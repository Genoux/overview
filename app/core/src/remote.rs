//! Sessions on the owner's other machines, over their own `ssh` (their config, their keys, their agent).
//!
//! Nothing is installed on the remote machine. Each refresh sends a small read-only POSIX shell script that lists the
//! recent session files (path, mtime, size), the live agents (`~/.claude/sessions/*.json`, never the `.key` files beside
//! them) and the process table. Only files that changed since the last refresh are fetched, and only their ends (plus
//! the first 128 KB, where the working folder and the first prompt live). They are cached on this machine and read by the
//! same readers as local sessions, so a remote session looks exactly like a local one.
use crate::model::Session;
use crate::procs;
use crate::sources::{claude, codex};
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};

const TAIL: u64 = 384 * 1024;
const HEAD: u64 = 128 * 1024;
const BATCH: usize = 12;

/// An ssh destination as the owner typed it or as their ssh config names it: an alias, `host`, `user@host`, `[::1]`.
/// Nothing that could be read as an option or a shell word.
pub fn valid_alias(a: &str) -> bool {
    !a.is_empty()
        && a.len() <= 255
        && !a.starts_with('-')
        && a.chars()
            .all(|c| c.is_ascii_alphanumeric() || "._-@:[]".contains(c))
}

/// Runs `script` with `sh -s` on `alias` and returns its output. Batch mode: it never prompts for a password.
pub fn ssh(alias: &str, script: &str, timeout: Duration) -> Result<String, String> {
    if !valid_alias(alias) {
        return Err(format!("not an ssh destination: {alias}"));
    }
    let mut child = crate::procs::program("ssh")
        .args([
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=6",
            "-o",
            "ServerAliveInterval=5",
            "-o",
            "ControlMaster=auto",
            "-o",
            "ControlPath=/tmp/ov-%C",
            "-o",
            "ControlPersist=120",
            "--",
            alias,
            "sh -s",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("ssh: {e}"))?;
    child
        .stdin
        .take()
        .unwrap()
        .write_all(script.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut out = child.stdout.take().unwrap();
    let mut err = child.stderr.take().unwrap();
    let reader = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = out.read_to_string(&mut s);
        s
    });
    let ereader = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = err.read_to_string(&mut s);
        s
    });
    let start = Instant::now();
    let status = loop {
        if let Some(st) = child.try_wait().map_err(|e| e.to_string())? {
            break st;
        }
        if start.elapsed() > timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err("timed out".into());
        }
        std::thread::sleep(Duration::from_millis(40));
    };
    let text = reader.join().unwrap_or_default();
    let etext = ereader.join().unwrap_or_default();
    if !status.success() {
        let msg = etext
            .lines()
            .rfind(|l| !l.trim().is_empty())
            .unwrap_or("could not connect")
            .trim()
            .to_string();
        return Err(crate::model::clip(&msg, 160));
    }
    Ok(text)
}

/// Lists what is there. Read-only; paths are relative to the remote home.
const LIST: &str = r#"cd "$HOME" 2>/dev/null || exit 3
echo "@now $(date +%s)"
os=$(uname -s); echo "@os $os"
st() { if [ "$os" = Darwin ]; then stat -f '%m %z' "$1"; else stat -c '%Y %s' "$1"; fi; }
{ find .claude/projects -maxdepth 2 -type f -name '*.jsonl' -mtime -7 2>/dev/null; find .codex/sessions -type f -name '*.jsonl' -mtime -7 2>/dev/null; } | while IFS= read -r f; do printf '@file %s %s\n' "$(st "$f")" "$f"; done
for p in .claude/sessions/*.json; do [ -f "$p" ] && printf '@pid %s\n' "$(tr -d '\n' < "$p")"; done
if [ "$os" = Linux ]; then for p in $(ps -u "$(id -u)" -o pid= 2>/dev/null); do e=$(readlink "/proc/$p/exe" 2>/dev/null) && printf '@exe %s %s\n' "$p" "$e"; done; fi
echo "@ps"; ps axo pid=,ppid=,tty=,comm= 2>/dev/null; echo "@end"
"#;

/// A path from the listing that may be fetched: under the agents' folders, no quote, no `..`, no control characters.
fn fetchable(p: &str) -> bool {
    (p.starts_with(".claude/projects/") || p.starts_with(".codex/sessions/"))
        && p.ends_with(".jsonl")
        && !p.contains('\'')
        && !p.contains(' ')
        && !p.contains("..")
        && !p.chars().any(|c| c.is_control())
}

fn fetch_script(paths: &[&String]) -> String {
    let list: Vec<String> = paths.iter().map(|p| format!("'{p}'")).collect();
    format!(
        r#"cd "$HOME" 2>/dev/null || exit 3
for f in {}; do
  [ -f "$f" ] || continue
  n=$(wc -c < "$f" | tr -d ' ')
  if [ "$n" -le {TAIL} ]; then printf '@whole %s ' "$f"; base64 < "$f" | tr -d '\n'; echo
  else printf '@headtail %s ' "$f"; head -c {HEAD} "$f" | base64 | tr -d '\n'; printf ' '; tail -c {TAIL} "$f" | base64 | tr -d '\n'; echo; fi
done
"#,
        list.join(" ")
    )
}

/// What a refresh found on one machine.
pub struct Collected {
    pub sessions: Vec<Session>,
    /// Round trip of the listing, in milliseconds.
    pub latency_ms: u64,
}

/// One remote machine: its alias, its cache folder, and what was fetched already (path -> mtime, size).
pub struct Remote {
    pub alias: String,
    cache: PathBuf,
    seen: HashMap<String, (u64, u64)>,
}

impl Remote {
    pub fn new(alias: &str, cache_root: &Path) -> Result<Remote, String> {
        if !valid_alias(alias) {
            return Err(format!("not an ssh destination: {alias}"));
        }
        let safe: String = alias
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '.' || c == '-' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        let cache = cache_root.join(safe);
        std::fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
        Ok(Remote {
            alias: alias.to_string(),
            cache,
            seen: HashMap::new(),
        })
    }

    fn cached(&self, rel: &str) -> PathBuf {
        self.cache.join(rel.replace('/', "__"))
    }

    pub fn collect(&mut self) -> Result<Collected, String> {
        let t = Instant::now();
        let text = ssh(&self.alias, LIST, Duration::from_secs(25))?;
        let latency_ms = t.elapsed().as_millis() as u64;
        let (mut now, mut files, mut pids, mut ps, mut in_ps) =
            (0u64, vec![], vec![], String::new(), false);
        let mut exe: HashMap<u32, String> = HashMap::new();
        for line in text.lines() {
            if in_ps {
                if line == "@end" {
                    in_ps = false;
                } else {
                    ps.push_str(line);
                    ps.push('\n');
                }
                continue;
            }
            if let Some(v) = line.strip_prefix("@now ") {
                now = v.trim().parse().unwrap_or(0);
            } else if let Some(v) = line.strip_prefix("@file ") {
                let mut it = v.splitn(3, ' ');
                if let (Some(m), Some(z), Some(p)) = (it.next(), it.next(), it.next()) {
                    if let (Ok(m), Ok(z)) = (m.parse::<u64>(), z.parse::<u64>()) {
                        if fetchable(p) {
                            files.push((p.to_string(), m, z));
                        }
                    }
                }
            } else if let Some(v) = line.strip_prefix("@pid ") {
                pids.push(v.to_string());
            } else if let Some(v) = line.strip_prefix("@exe ") {
                if let Some((p, e)) = v.split_once(' ') {
                    if let Ok(p) = p.parse() {
                        exe.insert(p, e.to_string());
                    }
                }
            } else if line == "@ps" {
                in_ps = true;
            }
        }
        if now == 0 {
            return Err("unexpected answer from the machine".into());
        }
        // fetch what changed, a few files per round trip
        let changed: Vec<&String> = files
            .iter()
            .filter(|(p, m, z)| self.seen.get(p) != Some(&(*m, *z)) || !self.cached(p).exists())
            .map(|(p, _, _)| p)
            .collect();
        for chunk in changed.chunks(BATCH) {
            let out = ssh(&self.alias, &fetch_script(chunk), Duration::from_secs(60))?;
            for line in out.lines() {
                self.store(line);
            }
        }
        for (p, m, z) in &files {
            if self.cached(p).exists() {
                self.seen.insert(p.clone(), (*m, *z));
            }
        }
        // forget files that left the listing
        let keep: HashSet<PathBuf> = files.iter().map(|(p, _, _)| self.cached(p)).collect();
        if let Ok(dir) = std::fs::read_dir(&self.cache) {
            for e in dir.flatten() {
                if !keep.contains(&e.path()) {
                    let _ = std::fs::remove_file(e.path());
                }
            }
        }
        self.seen
            .retain(|p, _| files.iter().any(|(q, _, _)| q == p));
        // read them like local sessions
        let mut sessions = vec![];
        for (p, m, _) in &files {
            let path = self.cached(p);
            if !path.exists() {
                continue;
            }
            let quiet = now.saturating_sub(*m);
            let s = if p.starts_with(".claude/") {
                claude::read(&path, quiet, *m)
            } else {
                codex::read(&path, quiet, *m)
            };
            if let Some(mut s) = s {
                s.machine = self.alias.clone();
                sessions.push(s);
            }
        }
        crate::attach_runs(&mut sessions, &procs::from_parts_with(&pids, &ps, &exe));
        sessions.sort_by_key(|s| s.quiet_secs);
        Ok(Collected {
            sessions,
            latency_ms,
        })
    }

    fn store(&self, line: &str) {
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD;
        let (kind, rest) = if let Some(r) = line.strip_prefix("@whole ") {
            ("whole", r)
        } else if let Some(r) = line.strip_prefix("@headtail ") {
            ("headtail", r)
        } else {
            return;
        };
        // the path has no spaces in the agents' folders; base64 never has spaces
        let mut parts = rest.split(' ');
        let Some(p) = parts.next() else { return };
        if !fetchable(p) {
            return;
        }
        let bytes = match kind {
            "whole" => b64.decode(parts.next().unwrap_or("")).ok(),
            _ => match (
                parts.next().map(|h| b64.decode(h)),
                parts.next().map(|t| b64.decode(t)),
            ) {
                (Some(Ok(mut h)), Some(Ok(t))) => {
                    h.push(b'\n');
                    h.extend(t);
                    Some(h)
                }
                _ => None,
            },
        };
        if let Some(b) = bytes {
            let _ = std::fs::write(self.cached(p), b);
        }
    }
}

/// Ends an idle agent on a remote machine, only if that pid is still the agent of that session.
pub fn kill(alias: &str, pid: u32, session_id: &str) -> Result<(), String> {
    if !session_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err("bad session id".into());
    }
    let script = format!("f=\"$HOME/.claude/sessions/{pid}.json\"; [ -f \"$f\" ] && grep -q '{session_id}' \"$f\" && kill -TERM {pid} && echo ok\n");
    let out = ssh(alias, &script, Duration::from_secs(15))?;
    if out.trim() == "ok" {
        Ok(())
    } else {
        Err("that agent is no longer running there".into())
    }
}

/// The ssh hosts named in the owner's `~/.ssh/config` (no wildcards), with what each resolves to, for the add-a-machine list.
/// Only `Host`, `HostName` and `User` lines are read.
pub fn ssh_config_hosts(home: &Path) -> Vec<(String, String)> {
    let Ok(text) = std::fs::read_to_string(home.join(".ssh/config")) else {
        return vec![];
    };
    let mut out: Vec<(String, Option<String>, Option<String>)> = vec![];
    let mut current: Vec<usize> = vec![];
    for line in text.lines() {
        let l = line.trim();
        let mut it = l.splitn(2, |c: char| c.is_whitespace() || c == '=');
        let (Some(k), Some(v)) = (it.next(), it.next()) else {
            continue;
        };
        let v = v.trim().trim_start_matches('=').trim();
        match k.to_lowercase().as_str() {
            "host" => {
                current.clear();
                for h in v.split_whitespace() {
                    if h.contains('*') || h.contains('?') || h.starts_with('!') || !valid_alias(h) {
                        continue;
                    }
                    current.push(out.len());
                    out.push((h.to_string(), None, None));
                }
            }
            "match" => current.clear(),
            "hostname" => {
                for &i in &current {
                    out[i].1 = Some(v.to_string());
                }
            }
            "user" => {
                for &i in &current {
                    out[i].2 = Some(v.to_string());
                }
            }
            _ => {}
        }
    }
    out.into_iter()
        .map(|(h, n, u)| {
            let host = n.unwrap_or_else(|| h.clone());
            let to = match u {
                Some(u) => format!("{u}@{host}"),
                None => host,
            };
            (h, to)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_safe_destinations_and_paths() {
        for ok in ["workstation", "john@192.168.86.23", "box.local", "[::1]"] {
            assert!(valid_alias(ok), "{ok}");
        }
        for bad in ["-oProxyCommand=x", "a b", "a;rm", "", "a'b", "$(x)"] {
            assert!(!valid_alias(bad), "{bad}");
        }
        assert!(fetchable(".claude/projects/-home-john-x/abc.jsonl"));
        for bad in [
            ".claude/projects/../.ssh/id.jsonl",
            ".ssh/x.jsonl",
            ".codex/sessions/a'b.jsonl",
            ".claude/projects/x.txt",
        ] {
            assert!(!fetchable(bad), "{bad}");
        }
    }
    #[test]
    fn reads_hosts_from_ssh_config() {
        let dir = std::env::temp_dir().join("ov-sshcfg");
        std::fs::create_dir_all(dir.join(".ssh")).unwrap();
        std::fs::write(dir.join(".ssh/config"), "Host *\n  User nobody\nHost workstation\n  HostName 192.168.86.23\n  User john\nHost 192.168.86.34\n  User ubuntu\nHost gh *.corp\n").unwrap();
        assert_eq!(
            ssh_config_hosts(&dir),
            vec![
                ("workstation".into(), "john@192.168.86.23".into()),
                ("192.168.86.34".into(), "ubuntu@192.168.86.34".into()),
                ("gh".into(), "gh".into())
            ]
        );
    }
    #[test]
    fn a_fetched_file_reads_like_a_local_one() {
        let root = std::env::temp_dir().join("ov-remote-test");
        let _ = std::fs::remove_dir_all(&root);
        let r = Remote::new("john@box", &root).unwrap();
        use base64::Engine;
        let body = "{\"type\":\"user\",\"cwd\":\"/home/john/flow\",\"sessionId\":\"r1\",\"message\":{\"role\":\"user\",\"content\":\"Fix tests\"}}\n{\"type\":\"assistant\",\"message\":{\"stop_reason\":\"end_turn\",\"content\":[{\"type\":\"text\",\"text\":\"Done.\"}]}}\n";
        r.store(&format!(
            "@whole .claude/projects/-home-john-flow/r1.jsonl {}",
            base64::engine::general_purpose::STANDARD.encode(body)
        ));
        let s = claude::read(
            &r.cached(".claude/projects/-home-john-flow/r1.jsonl"),
            60,
            0,
        )
        .unwrap();
        assert_eq!(
            (s.id.as_str(), s.project.as_str(), s.state),
            ("r1", "flow", crate::model::State::Done)
        );
    }
}
