// Overview app: a window showing the map (web/), fed by the core scan of this machine's agent sessions and, over the
// owner's own ssh, of their other machines. It never types into a session. The actions it offers are the owner's own:
// go to a session (bring its window forward, or resume it), show its folder, close it (end an idle agent and hide it).
// Every action takes a session id and looks the session up in a fresh scan, so the page cannot pass a path or a command.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use overview_core::model::{Session, State};
use overview_core::remote::{self, Remote};
use overview_core::summary::{self, Endpoint, Summary};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::Manager;

const VERSION: &str = env!("CARGO_PKG_VERSION");

/// A session as the page sees it: the core session plus its summary, if one is ready.
#[derive(Serialize)]
struct View {
    #[serde(flatten)]
    session: Session,
    summary: Option<Summary>,
}

#[derive(Serialize)]
struct Snapshot {
    version: &'static str,
    /// This machine's short name, shown on its island.
    host: String,
    /// The home folder, so the page can show paths as ~/...
    home: String,
    sessions: Vec<View>,
    /// The owner's other machines and how each is doing.
    machines: Vec<MachineView>,
    /// How many sessions are hidden (closed or cleared).
    archived: usize,
    /// The summarizer: which model, and the last problem if any (no key, no network, ...).
    llm: LlmStatus,
}

#[derive(Serialize, Clone, Default)]
struct LlmStatus {
    model: String,
    error: Option<String>,
    pending: usize,
}

fn home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default()
}
fn hostname() -> String {
    overview_core::procs::program("hostname")
        .arg("-s")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|h| !h.is_empty())
        .unwrap_or_else(|| "this computer".into())
}

/* ---------------- app data: small JSON files in the app's data folder ---------------- */
fn data_file(app: &tauri::AppHandle, name: &str) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(name))
}
fn load<T: for<'a> Deserialize<'a> + Default>(app: &tauri::AppHandle, name: &str) -> T {
    data_file(app, name)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}
fn store<T: Serialize>(app: &tauri::AppHandle, name: &str, v: &T) -> Result<(), String> {
    let p = data_file(app, name).ok_or("no app data folder")?;
    if let Some(d) = p.parent() {
        std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, serde_json::to_string_pretty(v).unwrap()).map_err(|e| e.to_string())
}

/// Sessions hidden from Overview (closed or cleared). Their files stay untouched: the agent's history and resume keep working.
fn archived(app: &tauri::AppHandle) -> BTreeSet<String> {
    load(app, "archive.json")
}

/* ---------------- machines: the owner's other computers, reached over their ssh ---------------- */
#[derive(Serialize, Deserialize, Clone)]
struct MachineCfg {
    alias: String,
    #[serde(default)]
    name: String,
}

#[derive(Serialize, Clone)]
struct MachineView {
    alias: String,
    name: String,
    status: String,
    error: Option<String>,
    latency_ms: u64,
    sessions: usize,
}

#[derive(Default, Clone)]
struct MachineState {
    status: String,
    error: Option<String>,
    latency_ms: u64,
    sessions: Vec<Session>,
}

static MACHINES: OnceLock<Mutex<BTreeMap<String, MachineState>>> = OnceLock::new();
static KICK: AtomicBool = AtomicBool::new(false);
fn machines_state() -> &'static Mutex<BTreeMap<String, MachineState>> {
    MACHINES.get_or_init(|| Mutex::new(BTreeMap::new()))
}

/// Every 10 seconds (or right after a machine is added), each machine is refreshed in parallel. Only changed files travel.
fn remote_worker(app: tauri::AppHandle) {
    let cache_root = app
        .path()
        .app_cache_dir()
        .map(|d| d.join("machines"))
        .unwrap_or_else(|_| std::env::temp_dir().join("overview-machines"));
    let mut remotes: HashMap<String, Remote> = HashMap::new();
    loop {
        let cfg: Vec<MachineCfg> = load(&app, "machines.json");
        remotes.retain(|a, _| cfg.iter().any(|m| &m.alias == a));
        machines_state()
            .lock()
            .unwrap()
            .retain(|a, _| cfg.iter().any(|m| &m.alias == a));
        for m in &cfg {
            if !remotes.contains_key(&m.alias) {
                match Remote::new(&m.alias, &cache_root) {
                    Ok(r) => {
                        remotes.insert(m.alias.clone(), r);
                        machines_state()
                            .lock()
                            .unwrap()
                            .entry(m.alias.clone())
                            .or_insert(MachineState {
                                status: "connecting".into(),
                                ..Default::default()
                            });
                    }
                    Err(e) => {
                        machines_state().lock().unwrap().insert(
                            m.alias.clone(),
                            MachineState {
                                status: "offline".into(),
                                error: Some(e),
                                ..Default::default()
                            },
                        );
                    }
                }
            }
        }
        std::thread::scope(|sc| {
            for (alias, r) in remotes.iter_mut() {
                sc.spawn(move || {
                    let res = r.collect();
                    let mut st = machines_state().lock().unwrap();
                    let e = st.entry(alias.clone()).or_default();
                    match res {
                        Ok(c) => {
                            e.status = "connected".into();
                            e.error = None;
                            e.latency_ms = c.latency_ms;
                            e.sessions = c.sessions;
                        }
                        Err(err) => {
                            e.status = "offline".into();
                            e.error = Some(err);
                        }
                    }
                });
            }
        });
        for _ in 0..40 {
            if KICK.swap(false, Ordering::SeqCst) {
                break;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
    }
}

/// Every session Overview knows: this machine's, then each connected machine's last refresh.
fn all_sessions() -> Vec<Session> {
    let mut all = overview_core::scan(&home());
    for st in machines_state().lock().unwrap().values() {
        all.extend(st.sessions.iter().cloned());
    }
    all
}
fn find(id: &str) -> Result<Session, String> {
    all_sessions()
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("no session {id}"))
}

#[tauri::command]
fn sessions(app: tauri::AppHandle) -> Snapshot {
    let hidden = archived(&app);
    let all = all_sessions();
    let archived_count = all.iter().filter(|s| hidden.contains(&s.id)).count();
    let cache = CACHE
        .get_or_init(|| Mutex::new(BTreeMap::new()))
        .lock()
        .unwrap()
        .clone();
    let views = all
        .into_iter()
        .filter(|s| !hidden.contains(&s.id))
        .map(|s| {
            let summary = cache.get(&s.id).map(|c| c.summary.clone());
            View {
                session: s,
                summary,
            }
        })
        .collect();
    let cfg: Vec<MachineCfg> = load(&app, "machines.json");
    let st = machines_state().lock().unwrap().clone();
    let machines = cfg
        .iter()
        .map(|m| {
            let s = st.get(&m.alias).cloned().unwrap_or(MachineState {
                status: "connecting".into(),
                ..Default::default()
            });
            MachineView {
                alias: m.alias.clone(),
                name: if m.name.is_empty() {
                    m.alias.clone()
                } else {
                    m.name.clone()
                },
                status: s.status,
                error: s.error,
                latency_ms: s.latency_ms,
                sessions: s.sessions.len(),
            }
        })
        .collect();
    let llm = STATUS
        .get_or_init(|| Mutex::new(LlmStatus::default()))
        .lock()
        .unwrap()
        .clone();
    Snapshot {
        version: VERSION,
        host: hostname(),
        home: home().to_string_lossy().to_string(),
        sessions: views,
        machines,
        archived: archived_count,
        llm,
    }
}

/// The hosts in ~/.ssh/config, each marked when it is already added.
#[tauri::command]
fn ssh_hosts(app: tauri::AppHandle) -> Vec<(String, String, bool)> {
    let cfg: Vec<MachineCfg> = load(&app, "machines.json");
    remote::ssh_config_hosts(&home())
        .into_iter()
        .map(|(a, to)| {
            let added = cfg.iter().any(|m| m.alias == a);
            (a, to, added)
        })
        .collect()
}
#[tauri::command]
fn machine_add(app: tauri::AppHandle, alias: String) -> Result<(), String> {
    let alias = alias.trim().to_string();
    if !remote::valid_alias(&alias) {
        return Err(
            "That is not an ssh destination. Use an alias from your ssh config or user@host."
                .into(),
        );
    }
    let mut cfg: Vec<MachineCfg> = load(&app, "machines.json");
    if cfg.iter().any(|m| m.alias == alias) {
        return Err(format!("{alias} is already added"));
    }
    cfg.push(MachineCfg {
        alias,
        name: String::new(),
    });
    store(&app, "machines.json", &cfg)?;
    KICK.store(true, Ordering::SeqCst);
    Ok(())
}
#[tauri::command]
fn machine_rename(app: tauri::AppHandle, alias: String, name: String) -> Result<(), String> {
    let mut cfg: Vec<MachineCfg> = load(&app, "machines.json");
    let m = cfg
        .iter_mut()
        .find(|m| m.alias == alias)
        .ok_or("no such machine")?;
    m.name = overview_core::model::clip(name.trim(), 40);
    store(&app, "machines.json", &cfg)
}
#[tauri::command]
fn machine_remove(app: tauri::AppHandle, alias: String) -> Result<(), String> {
    let mut cfg: Vec<MachineCfg> = load(&app, "machines.json");
    cfg.retain(|m| m.alias != alias);
    store(&app, "machines.json", &cfg)?;
    machines_state().lock().unwrap().remove(&alias);
    KICK.store(true, Ordering::SeqCst);
    Ok(())
}

/* ---------------- the owner's actions on a session ---------------- */
/// Quotes a value for a POSIX shell.
fn sh_quote(v: &str) -> String {
    format!("'{}'", v.replace('\'', "'\\''"))
}

/// Runs `line` in a new window of the owner's terminal: on macOS a one-off `.command` script opened with whatever app
/// handles those (Terminal unless the owner chose another); elsewhere the desktop's default terminal.
fn terminal(line: &str) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        let f = std::env::temp_dir().join(format!(
            "overview-{}.command",
            std::process::id() as u64 * 1000
                + (std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.subsec_millis())
                    .unwrap_or(0) as u64)
        ));
        // the script removes itself first, then runs the line in a login shell
        std::fs::write(
            &f,
            format!("#!/bin/sh\nrm -f \"$0\"\n{line}\nexec \"${{SHELL:-/bin/zsh}}\" -l\n"),
        )
        .map_err(|e| e.to_string())?;
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&f, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
        overview_core::procs::program("open")
            .arg(&f)
            .spawn()
            .map_err(|e| e.to_string())?;
    } else {
        linux_terminal(line)?;
    }
    Ok(())
}

/// The owner's terminal on Linux, from the desktop's own conventions, never a list of apps: `xdg-terminal-exec`
/// (the freedesktop default-terminal launcher), else `$TERMINAL -e`, else Debian's `x-terminal-emulator`.
fn linux_terminal(line: &str) -> Result<(), String> {
    // sh runs the line, then becomes the owner's own shell in the same folder, so an agent that ends or a resume
    // that fails leaves its message on screen. The line itself never goes to that shell: it is POSIX, and the
    // owner's shell may not be (fish, nushell).
    let kept_open = format!("{line}; exec \"${{SHELL:-sh}}\" -l");
    let run = |prog: &str, pre: &[&str]| {
        overview_core::procs::program(prog)
            .args(pre)
            .args(["sh", "-c", &kept_open])
            .spawn()
            .is_ok()
    };
    let custom = std::env::var("TERMINAL").ok().filter(|t| !t.is_empty());
    if run("xdg-terminal-exec", &[])
        || custom.as_deref().is_some_and(|t| run(t, &["-e"]))
        || run("x-terminal-emulator", &["-e"])
    {
        Ok(())
    } else {
        Err("no terminal found: install xdg-terminal-exec or set $TERMINAL".into())
    }
}

fn resume_line(s: &Session) -> Result<String, String> {
    match s.agent {
        "claude" => Ok(format!("claude --resume {}", sh_quote(&s.id))),
        "codex" => Ok(format!("codex resume {}", sh_quote(&s.id))),
        other => Err(format!("resuming {other} sessions is not supported yet")),
    }
}

/// Brings the window hosting a local session to the front: on macOS the `.app` bundle found in its process tree; on
/// Hyprland the window owned by the agent's nearest ancestor.
fn focus_local(run: &overview_core::procs::Run) -> Result<(), String> {
    let no_window = || {
        format!(
            "it runs in {}, which has no window to bring forward",
            run.app
        )
    };
    if cfg!(target_os = "macos") {
        let bundle = run.bundle.as_ref().ok_or_else(no_window)?;
        let ok = overview_core::procs::program("open")
            .arg(bundle)
            .status()
            .map_err(|e| e.to_string())?
            .success();
        return if ok {
            Ok(())
        } else {
            Err(format!("could not open {}", run.app))
        };
    }
    if std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_none() {
        return Err("bringing a window forward works on macOS and Hyprland for now".into());
    }
    let hyprctl = |args: &[&str]| {
        overview_core::procs::program("hyprctl")
            .args(args)
            .output()
            .map_err(|e| format!("hyprctl: {e}"))
    };
    let clients: serde_json::Value = serde_json::from_slice(&hyprctl(&["clients", "-j"])?.stdout)
        .map_err(|e| format!("hyprctl clients: {e}"))?;
    let windows: Vec<(u32, String)> = clients
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|c| {
            let pid = c["pid"].as_u64()? as u32;
            Some((pid, c["class"].as_str().unwrap_or("").to_string()))
        })
        .collect();
    let pids: Vec<u32> = windows.iter().map(|(p, _)| *p).collect();
    let procs = overview_core::procs::parse_ps(&overview_core::procs::ps_now());
    // the window in the agent's own process tree, else (a session kept by a background helper) the window named
    // like its host
    let owner = overview_core::procs::window_owner(run.pid, &procs, &pids)
        .or_else(|| overview_core::procs::window_by_name(&run.app, &windows))
        .ok_or_else(no_window)?;
    // Hyprland with a Lua config reads `dispatch` as Lua (0.56 and later); a classic config takes the dispatcher name.
    let lua = format!("hl.dsp.focus({{ window = \"pid:{owner}\" }})");
    let classic = format!("pid:{owner}");
    let mut said = String::new();
    for args in [
        vec!["dispatch", lua.as_str()],
        vec!["dispatch", "focuswindow", classic.as_str()],
    ] {
        let out = hyprctl(&args)?;
        said = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if out.status.success() && said == "ok" {
            return Ok(());
        }
    }
    Err(format!("hyprctl could not focus {}: {said}", run.app))
}

/// The one way to get to a session. Open somewhere: bring that window forward. Not open: resume it in a new terminal.
/// On another machine: a terminal over ssh, in its folder (resumed if no agent has it open).
#[tauri::command]
fn go(id: String) -> Result<String, String> {
    let s = find(&id)?;
    if s.machine == "local" {
        if let Some(r) = &s.run {
            focus_local(r)?;
            return Ok(format!("focus:{}", r.app));
        }
        if !std::path::Path::new(&s.root).is_dir() {
            return Err(format!("its folder {} is not on this machine", s.root));
        }
        terminal(&format!("cd {} && {}", sh_quote(&s.root), resume_line(&s)?))?;
        return Ok("resume".into());
    }
    if !remote::valid_alias(&s.machine) {
        return Err("bad machine".into());
    }
    let inner = match &s.run {
        Some(_) => format!("cd {} && exec \"$SHELL\" -l", sh_quote(&s.cwd)),
        None => format!("cd {} && {}", sh_quote(&s.root), resume_line(&s)?),
    };
    terminal(&format!("ssh -t {} {}", s.machine, sh_quote(&inner)))?;
    Ok(if s.run.is_some() {
        "shell".into()
    } else {
        "resume".into()
    })
}

/// Shows the session's folder in Finder (this machine only).
#[tauri::command]
fn reveal(id: String) -> Result<(), String> {
    let s = find(&id)?;
    if s.machine != "local" {
        return Err(format!("its folder is on {}", s.machine));
    }
    if !std::path::Path::new(&s.cwd).is_dir() {
        return Err(format!("its folder {} is not on this machine", s.cwd));
    }
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    overview_core::procs::program(opener)
        .arg(&s.cwd)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Closes a session: ends its agent if one has it open and it is not working, then hides it from Overview.
/// The transcript stays, so going to it later resumes it.
#[tauri::command]
fn close(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let s = find(&id)?;
    if s.state == State::Run || s.run.as_ref().map(|r| r.busy).unwrap_or(false) {
        return Err("it is working; close it when it has finished".into());
    }
    if let Some(r) = &s.run {
        if s.machine == "local" {
            // only if that pid is still this session's agent
            let pidfile = home()
                .join(".claude/sessions")
                .join(format!("{}.json", r.pid));
            let ours = std::fs::read_to_string(&pidfile)
                .map(|t| t.contains(&s.id))
                .unwrap_or(false);
            if !ours {
                return Err("that agent is no longer running".into());
            }
            overview_core::procs::program("kill")
                .args(["-TERM", &r.pid.to_string()])
                .status()
                .map_err(|e| e.to_string())?;
        } else {
            remote::kill(&s.machine, r.pid, &s.id)?;
        }
    }
    let mut set = archived(&app);
    set.insert(id);
    store(&app, "archive.json", &set)
}

/// Brings every closed or cleared session back.
#[tauri::command]
fn restore_all(app: tauri::AppHandle) -> Result<(), String> {
    store(&app, "archive.json", &BTreeSet::<String>::new())
}

/* ---------------- summaries: a background worker, a cache, and the settings ---------------- */
#[derive(Serialize, Deserialize, Clone)]
struct Cached {
    updated: u64,
    state: String,
    summary: Summary,
}
static CACHE: OnceLock<Mutex<BTreeMap<String, Cached>>> = OnceLock::new();
static STATUS: OnceLock<Mutex<LlmStatus>> = OnceLock::new();

/// The owner's settings (app data `settings.json`): which endpoint and model, and projects whose transcripts never leave.
#[derive(Serialize, Deserialize, Default)]
struct Settings {
    #[serde(default)]
    endpoint: Endpoint,
    #[serde(default)]
    never_send: Vec<String>,
}

/// Every 20 seconds: summarize the sessions that changed since their last summary and have settled (quiet for 45 s,
/// or a new state), a few at a time, on every machine. Sessions asleep for a day are summarized once, then left alone.
fn summarizer(app: tauri::AppHandle) {
    let cache = CACHE.get_or_init(|| Mutex::new(load(&app, "summaries.json")));
    let status = STATUS.get_or_init(|| Mutex::new(LlmStatus::default()));
    loop {
        let settings: Settings = load(&app, "settings.json");
        status.lock().unwrap().model = settings.endpoint.model.clone();
        let hidden = archived(&app);
        let all: Vec<Session> = all_sessions()
            .into_iter()
            .filter(|s| !hidden.contains(&s.id) && !settings.never_send.contains(&s.project))
            .collect();
        let todo: Vec<Session> = {
            let c = cache.lock().unwrap();
            all.into_iter()
                .filter(|s| {
                    let st = format!("{:?}", s.state).to_lowercase();
                    match c.get(&s.id) {
                        None => true,
                        Some(prev) => {
                            s.updated > prev.updated
                                && (s.quiet_secs >= 45 || prev.state != st)
                                && st != "idle"
                        }
                    }
                })
                .collect()
        };
        status.lock().unwrap().pending = todo.len();
        if !todo.is_empty() {
            match summary::key_from_keychain("openrouter") {
                None => status.lock().unwrap().error = Some("no key: add it with  security add-generic-password -U -s overview -a openrouter -w".into()),
                Some(key) => {
                    for s in todo.iter().take(4) {
                        let st = format!("{:?}", s.state).to_lowercase();
                        let excerpt = summary::excerpt(std::path::Path::new(&s.path), s.agent);
                        if excerpt.is_empty() { continue; }
                        match summary::summarize(&settings.endpoint, &key, &s.project, &st, &excerpt) {
                            Ok(sum) => { cache.lock().unwrap().insert(s.id.clone(), Cached { updated: s.updated, state: st, summary: sum }); status.lock().unwrap().error = None; }
                            Err(e) => { status.lock().unwrap().error = Some(e); break; }
                        }
                    }
                    let snapshot = cache.lock().unwrap().clone();
                    let _ = store(&app, "summaries.json", &snapshot);
                }
            }
        }
        std::thread::sleep(Duration::from_secs(20));
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let h1 = app.handle().clone();
            std::thread::spawn(move || summarizer(h1));
            let h2 = app.handle().clone();
            std::thread::spawn(move || remote_worker(h2));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sessions,
            go,
            reveal,
            close,
            restore_all,
            ssh_hosts,
            machine_add,
            machine_rename,
            machine_remove
        ])
        .run(tauri::generate_context!())
        .expect("Overview failed to start");
}
