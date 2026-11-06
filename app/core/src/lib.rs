//! Overview core: finds the coding-agent sessions on this machine and reads them into one normalized shape.
//! Read-only by design: it never writes to an agent's files, never sends keystrokes, and never opens credential files.
pub mod model;
pub mod summary;
pub mod sources;
pub mod tail;

use model::Session;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Sessions untouched for longer than this are not listed at all.
pub const RECENT_DAYS: u64 = 7;

type Reader = fn(&Path, u64, u64) -> Option<Session>;

/// Every recent session of every supported agent under `home`, most recently active first.
pub fn scan(home: &Path) -> Vec<Session> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let groups: [(Vec<PathBuf>, Reader); 2] = [(sources::claude::files(home), sources::claude::read), (sources::codex::files(home), sources::codex::read)];
    let mut out = vec![];
    for (files, read) in groups {
        for f in files {
            let Ok(meta) = std::fs::metadata(&f) else { continue };
            let updated = meta.modified().ok().and_then(|m| m.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
            let quiet = now.saturating_sub(updated);
            if quiet > RECENT_DAYS * 86400 { continue; }
            if let Some(s) = read(&f, quiet, updated) { out.push(s); }
        }
    }
    out.sort_by_key(|s| s.quiet_secs);
    out
}
