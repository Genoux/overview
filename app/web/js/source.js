// Real data: inside the app, the sessions come from the Rust core (the `sessions` command), which reads the coding
// agents' own session files on this machine. In a plain browser (no Tauri) the map keeps its sample data.
// This module turns a core session into the shape the map already uses (core.js INITIAL), and keeps it fresh.
import { HOSTS, PROJECTS, INITIAL } from './core.js';

const tauri = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.core;
export const live = !!tauri;
const STATE = { run: 'run', wait: 'wait', done: 'done', err: 'err', idle: 'idle' };
// plain text: no markdown marks (#, *, `, >) and collapsed whitespace
const plain = (t) => String(t || '').replace(/[#*`>_]+/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (t, n) => { t = plain(t); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
let HOME = '';
export const where = (cwd) => (HOME && cwd && cwd.startsWith(HOME) ? '~' + cwd.slice(HOME.length) : cwd || '');
export const meta = { archived: 0, llm: null };

// one core session -> one map session
function toMap(s, i) {
  const out = { id: s.id, plot: s.project, agent: ['claude', 'codex', 'gemini'].includes(s.agent) ? s.agent : 'claude', state: STATE[s.state] || 'idle',
    since: Math.max(0, Math.round(s.quiet_secs / 60)), prio: i + 1, title: clip(s.title || s.project, 90),
    summary: clip(s.last_reply || s.last_prompt || '', 160), branch: s.branch || null, path: s.path, cwd: s.cwd, src: s.agent };
  // the LLM summary, when ready: a task title, what was done and is left, what it needs from you, the next step
  const m = s.summary;
  if (m) { out.sum = { done: plain(m.done), left: plain(m.left), needs: plain(m.needs), next: plain(m.next), priority: m.priority }; out.title = clip(m.title, 90); out.summary = clip(m.next || m.left || m.done, 160); }
  if (out.state === 'wait' && s.waiting_on) {
    const m = s.waiting_on.match(/^([^:]+):\s*(.+)$/);
    if (m) { out.kind = 'command'; out.cmd = m[2]; out.bubble = clip('run ' + m[2] + '?', 30); }
    else { out.kind = 'question'; out.q = s.waiting_on; out.bubble = clip(s.waiting_on, 30); }
  }
  if (out.state === 'err') out.bubble = clip((m && m.needs) || 'API error', 30);
  // a finished turn that still needs the owner (pick, approve, review…) is "needs you": the files cannot tell, the summary can
  if (out.state === 'done' && m && m.needs) { out.state = 'wait'; out.kind = 'question'; out.q = plain(m.needs); out.bubble = clip(m.needs, 30); out.asks = true; }
  if (m && m.priority === 'high') out.prio = 0;
  return out;
}

// replaces the sample data in place (the map's modules read these arrays)
function fill(snap) {
  HOME = snap.home || ''; meta.archived = snap.archived || 0; meta.llm = snap.llm || null;
  const list = snap.sessions.map(toMap);
  HOSTS.length = 0; HOSTS.push({ id: 'local', name: snap.host, sub: 'local', lat: '' });
  PROJECTS.length = 0; for (const p of [...new Set(list.map((s) => s.plot))]) PROJECTS.push({ id: p, host: 'local' });
  INITIAL.length = 0; INITIAL.push(...list);
  return list;
}

export async function loadReal() {
  if (!live) return false;
  const snap = await tauri.invoke('sessions');
  fill(snap);
  return true;
}

// every few seconds: update states in place; if sessions or projects come or go, ask for a rebuild
export function watch(G, onChange, onRebuild, every = 3000) {
  if (!live) return;
  setInterval(async () => {
    let snap; try { snap = await tauri.invoke('sessions'); } catch (e) { return; }
    const next = snap.sessions.map(toMap), ids = (l) => l.map((s) => s.id + '@' + s.plot).sort().join('|');
    meta.archived = snap.archived || 0; meta.llm = snap.llm || null;
    if (ids(next) !== ids(INITIAL)) { fill(snap); onRebuild(); return; }
    let changed = false;
    for (const n of next) {
      const s = G.S.find((x) => x.id === n.id); if (!s) continue;
      const prev = s.state, before = JSON.stringify(s.sum || null) + s.title; Object.assign(s, n);
      if (prev !== s.state) onChange(s, prev); else if (before !== JSON.stringify(s.sum || null) + s.title) changed = true;
    }
    if (changed) onChange(null, null);   // a new summary arrived: redraw the panels
  }, every);
}

// the user's own actions on a session: resume it in Terminal, show its folder, archive it (hide it here), restore all
export async function act(name, id) {
  if (!live) return { ok: false, error: 'only in the app' };
  try { await tauri.invoke(name, id ? { id } : {}); return { ok: true }; } catch (e) { return { ok: false, error: String(e) }; }
}
export async function refreshNow(G, onChange, onRebuild) { const snap = await tauri.invoke('sessions'); meta.archived = snap.archived || 0; fill(snap); onRebuild(); }
