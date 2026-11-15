//! Codex: "rollout" JSONL files in `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
use crate::model::{clip, infer, project_of, Ask, Pending, Seen, Session};
use crate::tail::{first_lines, last_lines};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub fn files(home: &Path) -> Vec<PathBuf> {
    let mut out = vec![];
    let mut stack = vec![home.join(".codex/sessions")];
    while let Some(d) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&d) else {
            continue;
        };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.extension().map(|x| x == "jsonl").unwrap_or(false) {
                out.push(p);
            }
        }
    }
    out
}

fn text_of(content: &Value) -> Option<String> {
    let Value::Array(items) = content else {
        return None;
    };
    let t: Vec<&str> = items.iter().filter_map(|i| i["text"].as_str()).collect();
    if t.is_empty() {
        None
    } else {
        Some(t.join(" "))
    }
}

/// Whether the turn's approval policy can stop a command to ask the owner: "never" does not; the granular policy asks
/// only when sandbox escalations or rule prompts are turned on; the other named policies ("on-request", "untrusted"…) may.
fn policy_asks(policy: &Value) -> bool {
    match policy {
        Value::String(p) => p != "never",
        Value::Object(o) => o
            .get("granular")
            .map(|g| g["sandbox_approval"] == true || g["rules"] == true)
            .unwrap_or(true),
        _ => true,
    }
}

pub fn read(path: &Path, quiet: u64, updated: u64) -> Option<Session> {
    let (mut cwd, mut id, mut title) = (None::<String>, None::<String>, None::<String>);
    let mut root = None::<String>;
    for r in first_lines(path, 64 * 1024) {
        if r["type"] == "session_meta" {
            cwd = r["payload"]["cwd"].as_str().map(String::from);
            root = cwd.clone();
            id = r["payload"]["id"].as_str().map(String::from);
        }
        if title.is_none()
            && r["type"] == "response_item"
            && r["payload"]["type"] == "message"
            && r["payload"]["role"] == "user"
        {
            if let Some(t) = text_of(&r["payload"]["content"]) {
                if !t.trim_start().starts_with('<') {
                    title = Some(clip(&t, 80));
                }
            }
        }
    }
    let (mut last_prompt, mut last_reply) = (None::<String>, None::<String>);
    let mut seen = Seen::default();
    let mut pending: Vec<(String, Pending)> = vec![];
    let mut asks = true;
    for r in last_lines(path, 384 * 1024) {
        let p = &r["payload"];
        match (
            r["type"].as_str().unwrap_or(""),
            p["type"].as_str().unwrap_or(""),
        ) {
            ("turn_context", _) => {
                if let Some(c) = p["cwd"].as_str() {
                    cwd = Some(c.to_string());
                }
                if !p["approval_policy"].is_null() {
                    asks = policy_asks(&p["approval_policy"]);
                }
            }
            ("event_msg", "task_started") => {
                seen.in_turn = true;
                seen.final_reply = None;
                seen.api_error = false;
            }
            ("event_msg", "task_complete") => {
                seen.in_turn = false;
                pending.clear();
                if let Some(m) = p["last_agent_message"].as_str() {
                    last_reply = Some(clip(m, 400));
                }
                seen.final_reply = last_reply.clone();
            }
            ("event_msg", "error") | ("event_msg", "stream_error") => {
                seen.api_error = true;
                seen.in_turn = false;
            }
            ("response_item", "message") => {
                let t = text_of(&p["content"]);
                match p["role"].as_str() {
                    Some("user") => {
                        if let Some(t) = t {
                            if !t.trim_start().starts_with('<') {
                                last_prompt = Some(clip(&t, 400));
                            }
                        }
                    }
                    Some("assistant") => {
                        if let Some(t) = t {
                            last_reply = Some(clip(&t, 400));
                        }
                    }
                    _ => {}
                }
            }
            ("response_item", "function_call") | ("response_item", "custom_tool_call") => {
                let name = p["name"].as_str().unwrap_or("tool");
                let args = p["arguments"]
                    .as_str()
                    .or_else(|| p["input"].as_str())
                    .unwrap_or("");
                let cmd = serde_json::from_str::<Value>(args).ok().and_then(|a| {
                    a["command"]
                        .as_array()
                        .map(|c| {
                            c.iter()
                                .filter_map(|x| x.as_str())
                                .collect::<Vec<_>>()
                                .join(" ")
                        })
                        .or_else(|| a["cmd"].as_str().map(String::from))
                });
                let what = match cmd {
                    Some(c) => format!("{}: {}", name, clip(&c, 80)),
                    None => name.to_string(),
                };
                let ask = if asks && name != "update_plan" {
                    Ask::Maybe
                } else {
                    Ask::Never
                };
                if let Some(cid) = p["call_id"].as_str() {
                    pending.push((cid.to_string(), Pending { what, ask }));
                }
            }
            ("response_item", "function_call_output")
            | ("response_item", "custom_tool_call_output") => {
                if let Some(cid) = p["call_id"].as_str() {
                    pending.retain(|(c, _)| c != cid);
                }
            }
            _ => {}
        }
    }
    seen.pending = pending.into_iter().map(|(_, p)| p).collect();
    let cwd = cwd?;
    let root = root.unwrap_or_else(|| cwd.clone());
    let (state, waiting_on) = infer(&seen, quiet);
    Some(Session {
        id: id.unwrap_or_else(|| {
            path.file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default()
        }),
        agent: "codex",
        project: project_of(&cwd, &root),
        cwd,
        root,
        branch: None,
        title: title.or_else(|| last_prompt.as_ref().map(|p| clip(p, 80))),
        state,
        quiet_secs: quiet,
        updated,
        last_prompt,
        last_reply,
        waiting_on,
        open_calls: None,
        path: path.to_string_lossy().to_string(),
        machine: "local".into(),
        run: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::State;
    #[test]
    fn a_completed_task_is_done_and_an_open_call_waits() {
        let p = std::env::temp_dir().join("ov-codex-test.jsonl");
        let meta = r#"{"type":"session_meta","payload":{"id":"c1","cwd":"/w/flow"}}"#;
        let user = r#"{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"Keyboard map"}]}}"#;
        std::fs::write(&p, [meta, user, r#"{"type":"event_msg","payload":{"type":"task_started"}}"#, r#"{"type":"event_msg","payload":{"type":"task_complete","last_agent_message":"Done: 14 of 20 shortcuts."}}"#].join("\n") + "\n").unwrap();
        let s = read(&p, 30, 0).unwrap();
        assert_eq!(
            (s.state, s.project.as_str(), s.title.as_deref()),
            (State::Done, "flow", Some("Keyboard map"))
        );
        std::fs::write(&p, [meta, user, r#"{"type":"event_msg","payload":{"type":"task_started"}}"#, r#"{"type":"response_item","payload":{"type":"function_call","name":"shell","call_id":"k1","arguments":"{\"command\":[\"pnpm\",\"test\"]}"}}"#].join("\n") + "\n").unwrap();
        let s = read(&p, 60, 0).unwrap();
        assert_eq!(
            (s.state, s.waiting_on.as_deref()),
            (State::Wait, Some("shell: pnpm test"))
        );
        // a policy that never asks for commands: the same open call is just a long command
        let ctx = r#"{"type":"turn_context","payload":{"cwd":"/w/flow","approval_policy":{"granular":{"sandbox_approval":false,"rules":false,"request_permissions":true}}}}"#;
        std::fs::write(&p, [meta, user, ctx, r#"{"type":"event_msg","payload":{"type":"task_started"}}"#, r#"{"type":"response_item","payload":{"type":"function_call","name":"shell","call_id":"k1","arguments":"{\"command\":[\"pnpm\",\"test\"]}"}}"#].join("\n") + "\n").unwrap();
        assert_eq!(read(&p, 300, 0).unwrap().state, State::Run);
    }
}
