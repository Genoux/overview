//! The normalized session every reader produces, and the rules that turn what a reader saw into a state.
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum State {
    /// A turn is in progress.
    Run,
    /// The agent needs the user: a tool call waits for approval, or the turn ended on a question.
    Wait,
    /// The last turn ended normally.
    Done,
    /// The last turn ended on an API error.
    Err,
    /// Quiet for a day or more.
    Idle,
}

#[derive(Debug, Clone, Serialize)]
pub struct Session {
    pub id: String,
    /// "claude", "codex", ...
    pub agent: &'static str,
    /// The working folder the agent ran in.
    pub cwd: String,
    /// The folder's last path segment: the project, as the map shows it.
    pub project: String,
    pub branch: Option<String>,
    pub title: Option<String>,
    pub state: State,
    /// Seconds since the session file last changed.
    pub quiet_secs: u64,
    /// Unix time of the last change.
    pub updated: u64,
    pub last_prompt: Option<String>,
    pub last_reply: Option<String>,
    /// What a waiting session waits on: a command, a file, or the question it asked.
    pub waiting_on: Option<String>,
    /// The file this was read from (for the summarizer and for "open").
    pub path: String,
}

/// What a reader saw at the end of a session file; `infer` turns it into a state.
#[derive(Debug, Default, Clone)]
pub struct Seen {
    /// A turn started and has not ended (a prompt or a tool result came last, or a tool call is pending).
    pub in_turn: bool,
    /// Tool calls with no result yet, as short descriptions (e.g. "Bash: pnpm test").
    pub pending: Vec<String>,
    /// The agent runs tools without asking (so a pending call is just running, never awaiting approval).
    pub auto_approve: bool,
    /// The last turn ended on an API error.
    pub api_error: bool,
    /// The last reply, if the turn ended on it.
    pub final_reply: Option<String>,
}

pub const ACTIVE_SECS: u64 = 120; // a turn quiet for longer than this, with nothing pending, has stopped
pub const APPROVAL_SECS: u64 = 30; // a tool call pending this long is probably waiting for approval
pub const ASLEEP_SECS: u64 = 24 * 3600;

pub fn infer(seen: &Seen, quiet: u64) -> (State, Option<String>) {
    if quiet >= ASLEEP_SECS {
        return (State::Idle, None);
    }
    if seen.api_error {
        return (State::Err, None);
    }
    if !seen.pending.is_empty() {
        if quiet >= APPROVAL_SECS && !seen.auto_approve {
            return (State::Wait, Some(seen.pending.join(", ")));
        }
        return (State::Run, None);
    }
    if seen.in_turn {
        return if quiet < ACTIVE_SECS { (State::Run, None) } else { (State::Done, None) };
    }
    match &seen.final_reply {
        Some(r) if r.trim_end().ends_with('?') => (State::Wait, Some(clip(r, 160))),
        _ => (State::Done, None),
    }
}

/// Shortens text to `n` characters on a character boundary, collapsing whitespace.
pub fn clip(t: &str, n: usize) -> String {
    let flat: String = t.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() <= n {
        return flat;
    }
    let mut out: String = flat.chars().take(n.saturating_sub(1)).collect();
    out.push('…');
    out
}

/// The project a working folder belongs to: the top folder of its git repository (a session that `cd`s into a
/// subfolder stays on its project), or the folder's own name outside a repository.
pub fn project_of(cwd: &str) -> String {
    let mut p = std::path::Path::new(cwd);
    loop {
        if p.join(".git").exists() {
            return name_of(&p.to_string_lossy());
        }
        match p.parent() { Some(up) if up.as_os_str().len() > 1 => p = up, _ => return name_of(cwd) }
    }
}
fn name_of(path: &str) -> String {
    path.trim_end_matches('/').rsplit('/').next().unwrap_or(path).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn states() {
        let mut s = Seen::default();
        s.final_reply = Some("All done, tests pass.".into());
        assert_eq!(infer(&s, 10).0, State::Done);
        s.final_reply = Some("Electron or Tauri for P0?".into());
        assert_eq!(infer(&s, 10).0, State::Wait);
        assert_eq!(infer(&s, ASLEEP_SECS).0, State::Idle);
        let mut p = Seen { in_turn: true, pending: vec!["Bash: pnpm db:migrate".into()], ..Default::default() };
        assert_eq!(infer(&p, 5).0, State::Run);
        assert_eq!(infer(&p, 45), (State::Wait, Some("Bash: pnpm db:migrate".into())));
        p.auto_approve = true;
        assert_eq!(infer(&p, 45).0, State::Run);
        let t = Seen { in_turn: true, ..Default::default() };
        assert_eq!(infer(&t, 20).0, State::Run);
        assert_eq!(infer(&t, 600).0, State::Done);
        let e = Seen { api_error: true, ..Default::default() };
        assert_eq!(infer(&e, 20).0, State::Err);
    }
    #[test]
    fn clipping() {
        assert_eq!(clip("a  b\n c", 10), "a b c");
        assert_eq!(clip("abcdefghij", 5), "abcd…");
        assert_eq!(project_of("/nonexistent/x/code/gramly/"), "gramly");
    }
}
