// UI and boot: input, camera follow, rail (now / tasks / brief), status bar, popovers, toast, demo, frame loop.
// The tracker only tracks: nothing here ever writes to an agent.
import { G, C, reduce, readSignal, clone, INITIAL, EVENTS, HOSTS, byId, hostOf, fmt, esc, wantsDesk, waiting, hourNow, nightFactor } from './core.js';
import { gene } from './creatures.js';
import { buildWorld } from './world.js';
import { body, simulate, settle, onStateChange, activity } from './life.js';
import { cv, stage, resize, fit, frameTo, stepZoom, glide, toW, draw, edgeMarkers, placeTip, minimap, mmJump, hitAgent, hitPlot, DIAM } from './render.js';

/* ---------------- boot ---------------- */
readSignal();
const q = new URLSearchParams(location.search); if (q.has('hour')) G.hourOverride = parseFloat(q.get('hour'));
G.S = clone(INITIAL); G.world = buildWorld(); G.S.forEach(body);
resize();
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
fit(true);
document.getElementById('crumb-n').textContent = ' · ' + G.S.length + ' agents on ' + HOSTS.length + ' machines';

/* ---------------- frame loop ---------------- */
let last = 0, drag = null;
function frame(now) {
  if (document.hidden) { requestAnimationFrame(frame); return; }
  const t = now / 1000, dt = Math.min(0.1, last ? t - last : 0); last = t; G.t = t;
  G.night = nightFactor(hourNow());
  const e = reduce ? 1 : Math.min(1, dt * 10);
  G.cam.u += (G.tgt.u - G.cam.u) * e; G.cam.v += (G.tgt.v - G.cam.v) * e; G.cam.z += (G.tgt.z - G.cam.z) * e; if (Math.abs(G.tgt.z - G.cam.z) < 0.002) G.cam.z = G.tgt.z;
  if (reduce) settle(); else simulate(dt, t);
  if (G.follow && G.bodies[G.follow]) { const fb = G.bodies[G.follow]; if (fb.path.length) { G.tgt.u = fb.u; G.tgt.v = fb.v; } else if (t > G.followUntil) G.follow = null; }
  draw(t);
  edgeMarkers(locate); placeTip(icon, drag && drag.moved); minimap(); clock();
  if (reduce) setTimeout(() => requestAnimationFrame(frame), 400); else requestAnimationFrame(frame);
}
let clockTxt = '';
function clock() { const h = hourNow(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60), part = G.night >= 0.45 ? 'night' : G.night > 0 ? (h < 12 ? 'dawn' : 'dusk') : 'day'; const s = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + ' · ' + part; if (s !== clockTxt) { clockTxt = s; document.getElementById('clock').textContent = s; } }

/* ---------------- input ---------------- */
function local(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * G.dpr, (e.clientY - r.top) * G.dpr]; }
const pointers = {}; let pinch = null, wheelAcc = 0;
stage.addEventListener('pointerdown', (e) => {
  if (e.target !== cv && e.target !== stage) return;
  stage.focus({ preventScroll: true }); closePop();
  pointers[e.pointerId] = [e.clientX, e.clientY];
  const ids = Object.keys(pointers);
  if (ids.length === 2) { const a = pointers[ids[0]], b = pointers[ids[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: G.tgt.z }; drag = null; return; }
  const L = local(e); stage.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, u: G.tgt.u, v: G.tgt.v, moved: false, agent: hitAgent(L[0], L[1]), plot: hitPlot(L[0], L[1]) };
});
stage.addEventListener('pointermove', (e) => {
  const L = local(e);
  if (pointers[e.pointerId]) pointers[e.pointerId] = [e.clientX, e.clientY];
  if (pinch) { const ids = Object.keys(pointers); if (ids.length < 2) return; const a = pointers[ids[0]], b = pointers[ids[1]]; G.tgt.z = G.cam.z = Math.max(G.levels[0], Math.min(G.levels[G.levels.length - 1], pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); zval(); return; }
  if (drag) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 3) drag.moved = true;
    if (drag.moved) { G.follow = null; stage.classList.add('panning'); const p = G.cam.z * G.dpr, da = (e.clientX - drag.x) * G.dpr / (16 * p), db = (e.clientY - drag.y) * G.dpr / (8 * p); G.tgt.u = drag.u - (da + db) / 2; G.tgt.v = drag.v - (db - da) / 2; G.cam.u = G.tgt.u; G.cam.v = G.tgt.v; }
    return;
  }
  if (e.pointerType === 'mouse') { G.hover.agent = hitAgent(L[0], L[1]); G.hover.plot = G.hover.agent ? null : hitPlot(L[0], L[1]); stage.classList.toggle('over-agent', !!(G.hover.agent || G.hover.plot)); }
});
function endPointer(e) {
  delete pointers[e.pointerId];
  if (pinch) { if (Object.keys(pointers).length < 2) { let best = G.levels[0]; for (const l of G.levels) if (Math.abs(l - G.tgt.z) < Math.abs(best - G.tgt.z)) best = l; G.tgt.z = best; zval(); pinch = null; } drag = null; return; }
  if (!drag) return;
  if (!drag.moved) { if (drag.agent) select(drag.agent, true); else if (drag.plot) { const first = G.S.find((s) => s.plot === drag.plot); select(first ? first.id : null, true); } else select(null); }
  drag = null; stage.classList.remove('panning');
}
stage.addEventListener('pointerup', endPointer); stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('pointerleave', () => { G.hover = { agent: null, plot: null }; });
stage.addEventListener('wheel', (e) => {
  e.preventDefault(); const L = local(e);
  if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) { wheelAcc += e.deltaY; if (Math.abs(wheelAcc) > 60) { stepZoom(wheelAcc > 0 ? -1 : 1, L[0], L[1]); zval(); wheelAcc = 0; } }
  else { const p = G.cam.z * G.dpr, da = -e.deltaX * G.dpr / (16 * p); G.tgt.u -= da / 2; G.tgt.v += da / 2; if (reduce) Object.assign(G.cam, G.tgt); }
}, { passive: false });
function locate(id) { const s = byId(id); if (!s) return; select(id, true); const b = body(s); glide(b.u, b.v); zval(); G.follow = id; G.followUntil = performance.now() / 1000 + 4; }
function nextWaiting() { const w = waiting(); if (!w.length) { toast('Nothing is waiting on you'); return; } const i = G.selId ? w.findIndex((s) => s.id === G.selId) : -1; locate(w[(i + 1) % w.length].id); }
stage.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { const w = waiting(); if (!w.length) return; const i = G.selId ? w.findIndex((s) => s.id === G.selId) : -1, n = e.shiftKey ? i - 1 : i + 1; if (n < 0 || n >= w.length) return; e.preventDefault(); locate(w[n].id); return; }
  const map = { ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1] };
  if (map[e.key]) { e.preventDefault(); G.tgt.u += map[e.key][0]; G.tgt.v += map[e.key][1]; if (reduce) Object.assign(G.cam, G.tgt); return; }
  if (e.key === '+' || e.key === '=') { stepZoom(1); zval(); } else if (e.key === '-') { stepZoom(-1); zval(); } else if (e.key === 'f' || e.key === 'F') { fit(); zval(); } else if (e.key === 'Enter' && G.selId) openInOrca(G.selId); else if (e.key === 'Escape') { select(null); closePop(); }
});
function zval() { document.getElementById('zval').textContent = (Math.round(G.tgt.z * 100) / 100) + '×'; }
document.getElementById('zin').addEventListener('click', () => { stepZoom(1); zval(); });
document.getElementById('zout').addEventListener('click', () => { stepZoom(-1); zval(); });
document.getElementById('zfit').addEventListener('click', () => { fit(); zval(); });
const mm = document.getElementById('mm'); let mmDown = false;
mm.addEventListener('pointerdown', (e) => { mmDown = true; mm.setPointerCapture(e.pointerId); mmJump(e); e.stopPropagation(); });
mm.addEventListener('pointermove', (e) => { if (mmDown) mmJump(e); });
mm.addEventListener('pointerup', () => { mmDown = false; });

/* ---------------- popovers ---------------- */
let popEl = null, popFor = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } if (popFor) { popFor.setAttribute('aria-expanded', 'false'); popFor = null; } }
function openPop(anchor, html, where) {
  const same = popFor === anchor; closePop(); if (same) return;
  popEl = document.createElement('div'); popEl.className = 'pop'; popEl.setAttribute('role', 'dialog'); popEl.innerHTML = html; document.body.appendChild(popEl);
  const r = anchor.getBoundingClientRect(), pw = popEl.offsetWidth, ph = popEl.offsetHeight;
  popEl.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, where === 'below' ? r.right - pw : r.left)) + 'px';
  popEl.style.top = Math.max(8, (where === 'below' ? r.bottom + 6 : r.top - ph - 6) + window.scrollY) + 'px';
  anchor.setAttribute('aria-expanded', 'true'); popFor = anchor;
  popEl.addEventListener('click', (e) => { const el = e.target.closest('[data-loc]'); if (el) { locate(el.getAttribute('data-loc')); closePop(); } });
}
document.addEventListener('pointerdown', (e) => { if (popEl && !popEl.contains(e.target) && !(popFor && popFor.contains(e.target))) closePop(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePop();
  if ((e.key === 'l' || e.key === 'L') && G.selId && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !(e.target.closest && e.target.closest('input, textarea'))) { e.preventDefault(); locate(G.selId); }
});
document.getElementById('help').addEventListener('click', (e) => {
  openPop(e.currentTarget, '<h4>on the map</h4>' +
    '<div class="lg">' + icon('run') + 'typing at its slab: running</div><div class="lg">' + icon('wait') + 'hopping under a diamond: needs you</div><div class="lg">' + icon('err') + 'melted by a cracked slab: failed</div><div class="lg">' + icon('done') + 'free: lives by its needs</div><div class="lg">' + icon('idle') + 'asleep: quiet a day or more</div>' +
    '<div class="sep"></div><h4>the world</h4><div class="lg">each machine is an island; its commons has four zones: rest, snack, circle, play</div><div class="lg">free creatures pick what they need most: energy, hunger, social, fun</div><div class="lg">hover a creature to see its needs; zoom in to read speech</div>' +
    '<div class="sep"></div><h4>keys</h4><div class="keys"><kbd>Tab</kbd><span>next agent that needs you</span><kbd>l</kbd><span>go to the selected agent</span><kbd>Enter</kbd><span>open the selected agent in Orca</span><kbd>f</kbd><span>fit every neighborhood</span><kbd>+ −</kbd><span>zoom</span><kbd>Esc</kbd><span>clear selection</span></div>', 'below');
});
function flyTo(hid) { const h = G.world.hoods.find((x) => x.h.id === hid); if (h) { frameTo([h]); zval(); } }
function listPop(anchor, state, title) {
  const arr = G.S.filter((s) => s.state === state);
  let h = '<h4>' + title + ' · ' + arr.length + '</h4>' + (arr.length ? '' : '<div class="lg">none right now</div>');
  for (const s of arr) h += '<button class="pi" type="button" data-loc="' + s.id + '">' + icon(s.state) + '<span>' + esc(s.title) + '</span><span class="a">' + fmt(s.since) + '</span><span class="m">' + s.plot + ' · ' + esc(gene(s.id).name) + ' · ' + esc(activity(s) || s.summary) + '</span></button>';
  openPop(anchor, h, 'above');
}

/* ---------------- rail ---------------- */
export function icon(st) {
  if (st === 'wait') return DIAM;
  if (st === 'done') return '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.8 9 9.8 3" fill="none" stroke="var(--done)" stroke-width="1.5"/></svg>';
  if (st === 'err') return '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" stroke="var(--err)" stroke-width="1.5"/></svg>';
  if (st === 'idle') return '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.6" fill="none" stroke="var(--subtle)" stroke-width="1.2"/></svg>';
  return '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><g fill="var(--run)"><circle cx="4" cy="2.5" r="1"/><circle cx="8" cy="2.5" r="1"/><circle cx="4" cy="6" r="1"/><circle cx="8" cy="6" r="1"/><circle cx="4" cy="9.5" r="1"/><circle cx="8" cy="9.5" r="1"/></g></svg>';
}
const TRACKED = '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.8 9 9.8 3" fill="none" stroke="var(--dim)" stroke-width="1.5"/></svg>';
const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.8 9 9.8 3" fill="none" stroke="var(--side)" stroke-width="2"/></svg>';
const GROUPS = [['wait', 'needs you'], ['err', 'failed'], ['run', 'running'], ['done', 'done'], ['idle', 'asleep']];
let filter = null, tab = 'now';
const pNow = document.getElementById('p-now'), pTasks = document.getElementById('p-tasks'), pBrief = document.getElementById('p-brief'), chips = document.getElementById('chips');
function renderChips() { chips.innerHTML = GROUPS.map((g) => { const n = G.S.filter((s) => s.state === g[0]).length; return '<button class="chip' + (n ? '' : ' zero') + '" type="button" data-f="' + g[0] + '" aria-pressed="' + (filter === g[0]) + '">' + icon(g[0]) + '<b>' + n + '</b>' + g[1] + '</button>'; }).join(''); }
chips.addEventListener('click', (e) => { const c = e.target.closest('[data-f]'); if (!c) return; const f = c.getAttribute('data-f'); filter = filter === f ? null : f; renderNow(); });
function renderNow() {
  renderChips(); let h = '';
  for (const g of GROUPS) {
    if (filter && filter !== g[0]) continue;
    const arr = G.S.filter((s) => s.state === g[0]); if (g[0] === 'wait') arr.sort((a, b) => a.prio - b.prio || b.since - a.since);
    if (!arr.length && g[0] !== 'wait' && !filter) continue;
    h += '<div class="sh ' + g[0] + '">' + icon(g[0]) + '<span>' + g[1] + '</span><span class="n">' + arr.length + '</span></div>';
    if (!arr.length) { h += '<div class="empty">' + (g[0] === 'wait' ? 'Nothing is waiting on you.' : 'None right now.') + '</div>'; continue; }
    for (const s of arr) {
      if (s.state === 'wait' || s.state === 'err') {
        const tracked = taskForSession(s.id);
        h += '<div class="card' + (s.state === 'err' ? ' err' : '') + (G.selId === s.id ? ' sel' : '') + '" data-id="' + s.id + '" tabindex="0"><div class="ct">' + esc(s.title) + '</div><div class="cm">' + esc(gene(s.id).name) + ' · ' + s.agent + ' · ' + hostOf(s).name + ':' + s.plot + '</div>' +
          '<div class="cs">' + icon(s.state) + '<span>' + (s.state === 'err' ? 'failed and stopped' : s.kind === 'command' ? 'wants to run a command' : 'is asking a question') + '</span><em>' + (s.state === 'err' ? '' : 'waiting ') + fmt(s.since) + '</em></div>' +
          (s.cmd ? '<div class="cmd"><i>$</i> ' + esc(s.cmd) + '</div>' : s.q ? '<div class="q">' + esc(s.q) + '</div>' : '<div class="cmd">' + esc(s.summary) + '</div>') +
          '<div class="acts"><button class="btn pri" type="button" data-open="' + s.id + '"><kbd>Enter</kbd>open in orca</button><button class="btn" type="button" data-locate="' + s.id + '"><kbd>l</kbd>locate</button>' + (tracked ? '<button class="btn plain" type="button" data-gotask="1">' + TRACKED + 'tracked</button>' : '<button class="btn plain" type="button" data-track="' + s.id + '">track</button>') + '</div></div>';
      } else h += '<div class="row' + (G.selId === s.id ? ' sel' : '') + '" data-id="' + s.id + '" tabindex="0">' + icon(s.state) + '<span class="rt">' + esc(s.title) + '</span><span class="ra">' + fmt(s.since) + '</span><span class="rs">' + s.plot + ' · ' + esc(gene(s.id).name) + ' · ' + esc(s.summary) + '</span></div>';
    }
  }
  pNow.innerHTML = h;
}

/* tracker */
let TASKS = [];
try { TASKS = JSON.parse(localStorage.getItem('overview.tasks.v4') || '[]') || []; } catch (e) { TASKS = []; }
function saveTasks() { try { localStorage.setItem('overview.tasks.v4', JSON.stringify(TASKS)); } catch (e) { /* storage blocked: tasks live for this visit only */ } }
function taskForSession(id) { return TASKS.find((t) => t.src === id && !t.doneAt) || null; }
function taskTitle(s) { return s.state === 'err' ? 'Fix ' + s.title[0].toLowerCase() + s.title.slice(1) : s.cmd ? 'Approve ' + s.cmd : 'Answer: ' + (s.bubble || s.title); }
function addTask(title, src, from, extra) { TASKS.unshift(Object.assign({ id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), title, src: src || null, from: from || 'you', at: Date.now(), doneAt: null }, extra || {})); saveTasks(); renderAll(); }
function autoTasks() { for (const s of G.S) { const sig = s.state + '|' + (s.cmd || s.bubble || ''); if ((s.state === 'wait' || s.state === 'err') && !taskForSession(s.id) && !TASKS.some((t) => t.src === s.id && t.sig === sig)) TASKS.unshift({ id: 't-' + s.id + '-' + Date.now().toString(36), title: taskTitle(s) + ' (' + s.plot + ')', src: s.id, from: s.state === 'err' ? 'failed' : 'needs you', at: Date.now(), doneAt: null, sig }); } saveTasks(); }
const hhmm = (ms) => { const d = new Date(ms); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); };
function renderTasks() {
  const open = TASKS.filter((t) => !t.doneAt), done = TASKS.filter((t) => t.doneAt).sort((a, b) => b.doneAt - a.doneAt);
  document.getElementById('tcount').textContent = open.length || '';
  let h = '<form class="add" id="addf"><input id="addi" type="text" placeholder="Add a task, then press Enter" aria-label="New task" autocomplete="off"><button class="btn plain" type="submit">add</button></form>';
  h += '<div class="sh"><span>to do</span><span class="n">' + open.length + '</span></div>';
  if (!open.length) h += '<div class="empty">Nothing to do. Tasks appear here when an agent needs you, or when you track a brief item.</div>';
  for (const t of open) {
    const s = t.src && byId(t.src), moved = s && t.sig && s.state + '|' + (s.cmd || s.bubble || '') !== t.sig;
    h += '<div class="task"><button class="box" type="button" data-check="' + t.id + '" aria-label="Mark done: ' + esc(t.title) + '">' + CHECK + '</button><span class="tt"' + (s ? ' data-loc="' + s.id + '"' : '') + '>' + esc(t.title) + '</span><span class="ta">' + fmt(Math.floor((Date.now() - t.at) / 60000)) + '</span>' +
      '<span class="tm">' + (s ? icon(s.state) + '<span>' + s.plot + ' · ' + esc(gene(s.id).name) + '</span>' : '') + '<span>from ' + esc(t.from) + '</span><button class="rm" type="button" data-rm="' + t.id + '">remove</button></span>' +
      (moved ? '<span class="hint">' + icon('done') + 'agent moved on · <button type="button" data-check="' + t.id + '">mark done</button></span>' : '') + '</div>';
  }
  if (done.length) { h += '<div class="sh done">' + icon('done') + '<span>done</span><span class="n">' + done.length + '</span></div>'; for (const t of done.slice(0, 12)) h += '<div class="task done"><button class="box" type="button" data-uncheck="' + t.id + '" aria-label="Reopen: ' + esc(t.title) + '">' + CHECK + '</button><span class="tt">' + esc(t.title) + '</span><span class="ta">done ' + hhmm(t.doneAt) + '</span></div>'; }
  pTasks.innerHTML = h;
}
pTasks.addEventListener('submit', (e) => { e.preventDefault(); const v = document.getElementById('addi').value.trim(); if (v) { addTask(v, null, 'you'); const ni = document.getElementById('addi'); if (ni) ni.focus(); } });
pTasks.addEventListener('click', (e) => {
  const c = e.target.closest('[data-check]'), u = e.target.closest('[data-uncheck]'), r = e.target.closest('[data-rm]'), l = e.target.closest('[data-loc]');
  if (c) { const t = TASKS.find((x) => x.id === c.getAttribute('data-check')); if (t) { t.doneAt = Date.now(); saveTasks(); renderAll(); toast('Done: ' + t.title); } return; }
  if (u) { const t = TASKS.find((x) => x.id === u.getAttribute('data-uncheck')); if (t) { t.doneAt = null; saveTasks(); renderAll(); } return; }
  if (r) { TASKS = TASKS.filter((x) => x.id !== r.getAttribute('data-rm')); saveTasks(); renderAll(); return; }
  if (l) locate(l.getAttribute('data-loc'));
});
const BRIEF = [
  { id: 'b1', src: 'g1', title: 'Approve the gramly migration', body: 'The sync fix waits on pnpm db:migrate. Everything else in gramly is behind it.' },
  { id: 'b2', src: 'f2', title: 'Look at the flow timeline tests', body: '3 tests fail in Timeline.test.tsx. The agent stopped after three retries.' },
  { id: 'b3', src: 'h1', title: 'Pick Electron or Tauri for Hangar', body: 'One answer unblocks P0. The comparison is in the session.' },
  { id: 'b4', src: 'c1', title: 'Review the culture copy pass', body: '3 files changed in the hero and FAQ. Ready since yesterday.' },
  { id: 'b5', src: 'j1', title: 'Resume or archive jb-site', body: 'Quiet for a day. Last step was picking a grid.' }
];
const briefTracked = (b) => TASKS.some((t) => !t.doneAt && (t.brief === b.id || (b.src && t.src === b.src)));
function renderBrief() {
  let h = '<h2>Three things first</h2><p class="by">from ' + G.S.length + ' sessions on ' + HOSTS.length + ' machines · sample</p><div class="sh"><span>start here</span></div>';
  BRIEF.forEach((b, i) => {
    if (i === 3) h += '<div class="sh"><span>when you have a minute</span></div>';
    h += '<div class="bi"><span class="n">' + (i + 1) + '</span><span class="bt">' + esc(b.title) + '</span><span class="bs">' + esc(b.body) + '</span><div class="acts"><button class="btn plain" type="button" data-loc="' + b.src + '">locate</button>' + (briefTracked(b) ? '<button class="btn plain" type="button" data-gotask="1">' + TRACKED + 'tracked</button>' : '<button class="btn plain" type="button" data-btrack="' + b.id + '">track</button>') + '</div></div>';
  });
  pBrief.innerHTML = h;
}
pBrief.addEventListener('click', (e) => {
  const t = e.target.closest('[data-btrack]'), l = e.target.closest('[data-loc]'), g = e.target.closest('[data-gotask]');
  if (t) { const b = BRIEF.find((x) => x.id === t.getAttribute('data-btrack')); addTask(b.title, b.src, 'brief', { brief: b.id }); toast('Tracking: ' + b.title); return; }
  if (g) { showTab('tasks'); return; }
  if (l) locate(l.getAttribute('data-loc'));
});
function renderStatus() {
  const n = (st) => G.S.filter((s) => s.state === st).length;
  document.getElementById('status').innerHTML = '<button class="sb brand" type="button" id="sb-fit" title="Fit every neighborhood">overview</button>' +
    '<button class="sb wait" type="button" id="sb-wait" title="Jump to the next agent that needs you">' + icon('wait') + n('wait') + ' needs you</button>' +
    (n('err') ? '<button class="sb err" type="button" data-sl="err" aria-expanded="false">' + icon('err') + n('err') + ' failed</button>' : '') +
    '<button class="sb" type="button" data-sl="run" aria-expanded="false">' + icon('run') + n('run') + ' running</button>' +
    '<button class="sb done" type="button" data-sl="done" aria-expanded="false">' + icon('done') + n('done') + ' done</button>' +
    '<button class="sb" type="button" data-sl="idle" aria-expanded="false">' + icon('idle') + n('idle') + ' asleep</button>' +
    '<span class="sp"></span>' + HOSTS.map((h) => '<button class="sb host" type="button" data-fly="' + h.id + '" title="Fly to ' + h.name + '">' + h.name + (h.lat ? ' ' + h.lat : '') + '</button>').join('');
}
document.getElementById('status').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'sb-fit') { closePop(); fit(); zval(); return; }
  if (b.id === 'sb-wait') { closePop(); nextWaiting(); return; }
  if (b.hasAttribute('data-fly')) { closePop(); flyTo(b.getAttribute('data-fly')); return; }
  const st = b.getAttribute('data-sl'); if (st) listPop(b, st, { run: 'running', done: 'done', err: 'failed', idle: 'asleep' }[st]);
});
function renderAll() { autoTasks(); renderNow(); renderTasks(); renderBrief(); renderStatus(); }
function select(id, fromMap) {
  G.selId = id || null; renderNow();
  if (id && fromMap && tab === 'now') { const el = pNow.querySelector('[data-id="' + id + '"]'); if (el && window.matchMedia('(min-width: 861px)').matches) el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }
}
function openInOrca(id) { const s = byId(id); toast('Prototype: would focus ' + s.plot + ' · ' + s.agent + ' in Orca'); }
pNow.addEventListener('click', (e) => {
  const o = e.target.closest('[data-open]'); if (o) { openInOrca(o.getAttribute('data-open')); return; }
  const tr = e.target.closest('[data-track]'); if (tr) { const s = byId(tr.getAttribute('data-track')); addTask(taskTitle(s) + ' (' + s.plot + ')', s.id, s.state === 'err' ? 'failed' : 'needs you'); toast('Tracking: ' + taskTitle(s)); return; }
  if (e.target.closest('[data-gotask]')) { showTab('tasks'); return; }
  const l = e.target.closest('[data-locate]') || e.target.closest('[data-id]'); if (!l) return;
  locate(l.getAttribute('data-locate') || l.getAttribute('data-id'));
});
pNow.addEventListener('keydown', (e) => { const el = e.target.closest('[data-id]'); if (!el || e.target.closest('button')) return; if (e.key === 'Enter') { e.preventDefault(); openInOrca(el.getAttribute('data-id')); } else if (e.key === ' ') { e.preventDefault(); locate(el.getAttribute('data-id')); } });
const TABS = { now: [document.getElementById('t-now'), document.getElementById('v-now')], tasks: [document.getElementById('t-tasks'), pTasks], brief: [document.getElementById('t-brief'), pBrief] };
function showTab(w) { tab = w; for (const k in TABS) { TABS[k][0].setAttribute('aria-selected', k === w); if (k === 'now') TABS[k][1].style.display = k === w ? 'flex' : 'none'; else TABS[k][1].hidden = k !== w; } }
for (const k in TABS) TABS[k][0].addEventListener('click', () => showTab(k));

/* ---------------- toast + demo ---------------- */
const toastEl = document.getElementById('toast'); let tt;
function toast(m) { toastEl.textContent = m; toastEl.classList.remove('off'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.add('off'), 3200); }
let ev = 0, demoT = null; const demoBtn = document.getElementById('demo');
function demoStep() {
  if (ev >= EVENTS.length) {
    const before = G.S.map((s) => s.state); G.S = clone(INITIAL); ev = 0;
    G.S.forEach((s, i) => { if (before[i] !== s.state) onStateChange(s, before[i]); });
    renderAll(); toast('Demo reset to the morning state'); return;
  }
  const e = EVENTS[ev++], s = byId(e.id), prev = s.state; Object.assign(s, e.set);
  if (s.state !== 'wait') { delete s.cmd; if (e.set.state) delete s.q; if (s.state !== 'err') delete s.bubble; }
  onStateChange(s, prev); renderAll(); toast(e.msg);
}
function setDemo(on) { demoBtn.setAttribute('aria-pressed', on); clearInterval(demoT); if (on) demoT = setInterval(demoStep, 12000); }
demoBtn.addEventListener('click', () => setDemo(demoBtn.getAttribute('aria-pressed') !== 'true'));

zval(); renderAll(); setDemo(!reduce);
requestAnimationFrame(frame);
