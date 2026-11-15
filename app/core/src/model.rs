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
    /// The folder the agent works in now: it moves when the agent changes folder.
    pub cwd: String,
    /// The folder the session started in. The agent files the session under it, so resuming happens there.
    pub root: String,
    /// The project, as the map shows it: see `project_of`.
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
    /// Tool calls with no result yet that may need an approval, described. The file cannot say whether a prompt is
    /// on screen, so a reader fills this only when its agent's live process reports one (`Run::waiting_for`):
    /// `settle` then trusts the process over the reader's guess. Left empty, the guess stands.
    #[serde(skip)]
    pub open_calls: Option<String>,
    /// The file this was read from (for the summarizer and for "open"); for a remote session, its local cached copy.
    pub path: String,
    /// "local", or the ssh alias of the machine it runs on.
    pub machine: String,
    /// How it runs right now (pid, terminal, host app), when an agent process has it open.
    pub run: Option<crate::procs::Run>,
}

/// Whether a tool call with no result yet can be waiting on the owner. Each reader decides from the agent's own
/// permission mode and the tool: the session files never record that an approval prompt is on screen.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ask {
    /// It never asks (read-only tools, or a mode that runs everything): a long call is just running.
    Never,
    /// It may need an approval: past `APPROVAL_SECS` without a result, it probably does.
    Maybe,
    /// It is a question to the owner (a multiple-choice question, a plan to approve): waiting from the start.
    Always,
}

/// A tool call with no result yet.
#[derive(Debug, Clone)]
pub struct Pending {
    /// A short description (e.g. "Bash: pnpm test"), or the question itself for `Ask::Always`.
    pub what: String,
    pub ask: Ask,
}

/// What a reader saw at the end of a session file; `infer` turns it into a state.
#[derive(Debug, Default, Clone)]
pub struct Seen {
    /// A turn started and has not ended (a prompt or a tool result came last, or a tool call is pending).
    pub in_turn: bool,
    /// Tool calls with no result yet.
    pub pending: Vec<Pending>,
    /// The last turn ended on an API error.
    pub api_error: bool,
    /// The last reply, if the turn ended on it.
    pub final_reply: Option<String>,
}

pub const ACTIVE_SECS: u64 = 120; // a turn quiet for longer than this, with nothing pending, has stopped
pub const APPROVAL_SECS: u64 = 30; // a tool call pending this long is probably waiting for approval
pub const STALL_SECS: u64 = 30 * 60; // a call that never asks, with no result for this long: the agent stopped mid-call
pub const ASLEEP_SECS: u64 = 24 * 3600;

pub fn infer(seen: &Seen, quiet: u64) -> (State, Option<String>) {
    if quiet >= ASLEEP_SECS {
        return (State::Idle, None);
    }
    if seen.api_error {
        return (State::Err, None);
    }
    let asking: Vec<&str> = seen
        .pending
        .iter()
        .filter(|p| p.ask == Ask::Always || (p.ask == Ask::Maybe && quiet >= APPROVAL_SECS))
        .map(|p| p.what.as_str())
        .collect();
    if !asking.is_empty() {
        return (State::Wait, Some(asking.join(", ")));
    }
    if !seen.pending.is_empty() {
        return if quiet < STALL_SECS {
            (State::Run, None)
        } else {
            (State::Done, None)
        };
    }
    if seen.in_turn {
        return if quiet < ACTIVE_SECS {
            (State::Run, None)
        } else {
            (State::Done, None)
        };
    }
    match &seen.final_reply {
        Some(r) if r.trim_end().ends_with('?') => (State::Wait, Some(clip(r, 160))),
        _ => (State::Done, None),
    }
}

/// The open calls a reader hands to `Session::open_calls`: none when a question to the owner is among them.
pub fn open_calls(pending: &[Pending]) -> Option<String> {
    if pending.is_empty() || pending.iter().any(|p| p.ask == Ask::Always) {
        return None;
    }
    let what: Vec<&str> = pending.iter().map(|p| p.what.as_str()).collect();
    Some(what.join(", "))
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

/// The project a session belongs to: the repository it works in, else the repository it started in, else the
/// folder it started in. A home folder is "~": its own name is the owner's, which says nothing.
pub fn project_of(cwd: &str, root: &str) -> String {
    let folder = repository_of(cwd)
        .or_else(|| repository_of(root))
        .unwrap_or_else(|| root.to_string());
    if is_home(&folder) {
        "~".into()
    } else {
        name_of(&folder)
    }
}
fn repository_of(folder: &str) -> Option<String> {
    std::path::Path::new(folder)
        .ancestors()
        .find(|p| p.join(".git").exists())
        .map(|p| p.to_string_lossy().into_owned())
}
fn is_home(folder: &str) -> bool {
    let parts: Vec<&str> = folder.split('/').filter(|part| !part.is_empty()).collect();
    matches!(parts.as_slice(), ["home" | "Users", _])
}
fn name_of(path: &str) -> String {
    path.trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn states() {
        let mut s = Seen {
            final_reply: Some("All done, tests pass.".into()),
            ..Default::default()
        };
        assert_eq!(infer(&s, 10).0, State::Done);
        s.final_reply = Some("Electron or Tauri for P0?".into());
        assert_eq!(infer(&s, 10).0, State::Wait);
        assert_eq!(infer(&s, ASLEEP_SECS).0, State::Idle);
        let call = |ask| Seen {
            in_turn: true,
            pending: vec![Pending {
                what: "Bash: pnpm db:migrate".into(),
                ask,
            }],
            ..Default::default()
        };
        assert_eq!(infer(&call(Ask::Maybe), 5).0, State::Run);
        assert_eq!(
            infer(&call(Ask::Maybe), 45),
            (State::Wait, Some("Bash: pnpm db:migrate".into()))
        );
        // a long build in a mode that never asks keeps running, until it has clearly stopped
        assert_eq!(infer(&call(Ask::Never), 600).0, State::Run);
        assert_eq!(infer(&call(Ask::Never), STALL_SECS).0, State::Done);
        // a question to the owner waits at once
        assert_eq!(infer(&call(Ask::Always), 1).0, State::Wait);
        let t = Seen {
            in_turn: true,
            ..Default::default()
        };
        assert_eq!(infer(&t, 20).0, State::Run);
        assert_eq!(infer(&t, 600).0, State::Done);
        let e = Seen {
            api_error: true,
            ..Default::default()
        };
        assert_eq!(infer(&e, 20).0, State::Err);
    }
    #[test]
    fn clipping() {
        assert_eq!(clip("a  b\n c", 10), "a b c");
        assert_eq!(clip("abcdefghij", 5), "abcd…");
        assert_eq!(
            project_of("/nonexistent/x/code/gramly/", "/nonexistent/x/code/gramly/"),
            "gramly"
        );
    }
    #[test]
    fn a_session_outside_a_repository_is_named_after_where_it_started() {
        assert_eq!(
            project_of("/nonexistent/x/gramly/.demo", "/nonexistent/x/gramly"),
            "gramly"
        );
        assert_eq!(project_of("/home/sam/.agent/memory", "/home/sam"), "~");
        assert_eq!(project_of("/Users/sam", "/Users/sam"), "~");
    }
}
