//! Overview core: finds the coding-agent sessions on this machine and reads them into one normalized shape.
//! Read-only by design: it never writes to an agent's files, never sends keystrokes, and never opens credential files.
pub mod model;
pub mod procs;
pub mod remote;
pub mod sources;
pub mod summary;
pub mod tail;

use model::Session;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Sessions untouched for longer than this are not listed at all.
pub const RECENT_DAYS: u64 = 7;

type Reader = fn(&Path, u64, u64) -> Option<Session>;

/// Every recent session of every supported agent under `home`, most recently active first.
pub fn scan(home: &Path) -> Vec<Session> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let groups: [(Vec<PathBuf>, Reader); 2] = [
        (sources::claude::files(home), sources::claude::read),
        (sources::codex::files(home), sources::codex::read),
    ];
    let mut out = vec![];
    for (files, read) in groups {
        for f in files {
            let Ok(meta) = std::fs::metadata(&f) else {
                continue;
            };
            let updated = meta
                .modified()
                .ok()
                .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let quiet = now.saturating_sub(updated);
            if quiet > RECENT_DAYS * 86400 {
                continue;
            }
            if let Some(s) = read(&f, quiet, updated) {
                out.push(s);
            }
        }
    }
    attach_runs(&mut out, &procs::local(home));
    out.sort_by_key(|s| s.quiet_secs);
    out
}

/// Gives each session its live process, if any, and lets what that process reports settle the state.
pub fn attach_runs(sessions: &mut [Session], runs: &std::collections::HashMap<String, procs::Run>) {
    for s in sessions.iter_mut() {
        s.run = runs.get(&s.id).cloned();
        settle(s);
    }
}

/// The agent's own word wins over the transcript. Guessing approvals from the transcript was wrong both ways:
/// replayed over 30 days of the owner's sessions (2026-11-10, 17,143 tool calls scored against the approval
/// decision the agent stamps on each result), it raised 6 alerts, 5 of them false, and missed 197 prompts that
/// stayed up 30 seconds or more, because hooks and automatic approval modes ask in modes that "never ask".
/// No agent is named here: a reader opts in by filling `open_calls`, and a live process by reporting a prompt.
fn settle(s: &mut Session) {
    use model::State;
    let busy = s.run.as_ref().is_some_and(|r| r.busy);
    let guessed = s.state == State::Wait && s.open_calls.is_some();
    if let Some(prompt) = s.run.as_ref().and_then(|r| r.waiting_for.clone()) {
        // a prompt is on screen: say what it is about when the transcript knows
        let asked = s.waiting_on.take().filter(|_| s.state == State::Wait);
        s.waiting_on = asked.or_else(|| s.open_calls.clone()).or(Some(prompt));
        s.state = State::Wait;
    } else if guessed || (busy && matches!(s.state, State::Done | State::Idle)) {
        // no prompt on screen: an open call is running, or was left behind by an agent that stopped
        s.state = if busy { State::Run } else { State::Done };
        s.waiting_on = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use model::State;
    use procs::Run;

    fn session(state: State, waiting_on: Option<&str>, open_calls: Option<&str>) -> Session {
        Session {
            id: "s1".into(),
            agent: "agent",
            cwd: "/w/gramly".into(),
            project: "gramly".into(),
            branch: None,
            title: None,
            state,
            quiet_secs: 90,
            updated: 0,
            last_prompt: None,
            last_reply: None,
            waiting_on: waiting_on.map(str::to_string),
            open_calls: open_calls.map(str::to_string),
            path: String::new(),
            machine: "local".into(),
            run: None,
        }
    }
    fn settled(session: Session, run: Option<Run>) -> (State, Option<String>) {
        let mut sessions = [session];
        let runs = run.map(|r| ("s1".to_string(), r)).into_iter().collect();
        attach_runs(&mut sessions, &runs);
        (sessions[0].state, sessions[0].waiting_on.clone())
    }
    fn run(busy: bool, waiting_for: Option<&str>) -> Run {
        Run {
            pid: 1,
            tty: "pts/1".into(),
            app: "a terminal".into(),
            bundle: None,
            started: 0,
            busy,
            waiting_for: waiting_for.map(str::to_string),
        }
    }
    const CALL: &str = "Bash: pnpm deploy";
    const QUESTION: &str = "Electron or Tauri?";

    #[test]
    fn a_prompt_on_screen_needs_you_whatever_the_mode() {
        // the reader saw a mode that "never asks" and said running, yet a prompt is up
        assert_eq!(
            settled(
                session(State::Run, None, Some(CALL)),
                Some(run(false, Some("approve Bash")))
            ),
            (State::Wait, Some(CALL.into()))
        );
        // nothing in the transcript to name: the agent's own words
        assert_eq!(
            settled(
                session(State::Run, None, None),
                Some(run(false, Some("dialog open")))
            ),
            (State::Wait, Some("dialog open".into()))
        );
    }
    #[test]
    fn a_slow_command_with_no_prompt_is_not_an_alert() {
        let guessed = || session(State::Wait, Some(CALL), Some(CALL));
        assert_eq!(
            settled(guessed(), Some(run(true, None))),
            (State::Run, None)
        );
        // the agent is gone: nothing can be asking
        assert_eq!(settled(guessed(), None), (State::Done, None));
    }
    #[test]
    fn a_question_in_the_reply_still_waits() {
        let asked = || session(State::Wait, Some(QUESTION), None);
        assert_eq!(settled(asked(), None), (State::Wait, Some(QUESTION.into())));
        assert_eq!(
            settled(asked(), Some(run(false, None))),
            (State::Wait, Some(QUESTION.into()))
        );
    }
    #[test]
    fn a_reader_that_leaves_open_calls_empty_keeps_its_own_guess() {
        assert_eq!(
            settled(session(State::Wait, Some(CALL), None), None),
            (State::Wait, Some(CALL.into()))
        );
    }
}
