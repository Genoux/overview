//! Which app runs each live session, so "go" can bring that window forward and "close" can end an idle agent.
//!
//! Claude Code writes `~/.claude/sessions/<pid>.json` for every running CLI (session id, pid, and a live status:
//! busy, idle, or waiting with what it waits for).
//! The process tree then leads from that pid up to whatever hosts its terminal. Nothing here knows any app by name:
//! - on macOS, the host is the nearest ancestor whose executable lives in an `.app` bundle; its name is the bundle's name
//!   and the bundle path is what "go" opens;
//! - elsewhere (Linux, a remote machine), it is the nearest ancestor that is not a shell, a wrapper or the agent itself,
//!   named by its process name, or, when that name says nothing (a runtime's "MainThread"), by the hidden folder its
//!   executable lives in (`~/.something/...` -> "something").
//!
//! Only the `.json` files are read: the `.key` files beside them are secrets. The same parsing runs on text gathered
//! from a remote machine over ssh (see `remote.rs`).
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Run {
    pub pid: u32,
    /// The terminal device (ttys019, pts/3).
    pub tty: String,
    /// The host's name, as derived from the process tree: an app bundle's name, "tmux", or a runtime's hidden folder.
    pub app: String,
    /// On macOS, the `.app` bundle to bring forward; none when the host is not an app (tmux, sshd, a remote machine).
    pub bundle: Option<String>,
    /// Unix time the agent started.
    pub started: u64,
    /// The agent says it is working right now.
    pub busy: bool,
    /// The agent says a prompt is on screen (an approval, a question, a dialog), in its own words.
    pub waiting_for: Option<String>,
}

pub struct Proc {
    pub ppid: u32,
    pub tty: String,
    /// The executable as `ps` reports it (a full path for most GUI apps on macOS).
    pub path: String,
}
impl Proc {
    fn name(&self) -> &str {
        self.path.rsplit('/').next().unwrap_or(&self.path)
    }
}

/// `ps axo pid=,ppid=,tty=,comm=` output (macOS and Linux) into pid -> process.
pub fn parse_ps(text: &str) -> HashMap<u32, Proc> {
    let mut out = HashMap::new();
    for line in text.lines() {
        let mut it = line.split_whitespace();
        let (Some(pid), Some(ppid), Some(tty)) = (it.next(), it.next(), it.next()) else {
            continue;
        };
        let path: Vec<&str> = it.collect();
        let (Ok(pid), Ok(ppid)) = (pid.parse(), ppid.parse()) else {
            continue;
        };
        out.insert(
            pid,
            Proc {
                ppid,
                tty: tty.to_string(),
                path: path.join(" "),
            },
        );
    }
    out
}

/// Processes that are never the host: shells, login and privilege wrappers, script runtimes, and the agents themselves.
const NOT_A_HOST: &[&str] = &[
    "sh", "bash", "zsh", "fish", "dash", "ksh", "tcsh", "csh", "nu", "elvish", "xonsh", "login",
    "sudo", "su", "doas", "env", "script", "nohup", "timeout", "claude", "codex", "node", "bun",
    "deno", "npm", "npx", "pnpm", "python", "python3",
];

fn skip(name: &str) -> bool {
    let n = name.trim_start_matches('-').to_lowercase();
    NOT_A_HOST.contains(&n.as_str()) || n.is_empty()
}

/// The outermost `.app` bundle in a path: "/Applications/Editor.app/Contents/Frameworks/Editor Helper.app/..." -> "/Applications/Editor.app".
fn bundle_of(path: &str) -> Option<String> {
    let i = path
        .find(".app/")
        .or_else(|| path.strip_suffix(".app").map(|p| p.len()))?;
    Some(path[..i + 4].to_string())
}

/// A name for a process whose own name says nothing: the hidden folder its executable lives in, if any.
fn name_from_exe(exe: &str) -> Option<String> {
    exe.split('/')
        .find(|c| c.len() > 1 && c.starts_with('.'))
        .map(|c| c.trim_start_matches('.').to_string())
}

/// The host of a process: the nearest app bundle (macOS), else the nearest ancestor that is not a shell or the agent.
pub fn host_of(
    pid: u32,
    procs: &HashMap<u32, Proc>,
    exe: &HashMap<u32, String>,
) -> (String, Option<String>) {
    let mut first: Option<String> = None;
    let mut p = procs.get(&pid).map(|x| x.ppid).unwrap_or(0);
    for _ in 0..40 {
        let Some(pr) = procs.get(&p) else { break };
        if let Some(b) = bundle_of(&pr.path) {
            let name = b
                .rsplit('/')
                .next()
                .unwrap_or(&b)
                .trim_end_matches(".app")
                .to_string();
            return (name, Some(b));
        }
        if first.is_none() && !skip(pr.name()) {
            // Linux cuts names to 15 characters and lets threads rename them ("MainThread", "tmux: server")
            let own = pr.name().split(':').next().unwrap_or("").trim().to_string();
            // a process that renamed itself (its name is not its executable's) is named by where its executable lives
            let renamed = exe.get(&p).filter(|e| {
                let base = e.rsplit('/').next().unwrap_or(e);
                !base.starts_with(own.as_str())
            });
            first = renamed
                .and_then(|e| name_from_exe(e).or_else(|| e.rsplit('/').next().map(String::from)))
                .or(Some(own));
        }
        if pr.ppid <= 1 || pr.ppid == p {
            break;
        }
        p = pr.ppid;
    }
    (first.unwrap_or_else(|| "a terminal".into()), None)
}

/// Session id -> how it runs, from the pid files' text and `ps` output. A pid file whose process is gone is ignored.
pub fn from_parts(pid_files: &[String], ps: &str) -> HashMap<String, Run> {
    from_parts_with(pid_files, ps, &HashMap::new())
}

/// The same, with executable paths (pid -> path) for processes whose name says nothing.
pub fn from_parts_with(
    pid_files: &[String],
    ps: &str,
    exe: &HashMap<u32, String>,
) -> HashMap<String, Run> {
    let procs = parse_ps(ps);
    let mut out = HashMap::new();
    for text in pid_files {
        let Ok(v) = serde_json::from_str::<Value>(text) else {
            continue;
        };
        let (Some(id), Some(pid)) = (v["sessionId"].as_str(), v["pid"].as_u64()) else {
            continue;
        };
        let pid = pid as u32;
        // the pid must still be alive and still an agent-like process (a recycled pid could be anything)
        let Some(pr) = procs.get(&pid) else { continue };
        if !skip(pr.name()) {
            continue;
        }
        let (app, bundle) = host_of(pid, &procs, exe);
        out.insert(
            id.to_string(),
            Run {
                pid,
                tty: pr.tty.clone(),
                app,
                bundle,
                started: v["startedAt"].as_u64().map(|ms| ms / 1000).unwrap_or(0),
                busy: v["status"].as_str() == Some("busy"),
                waiting_for: (v["status"].as_str() == Some("waiting"))
                    .then(|| v["waitingFor"].as_str().unwrap_or("your input").to_string()),
            },
        );
    }
    out
}

/// A host and an app are the same program when their names match, ignoring case, or the host's first word before a
/// dash or underscore is the app's name (a daemon `tool-core` or `tool-remote` beside its app `Tool`).
fn same_app(host: &str, app: &str) -> bool {
    let want = host.to_lowercase();
    let stem = want.split(['-', '_']).next().unwrap_or(&want);
    let app = app.to_lowercase();
    app == want || app == stem
}

/// The window of a host that runs outside any window's process tree (a background helper the app talks to): the
/// window whose class names the same program. Classes may be reverse-DNS (`com.example.Tool`): the last part counts.
pub fn window_by_name(host: &str, windows: &[(u32, String)]) -> Option<u32> {
    windows
        .iter()
        .find(|(_, class)| same_app(host, class.rsplit('.').next().unwrap_or(class)))
        .map(|(pid, _)| *pid)
}

/// An installed app whose name matches a host that runs outside its bundle (a daemon such as `tool` or `tool-core`
/// next to its `Tool.app`): same name, ignoring case, or the same first word before a dash or underscore.
fn installed_bundle(name: &str, dirs: &[std::path::PathBuf]) -> Option<String> {
    for d in dirs {
        let Ok(rd) = std::fs::read_dir(d) else {
            continue;
        };
        for e in rd.flatten() {
            let f = e.file_name().to_string_lossy().to_lowercase();
            if let Some(app) = f.strip_suffix(".app") {
                if same_app(name, app) {
                    return Some(e.path().to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

/// This machine's process table, in the shape `parse_ps` reads.
pub fn ps_now() -> String {
    std::process::Command::new("ps")
        .args(["axo", "pid=,ppid=,tty=,comm="])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

/// The process that owns the window a session runs in: `pid` itself or its nearest ancestor among `window_pids`
/// (the owning pids the desktop reports for its windows, e.g. Hyprland's `hyprctl clients`). None when the session
/// runs outside any window (tmux, sshd).
pub fn window_owner(pid: u32, procs: &HashMap<u32, Proc>, window_pids: &[u32]) -> Option<u32> {
    let mut p = pid;
    for _ in 0..40 {
        if window_pids.contains(&p) {
            return Some(p);
        }
        let parent = procs.get(&p)?.ppid;
        if parent <= 1 || parent == p {
            return None;
        }
        p = parent;
    }
    None
}

/// This machine's live sessions.
pub fn local(home: &Path) -> HashMap<String, Run> {
    let mut files = vec![];
    if let Ok(dir) = std::fs::read_dir(home.join(".claude/sessions")) {
        for e in dir.flatten() {
            let p = e.path();
            if p.extension().map(|x| x == "json").unwrap_or(false) {
                if let Ok(t) = std::fs::read_to_string(&p) {
                    files.push(t);
                }
            }
        }
    }
    if files.is_empty() {
        return HashMap::new();
    }
    let ps = ps_now();
    // Linux lets a process rename itself ("MainThread"); its executable, from /proc, says what it is
    let exe: HashMap<u32, String> = if cfg!(target_os = "linux") {
        parse_ps(&ps)
            .keys()
            .filter_map(|pid| {
                let path = std::fs::read_link(format!("/proc/{pid}/exe")).ok()?;
                Some((*pid, path.to_string_lossy().into_owned()))
            })
            .collect()
    } else {
        HashMap::new()
    };
    let mut runs = from_parts_with(&files, &ps, &exe);
    if cfg!(target_os = "macos") {
        let dirs = [
            std::path::PathBuf::from("/Applications"),
            std::path::PathBuf::from("/Applications/Utilities"),
            home.join("Applications"),
        ];
        for r in runs.values_mut() {
            if r.bundle.is_none() {
                if let Some(b) = installed_bundle(&r.app, &dirs) {
                    r.app = b
                        .rsplit('/')
                        .next()
                        .unwrap_or(&b)
                        .trim_end_matches(".app")
                        .to_string();
                    r.bundle = Some(b);
                }
            }
        }
    }
    runs
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn the_host_comes_from_the_tree_not_from_a_list() {
        let ps = "  1     0 ??       /sbin/launchd\n 100     1 ??       /Applications/Some Editor.app/Contents/Frameworks/Some Editor Helper.app/Contents/MacOS/Some Editor Helper\n 200   100 ttys019  login\n 300   200 ttys019  -zsh\n 400   300 ttys019  claude\n 500     1 ?        tmux: server\n 600   500 pts/3    bash\n 700   600 pts/3    claude\n 900     1 ?        MainThread\n 910   900 pts/4    zsh\n 920   910 pts/4    claude\n";
        let files = vec![
            r#"{"pid":400,"sessionId":"s1","startedAt":1700000000000,"status":"busy"}"#.to_string(),
            r#"{"pid":700,"sessionId":"s2","status":"idle"}"#.to_string(),
            r#"{"pid":920,"sessionId":"s3"}"#.to_string(),
            r#"{"pid":999,"sessionId":"gone"}"#.to_string(),
        ];
        let exe: HashMap<u32, String> = [(
            900,
            "/home/john/.some-remote/runtimes/node-1/bin/node".to_string(),
        )]
        .into();
        let runs = from_parts_with(&files, ps, &exe);
        assert_eq!(
            runs["s1"],
            Run {
                pid: 400,
                tty: "ttys019".into(),
                app: "Some Editor".into(),
                bundle: Some("/Applications/Some Editor.app".into()),
                started: 1_700_000_000,
                busy: true,
                waiting_for: None
            }
        );
        assert_eq!(
            (runs["s2"].app.as_str(), runs["s2"].bundle.is_none()),
            ("tmux", true)
        );
        assert_eq!(runs["s3"].app, "some-remote");
        let asking =
            r#"{"pid":400,"sessionId":"s1","status":"waiting","waitingFor":"approve Bash"}"#;
        let runs = from_parts_with(&[asking.to_string()], ps, &exe);
        assert_eq!(
            (runs["s1"].busy, runs["s1"].waiting_for.as_deref()),
            (false, Some("approve Bash"))
        );
        let runs = from_parts_with(&files, ps, &exe);
        assert!(!runs.contains_key("gone"));
        // a process named like its executable keeps its own name, even when that executable sits in a hidden folder
        let ps2 = "1 0 ? init\n50 1 ? tool-core\n60 50 pts/1 zsh\n70 60 pts/1 claude\n";
        let exe2: HashMap<u32, String> =
            [(50, "/home/john/.local/bin/tool-core".to_string())].into();
        assert_eq!(
            from_parts_with(&[r#"{"pid":70,"sessionId":"s4"}"#.to_string()], ps2, &exe2)["s4"].app,
            "tool-core"
        );
        // a daemon outside its bundle finds the installed app of the same name
        let apps = std::env::temp_dir().join("ov-apps");
        std::fs::create_dir_all(apps.join("Tool.app")).unwrap();
        assert_eq!(
            installed_bundle("tool-core", std::slice::from_ref(&apps))
                .map(|b| b.ends_with("Tool.app")),
            Some(true)
        );
        assert_eq!(installed_bundle("tmux", &[apps]), None);
    }

    #[test]
    fn the_window_is_the_nearest_ancestor_that_owns_one() {
        // a terminal (50) and an editor whose window belongs to its main process (80), not the pty helper (81)
        let ps = "1 0 ? systemd\n50 1 ? term\n60 50 pts/1 zsh\n70 60 pts/1 claude\n80 1 ? editor\n81 80 ? editor\n82 81 pts/2 zsh\n83 82 pts/2 claude\n500 1 ? tmux: server\n600 500 pts/3 bash\n700 600 pts/3 claude\n";
        let procs = parse_ps(ps);
        let windows = [50, 80, 999];
        assert_eq!(window_owner(70, &procs, &windows), Some(50));
        assert_eq!(window_owner(83, &procs, &windows), Some(80));
        assert_eq!(window_owner(700, &procs, &windows), None);
        assert_eq!(window_owner(12345, &procs, &windows), None);
        // a helper started outside the app's tree finds the app's window by name
        let classes = [
            (50, "com.example.Term".to_string()),
            (80, "tool".to_string()),
        ];
        assert_eq!(window_by_name("tool-remote", &classes), Some(80));
        assert_eq!(window_by_name("term", &classes), Some(50));
        assert_eq!(window_by_name("tmux", &classes), None);
    }
}
