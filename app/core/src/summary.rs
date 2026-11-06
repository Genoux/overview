//! Summaries: the core feature. For each session, a small, cheap model writes what the owner needs at a glance:
//! a task title, what was done, what is left, what it needs from them, the next step, and a priority.
//!
//! Provider-agnostic: it speaks the OpenAI-compatible chat API, so OpenRouter, a local server (Ollama, LM Studio) or any
//! other compatible endpoint is a base URL and a model name in the settings. Nothing here is specific to one company.
//! Privacy: only the end of the transcript is sent, size-capped, after `redact` has removed anything that looks secret.
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Summary {
    /// The task, in a few words ("Fix sync conflict on reconnect").
    pub title: String,
    /// What has been done, one or two short sentences.
    pub done: String,
    /// What is left, or "" when nothing is.
    pub left: String,
    /// What the agent needs from the owner right now, or "" when nothing.
    pub needs: String,
    /// The next step, for the owner or the agent.
    pub next: String,
    /// "high", "normal" or "low".
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Endpoint {
    /// e.g. "https://openrouter.ai/api/v1" (OpenRouter), "http://localhost:11434/v1" (Ollama)
    pub base_url: String,
    pub model: String,
}
impl Default for Endpoint {
    fn default() -> Self {
        Endpoint {
            base_url: "https://openrouter.ai/api/v1".into(),
            model: "openai/gpt-oss-120b".into(),
        }
    }
}

/* ---------------- what is sent: the end of the transcript, as readable turns ---------------- */
const MAX_EXCERPT: usize = 12_000;

fn text_of(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => {
            let t: Vec<&str> = items
                .iter()
                .filter(|i| {
                    i["type"] == "text" || i["type"] == "input_text" || i["type"] == "output_text"
                })
                .filter_map(|i| i["text"].as_str())
                .collect();
            if t.is_empty() {
                None
            } else {
                Some(t.join(" "))
            }
        }
        _ => None,
    }
}

/// The last turns of a session as "OWNER: ...", "AGENT: ...", "TOOL: ..." lines, newest last, capped in size.
pub fn excerpt(path: &Path, agent: &str) -> String {
    let mut lines: Vec<String> = vec![];
    for r in crate::tail::last_lines(path, 512 * 1024) {
        match agent {
            "claude" => match r["type"].as_str().unwrap_or("") {
                "user" if r["isMeta"].as_bool() != Some(true) => {
                    if let Some(t) = text_of(&r["message"]["content"]) {
                        if !t.starts_with('<') {
                            lines.push(format!("OWNER: {}", one_line(&t, 1200)));
                        }
                    }
                }
                "assistant" => {
                    if let Value::Array(items) = &r["message"]["content"] {
                        for i in items {
                            if i["type"] == "text" {
                                if let Some(t) = i["text"].as_str() {
                                    lines.push(format!("AGENT: {}", one_line(t, 1500)));
                                }
                            }
                            if i["type"] == "tool_use" {
                                let d = i["input"]["command"]
                                    .as_str()
                                    .or_else(|| i["input"]["file_path"].as_str())
                                    .unwrap_or("");
                                lines.push(format!(
                                    "TOOL: {} {}",
                                    i["name"].as_str().unwrap_or("tool"),
                                    one_line(d, 160)
                                ));
                            }
                        }
                    }
                }
                _ => {}
            },
            _ => {
                let p = &r["payload"];
                match (
                    r["type"].as_str().unwrap_or(""),
                    p["type"].as_str().unwrap_or(""),
                ) {
                    ("response_item", "message") => {
                        if let Some(t) = text_of(&p["content"]) {
                            if t.trim_start().starts_with('<') {
                                continue;
                            }
                            let who = if p["role"] == "user" {
                                "OWNER"
                            } else if p["role"] == "assistant" {
                                "AGENT"
                            } else {
                                continue;
                            };
                            lines.push(format!("{}: {}", who, one_line(&t, 1500)));
                        }
                    }
                    ("response_item", "function_call") | ("response_item", "custom_tool_call") => {
                        lines.push(format!("TOOL: {}", p["name"].as_str().unwrap_or("tool")))
                    }
                    _ => {}
                }
            }
        }
    }
    let mut out = String::new();
    for l in lines.iter().rev() {
        if out.len() + l.len() > MAX_EXCERPT {
            break;
        }
        out = format!("{}\n{}", l, out);
    }
    redact(out.trim())
}

fn one_line(t: &str, n: usize) -> String {
    crate::model::clip(t, n)
}

/* ---------------- redaction: nothing that looks secret leaves the machine ---------------- */
fn patterns() -> &'static Vec<(Regex, &'static str)> {
    static P: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    P.get_or_init(|| {
        [
            (r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)", "[private key]"),
            (r"\b(sk|pk|rk)-[A-Za-z0-9_\-]{16,}", "[key]"),
            (r"\bsk-(or|ant|proj)-[A-Za-z0-9_\-]{10,}", "[key]"),
            (r"\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}", "[token]"),
            (r"\bxox[abpr]-[A-Za-z0-9\-]{10,}", "[token]"),
            (r"\bAKIA[0-9A-Z]{16}\b", "[key]"),
            (r"\bAIza[0-9A-Za-z_\-]{30,}", "[key]"),
            (r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}", "[token]"),
            (r"(?i)\b(bearer)\s+[A-Za-z0-9._\-]{16,}", "$1 [token]"),
            (r"(?i)\b([A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|APIKEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)\s*[=:]\s*\S+", "$1=[redacted]"),
            (r"(?i)(postgres|postgresql|mysql|mongodb(\+srv)?|redis|amqp)://[^\s:@/]+:[^\s@/]+@", "$1://[credentials]@"),
            (r"[A-Za-z0-9+/=_\-]{48,}", "[long value]"),
        ]
        .into_iter()
        .map(|(p, r)| (Regex::new(p).expect("redaction pattern"), r))
        .collect()
    })
}
pub fn redact(text: &str) -> String {
    let mut t = text.to_string();
    for (re, with) in patterns() {
        t = re.replace_all(&t, *with).into_owned();
    }
    t
}

/* ---------------- the call ---------------- */
const SYSTEM: &str = "You summarize a coding agent's session for its owner, who is coming back to it later and has not read it. \
Read the transcript excerpt (OWNER = the person, AGENT = the coding agent, TOOL = actions it took) and answer with JSON only: \
{\"title\": a task title of 3 to 7 words, \
\"done\": what has been done, at most 2 short sentences, \
\"left\": what is still left to do, at most 1 sentence, or \"\" if nothing, \
\"needs\": what the agent needs from the owner right now (an approval, an answer, a review, a fix), at most 1 sentence, or \"\" if nothing, \
\"next\": the single next step, at most 1 sentence, \
\"priority\": \"high\" if the owner is blocking progress or something failed, \"low\" if it is finished or idle, otherwise \"normal\"}. \
Plain words, no markdown, no file contents, never repeat secrets.";

/// Asks the endpoint for a summary of `excerpt`. `state` and `project` give the model the context the files already know.
pub fn summarize(
    ep: &Endpoint,
    key: &str,
    project: &str,
    state: &str,
    excerpt: &str,
) -> Result<Summary, String> {
    let body = json!({
        "model": ep.model,
        "temperature": 0.2,
        "max_tokens": 500,
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": SYSTEM },
            { "role": "user", "content": format!("Project: {project}\nCurrent state: {state}\n\nTranscript excerpt:\n{excerpt}") }
        ]
    });
    let url = format!("{}/chat/completions", ep.base_url.trim_end_matches('/'));
    let resp = ureq::post(&url)
        .set("Authorization", &format!("Bearer {key}"))
        .set("Content-Type", "application/json")
        .set("X-Title", "Overview")
        .timeout(std::time::Duration::from_secs(60))
        .send_json(body)
        .map_err(|e| match e {
            ureq::Error::Status(code, r) => format!(
                "HTTP {code}: {}",
                crate::model::clip(&r.into_string().unwrap_or_default(), 200)
            ),
            other => other.to_string(),
        })?;
    let v: Value = resp.into_json().map_err(|e| e.to_string())?;
    let content = v["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("no answer in the response")?;
    parse(content)
}

/// Reads the model's answer: tolerant of code fences and extra text around the JSON, strict about the fields.
pub fn parse(content: &str) -> Result<Summary, String> {
    let start = content.find('{').ok_or("no JSON in the answer")?;
    let end = content.rfind('}').ok_or("no JSON in the answer")?;
    let v: Value =
        serde_json::from_str(&content[start..=end]).map_err(|e| format!("bad JSON: {e}"))?;
    let f = |k: &str| {
        v[k].as_str()
            .map(|s| crate::model::clip(s, 300))
            .unwrap_or_default()
    };
    let s = Summary {
        title: f("title"),
        done: f("done"),
        left: f("left"),
        needs: f("needs"),
        next: f("next"),
        priority: match v["priority"].as_str() {
            Some("high") => "high",
            Some("low") => "low",
            _ => "normal",
        }
        .into(),
    };
    if s.title.is_empty() {
        return Err("the answer has no title".into());
    }
    Ok(s)
}

/// The API key from the OS keychain (macOS: `security`, Linux: `secret-tool`). Never logged, never written to disk.
pub fn key_from_keychain(account: &str) -> Option<String> {
    let out = if cfg!(target_os = "macos") {
        std::process::Command::new("security")
            .args([
                "find-generic-password",
                "-s",
                "overview",
                "-a",
                account,
                "-w",
            ])
            .output()
            .ok()?
    } else {
        std::process::Command::new("secret-tool")
            .args(["lookup", "service", "overview", "account", account])
            .output()
            .ok()?
    };
    let k = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() && !k.is_empty() {
        Some(k)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn secrets_never_leave() {
        let t = redact("OPENROUTER_API_KEY=sk-or-v1-abcdefghijklmnopqrstuvwx and ghp_abcdefghijklmnopqrstuvwxyz0123 then postgres://me:hunter2@db:5432/x and Bearer abcdefghijklmnopqrstuv");
        for leak in ["sk-or-v1", "ghp_abc", "hunter2", "abcdefghijklmnopqrstuv"] {
            assert!(!t.contains(leak), "{leak} leaked: {t}");
        }
        assert!(
            redact("-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----")
                .contains("[private key]")
        );
        assert_eq!(
            redact("run pnpm test in src/app"),
            "run pnpm test in src/app"
        );
    }
    #[test]
    fn answers_are_read_strictly() {
        let s = parse("```json\n{\"title\":\"Fix sync\",\"done\":\"Patched it.\",\"left\":\"\",\"needs\":\"Approve the migration.\",\"next\":\"Run pnpm db:migrate.\",\"priority\":\"high\"}\n```").unwrap();
        assert_eq!(
            (s.title.as_str(), s.priority.as_str(), s.needs.as_str()),
            ("Fix sync", "high", "Approve the migration.")
        );
        assert_eq!(
            parse("{\"title\":\"x\",\"priority\":\"urgent\"}")
                .unwrap()
                .priority,
            "normal"
        );
        assert!(parse("no json here").is_err());
        assert!(parse("{\"done\":\"x\"}").is_err());
    }
}
