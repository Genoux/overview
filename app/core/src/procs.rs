//! Which app runs each live session, so "focus" can bring that window forward and "close" can end an idle agent.
//!
//! Claude Code writes `~/.claude/sessions/<pid>.json` for every running CLI (session id, pid, a live busy/idle status).
//! The process tree from `ps` then leads from that pid up to the app that hosts its terminal (Orca, Ghostty, Herdr,
//! Terminal, iTerm, VS Code, tmux over ssh, ...). Only the `.json` files are read: the `.key` files beside them are secrets.
//! The same parsing runs on text gathered from a remote machine over ssh (see `remote.rs`).
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Run {
    pub pid: u32,
    /// The terminal device (ttys019, pts/3).
    pub tty: String,
    /// The app hosting the terminal, as people name it ("Orca", "Ghostty", "tmux").
    pub app: String,
    /// Unix time the agent started.
    pub started: u64,
    /// The agent says it is working right now.
    pub busy: bool,
}

pub struct Proc {
    pub ppid: u32,
    pub tty: String,
    pub comm: String,
}

/// `ps axo pid=,ppid=,tty=,comm=` output (macOS and Linux) into pid -> process.
pub fn parse_ps(text: &str) -> HashMap<u32, Proc> {
    let mut out = HashMap::new();
    for line in text.lines() {
        let mut it = line.split_whitespace();
        let (Some(pid), Some(ppid), Some(tty)) = (it.next(), it.next(), it.next()) else { continue };
        let comm: Vec<&str> = it.collect();
        let (Ok(pid), Ok(ppid)) = (pid.parse(), ppid.parse()) else { continue };
        let comm = comm.join(" ");
        let base = comm.rsplit('/').next().unwrap_or(&comm).to_string();
        out.insert(pid, Proc { ppid, tty: tty.to_string(), comm: base });
    }
    out
}

/// Known hosts of a terminal, by the start of their process name (lowercase). GUI apps win over multiplexers and sshd.
const APPS: &[(&str, &str)] = &[
    ("orca", "Orca"), ("ghostty", "Ghostty"), ("herdr", "Herdr"), ("terminal", "Terminal"), ("iterm", "iTerm"),
    ("code", "VS Code"), ("cursor", "Cursor"), ("wezterm", "WezTerm"), ("kitty", "kitty"), ("alacritty", "Alacritty"),
    ("warp", "Warp"), ("zed", "Zed"), ("windsurf", "Windsurf"), ("konsole", "Konsole"), ("gnome-terminal", "GNOME Terminal"),
];
const FALLBACKS: &[(&str, &str)] = &[("tmux", "tmux"), ("screen", "screen"), ("sshd", "ssh"), ("zellij", "zellij")];

/// The app hosting a process: the nearest ancestor that is a known app; else a multiplexer or sshd; else "a terminal".
pub fn app_of(pid: u32, procs: &HashMap<u32, Proc>) -> String {
    let mut fallback: Option<&str> = None;
    let mut p = pid;
    for _ in 0..40 {
        let Some(pr) = procs.get(&p) else { break };
        let name = pr.comm.to_lowercase();
        if let Some((_, app)) = APPS.iter().find(|(k, _)| name.starts_with(k)) { return app.to_string(); }
        if fallback.is_none() { if let Some((_, f)) = FALLBACKS.iter().find(|(k, _)| name.starts_with(k)) { fallback = Some(f); } }
        if pr.ppid <= 1 || pr.ppid == p { break; }
        p = pr.ppid;
    }
    fallback.unwrap_or("a terminal").to_string()
}

/// Session id -> how it runs, from the pid files' text and `ps` output. A pid file whose process is gone is ignored.
pub fn from_parts(pid_files: &[String], ps: &str) -> HashMap<String, Run> { from_parts_with(pid_files, ps, &HashMap::new()) }

/// The same, with executable paths for processes whose name says nothing (Linux names Orca's remote runtime "MainThread").
pub fn from_parts_with(pid_files: &[String], ps: &str, exe: &HashMap<u32, String>) -> HashMap<String, Run> {
    let mut procs = parse_ps(ps);
    for (pid, path) in exe {
        let p = path.to_lowercase();
        let named = if p.contains("orca") { "orca" } else if p.contains("herdr") { "herdr" } else if p.contains("vscode-server") || p.contains("code-server") { "code" } else { continue };
        if let Some(pr) = procs.get_mut(pid) { pr.comm = named.to_string(); }
    }
    let mut out = HashMap::new();
    for text in pid_files {
        let Ok(v) = serde_json::from_str::<Value>(text) else { continue };
        let (Some(id), Some(pid)) = (v["sessionId"].as_str(), v["pid"].as_u64()) else { continue };
        let pid = pid as u32;
        let Some(pr) = procs.get(&pid) else { continue };
        // the pid must still be an agent (a recycled pid is someone else's process)
        if !pr.comm.to_lowercase().contains("claude") && !pr.comm.to_lowercase().contains("node") { continue; }
        out.insert(id.to_string(), Run {
            pid,
            tty: pr.tty.clone(),
            app: app_of(pid, &procs),
            started: v["startedAt"].as_u64().map(|ms| ms / 1000).unwrap_or(0),
            busy: v["status"].as_str() == Some("busy"),
        });
    }
    out
}

/// This machine's live sessions.
pub fn local(home: &Path) -> HashMap<String, Run> {
    let mut files = vec![];
    if let Ok(dir) = std::fs::read_dir(home.join(".claude/sessions")) {
        for e in dir.flatten() {
            let p = e.path();
            if p.extension().map(|x| x == "json").unwrap_or(false) {
                if let Ok(t) = std::fs::read_to_string(&p) { files.push(t); }
            }
        }
    }
    if files.is_empty() { return HashMap::new(); }
    let ps = std::process::Command::new("ps").args(["axo", "pid=,ppid=,tty=,comm="]).output().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
    from_parts(&files, &ps)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn finds_the_app_above_the_shell() {
        let ps = "  1     0 ??       launchd\n 100     1 ??       /Applications/Orca.app/Contents/Frameworks/Orca Helper.app/Contents/MacOS/Orca Helper\n 200   100 ttys019  login\n 300   200 ttys019  -zsh\n 400   300 ttys019  claude\n 500     1 ??       tmux\n 600   500 pts/3    bash\n 700   600 pts/3    claude\n 800   700 pts/3    claude\n";
        let files = vec![r#"{"pid":400,"sessionId":"s1","startedAt":1700000000000,"status":"busy"}"#.to_string(), r#"{"pid":700,"sessionId":"s2","status":"idle"}"#.to_string(), r#"{"pid":999,"sessionId":"gone"}"#.to_string()];
        let runs = from_parts(&files, ps);
        assert_eq!(runs["s1"], Run { pid: 400, tty: "ttys019".into(), app: "Orca".into(), started: 1_700_000_000, busy: true });
        assert_eq!(runs["s2"].app, "tmux");
        assert!(!runs.contains_key("gone"));
    }
}
