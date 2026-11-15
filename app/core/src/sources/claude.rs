//! Claude Code: one JSONL file per session in `~/.claude/projects/<folder>/<session>.jsonl`.
use crate::model::{clip, infer, open_calls, project_of, Ask, Pending, Seen, Session};
use crate::tail::{first_lines, last_lines};
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub fn files(home: &Path) -> Vec<PathBuf> {
    let root = home.join(".claude/projects");
    let Ok(dirs) = std::fs::read_dir(root) else {
        return vec![];
    };
    let mut out = vec![];
    for d in dirs.flatten() {
        let Ok(fs) = std::fs::read_dir(d.path()) else {
            continue;
        };
        for f in fs.flatten() {
            let p = f.path();
            if p.extension().map(|e| e == "jsonl").unwrap_or(false) {
                out.push(p);
            }
        }
    }
    out
}

fn text_of(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => {
            let t: Vec<&str> = items
                .iter()
                .filter(|i| i["type"] == "text")
                .filter_map(|i| i["text"].as_str())
                .collect();
            if t.is_empty() {
                None
            } else {
                Some(t.join(" "))
            }
        }
        _ => None,
    }
}

fn describe_tool(item: &Value) -> String {
    let name = item["name"].as_str().unwrap_or("tool");
    let input = &item["input"];
    let detail = input["command"]
        .as_str()
        .or_else(|| input["file_path"].as_str())
        .or_else(|| input["url"].as_str())
        .or_else(|| input["pattern"].as_str());
    match detail {
        Some(d) => format!("{}: {}", name, clip(d, 80)),
        None => name.to_string(),
    }
}

/// Tools that never ask for approval, in any mode (reading, searching, planning, subagents, background shells).
const NEVER_ASKS: &[&str] = &[
    "Read",
    "Glob",
    "Grep",
    "LS",
    "NotebookRead",
    "TodoWrite",
    "TodoRead",
    "Task",
    "Agent",
    "ToolSearch",
    "TaskCreate",
    "TaskUpdate",
    "TaskList",
    "TaskGet",
    "TaskOutput",
    "TaskStop",
    "BashOutput",
    "KillShell",
    "Monitor",
    "ScheduleWakeup",
];
/// Tools that `acceptEdits` runs without asking.
const EDITS: &[&str] = &["Edit", "MultiEdit", "Write", "NotebookEdit"];

/// Whether a tool call can be waiting on the owner, given the session's permission mode.
fn ask_of(item: &Value, mode: &str) -> Ask {
    let name = item["name"].as_str().unwrap_or("");
    // a question or a plan is addressed to the owner whatever the mode
    if name == "AskUserQuestion" || name == "ExitPlanMode" {
        return Ask::Always;
    }
    // these modes never stop for approval ("auto" lets a classifier decide, "dontAsk" refuses instead of asking)
    if matches!(mode, "bypassPermissions" | "auto" | "dontAsk") {
        return Ask::Never;
    }
    if NEVER_ASKS.contains(&name)
        || item["input"]["run_in_background"] == true
        || (mode == "acceptEdits" && EDITS.contains(&name))
    {
        return Ask::Never;
    }
    Ask::Maybe
}

/// What the owner is asked: the question itself, or "approve the plan".
fn what_of(item: &Value) -> String {
    match item["name"].as_str() {
        Some("AskUserQuestion") => item["input"]["questions"][0]["question"]
            .as_str()
            .map(|q| clip(q, 160))
            .unwrap_or_else(|| "A question for you".into()),
        Some("ExitPlanMode") => "Approve the plan?".into(),
        _ => describe_tool(item),
    }
}

/// Reads one session file. `quiet` is the seconds since it last changed; `updated` its unix time.
const TAIL: u64 = 384 * 1024;

pub fn read(path: &Path, quiet: u64, updated: u64) -> Option<Session> {
    let tail = last_lines(path, TAIL);
    if tail.is_empty() {
        return None;
    }
    let (mut cwd, mut branch, mut title, mut id) = (
        None::<String>,
        None::<String>,
        None::<String>,
        None::<String>,
    );
    let (mut last_prompt, mut last_reply) = (None::<String>, None::<String>);
    let mut seen = Seen::default();
    let mut pending: Vec<(String, Pending)> = vec![];
    let mut mode = String::from("default");
    let mut root = None::<String>;
    for r in &tail {
        if let Some(c) = r["cwd"].as_str() {
            root.get_or_insert_with(|| c.to_string());
            cwd = Some(c.to_string());
        }
        if let Some(b) = r["gitBranch"].as_str() {
            if !b.is_empty() {
                branch = Some(b.to_string());
            }
        }
        if let Some(s) = r["sessionId"].as_str() {
            id = Some(s.to_string());
        }
        match r["type"].as_str().unwrap_or("") {
            "ai-title" => {
                if let Some(t) = r["aiTitle"].as_str().or_else(|| r["title"].as_str()) {
                    title = Some(t.to_string());
                }
            }
            "permission-mode" => {
                if let Some(m) = r["permissionMode"].as_str() {
                    mode = m.to_string();
                }
            }
            "user" => {
                if r["isMeta"].as_bool() == Some(true) {
                    continue;
                }
                let content = &r["message"]["content"];
                if let Value::Array(items) = content {
                    let done: HashSet<&str> = items
                        .iter()
                        .filter(|i| i["type"] == "tool_result")
                        .filter_map(|i| i["tool_use_id"].as_str())
                        .collect();
                    if !done.is_empty() {
                        pending.retain(|(id, _)| !done.contains(id.as_str()));
                        seen.in_turn = true;
                    }
                }
                if let Some(t) = text_of(content) {
                    if !t.starts_with('<') && !t.starts_with("[Request interrupted") {
                        last_prompt = Some(clip(&t, 400));
                        seen.in_turn = true;
                        seen.final_reply = None;
                        seen.api_error = false;
                    } else if t.starts_with("[Request interrupted") {
                        seen.in_turn = false;
                        pending.clear();
                    }
                }
            }
            "assistant" => {
                let m = &r["message"];
                if r["isApiErrorMessage"].as_bool() == Some(true) {
                    seen.api_error = true;
                    seen.in_turn = false;
                    continue;
                }
                if let Value::Array(items) = &m["content"] {
                    for i in items.iter().filter(|i| i["type"] == "tool_use") {
                        if let Some(tid) = i["id"].as_str() {
                            pending.push((
                                tid.to_string(),
                                Pending {
                                    what: what_of(i),
                                    ask: ask_of(i, &mode),
                                },
                            ));
                        }
                    }
                }
                if let Some(t) = text_of(&m["content"]) {
                    last_reply = Some(clip(&t, 400));
                }
                if m["stop_reason"].as_str() == Some("end_turn") && pending.is_empty() {
                    seen.in_turn = false;
                    seen.final_reply = last_reply.clone();
                } else {
                    seen.in_turn = true;
                }
            }
            _ => {}
        }
    }
    // the working folder and a first prompt are written early; look at the start if the tail had none
    // a long session's tail no longer holds its start, so the folder it started in is read there too
    let cut = std::fs::metadata(path).is_ok_and(|m| m.len() > TAIL);
    if cut || cwd.is_none() || (title.is_none() && last_prompt.is_none()) {
        let head = first_lines(path, 128 * 1024);
        if let Some(c) = head.iter().find_map(|r| r["cwd"].as_str()) {
            if cut || root.is_none() {
                root = Some(c.to_string());
            }
            cwd.get_or_insert_with(|| c.to_string());
        }
        for r in head {
            if title.is_none() && r["type"] == "user" && r["isMeta"].as_bool() != Some(true) {
                if let Some(t) = text_of(&r["message"]["content"]) {
                    if !t.starts_with('<') {
                        title = Some(clip(&t, 80));
                    }
                }
            }
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
        agent: "claude",
        project: project_of(&cwd, &root),
        cwd,
        root,
        branch,
        title: title.or_else(|| last_prompt.as_ref().map(|p| clip(p, 80))),
        state,
        quiet_secs: quiet,
        updated,
        last_prompt,
        last_reply,
        waiting_on,
        open_calls: open_calls(&seen.pending),
        path: path.to_string_lossy().to_string(),
        machine: "local".into(),
        run: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::State;
    fn write(lines: &[&str]) -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "ov-claude-{}.jsonl",
            lines.len() * 7919 + lines.iter().map(|l| l.len()).sum::<usize>()
        ));
        std::fs::write(&p, lines.join("\n") + "\n").unwrap();
        p
    }
    #[test]
    fn a_session_that_moved_keeps_the_folder_it_started_in() {
        let moved = write(&[
            r#"{"type":"user","cwd":"/w/gramly","sessionId":"s9","message":{"role":"user","content":"Tidy the notes"}}"#,
            r#"{"type":"assistant","cwd":"/w/gramly/notes/2026","message":{"stop_reason":"end_turn","content":[{"type":"text","text":"Tidied."}]}}"#,
        ]);
        let s = read(&moved, 60, 0).unwrap();
        assert_eq!(
            (s.root.as_str(), s.cwd.as_str(), s.project.as_str()),
            ("/w/gramly", "/w/gramly/notes/2026", "gramly")
        );
    }
    #[test]
    fn a_long_session_still_knows_the_folder_it_started_in() {
        let filler = format!(
            r#"{{"type":"assistant","cwd":"/w/gramly/notes","message":{{"content":[{{"type":"text","text":"{}"}}]}}}}"#,
            "x".repeat(4096)
        );
        let mut lines = vec![
            r#"{"type":"user","cwd":"/w/gramly","sessionId":"s8","message":{"role":"user","content":"Tidy the notes"}}"#,
        ];
        lines.extend(std::iter::repeat_n(filler.as_str(), 120));
        let long = write(&lines);
        assert!(std::fs::metadata(&long).unwrap().len() > TAIL);
        let s = read(&long, 60, 0).unwrap();
        assert_eq!(
            (s.root.as_str(), s.cwd.as_str()),
            ("/w/gramly", "/w/gramly/notes")
        );
    }
    #[test]
    fn a_turn_that_ended_is_done_and_a_pending_command_waits() {
        let base = r#"{"type":"user","cwd":"/w/gramly","gitBranch":"main","sessionId":"s1","message":{"role":"user","content":"Fix sync conflict"}}"#;
        let done = write(&[
            base,
            r#"{"type":"assistant","message":{"stop_reason":"end_turn","content":[{"type":"text","text":"Fixed, 3 files changed."}]}}"#,
        ]);
        let s = read(&done, 60, 0).unwrap();
        assert_eq!(
            (s.state, s.project.as_str(), s.branch.as_deref()),
            (State::Done, "gramly", Some("main"))
        );
        let wait = write(&[
            base,
            r#"{"type":"assistant","message":{"stop_reason":"tool_use","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"pnpm db:migrate"}}]}}"#,
        ]);
        let s = read(&wait, 90, 0).unwrap();
        assert_eq!(
            (s.state, s.waiting_on.as_deref()),
            (State::Wait, Some("Bash: pnpm db:migrate"))
        );
        let ran = write(&[
            base,
            r#"{"type":"assistant","message":{"stop_reason":"tool_use","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"ls"}}]}}"#,
            r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"ok"}]}}"#,
        ]);
        assert_eq!(read(&ran, 5, 0).unwrap().state, State::Run);
        let q = write(&[
            base,
            r#"{"type":"assistant","message":{"stop_reason":"end_turn","content":[{"type":"text","text":"Electron or Tauri?"}]}}"#,
        ]);
        assert_eq!(read(&q, 60, 0).unwrap().state, State::Wait);
    }
    #[test]
    fn a_long_command_in_auto_mode_runs_and_a_question_waits() {
        let base = r#"{"type":"user","cwd":"/w/gramly","sessionId":"s2","message":{"role":"user","content":"Run the build"}}"#;
        let auto = r#"{"type":"permission-mode","permissionMode":"auto"}"#;
        let build = write(&[
            auto,
            base,
            r#"{"type":"assistant","message":{"stop_reason":"tool_use","content":[{"type":"tool_use","id":"b1","name":"Bash","input":{"command":"cargo build --release"}}]}}"#,
        ]);
        assert_eq!(read(&build, 300, 0).unwrap().state, State::Run);
        let ask = write(&[
            auto,
            base,
            r#"{"type":"assistant","message":{"stop_reason":"tool_use","content":[{"type":"tool_use","id":"q1","name":"AskUserQuestion","input":{"questions":[{"question":"Which database, Postgres or SQLite?"}]}}]}}"#,
        ]);
        let s = read(&ask, 2, 0).unwrap();
        assert_eq!(
            (s.state, s.waiting_on.as_deref()),
            (State::Wait, Some("Which database, Postgres or SQLite?"))
        );
        let edit = write(&[
            r#"{"type":"permission-mode","permissionMode":"acceptEdits"}"#,
            base,
            r#"{"type":"assistant","message":{"stop_reason":"tool_use","content":[{"type":"tool_use","id":"e1","name":"Write","input":{"file_path":"/w/a.rs"}}]}}"#,
        ]);
        assert_eq!(read(&edit, 90, 0).unwrap().state, State::Run);
    }
}
