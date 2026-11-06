//! Reading only the ends of session files: transcripts can be many megabytes, and the state lives at the end.
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// The last `max` bytes of a file as complete JSON lines (the first, possibly cut, line is dropped).
pub fn last_lines(path: &Path, max: u64) -> Vec<serde_json::Value> {
    let Ok(mut f) = File::open(path) else { return vec![] };
    let len = f.metadata().map(|m| m.len()).unwrap_or(0);
    let start = len.saturating_sub(max);
    if f.seek(SeekFrom::Start(start)).is_err() {
        return vec![];
    }
    let mut buf = Vec::new();
    if f.read_to_end(&mut buf).is_err() {
        return vec![];
    }
    let text = String::from_utf8_lossy(&buf);
    let mut lines = text.lines();
    if start > 0 {
        lines.next();
    }
    lines.filter_map(|l| serde_json::from_str(l).ok()).collect()
}

/// The first `max` bytes of a file as complete JSON lines (for what is only written once, at the start).
pub fn first_lines(path: &Path, max: u64) -> Vec<serde_json::Value> {
    let Ok(f) = File::open(path) else { return vec![] };
    let mut buf = Vec::new();
    if f.take(max).read_to_end(&mut buf).is_err() {
        return vec![];
    }
    let text = String::from_utf8_lossy(&buf);
    let mut out: Vec<serde_json::Value> = text.lines().filter_map(|l| serde_json::from_str(l).ok()).collect();
    if buf.len() as u64 == max && !text.ends_with('\n') {
        out.pop();
    }
    out
}
