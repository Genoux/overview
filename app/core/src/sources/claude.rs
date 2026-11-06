//! Claude Code: one JSONL file per session in `~/.claude/projects/<folder>/<session>.jsonl`.
use crate::model::{clip, infer, project_of, Seen, Session};
use crate::tail::{first_lines, last_lines};
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub fn files(home: &Path) -> Vec<PathBuf> {
    let root = home.join(".claude/projects");
    let Ok(dirs) = std::fs::read_dir(root) else { return vec![] };
    let mut out = vec![];
    for d in dirs.flatten() {
        let Ok(fs) = std::fs::read_dir(d.path()) else { continue };
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
            let t: Vec<&str> = items.iter().filter(|i| i["type"] == "text").filter_map(|i| i["text"].as_str()).collect();
            if t.is_empty() { None } else { Some(t.join(" ")) }
        }
        _ => None,
    }
}

fn describe_tool(item: &Value) -> String {
    let name = item["name"].as_str().unwrap_or("tool");
    let input = &item["input"];
    let detail = input["command"].as_str().or_else(|| input["file_path"].as_str()).or_else(|| input["url"].as_str()).or_else(|| input["pattern"].as_str());
    match detail {
        Some(d) => format!("{}: {}", name, clip(d, 80)),
        None => name.to_string(),
    }
}

/// Reads one session file. `quiet` is the seconds since it last changed; `updated` its unix time.
pub fn read(path: &Path, quiet: u64, updated: u64) -> Option<Session> {
    let tail = last_lines(path, 384 * 1024);
    if tail.is_empty() {
        return None;
    }
    let (mut cwd, mut branch, mut title, mut id) = (None::<String>, None::<String>, None::<String>, None::<String>);
    let (mut last_prompt, mut last_reply) = (None::<String>, None::<String>);
    let mut seen = Seen::default();
    let mut pending: Vec<(String, String)> = vec![];
    for r in &tail {
        if let Some(c) = r["cwd"].as_str() { cwd = Some(c.to_string()); }
        if let Some(b) = r["gitBranch"].as_str() { if !b.is_empty() { branch = Some(b.to_string()); } }
        if let Some(s) = r["sessionId"].as_str() { id = Some(s.to_string()); }
        match r["type"].as_str().unwrap_or("") {
            "ai-title" => { if let Some(t) = r["aiTitle"].as_str().or_else(|| r["title"].as_str()) { title = Some(t.to_string()); } }
            "permission-mode" => { seen.auto_approve = r["permissionMode"].as_str() == Some("bypassPermissions"); }
            "user" => {
                if r["isMeta"].as_bool() == Some(true) { continue; }
                let content = &r["message"]["content"];
                if let Value::Array(items) = content {
                    let done: HashSet<&str> = items.iter().filter(|i| i["type"] == "tool_result").filter_map(|i| i["tool_use_id"].as_str()).collect();
                    if !done.is_empty() { pending.retain(|(id, _)| !done.contains(id.as_str())); seen.in_turn = true; }
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
                if r["isApiErrorMessage"].as_bool() == Some(true) { seen.api_error = true; seen.in_turn = false; continue; }
                if let Value::Array(items) = &m["content"] {
                    for i in items.iter().filter(|i| i["type"] == "tool_use") {
                        if let Some(tid) = i["id"].as_str() { pending.push((tid.to_string(), describe_tool(i))); }
                    }
                }
                if let Some(t) = text_of(&m["content"]) { last_reply = Some(clip(&t, 400)); }
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
    if cwd.is_none() || (title.is_none() && last_prompt.is_none()) {
        for r in first_lines(path, 128 * 1024) {
            if cwd.is_none() { if let Some(c) = r["cwd"].as_str() { cwd = Some(c.to_string()); } }
            if title.is_none() && r["type"] == "user" && r["isMeta"].as_bool() != Some(true) {
                if let Some(t) = text_of(&r["message"]["content"]) { if !t.starts_with('<') { title = Some(clip(&t, 80)); } }
            }
        }
    }
    seen.pending = pending.into_iter().map(|(_, d)| d).collect();
    let cwd = cwd?;
    let (state, waiting_on) = infer(&seen, quiet);
    Some(Session {
        id: id.unwrap_or_else(|| path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default()),
        agent: "claude",
        project: project_of(&cwd),
        cwd,
        branch,
        title: title.or_else(|| last_prompt.as_ref().map(|p| clip(p, 80))),
        state,
        quiet_secs: quiet,
        updated,
        last_prompt,
        last_reply,
        waiting_on,
        path: path.to_string_lossy().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::State;
    fn write(lines: &[&str]) -> PathBuf {
        let p = std::env::temp_dir().join(format!("ov-claude-{}.jsonl", lines.len() * 7919 + lines.iter().map(|l| l.len()).sum::<usize>()));
        std::fs::write(&p, lines.join("\n") + "\n").unwrap();
        p
    }
    #[test]
    fn a_turn_that_ended_is_done_and_a_pending_command_waits() {
        let base = r#"{"type":"user","cwd":"/w/gramly","gitBranch":"main","sessionId":"s1","message":{"role":"user","content":"Fix sync conflict"}}"#;
        let done = write(&[base, r#"{"type":"assistant","message":{"stop_reason":"end_turn","content":[{"type":"text","text":"Fixed, 3 files changed."}]}}"#]);
        let s = read(&done, 60, 0).unwrap();
        assert_eq!((s.state, s.project.as_str(), s.branch.as_deref()), (State::Done, "gramly", Some("main")));
        let wait = write(&[base, r#"{"type":"assistant","message":{"stop_reason":"tool_use","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"pnpm db:migrate"}}]}}"#]);
        let s = read(&wait, 90, 0).unwrap();
        assert_eq!((s.state, s.waiting_on.as_deref()), (State::Wait, Some("Bash: pnpm db:migrate")));
        let ran = write(&[base, r#"{"type":"assistant","message":{"stop_reason":"tool_use","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"ls"}}]}}"#, r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"ok"}]}}"#]);
        assert_eq!(read(&ran, 5, 0).unwrap().state, State::Run);
        let q = write(&[base, r#"{"type":"assistant","message":{"stop_reason":"end_turn","content":[{"type":"text","text":"Electron or Tauri?"}]}}"#]);
        assert_eq!(read(&q, 60, 0).unwrap().state, State::Wait);
    }
}
