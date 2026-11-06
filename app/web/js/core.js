// Shared state, seeded randomness, Signal palette and sample data.
// Every colour comes from Signal (@barrymind/signal) CSS variables; the hex values here are fallbacks only.

export const G = {
  S: [], world: null, bodies: {}, selId: null, sel: { area: null }, hover: { agent: null, area: null },
  cam: { u: 14, v: 14, z: 1 }, tgt: { u: 14, v: 14, z: 1 }, dpr: 1, W: 0, H: 0,
  t: 0, follow: null, followUntil: 0, levels: [1, 2, 3, 4], boxes: {}, night: 0, hourOverride: null
};

export const reduce = typeof window !== 'undefined' && !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
export function fmt(m) { return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; }
export function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function clone(a) { return a.map((o) => Object.assign({}, o)); }

/* ---------------- palette (read from Signal at boot) ---------------- */
export const C = {
  ground: '#1b1c1e', plate: '#232426', plateEdge: '#424345', faceL: '#18191b', faceR: '#131415',
  wait: '#fec04a', done: '#86c2a2', err: '#f26b59', run: '#cad0d7', accent: '#888ff7',
  fg: '#e9e9eb', dim: '#abacae', subtle: '#9b9c9e', faint: '#727375', strong: '#77787a',
  line: '#303133', line2: '#424345', panel: '#262729', side: '#1a1b1c', onAccent: '#1a1b1c', labelBg: 'rgba(26,27,28,0.86)',
  islandTop: '#1f2022', commons: '#242527', islandL: '#161719', islandR: '#121314', islandEdge: '#38393c', bridgeTop: '#202123',
  gridMinor: 'rgba(233,233,235,0.035)', gridMajor: 'rgba(233,233,235,0.085)', cross: 'rgba(233,233,235,0.28)', tick: 'rgba(233,233,235,0.25)', plank: 'rgba(233,233,235,0.12)',
  shadow: 'rgba(0,0,0,0.38)', creatureInk: '#0e0f10', slabRim: '#3b3c3f', slabCursor: '#5a5c60', slabCrack: '#5c211a', minimapPlate: '#323336',
  windowDay: '#20242a', windowLit: '#8e8774', park: '#1f2520', treeDark: '#2f3d33', treeLight: '#455a49', trunk: '#3a2f28',
  furniture: '#34363a', furnitureTop: '#44464b', night: '#0d1018'
};
export const TEX = { dots: 0.12, hatch: 0.08, grid: 0.07, commonsEdge: 0.18 };
export const RAMPS = {};
export const TINTS = {
  slate: { ground: '#1d2026', wall: '#3b4250', wallShade: '#2c313b', roof: '#4a5262' },
  sage: { ground: '#1e221e', wall: '#3e4a40', wallShade: '#2e3730', roof: '#4c5a4e' },
  clay: { ground: '#241f1d', wall: '#4d3f38', wallShade: '#3a2f2a', roof: '#5c4b43' },
  plum: { ground: '#221f25', wall: '#463d4e', wallShade: '#342d3a', roof: '#554a5e' },
  sand: { ground: '#23221d', wall: '#4a4637', wallShade: '#38352a', roof: '#59543f' }
};
export const FONT = { mono: '"JetBrains Mono", ui-monospace, Menlo, monospace' };

export function readSignal() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue('--sg-' + name).trim();
  const map = {
    ground: 'overview-ground', plate: 'overview-plate', plateEdge: 'border-default', faceL: 'overview-plate-face-left', faceR: 'overview-plate-face-right',
    wait: 'status-wait-fg', done: 'status-done-fg', err: 'status-err-fg', run: 'status-run-fg', accent: 'accent-fg',
    fg: 'text-primary', dim: 'text-secondary', subtle: 'text-subtle', faint: 'text-disabled', strong: 'border-strong', line: 'border-subtle', line2: 'border-default',
    panel: 'surface-raised', side: 'surface-sunken', onAccent: 'text-on-accent', labelBg: 'overlay-label',
    islandTop: 'overview-terrain-island-top', commons: 'overview-terrain-commons', islandL: 'overview-terrain-island-face-left', islandR: 'overview-terrain-island-face-right', islandEdge: 'overview-terrain-island-edge', bridgeTop: 'overview-terrain-bridge-top',
    gridMinor: 'overview-lattice-grid-minor', gridMajor: 'overview-lattice-grid-major', cross: 'overview-lattice-survey-cross', tick: 'overview-lattice-graticule-tick', plank: 'overview-lattice-plate-tick',
    shadow: 'overview-creature-shadow', creatureInk: 'overview-creature-ink', slabRim: 'overview-slab-asleep-rim', slabCursor: 'overview-slab-run-cursor', slabCrack: 'overview-slab-err-crack', minimapPlate: 'overview-minimap-plate',
    windowDay: 'overview-hood-shared-window-day', windowLit: 'overview-hood-shared-window-lit', park: 'overview-hood-shared-park', treeDark: 'overview-hood-shared-tree-dark', treeLight: 'overview-hood-shared-tree-light', trunk: 'overview-hood-shared-trunk',
    furniture: 'overview-hood-shared-furniture', furnitureTop: 'overview-hood-shared-furniture-top', night: 'overview-hood-shared-night'
  };
  for (const k in map) { const x = v(map[k]); if (x) C[k] = x; }
  for (const k of ['dots', 'hatch', 'grid']) { const x = parseFloat(v('overview-opacity-texture-' + k)); if (!isNaN(x)) TEX[k] = x; }
  const ce = parseFloat(v('overview-opacity-commons-edge')); if (!isNaN(ce)) TEX.commonsEdge = ce;
  for (const r of ['pale', 'lit', 'dusk', 'dim']) {
    const o = {}; for (const [k, n] of [['d', 'shade'], ['b', 'base'], ['l', 'light'], ['h', 'highlight']]) o[k] = v('overview-creature-' + r + '-' + n);
    if (o.d && o.b && o.l && o.h) RAMPS[r] = o;
  }
  for (const t in TINTS) for (const [k, n] of [['ground', 'ground'], ['wall', 'wall'], ['wallShade', 'wall-shade'], ['roof', 'roof']]) { const x = v('overview-hood-' + t + '-' + n); if (x) TINTS[t][k] = x; }
  const fm = v('font-mono'); if (fm) FONT.mono = fm;
}

/* ---------------- colour maths for night shading ---------------- */
function parse(c) {
  if (c[0] === '#') { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
  const m = c.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1];
}
const shadeCache = new Map();
export function shade(c, f) {
  if (!f) return c;
  const key = c + '|' + f.toFixed(2); let out = shadeCache.get(key);
  if (!out) { const a = parse(c), b = parse(C.night); out = 'rgba(' + [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * f)).join(',') + ',' + a[3] + ')'; shadeCache.set(key, out); }
  return out;
}

/* ---------------- time of day: 0 = day, ~0.5 = night ---------------- */
export function hourNow() { if (G.hourOverride != null) return G.hourOverride; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
export function nightFactor(h) {
  if (h >= 7.5 && h <= 18) return 0;
  if (h > 18 && h < 20.5) return (h - 18) / 2.5 * 0.5;
  if (h > 5.5 && h < 7.5) return (7.5 - h) / 2 * 0.5;
  return 0.5;
}
export function isLunch(h) { return h >= 11.75 && h <= 13.5; }

/* ---------------- sample data (labelled as sample in the UI) ---------------- */
export const HOSTS = [
  { id: 'mac', name: 'macbook', sub: 'local', lat: '' },
  { id: 'arch', name: 'arch-workstation', sub: 'ssh', lat: '14 ms' },
  { id: 'srv', name: 'home-server', sub: 'ssh', lat: '22 ms' }
];
export const PROJECTS = [
  { id: 'gramly', host: 'mac' }, { id: 'overview', host: 'mac' }, { id: 'culture', host: 'mac' }, { id: 'jb-site', host: 'mac' },
  { id: 'hangar-roadmap', host: 'arch' }, { id: 'flow', host: 'arch' },
  { id: 'monotub-api', host: 'srv' }, { id: 'live-cam', host: 'srv' }
];
export const INITIAL = [
  { id: 'g1', plot: 'gramly', agent: 'claude', state: 'wait', kind: 'command', since: 18, prio: 1, title: 'Fix sync conflict on reconnect', cmd: 'pnpm db:migrate', bubble: 'run pnpm db:migrate?', summary: 'patched the reconnect handler; needs a migration to verify' },
  { id: 'g2', plot: 'gramly', agent: 'codex', state: 'run', since: 12, title: 'Rewrite suggestion ranking', summary: '4 of 7 call sites moved to rank()' },
  { id: 'o1', plot: 'overview', agent: 'claude', state: 'run', since: 6, title: 'The living world', summary: 'writing the neighborhood generator' },
  { id: 'c1', plot: 'culture', agent: 'claude', state: 'done', since: 41, title: 'Landing page copy pass', summary: 'ready to review · 3 files · +84 −61' },
  { id: 'c2', plot: 'culture', agent: 'gemini', state: 'done', since: 25, title: 'Image alt text', summary: 'ready to review · 9 files' },
  { id: 'j1', plot: 'jb-site', agent: 'gemini', state: 'idle', since: 1560, title: 'Case study layout', summary: 'quiet 1 day · last: picked a grid' },
  { id: 'h1', plot: 'hangar-roadmap', agent: 'claude', state: 'wait', kind: 'question', since: 4, prio: 2, title: 'Pick the app shell', bubble: 'Electron or Tauri?', q: 'Electron or Tauri for P0? Comparison is in the session.', summary: 'compared both on Wayland' },
  { id: 'h2', plot: 'hangar-roadmap', agent: 'codex', state: 'done', since: 52, title: 'Roadmap link check', summary: 'ready to review · 0 dead links' },
  { id: 'f1', plot: 'flow', agent: 'codex', state: 'run', since: 23, title: 'Keyboard map', summary: '14 of 20 shortcuts · help overlay next' },
  { id: 'f2', plot: 'flow', agent: 'claude', state: 'err', since: 9, title: 'Timeline view tests', bubble: 'exit 1 · 3 failing', summary: 'pnpm test · exit 1 · 3 failing in Timeline.test.tsx' },
  { id: 'm1', plot: 'monotub-api', agent: 'claude', state: 'run', since: 15, title: 'Humidity alert endpoint', summary: 'schema done · wiring push' },
  { id: 'm2', plot: 'monotub-api', agent: 'codex', state: 'done', since: 31, title: 'Readings tests', summary: 'ready to review · 12 tests pass' },
  { id: 'l1', plot: 'live-cam', agent: 'gemini', state: 'idle', since: 2900, title: 'Stream reconnect', summary: 'quiet 2 days · flaky RTSP reconnect' }
];
export const EVENTS = [
  { id: 'f1', set: { state: 'done', since: 0, summary: 'ready to review · 6 files · +212 −9' }, msg: 'flow · codex finished keyboard map' },
  { id: 'o1', set: { state: 'wait', kind: 'question', prio: 2, since: 0, bubble: 'hide sleepers?', q: 'Show sleeping agents on the map, or hide them?' }, msg: 'overview · claude needs you' },
  { id: 'g1', set: { state: 'run', since: 0, summary: 'migration ran · verifying the reconnect test' }, msg: 'gramly · claude back to work after your approval' },
  { id: 'j1', set: { state: 'run', since: 0, summary: 'resumed: case study grid' }, msg: 'jb-site · gemini woke up and went back to its desk' },
  { id: 'm1', set: { state: 'done', since: 0, summary: 'ready to review · 5 files · tests pass' }, msg: 'monotub-api · claude finished the alert endpoint' },
  { id: 'g2', set: { state: 'err', since: 0, bubble: 'exit 2 · tsc', summary: 'tsc · exit 2 · 2 type errors in rank.ts' }, msg: 'gramly · codex failed: 2 type errors' }
];

export function byId(id) { return G.S.find((s) => s.id === id); }
export function projOf(s) { return PROJECTS.find((p) => p.id === s.plot); }
export function hostOf(s) { return HOSTS.find((h) => h.id === projOf(s).host); }
export function wantsDesk(s) { return s.state === 'run' || s.state === 'wait' || s.state === 'err'; }
export function waiting() { return G.S.filter((s) => s.state === 'wait').sort((a, b) => a.prio - b.prio || b.since - a.since); }

/* ---------------- direction mock: what the summarizer writes per session, and the project roll-up (P4) ---------------- */
const SUMS = {
  g1: { done: 'Patched the reconnect handler so offline edits merge instead of overwriting.', left: 'Verify against real data.', needs: 'Approve pnpm db:migrate so the fix can be verified.', next: 'Run the migration, then the sync tests.', priority: 'high' },
  g2: { done: 'Moved 4 of 7 call sites to the new rank().', left: '3 call sites in search.', needs: '', next: 'Finish the search call sites.', priority: 'normal' },
  o1: { done: 'Neighborhood generator draws islands side by side.', left: 'Label placement.', needs: '', next: 'Place machine flags.', priority: 'normal' },
  c1: { done: 'Rewrote the hero and FAQ copy, 3 files.', left: '', needs: '', next: 'Review the diff and merge.', priority: 'low' },
  c2: { done: 'Alt text for 9 images.', left: '', needs: '', next: 'Spot-check and merge.', priority: 'low' },
  j1: { done: 'Picked a 12-column grid for case studies.', left: 'Build the layout.', needs: '', next: 'Resume or archive.', priority: 'low' },
  h1: { done: 'Compared Electron and Tauri on Wayland: memory, startup, tray.', left: 'P0 shell.', needs: 'Pick Electron or Tauri for P0.', next: 'Scaffold the chosen shell.', priority: 'high' },
  h2: { done: 'Checked every roadmap link, none dead.', left: '', needs: '', next: 'Nothing; can be archived.', priority: 'low' },
  f1: { done: '14 of 20 shortcuts mapped.', left: '6 shortcuts and the help overlay.', needs: '', next: 'Help overlay.', priority: 'normal' },
  f2: { done: 'Timeline view refactor.', left: '3 failing tests in Timeline.test.tsx.', needs: 'Look at the failing timeline tests; it stopped after three retries.', next: 'Fix the date math in the fixtures.', priority: 'high' },
  m1: { done: 'Alert schema done.', left: 'Push delivery.', needs: '', next: 'Wire the push service.', priority: 'normal' },
  m2: { done: '12 readings tests pass.', left: '', needs: '', next: 'Review and merge.', priority: 'low' },
  l1: { done: 'Reproduced the RTSP reconnect bug.', left: 'The fix.', needs: '', next: 'Resume when you are back on it.', priority: 'low' }
};
INITIAL.forEach((s) => { if (SUMS[s.id]) s.sum = SUMS[s.id]; });
export const PSUM = {
  gramly: { at: 'Offline sync is fixed in code; ranking rewrite is half done.', next: 'Approve the migration. Everything else in gramly waits on it.' },
  overview: { at: 'The world draws; labels are being placed.', next: 'Keep going, nothing needed from you.' },
  culture: { at: 'Copy pass and alt text are both finished.', next: 'Review two diffs and merge.' },
  'jb-site': { at: 'Grid picked, layout not started. Quiet a day.', next: 'Resume or archive.' },
  'hangar-roadmap': { at: 'Shell comparison done, links checked.', next: 'Pick Electron or Tauri to unblock P0.' },
  flow: { at: 'Shortcuts 14 of 20; timeline tests broke.', next: 'Fix the 3 timeline tests first.' },
  'monotub-api': { at: 'Alerts half wired, readings tested.', next: 'Merge the tests while push is wired.' },
  'live-cam': { at: 'Reconnect bug reproduced, not fixed. Quiet 2 days.', next: 'Resume when you pick it back up.' }
};

// where each session runs right now (from ~/.claude/sessions/<pid>.json + the process tree); null = not open in any app
export const RUNS = {
  g1: { app: 'Orca', tty: 'ttys019', pid: 10130, open: '2h' }, g2: { app: 'Herdr', tty: 'ttys001', pid: 39695, open: '40m' },
  o1: { app: 'Ghostty', tty: 'ttys007', pid: 36911, open: '3h' }, c1: { app: 'Orca', tty: 'ttys017', pid: 27474, open: '5h' },
  h1: { app: 'Orca · ssh', tty: 'ttys014', pid: 20400, open: '1h' }, f1: { app: 'tmux · ssh', tty: 'pts/3', pid: 4412, open: '6h' },
  f2: { app: 'Orca · ssh', tty: 'ttys021', pid: 72496, open: '1h' }, m1: { app: 'tmux · ssh', tty: 'pts/1', pid: 911, open: '1d' },
  c2: null, j1: null, h2: null, m2: null, l1: null
};
INITIAL.forEach((s) => { s.run = RUNS[s.id] || null; });
