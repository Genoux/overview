// Overview app: a window showing the map (web/), fed by the core scan of this machine's agent sessions.
// It never writes to an agent's files and never types into a session. The actions it offers are the user's own:
// resume a session in a new Terminal window, show its folder, or archive it (hide it in Overview's own list).
// Every action takes a session id and looks the session up in a fresh scan, so the page cannot pass a path or a command.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use overview_core::model::Session;
use overview_core::summary::{self, Endpoint, Summary};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Mutex, OnceLock};
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// A session as the page sees it: the core session plus its summary, if one is ready.
#[derive(Serialize)]
struct View {
    #[serde(flatten)]
    session: Session,
    summary: Option<Summary>,
}

#[derive(Serialize)]
struct Snapshot {
    /// This machine's short name, shown on its island.
    host: String,
    /// The home folder, so the page can show paths as ~/...
    home: String,
    sessions: Vec<View>,
    /// How many sessions are archived (hidden from the map).
    archived: usize,
    /// The summarizer: which model, and the last problem if any (no key, no network, ...).
    llm: LlmStatus,
}

#[derive(Serialize, Clone, Default)]
struct LlmStatus { model: String, error: Option<String>, pending: usize }

fn home() -> PathBuf {
    std::env::var_os("HOME").map(PathBuf::from).unwrap_or_default()
}

/* ---------------- the archive: Overview's own list of hidden sessions ---------------- */
fn archive_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("archive.json"))
}
fn archived(app: &tauri::AppHandle) -> BTreeSet<String> {
    archive_file(app).and_then(|p| std::fs::read_to_string(p).ok()).and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}
fn save_archived(app: &tauri::AppHandle, set: &BTreeSet<String>) -> Result<(), String> {
    let p = archive_file(app).ok_or("no app data folder")?;
    if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    std::fs::write(&p, serde_json::to_string(set).unwrap()).map_err(|e| e.to_string())
}

fn find(id: &str) -> Result<Session, String> {
    overview_core::scan(&home()).into_iter().find(|s| s.id == id).ok_or_else(|| format!("no session {id}"))
}
/// The session, if its folder exists on this machine (a session synced from another machine may point elsewhere).
fn find_here(id: &str) -> Result<Session, String> {
    let s = find(id)?;
    if !std::path::Path::new(&s.cwd).is_dir() {
        return Err(format!("its folder {} is not on this machine", s.cwd));
    }
    Ok(s)
}

#[tauri::command]
fn sessions(app: tauri::AppHandle) -> Snapshot {
    let host = Command::new("hostname").arg("-s").output().ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|h| !h.is_empty())
        .unwrap_or_else(|| "this computer".into());
    let hidden = archived(&app);
    let all = overview_core::scan(&home());
    let archived_count = all.iter().filter(|s| hidden.contains(&s.id)).count();
    let cache = CACHE.get_or_init(|| Mutex::new(BTreeMap::new())).lock().unwrap().clone();
    let views = all.into_iter().filter(|s| !hidden.contains(&s.id)).map(|s| { let summary = cache.get(&s.id).map(|c| c.summary.clone()); View { session: s, summary } }).collect();
    let llm = STATUS.get_or_init(|| Mutex::new(LlmStatus::default())).lock().unwrap().clone();
    Snapshot { host, home: home().to_string_lossy().to_string(), sessions: views, archived: archived_count, llm }
}

/// Quotes a value for a POSIX shell.
fn sh_quote(v: &str) -> String {
    format!("'{}'", v.replace('\'', "'\\''"))
}

/// Opens a new Terminal window in the session's folder with the session resumed (`claude --resume`, `codex resume`).
#[tauri::command]
fn resume(id: String) -> Result<(), String> {
    let s = find_here(&id)?;
    let agent_cmd = match s.agent {
        "claude" => format!("claude --resume {}", sh_quote(&s.id)),
        "codex" => format!("codex resume {}", sh_quote(&s.id)),
        other => return Err(format!("resuming {other} sessions is not supported yet")),
    };
    let line = format!("cd {} && {}", sh_quote(&s.cwd), agent_cmd);
    if cfg!(target_os = "macos") {
        let script = format!("tell application \"Terminal\"\n  do script \"{}\"\n  activate\nend tell", line.replace('\\', "\\\\").replace('"', "\\\""));
        Command::new("osascript").arg("-e").arg(script).spawn().map_err(|e| e.to_string())?;
    } else {
        Command::new("x-terminal-emulator").args(["-e", "sh", "-c", &line]).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Shows the session's folder in Finder (or the desktop's file manager on Linux).
#[tauri::command]
fn reveal(id: String) -> Result<(), String> {
    let s = find_here(&id)?;
    let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    Command::new(opener).arg(&s.cwd).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

/// Hides a session from Overview. Its files stay untouched (the agent's history and `--resume` keep working).
#[tauri::command]
fn archive(app: tauri::AppHandle, id: String) -> Result<(), String> {
    find(&id)?;
    let mut set = archived(&app);
    set.insert(id);
    save_archived(&app, &set)
}

/// Brings every archived session back.
#[tauri::command]
fn restore_all(app: tauri::AppHandle) -> Result<(), String> {
    save_archived(&app, &BTreeSet::new())
}

/* ---------------- summaries: a background worker, a cache, and the settings ---------------- */
#[derive(Serialize, Deserialize, Clone)]
struct Cached { updated: u64, state: String, summary: Summary }
static CACHE: OnceLock<Mutex<BTreeMap<String, Cached>>> = OnceLock::new();
static STATUS: OnceLock<Mutex<LlmStatus>> = OnceLock::new();

/// The owner's settings (app data `settings.json`): which endpoint and model, and projects whose transcripts never leave.
#[derive(Serialize, Deserialize, Default)]
struct Settings { #[serde(default)] endpoint: Endpoint, #[serde(default)] never_send: Vec<String> }

fn data_file(app: &tauri::AppHandle, name: &str) -> Option<PathBuf> { app.path().app_data_dir().ok().map(|d| d.join(name)) }
fn load<T: for<'a> Deserialize<'a> + Default>(app: &tauri::AppHandle, name: &str) -> T {
    data_file(app, name).and_then(|p| std::fs::read_to_string(p).ok()).and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}
fn store<T: Serialize>(app: &tauri::AppHandle, name: &str, v: &T) {
    if let Some(p) = data_file(app, name) { if let Some(d) = p.parent() { let _ = std::fs::create_dir_all(d); } let _ = std::fs::write(p, serde_json::to_string_pretty(v).unwrap()); }
}

/// Every 20 seconds: summarize the sessions that changed since their last summary and have settled (quiet for 45 s,
/// or a new state), a few at a time. Sessions asleep for a day are summarized once, then left alone.
fn summarizer(app: tauri::AppHandle) {
    let cache = CACHE.get_or_init(|| Mutex::new(load(&app, "summaries.json")));
    let status = STATUS.get_or_init(|| Mutex::new(LlmStatus::default()));
    loop {
        let settings: Settings = load(&app, "settings.json");
        status.lock().unwrap().model = settings.endpoint.model.clone();
        let hidden = archived(&app);
        let all: Vec<Session> = overview_core::scan(&home()).into_iter().filter(|s| !hidden.contains(&s.id) && !settings.never_send.contains(&s.project)).collect();
        let todo: Vec<Session> = {
            let c = cache.lock().unwrap();
            all.into_iter().filter(|s| {
                let st = format!("{:?}", s.state).to_lowercase();
                match c.get(&s.id) {
                    None => true,
                    Some(prev) => s.updated > prev.updated && (s.quiet_secs >= 45 || prev.state != st) && st != "idle",
                }
            }).collect()
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
                    store(&app, "summaries.json", &snapshot);
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_secs(20));
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| { let handle = app.handle().clone(); std::thread::spawn(move || summarizer(handle)); Ok(()) })
        .invoke_handler(tauri::generate_handler![sessions, resume, reveal, archive, restore_all])
        .run(tauri::generate_context!())
        .expect("Overview failed to start");
}
