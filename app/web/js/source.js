// Real data: inside the app, the sessions come from the Rust core (the `sessions` command), which reads the coding
// agents' own session files on this machine and, over the owner's ssh, on their other machines. In a plain browser
// (no Tauri) the map keeps its sample data. This module turns a core session into the shape the map uses (core.js
// INITIAL), keeps it fresh, and carries the owner's actions back to the app.
import { HOSTS, PROJECTS, INITIAL } from './core.js';

const tauri = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.core;
export const live = !!tauri;
const STATE = { run: 'run', wait: 'wait', done: 'done', err: 'err', idle: 'idle' };
// plain text: no markdown marks (#, *, `, >) and collapsed whitespace
const plain = (t) => String(t || '').replace(/[#*`>_]+/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (t, n) => { t = plain(t); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
let HOME = '';
export const where = (cwd) => (HOME && cwd && cwd.startsWith(HOME) ? '~' + cwd.slice(HOME.length) : cwd || '');
export const meta = { archived: 0, llm: null, version: '', host: '', machines: [] };

function ago(sec) { const m = Math.max(0, Math.round((Date.now() / 1000 - sec) / 60)); return m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; }

// one core session -> one map session. `plot` is the project's id on the map: its name, or name@machine when the
// same project name lives on two machines (each machine is its own island)
function toMap(s, i, plotOf) {
  const out = { id: s.id, plot: plotOf(s), project: s.project, machine: s.machine || 'local', agent: ['claude', 'codex', 'gemini'].includes(s.agent) ? s.agent : 'claude', state: STATE[s.state] || 'idle',
    since: Math.max(0, Math.round(s.quiet_secs / 60)), prio: i + 1, title: clip(s.title || s.project, 90),
    summary: clip(s.last_reply || s.last_prompt || '', 160), branch: s.branch || null, path: s.path, cwd: s.cwd, root: s.root || s.cwd, src: s.agent,
    run: s.run ? { app: s.run.app, tty: s.run.tty, pid: s.run.pid, busy: s.run.busy, open: s.run.started ? ago(s.run.started) : '' } : null };
  // the LLM summary, when ready: a task title, what was done and is left, what it needs from you, the next step
  const m = s.summary;
  if (m) { out.sum = { done: plain(m.done), left: plain(m.left), needs: plain(m.needs), next: plain(m.next), priority: m.priority }; out.title = clip(m.title, 90); out.summary = clip(m.next || m.left || m.done, 160); }
  if (out.state === 'wait' && s.waiting_on) {
    const w = s.waiting_on.match(/^([A-Za-z_][\w.-]*):\s*(.+)$/);   // "Bash: cmd" is a command; anything else is a question
    if (w) { out.kind = 'command'; out.cmd = w[2]; out.bubble = clip('run ' + w[2] + '?', 30); }
    else { out.kind = 'question'; out.q = s.waiting_on; out.bubble = clip(s.waiting_on, 30); }
  }
  if (out.state === 'err') out.bubble = clip((m && m.needs) || 'API error', 30);
  // a finished turn that still needs the owner (pick, approve, review…) is "needs you": the files cannot tell, the summary can
  if (out.state === 'done' && m && m.needs) { out.state = 'wait'; out.kind = 'question'; out.q = plain(m.needs); out.bubble = clip(m.needs, 30); out.asks = true; }
  if (m && m.priority === 'high') out.prio = 0;
  return out;
}

function mapAll(snap) {
  const names = new Map();   // project name -> the machines it is on
  for (const s of snap.sessions) { if (!names.has(s.project)) names.set(s.project, new Set()); names.get(s.project).add(s.machine || 'local'); }
  const label = (m) => (m === 'local' ? snap.host : ((snap.machines || []).find((x) => x.alias === m) || { name: m }).name);
  const plotOf = (s) => { const m = s.machine || 'local'; return names.get(s.project).size > 1 && m !== 'local' ? s.project + '@' + label(m) : s.project; };
  return snap.sessions.map((s, i) => toMap(s, i, plotOf));
}

function setMeta(snap) { meta.archived = snap.archived || 0; meta.llm = snap.llm || null; meta.version = snap.version || ''; meta.host = snap.host || ''; meta.machines = snap.machines || []; }

// replaces the sample data in place (the map's modules read these arrays)
function fill(snap) {
  HOME = snap.home || ''; setMeta(snap);
  const list = mapAll(snap);
  HOSTS.length = 0; HOSTS.push({ id: 'local', name: snap.host, sub: 'local', lat: '' });
  for (const m of snap.machines || []) if (list.some((s) => s.machine === m.alias)) HOSTS.push({ id: m.alias, name: m.name, sub: 'ssh', lat: m.latency_ms ? m.latency_ms + ' ms' : '' });
  PROJECTS.length = 0;
  for (const s of list) if (!PROJECTS.some((p) => p.id === s.plot)) PROJECTS.push({ id: s.plot, host: s.machine === 'local' ? 'local' : s.machine });
  INITIAL.length = 0; INITIAL.push(...list);
  return list;
}

export async function loadReal() {
  if (!live) return false;
  fill(await tauri.invoke('sessions'));
  return true;
}

// every few seconds: update states in place; if sessions, projects or machines come or go, ask for a rebuild
export function watch(G, onChange, onRebuild, every = 3000) {
  if (!live) return;
  const key = () => JSON.stringify(meta.machines.map((m) => [m.alias, m.name, m.status, m.sessions]));
  let machinesKey = key();
  setInterval(async () => {
    let snap; try { snap = await tauri.invoke('sessions'); } catch (e) { return; }
    const next = mapAll(snap), ids = (l) => l.map((s) => s.id + '@' + s.plot + '@' + s.machine).sort().join('|');
    setMeta(snap);
    if (ids(next) !== ids(INITIAL)) { fill(snap); machinesKey = key(); onRebuild(); return; }
    let changed = key() !== machinesKey; machinesKey = key();
    for (const n of next) {
      const s = G.S.find((x) => x.id === n.id); if (!s) continue;
      const sig = (x) => JSON.stringify(x.sum || null) + x.title + JSON.stringify(x.run);
      const prev = s.state, before = sig(s); Object.assign(s, n);
      if (prev !== s.state) onChange(s, prev); else if (before !== sig(s)) changed = true;
    }
    if (changed) onChange(null, null);   // a new summary, a machine's status, or where a session runs: redraw the panels
  }, every);
}

// the owner's actions, carried to the app: go, reveal, close, restore_all, and the machine settings
export async function act(name, id, args) {
  if (!live) return { ok: false, error: 'only in the app' };
  try { const value = await tauri.invoke(name, Object.assign(id ? { id } : {}, args || {})); return { ok: true, value }; } catch (e) { return { ok: false, error: String(e) }; }
}
export async function refreshNow(G, onChange, onRebuild) { fill(await tauri.invoke('sessions')); onRebuild(); }
