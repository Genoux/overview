//! `overview-probe`: prints this machine's agent sessions as JSON (one array).
//! The app runs it locally; over SSH the same binary will report a remote machine.
//! `--summary` prints only counts per agent, state and project (no titles, prompts or replies).
use std::collections::BTreeMap;

fn main() {
    let home = std::env::var_os("HOME").map(std::path::PathBuf::from).expect("HOME is not set");
    let sessions = overview_core::scan(&home);
    // --summarize <session id>: one summary through the configured endpoint (key from the keychain), for testing
    let args: Vec<String> = std::env::args().collect();
    if let Some(i) = args.iter().position(|a| a == "--summarize") {
        let id = args.get(i + 1).expect("--summarize needs a session id");
        let s = sessions.iter().find(|s| &s.id == id).expect("no such session");
        let key = overview_core::summary::key_from_keychain("openrouter").expect("no key in the keychain (service overview, account openrouter)");
        let ex = overview_core::summary::excerpt(std::path::Path::new(&s.path), s.agent);
        let t = std::time::Instant::now();
        let r = overview_core::summary::summarize(&overview_core::summary::Endpoint::default(), &key, &s.project, &format!("{:?}", s.state).to_lowercase(), &ex);
        eprintln!("({} characters sent, {:.1}s)", ex.len(), t.elapsed().as_secs_f32());
        match r { Ok(sum) => println!("{}", serde_json::to_string_pretty(&sum).unwrap()), Err(e) => { eprintln!("error: {e}"); std::process::exit(1); } }
        return;
    }
    if std::env::args().any(|a| a == "--summary") {
        let mut by: BTreeMap<String, usize> = BTreeMap::new();
        for s in &sessions {
            *by.entry(format!("{:<7} {:<5} {}", s.agent, format!("{:?}", s.state).to_lowercase(), s.project)).or_default() += 1;
        }
        println!("{} sessions in the last {} days", sessions.len(), overview_core::RECENT_DAYS);
        for (k, n) in by { println!("  {n:>3}  {k}"); }
        return;
    }
    println!("{}", serde_json::to_string_pretty(&sessions).unwrap());
}
