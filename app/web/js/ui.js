// UI and boot: input, camera follow, the info panel (machine, project), rail (now / tasks / brief), status bar, popovers, toast, demo, frame loop.
// The tracker only tracks: nothing here ever writes to an agent.
import { G, C, reduce, readSignal, clone, INITIAL, EVENTS, HOSTS, PROJECTS, PSUM, byId, hostOf, fmt, esc, wantsDesk, waiting, hourNow, nightFactor } from './core.js';
import { gene } from './creatures.js';
import { buildWorld } from './world.js';
import { body, simulate, settle, onStateChange, activity, resetLife } from './life.js';
import { live, loadReal, watch, act, where, meta, refreshNow } from './source.js';
import { cv, stage, resize, fit, frameTo, stepZoom, glide, toW, draw, edgeMarkers, placeTip, minimap, mmJump, hitAgent, hitArea, DIAM } from './render.js';

/* ---------------- boot ---------------- */
readSignal();
const q = new URLSearchParams(location.search); if (q.has('hour')) G.hourOverride = parseFloat(q.get('hour'));
// inside the app: the real sessions of this machine replace the sample data before the world is built
await loadReal();
G.S = clone(INITIAL); G.world = buildWorld(); G.S.forEach(body);
resize();
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
fit(true);
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
function crumb() { document.getElementById('crumb-n').textContent = ' · ' + plural(G.S.length, 'agent', 'agents') + ' on ' + plural(HOSTS.length, 'machine', 'machines'); }
crumb();

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
  edgeMarkers(locate); placeTip(icon, drag && drag.moved); minimap(); clock(); if (t > infoAt) { infoAt = t + 0.5; renderInfo(); }
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
  drag = { x: e.clientX, y: e.clientY, u: G.tgt.u, v: G.tgt.v, moved: false, agent: hitAgent(L[0], L[1]), area: hitArea(L[0], L[1]) };
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
  if (e.pointerType === 'mouse') { G.hover.agent = hitAgent(L[0], L[1]); G.hover.area = G.hover.agent ? null : hitArea(L[0], L[1]); stage.classList.toggle('over-agent', !!(G.hover.agent || G.hover.area)); }
});
function endPointer(e) {
  delete pointers[e.pointerId];
  if (pinch) { if (Object.keys(pointers).length < 2) { let best = G.levels[0]; for (const l of G.levels) if (Math.abs(l - G.tgt.z) < Math.abs(best - G.tgt.z)) best = l; G.tgt.z = best; zval(); pinch = null; } drag = null; return; }
  if (!drag) return;
  if (!drag.moved) { if (drag.agent) { openInfo(null); revealSession(drag.agent); } else if (drag.area) openInfo(drag.area); else clearReveal(); }
  drag = null; stage.classList.remove('panning');
}
stage.addEventListener('pointerup', endPointer); stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('pointerleave', () => { G.hover = { agent: null, area: null }; });
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
  if (e.key === '+' || e.key === '=') { stepZoom(1); zval(); } else if (e.key === '-') { stepZoom(-1); zval(); } else if (e.key === 'f' || e.key === 'F') { fit(); zval(); } else if (e.key === 'Enter' && G.selId) go(G.selId); else if (e.key === 'Escape') { if (G.sel.area) openInfo(null); else select(null); closePop(); }
});
function zval() { document.getElementById('zval').textContent = (Math.round(G.tgt.z * 100) / 100) + '×'; }
document.getElementById('zin').addEventListener('click', () => { stepZoom(1); zval(); });
document.getElementById('zout').addEventListener('click', () => { stepZoom(-1); zval(); });
document.getElementById('zfit').addEventListener('click', () => { fit(); zval(); });
const mm = document.getElementById('mm'); let mmDown = false;
mm.addEventListener('pointerdown', (e) => { mmDown = true; mm.setPointerCapture(e.pointerId); mmJump(e); e.stopPropagation(); });
mm.addEventListener('pointermove', (e) => { if (mmDown) mmJump(e); });
mm.addEventListener('pointerup', () => { mmDown = false; });

/* ---------------- the info panel: click a machine or a project ---------------- */
const infoEl = document.getElementById('info'); let infoAt = 0, infoKey = '';
const WORDS = { run: 'running', wait: 'needs you', done: 'done', err: 'failed', idle: 'asleep' }, ORDER = ['wait', 'err', 'run', 'done', 'idle'];
function openInfo(area) { G.sel.area = area; infoKey = ''; renderInfo(); }
function counts(list) { return ORDER.filter((st) => list.some((s) => s.state === st)).map((st) => '<span class="info-count">' + icon(st) + list.filter((s) => s.state === st).length + ' ' + WORDS[st] + '</span>').join(''); }
function sessionRow(s) {
  const what = wantsDesk(s) || s.state === 'idle' ? s.summary : activity(s);
  return '<button class="sg-row" type="button" data-loc="' + s.id + '">' + icon(s.state) + '<span class="sg-row__title">' + esc(s.title) + '</span><span class="sg-row__age">' + fmt(s.since) + '</span><span class="sg-row__meta">' + esc(gene(s.id).name) + ' · ' + s.agent + ' · ' + esc(what) + '</span></button>';
}
// a free blob is away when it is visiting another plot
const awayFrom = (s) => { const b = G.bodies[s.id], here = b && G.world.roomAt[Math.floor(b.u) + ',' + Math.floor(b.v)]; return b && !wantsDesk(s) && s.state !== 'idle' && here && here.project !== s.plot ? here.project : null; };
function renderInfo() {
  const a = G.sel.area; if (!a) { if (!infoEl.hidden) { infoEl.hidden = true; infoKey = ''; } return; }
  let head = '', sub = '', body = '';
  if (a.kind === 'plot') {
    const room = G.world.offices[a.id], h = room.hood.h, list = G.S.filter((s) => s.plot === a.id), guests = G.S.filter((s) => s.plot !== a.id && awayFrom(s) === a.id);
    head = a.id; sub = h.name + ' · ' + list.length + (list.length > 1 ? ' agents' : ' agent');
    const home = list.find((x) => x.cwd);
    if (home) sub += ' · ' + where(home.cwd);
    body = '<div class="info-counts">' + counts(list) + '</div><div class="info-list">' + list.map(sessionRow).join('') + '</div>' +
      (live && home ? '<div class="info-foot"><button class="sg-btn" type="button" data-reveal="' + home.id + '">show folder</button></div>' : '') +
      '<div class="info-foot">' + (guests.length ? 'visiting now: ' + guests.map((s) => esc(gene(s.id).name) + ' from ' + s.plot).join(', ') : 'a finished agent naps or plays by its slab; the slab shows its session') + '</div>';
  } else {
    const isl = G.world.hoods.find((x) => x.h.id === a.id), h = isl.h, list = G.S.filter((s) => hostOf(s).id === h.id), out = list.filter(awayFrom);
    head = h.name; sub = (h.sub === 'local' ? 'this computer' : 'ssh' + (h.lat ? ' · ' + h.lat : '')) + ' · ' + isl.rooms.length + ' projects · ' + list.length + ' agents';
    body = '<div class="info-counts">' + counts(list) + '</div><div class="info-list">' + isl.rooms.map((r) => { const ps = G.S.filter((s) => s.plot === r.project); return '<button class="sg-row info-project" type="button" data-plot="' + r.project + '"><span class="sg-row__title">' + esc(r.project) + '</span><span class="sg-row__age">' + ps.map((s) => icon(s.state)).join('') + '</span><span class="sg-row__meta">' + ps.length + (ps.length > 1 ? ' agents' : ' agent') + ' · ' + ps.map((s) => esc(gene(s.id).name)).join(', ') + '</span></button>'; }).join('') + '</div>' +
      (out.length ? '<div class="info-foot">out visiting: ' + out.map((s) => esc(gene(s.id).name) + ' at ' + awayFrom(s)).join(', ') + '</div>' : '');
  }
  const key = head + sub + body; if (key === infoKey) return; infoKey = key;
  infoEl.innerHTML = '<div class="info-head"><div><div class="info-title">' + esc(head) + '</div><div class="info-sub">' + esc(sub) + '</div></div><button class="sg-icon-btn" type="button" aria-label="Close">' + '<svg class="sg-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" stroke="currentColor" stroke-width="1.3"/></svg></button></div>' + body;
  infoEl.hidden = false;
}
infoEl.addEventListener('click', (e) => {
  if (e.target.closest('.sg-icon-btn')) { openInfo(null); return; }
  const rv = e.target.closest('[data-reveal]'); if (rv) { revealFolder(rv.getAttribute('data-reveal')); return; }
  // a session here works like clicking its blob: the map flies to it and the side panel opens its row; this panel stays open
  const loc = e.target.closest('[data-loc]'); if (loc) { const id = loc.getAttribute('data-loc'); revealSession(id); locate(id); return; }
  const pl = e.target.closest('[data-plot]'); if (pl) { const r = G.world.offices[pl.getAttribute('data-plot')]; openInfo({ kind: 'plot', id: r.project }); frameTo([{ u0: r.u0, v0: r.v0, u1: r.u0 + r.w, v1: r.v0 + r.d }]); zval(); }
});
infoEl.addEventListener('pointerdown', (e) => e.stopPropagation());

/* ---------------- popovers ---------------- */
let popEl = null, popFor = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } if (popFor) { popFor.setAttribute('aria-expanded', 'false'); popFor = null; } }
function openPop(anchor, html, where) {
  const same = popFor === anchor; closePop(); if (same) return;
  popEl = document.createElement('div'); popEl.className = 'sg-popover popover-floating'; popEl.setAttribute('role', 'dialog'); popEl.innerHTML = html; document.body.appendChild(popEl);
  const r = anchor.getBoundingClientRect(), pw = popEl.offsetWidth, ph = popEl.offsetHeight;
  popEl.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, where === 'below' ? r.right - pw : r.left)) + 'px';
  popEl.style.top = Math.max(8, (where === 'below' ? r.bottom + 6 : r.top - ph - 6) + window.scrollY) + 'px';
  anchor.setAttribute('aria-expanded', 'true'); popFor = anchor;
  popEl.addEventListener('click', (e) => { const el = e.target.closest('[data-loc]'); if (el) { const id = el.getAttribute('data-loc'); closePop(); revealSession(id); locate(id); } });
}
document.addEventListener('pointerdown', (e) => { if (popEl && !popEl.contains(e.target) && !(popFor && popFor.contains(e.target))) closePop(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!setEl.hidden) { if (addOpen) { addOpen = false; renderSettings(); } else closeSettings(); } else if (popEl) closePop(); else clearReveal(); }
  if ((e.key === 'l' || e.key === 'L') && G.selId && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !(e.target.closest && e.target.closest('input, textarea'))) { e.preventDefault(); locate(G.selId); }
});
document.getElementById('help').addEventListener('click', (e) => {
  const legend = (text, glyph = '') => '<div class="sg-popover__legend">' + glyph + text + '</div>', rule = '<div class="sg-popover__rule"></div>', title = (text) => '<h4 class="sg-popover__title">' + text + '</h4>';
  openPop(e.currentTarget, title('on the map') +
    legend('typing at its slab: running', icon('run')) + legend('hopping under a diamond: needs you', icon('wait')) + legend('melted by a cracked slab: failed', icon('err')) + legend('free: lives by its needs', icon('done')) + legend('asleep: quiet a day or more', icon('idle')) +
    rule + title('the world') + legend('each machine is an island of project plots; each desk has its slab') + legend('click an agent to open it in the side panel; click a project or a machine for its details') + legend('finished agents nap or play by their slab, and visit friends; work always calls them back') + legend('zoom in to read speech') +
    rule + title('keys') + '<div class="sg-popover__keys"><kbd>Tab</kbd><span>next agent that needs you</span><kbd>Enter</kbd><span>open or close the focused row</span><kbd>f</kbd><span>fit every neighborhood</span><kbd>+ −</kbd><span>zoom</span><kbd>Esc</kbd><span>clear selection</span></div>', 'below');
});
function flyTo(hid) { const h = G.world.hoods.find((x) => x.h.id === hid); if (h) { frameTo([h]); zval(); } }
function listPop(anchor, state, title) {
  const arr = G.S.filter((s) => s.state === state);
  let h = '<h4 class="sg-popover__title">' + title + ' · ' + arr.length + '</h4>' + (arr.length ? '' : '<div class="sg-popover__legend">none right now</div>');
  for (const s of arr) h += '<button class="sg-row sg-row--menu" type="button" data-loc="' + s.id + '">' + icon(s.state) + '<span class="sg-row__title">' + esc(s.title) + '</span><span class="sg-row__age">' + fmt(s.since) + '</span><span class="sg-row__meta">' + s.plot + ' · ' + esc(gene(s.id).name) + ' · ' + esc(activity(s) || s.summary) + '</span></button>';
  openPop(anchor, h, 'above');
}

/* ---------------- rail ---------------- */
export function icon(st, still) {
  if (st === 'wait') return DIAM;
  if (st === 'done') return '<svg class="sg-icon sg-tone-done" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.8 9 9.8 3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  if (st === 'err') return '<svg class="sg-icon sg-tone-err" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" stroke="currentColor" stroke-width="1.5"/></svg>';
  if (st === 'idle') return '<svg class="sg-icon sg-tone-idle" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  // running: a braille spinner. The phase comes from the page clock, so a re-rendered row carries on instead of restarting
  const ph = -((performance.now() / 1000) % 1.2).toFixed(3);
  return '<svg class="sg-icon' + (still ? '' : ' sg-tone-run') + '" viewBox="0 0 12 12" aria-hidden="true" style="--sg-run-phase:' + ph + 's"><g fill="' + (still ? 'var(--sg-status-run-fg)' : 'currentColor') + '"><circle cx="4" cy="2.5" r="1"/><circle cx="8" cy="2.5" r="1"/><circle cx="4" cy="6" r="1"/><circle cx="8" cy="6" r="1"/><circle cx="4" cy="9.5" r="1"/><circle cx="8" cy="9.5" r="1"/></g></svg>';
}
const TRACKED = '<svg class="sg-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.8 9 9.8 3" fill="none" stroke="var(--sg-text-secondary)" stroke-width="1.5"/></svg>';
const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.8 9 9.8 3" fill="none" stroke="var(--sg-surface-sunken)" stroke-width="2"/></svg>';
const SECTION_TONE = { wait: ' sg-section-head--wait', err: ' sg-section-head--err', done: ' sg-section-head--done' };
const GROUPS = [['wait', 'needs you'], ['err', 'failed'], ['run', 'running'], ['done', 'done'], ['idle', 'asleep']];
let filter = null, tab = 'brief';
const pNow = document.getElementById('p-now'), pTasks = document.getElementById('p-tasks'), pBrief = document.getElementById('p-brief'), chips = document.getElementById('chips');
function renderChips() { chips.innerHTML = GROUPS.map((g) => { const n = G.S.filter((s) => s.state === g[0]).length; return '<button class="sg-chip' + (n ? '' : ' is-zero') + '" type="button" data-f="' + g[0] + '" aria-pressed="' + (filter === g[0]) + '">' + icon(g[0], !n) + '<b>' + n + '</b>' + g[1] + '</button>'; }).join(''); }
chips.addEventListener('click', (e) => { const c = e.target.closest('[data-f]'); if (!c) return; const f = c.getAttribute('data-f'); filter = filter === f ? null : f; renderNow(); });
// the summary as a few labelled lines: what it needs from you first, then the next step (and done / left when asked)
function sumBlock(m, short) {
  const line = (k, v, cls) => (v ? '<div class="sg-summary__line' + (cls ? ' ' + cls : '') + '"><b>' + k + '</b>' + esc(v) + '</div>' : '');
  return '<div class="sg-summary">' + line('needs you', m.needs, 'is-need') + line('next', m.next) + (short ? '' : line('done', m.done) + line('left', m.left)) + '</div>';
}
function renderNow() {
  renderChips(); let h = '';
  for (const g of GROUPS) {
    if (filter && filter !== g[0]) continue;
    const arr = G.S.filter((s) => s.state === g[0]); if (g[0] === 'wait') arr.sort((a, b) => a.prio - b.prio || b.since - a.since);
    if (!arr.length && g[0] !== 'wait' && !filter) continue;
    h += '<div class="sg-section-head' + (SECTION_TONE[g[0]] || '') + '">' + icon(g[0]) + '<span>' + g[1] + '</span><span class="sg-section-head__count">' + arr.length + '</span></div>';
    if (!arr.length) { h += '<div class="sg-empty">' + (g[0] === 'wait' ? 'Nothing is waiting on you.' : 'None right now.') + '</div>'; continue; }
    for (const s of arr) {
      if (s.state === 'wait' || s.state === 'err') {
        const tracked = taskForSession(s.id);
        h += '<div class="sg-attn' + (s.state === 'err' ? ' sg-attn--err' : '') + (G.selId === s.id ? ' is-selected' : '') + '" data-id="' + s.id + '" tabindex="0"><div class="sg-attn__title">' + esc(s.title) + '</div><div class="sg-attn__meta">' + esc(gene(s.id).name) + ' · ' + s.agent + ' · ' + hostOf(s).name + ':' + s.plot + '</div>' + (s.cwd ? '<div class="sg-attn__where">' + esc(where(s.cwd)) + (s.branch ? ' · ⎇ ' + esc(s.branch) : '') + '</div>' : '') +
          '<div class="sg-attn__status">' + icon(s.state) + '<span>' + (s.state === 'err' ? 'failed and stopped' : s.kind === 'command' ? 'wants to run a command' : 'is asking a question') + '</span><em class="sg-attn__age">' + (s.state === 'err' ? '' : 'waiting ') + fmt(s.since) + '</em></div>' +
          (s.cmd ? '<div class="sg-attn__cmd"><i class="sg-prompt">$</i> ' + esc(s.cmd) + '</div>' : s.q ? '<div class="sg-attn__question">' + esc(s.q) + '</div>' : '') +
          (s.sum ? sumBlock(s.sum, true) : s.cmd || s.q ? '' : '<div class="sg-attn__cmd">' + esc(s.summary) + '</div>') +
          '<div class="sg-attn__actions"><button class="sg-btn sg-btn--primary" type="button" data-open="' + s.id + '"><kbd>Enter</kbd>resume</button>' + (live ? '<button class="sg-btn" type="button" data-reveal="' + s.id + '">folder</button>' : '') + '<button class="sg-btn" type="button" data-locate="' + s.id + '"><kbd>l</kbd>locate</button>' + (tracked ? '<button class="sg-btn" type="button" data-gotask="1">' + TRACKED + 'tracked</button>' : '<button class="sg-btn" type="button" data-track="' + s.id + '">track</button>') + '</div></div>';
      } else {
        const sel = G.selId === s.id;
        h += '<div class="sg-row' + (sel ? ' is-selected' : '') + '" data-id="' + s.id + '" tabindex="0">' + icon(s.state) + '<span class="sg-row__title">' + esc(s.title) + '</span><span class="sg-row__age">' + fmt(s.since) + '</span><span class="sg-row__meta">' + s.plot + ' · ' + esc(gene(s.id).name) + ' · ' + esc(s.summary) + '</span>' +
          // the selected row opens up: where it lives, and what you can do with it
          (sel && s.sum ? sumBlock(s.sum, false) : '') +
          (sel ? (s.cwd ? '<span class="sg-row__where">' + esc(where(s.cwd)) + (s.branch ? ' · ⎇ ' + esc(s.branch) : '') + '</span>' : '') + '<span class="sg-row__actions"><button class="sg-btn sg-btn--primary" type="button" data-open="' + s.id + '"><kbd>Enter</kbd>resume</button>' + (live ? '<button class="sg-btn" type="button" data-reveal="' + s.id + '">folder</button>' + ((s.state === 'done' || s.state === 'idle') ? '<button class="sg-btn" type="button" data-archive="' + s.id + '">archive</button>' : '') : '') + '</span>' : '') + '</div>';
      }
    }
  }
  if (live && meta.archived) h += '<div class="arch">' + meta.archived + ' archived · <button type="button" data-restore="1">restore all</button></div>';
  pNow.innerHTML = h;
}

/* tracker */
let TASKS = [];
const SEED = [
  { title: 'Write the gramly release notes', proj: 'gramly' }, { title: 'Reply to Max about the Hangar shell', proj: 'hangar-roadmap' },
  { title: 'Book an hour to review the culture diffs', proj: 'culture' }, { title: 'Renew the home-server TLS certificate', proj: null }
];
const TASKS_KEY = live ? 'overview.tasks.v1' : 'overview.tasks.mock2';
try { TASKS = JSON.parse(localStorage.getItem(TASKS_KEY) || 'null'); } catch (e) { TASKS = null; }
if (!Array.isArray(TASKS)) TASKS = live ? [] : SEED.map((t, i) => ({ id: 'seed' + i, title: t.title, proj: t.proj, at: Date.now() - (i + 1) * 47 * 60000, doneAt: null }));
function saveTasks() { try { localStorage.setItem(TASKS_KEY, JSON.stringify(TASKS)); } catch (e) { /* storage blocked: tasks live for this visit only */ } }
function taskForSession() { return null; }
const short = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
// "#gramly" anywhere in the text links the task to that project and is taken out of the title
function addTask(text) {
  const m = text.match(/#([\w-]+)/), proj = m && PROJECTS.some((p) => p.id === m[1]) ? m[1] : null;
  const title = (proj ? text.replace(m[0], '') : text).replace(/\s+/g, ' ').trim(); if (!title) return;
  TASKS.unshift({ id: 't' + Date.now().toString(36), title, proj, at: Date.now(), doneAt: null }); saveTasks(); renderTasks();
}
function autoTasks() { /* tasks are the owner's own; what agents need lives in Today */ }
const hhmm = (ms) => { const d = new Date(ms); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); };
const RM = '<svg class="sg-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.3"/></svg>';
function renderTasks() {
  const open = TASKS.filter((t) => !t.doneAt), done = TASKS.filter((t) => t.doneAt).sort((a, b) => b.doneAt - a.doneAt);
  document.getElementById('tcount').textContent = open.length || '';
  const meta = (t) => { const p = t.proj && PROJECTS.find((x) => x.id === t.proj); return p ? '<span class="sg-row__meta">' + PROJ + esc(p.id) + ' · ' + esc((HOSTS.find((h) => h.id === p.host) || {}).name || '') + '</span>' : ''; };
  const row = (t) => '<div class="sg-row sg-row--task' + (t.proj ? ' is-linked' : '') + '"' + (t.proj ? ' data-tproj="' + esc(t.proj) + '" title="Open ' + esc(t.proj) + '"' : '') + '><button class="sg-checkbox" type="button" data-check="' + t.id + '" aria-label="Mark done: ' + esc(t.title) + '">' + CHECK + '</button><span class="sg-row__title sg-row__title--clamp">' + esc(t.title) + '</span>' +
    '<span class="sg-row__age"><span class="sg-row__age-value">' + fmt(Math.floor((Date.now() - t.at) / 60000)) + '</span><button class="sg-icon-btn sg-row__reveal" type="button" data-rm="' + t.id + '" aria-label="Remove task: ' + esc(t.title) + '" title="Remove task">' + RM + '</button></span>' + meta(t) + '</div>';
  let h = '<form class="add" id="addf"><input class="sg-input" id="addi" type="text" placeholder="Add a task · #project links it" aria-label="New task" autocomplete="off"><button class="sg-btn sg-btn--lg" type="submit">add</button></form>';
  h += group('todo', '', '', 'to do', open.length, '', open.length ? open.map(row).join('') : '<div class="sg-row"><span></span><span class="sg-row__summary">Nothing to do.</span></div>');
  if (done.length) h += group('tdone', '', icon('done'), 'done', done.length, '', done.slice(0, 12).map((t) => '<div class="sg-row sg-row--task is-done"><button class="sg-checkbox" type="button" data-uncheck="' + t.id + '" aria-label="Reopen: ' + esc(t.title) + '">' + CHECK + '</button><span class="sg-row__title sg-row__title--clamp">' + esc(t.title) + '</span><span class="sg-row__age">' + hhmm(t.doneAt) + '</span></div>').join(''));
  pTasks.innerHTML = h;
}
pTasks.addEventListener('submit', (e) => { e.preventDefault(); const i = document.getElementById('addi'), v = i.value.trim(); if (v) { addTask(v); const ni = document.getElementById('addi'); if (ni) ni.focus(); } });
pTasks.addEventListener('click', (e) => {
  const sh = e.target.closest('[data-shut]'); if (sh) { const k = sh.getAttribute('data-shut'); toggleGroup(sh, k); return; }
  const c = e.target.closest('[data-check]'), u = e.target.closest('[data-uncheck]'), r = e.target.closest('[data-rm]');
  if (c) { const t = TASKS.find((x) => x.id === c.getAttribute('data-check')); if (t) { t.doneAt = Date.now(); saveTasks(); renderTasks(); toast('Done: ' + t.title); } return; }
  if (u) { const t = TASKS.find((x) => x.id === u.getAttribute('data-uncheck')); if (t) { t.doneAt = null; saveTasks(); renderTasks(); } return; }
  if (r) { TASKS = TASKS.filter((x) => x.id !== r.getAttribute('data-rm')); saveTasks(); renderTasks(); return; }
  const tp = e.target.closest('[data-tproj]'); if (tp) revealProject(tp.getAttribute('data-tproj'));   // a linked task opens its project
});
// Today: what needs you, where each project stands, what is running, what finished, and what is stale
let openId = (location.hash.match(/open=(\w+)/) || [])[1] || null; const CLOSED = [];   // #open=<id> opens one item (for screenshots)
const inApp = (s) => (s.run ? 'in ' + s.run.app : 'not open');
const ARROW = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 8 8 4M4.5 4H8v3.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
// the one way to get to a session, the same everywhere: bring its window to the front, or resume it when no app has it open
function goBtn(s) { const tip = s.run ? 'Focus: bring its window to the front' : 'Resume: not open anywhere, opens it in a new terminal'; return '<button class="sg-icon-btn sg-icon-btn--bordered sg-row__reveal" type="button" data-go="' + s.id + '" title="' + tip + '" aria-label="' + tip + '">' + ARROW + '</button>'; }
async function go(id) {
  const s = byId(id); if (!s) return;
  if (!live) { toast(s.run ? 'Prototype: would bring ' + s.run.app + ' to the front, on the tab running ' + s.plot : 'Prototype: would resume ' + s.plot + ' in a new terminal'); return; }
  const r = await act('go', id);
  if (!r.ok) { toast('Could not open it: ' + r.error.replace(/^Error:\s*/, '')); return; }
  const v = String(r.value || '');
  toast(v.startsWith('focus:') ? 'Brought ' + v.slice(6) + ' to the front' : v === 'shell' ? 'Opened a shell on ' + hostOf(s).name + ' in its folder' : 'Resumed in a new terminal');
}
// the opened session: where it runs, where its files are (a link), what is done and left; closing is a quiet link
function detail(s) {
  const r = s.run;
  return '<div class="sg-row__details"><div class="sg-detail"><span class="sg-detail__label">runs</span><span>' + (r ? esc(r.app) + ' · ' + esc(r.tty) + ' · pid ' + r.pid + ' · open ' + r.open : 'not open in any app · last active ' + fmt(s.since) + ' ago') + '</span></div>' +
    '<div class="sg-detail"><span class="sg-detail__label">where</span><span>' + whereLine(s) + '</span></div>' +
    (s.sum ? '<div class="sg-detail"><span class="sg-detail__label">done</span><span>' + esc(s.sum.done) + '</span></div>' + (s.sum.left ? '<div class="sg-detail"><span class="sg-detail__label">left</span><span>' + esc(s.sum.left) + '</span></div>' : '') : '') +
    (s.state === 'run' ? '' : '<div class="sg-detail"><span class="sg-detail__label"></span><span><button class="sg-link sg-link--subtle" type="button" data-close="' + s.id + '">' + (r ? 'close session' : 'clear from Overview') + '</button></span></div>') + '</div>';
}
function whereLine(s) {
  const folder = live ? (s.machine === 'local' ? where(s.cwd) : s.cwd) : '~/code/' + s.plot, branch = live ? s.branch : 'main';
  const place = esc(hostOf(s).name) + ' · ' + esc(folder);
  return (!live || s.machine === 'local' ? '<button class="sg-link" type="button" data-dir="' + s.id + '" title="Open the folder">' + place + '</button>' : place) + (branch ? ' · ⎇ ' + esc(branch) : '');
}
// a session row: status · title · age · ↗, then a meta line and one summary line; a click opens it in place and shows it on the map
function srow(s, title, line, lineKey) {
  const meta = (s.state === 'err' ? '<span class="sg-tone-err">failed</span> · ' : '') + esc(s.plot) + ' · ' + esc(hostOf(s).name) + ' · <span class="inapp">' + esc(inApp(s)) + '</span>';
  return '<div class="sg-row' + (openId === s.id ? ' is-open' : '') + '" data-x="' + s.id + '" tabindex="0" aria-expanded="' + (openId === s.id) + '">' + icon(s.state) + '<span class="sg-row__title">' + esc(title) + '</span><span class="sg-row__age"><span class="sg-row__age-value">' + fmt(s.since) + '</span>' + goBtn(s) + '</span>' +
    '<span class="sg-row__meta">' + meta + '</span>' + (line ? '<span class="sg-row__summary">' + (lineKey ? '<b>' + lineKey + '</b>' : '') + esc(line) + '</span>' : '') + (openId === s.id ? detail(s) : '') + '</div>';
}
const PROJ = '<svg class="sg-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 6 6 3.5 10.5 6 6 8.5Z" fill="none" stroke="var(--sg-text-subtle)" stroke-width="1.2"/></svg>';
const CHEV = '<svg class="sg-group__chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
// fold or unfold one group in place: no re-render, so nothing else on the panel redraws or replays its fade
function toggleGroup(btn, k) {
  SHUT[k] = !SHUT[k]; saveShut();
  const sec = btn.closest('.sg-group'); if (sec) sec.classList.toggle('is-collapsed', !!SHUT[k]);
  btn.setAttribute('aria-expanded', String(!SHUT[k]));
}
function saveShut() { try { localStorage.setItem('overview.today.shut', JSON.stringify(SHUT)); } catch (e) { /* session only */ } }
let SHUT = { stale: true }; try { SHUT = JSON.parse(localStorage.getItem('overview.today.shut')) || SHUT; } catch (e) { /* storage blocked: defaults */ }
function group(key, cls, ico, label, n, action, body) {
  const shut = !!SHUT[key];
  return '<section class="sg-group ' + cls + (shut ? ' is-collapsed' : '') + '" id="g-' + key + '"><div class="sg-group__head"><button class="sg-group__toggle" type="button" data-shut="' + key + '" aria-expanded="' + !shut + '">' + CHEV + (ico || '') + '<span>' + label + '</span><span class="sg-group__count">' + n + '</span></button>' + (action || '') + '</div><div class="sg-group__body">' + body + '</div></section>';
}
function llmLine() {
  const l = live && meta.llm; if (!l) return '';
  return l.error ? ' · <span class="sg-tone-err" title="' + esc(l.error) + '">summaries paused</span>' : l.pending ? ' · summarizing ' + l.pending : '';
}
function renderToday() {
  const S = G.S;
  const need = S.filter((s) => s.state === 'wait' || s.state === 'err').sort((a, b) => (a.prio ?? 9) - (b.prio ?? 9));
  const run = S.filter((s) => s.state === 'run'), done = S.filter((s) => s.state === 'done'), stale = S.filter((s) => s.state === 'idle');
  const openN = S.filter((s) => s.run).length;
  let h = '<div class="head"><h2>' + (need.length === 1 ? '1 thing needs you' : need.length ? need.length + ' things need you' : 'Nothing needs you') + '</h2><p class="by">' + (live ? '' : 'since yesterday 18:40 · ') + done.length + ' finished · ' + openN + ' open in apps · ' + HOSTS.length + (HOSTS.length > 1 ? ' machines' : ' machine') + llmLine() + '</p></div>';
  const jumps = [['need', 'needs you', need.length, ' sg-stat--wait'], ['run', 'running', run.length], ['done', 'finished', done.length], ['stale', 'stale', stale.length]];
  h += '<nav class="jump" aria-label="Jump to a group"><div class="sg-stats">' + jumps.map((j) => '<button type="button" data-jump="' + j[0] + '" class="sg-stat' + (j[2] ? j[3] || '' : ' is-zero') + '"><b class="sg-stat__value">' + j[2] + '</b><span class="sg-stat__label">' + j[1] + '</span></button>').join('') + '</div></nav>';
  h += group('need', 'sg-group--wait', icon('wait'), 'needs you', need.length, '', need.length ? need.map((s) => srow(s, s.sum ? s.sum.needs : s.title, s.sum && s.sum.next, 'then')).join('') : '<div class="sg-row"><span></span><span class="sg-row__summary">Nothing is waiting on you.</span></div>');
  if (run.length) h += group('run', '', icon('run'), 'running', run.length, '', run.map((s) => srow(s, s.title, s.sum && s.sum.done)).join(''));
  if (done.length) h += group('done', '', icon('done'), 'finished', done.length, '<button class="sg-group__action" type="button" data-closeall="done">close all</button>', done.map((s) => srow(s, s.title, s.sum && s.sum.next, 'next')).join(''));
  if (stale.length) h += group('stale', '', icon('idle'), 'stale', stale.length, '<button class="sg-group__action" type="button" data-closeall="idle">clear all</button>', stale.map((s) => srow(s, s.title, s.sum && s.sum.done)).join(''));
  const hidden = live ? meta.archived : CLOSED.length;
  if (hidden) h += '<div class="arch">' + hidden + ' closed · transcripts kept · <button type="button" data-restore-m="1">bring back</button></div>';
  const top = pBrief.scrollTop; pBrief.innerHTML = h; pBrief.scrollTop = top;
}
// Projects: where each project stands, grouped by machine; opening one lists its sessions
const pProj = document.getElementById('p-proj'); let openProj = null;
// a project's line: what was done most recently, and the most urgent next step (what it needs from you first)
function projSum(pid, ss) {
  if (!live) return PSUM[pid] || {};
  const withSum = ss.filter((s) => s.sum), recent = withSum.slice().sort((a, b) => a.since - b.since)[0];
  const ask = ss.find((s) => (s.state === 'wait' || s.state === 'err') && s.sum && s.sum.needs);
  const nxt = ask ? ask.sum.needs : (withSum.find((s) => s.state === 'run' && s.sum.next) || recent || {}).sum;
  return { at: recent ? recent.sum.done : '', next: typeof nxt === 'string' ? nxt : nxt ? nxt.next : '' };
}
function renderProjects() {
  const S = G.S, ORD = ['wait', 'err', 'run', 'done', 'idle'], rank = (s) => ORD.indexOf(s.state);
  const projs = PROJECTS.map((p) => ({ p, ss: S.filter((s) => s.plot === p.id).sort((a, b) => rank(a) - rank(b)) })).filter((x) => x.ss.length);
  const blockedN = projs.filter((x) => rank(x.ss[0]) < 2).length;
  let h = '<div class="head"><h2>' + projs.length + ' projects</h2><p class="by">' + (blockedN ? blockedN + ' waiting on you · ' : '') + S.length + ' sessions on ' + HOSTS.length + ' machines</p></div>';
  for (const host of HOSTS) {
    const mine = projs.filter((x) => hostOf(x.ss[0]).id === host.id).sort((a, b) => rank(a.ss[0]) - rank(b.ss[0]));
    if (!mine.length) continue;
    h += group('m-' + host.id, '', PROJ, host.name + (host.sub === 'ssh' ? ' · ssh' : ''), mine.length, '', mine.map(({ p, ss }) => {
      const ps = projSum(p.id, ss), lead = ss[0], blocked = rank(lead) < 2, isOpen = openProj === p.id;
      return '<div class="sg-row' + (blocked ? ' sg-row--blocked' : '') + (isOpen ? ' is-open' : '') + '" data-proj="' + p.id + '">' + icon(lead.state, true) + '<span class="sg-row__title sg-row__title--mono">' + esc(p.id) + '</span><span class="sg-row__age"><span class="seg">' + ss.map((s) => '<i class="' + s.state + '"></i>').join('') + '</span>' + ss.length + (ss.length > 1 ? ' sessions' : ' session') + '</span>' +
        (ps.at ? '<span class="sg-row__summary">' + esc(ps.at) + '</span>' : '') + (ps.next ? '<span class="sg-row__summary"><b>next</b>' + esc(ps.next) + '</span>' : '') +
        (isOpen ? '<div class="sg-row__children">' + ss.map((s) => srow(s, s.title)).join('') + '</div>' : '') + '</div>';
    }).join(''));
  }
  const top = pProj.scrollTop; pProj.innerHTML = h; pProj.scrollTop = top;
}
pProj.addEventListener('click', (e) => {
  if (sessionClick(e, renderProjects)) return;
  const sh = e.target.closest('[data-shut]'); if (sh) { const k = sh.getAttribute('data-shut'); toggleGroup(sh, k); return; }
  const pr = e.target.closest('[data-proj]'); if (!pr) return;
  const id = pr.getAttribute('data-proj'); openProj = openProj === id ? null : id; openId = null; renderProjects();
});
// what every session row does, wherever it is: ↗ goes to it, the folder link opens the folder, close closes, a click opens it in place
function sessionClick(e, rerender) {
  const g = e.target.closest('[data-go]'); if (g) { go(g.getAttribute('data-go')); return true; }
  const d = e.target.closest('[data-dir]'); if (d) { const id = d.getAttribute('data-dir'); if (live) revealFolder(id); else toast('Prototype: would open ~/code/' + byId(id).plot + ' in Finder'); return true; }
  const c = e.target.closest('[data-close]'); if (c) { const id = c.getAttribute('data-close'); if (armed(c, [id])) closeIds([id]); return true; }
  if (e.target.closest('button')) return false;
  const x = e.target.closest('[data-x]'); if (!x) return false;
  const id = x.getAttribute('data-x'); openId = openId === id ? null : id; rerender(); if (openId) locate(id); else select(null);
  return true;
}
function keyOpen(e, rerender) { if (e.key !== 'Enter' || e.target.closest('button')) return; const x = e.target.closest('[data-x]'); if (!x) return; e.preventDefault(); const id = x.getAttribute('data-x'); openId = openId === id ? null : id; rerender(); if (openId) locate(id); const again = document.querySelector('[data-x="' + id + '"]'); if (again) again.focus(); }

// map -> panel: one rule. A click on the map opens the same thing in the side panel, in place, scrolled into view
const GROUP_OF = { wait: 'need', err: 'need', run: 'run', done: 'done', idle: 'stale' };
function flash(el) { if (!el || reduce) return; el.classList.remove('sg-flash'); void el.offsetWidth; el.classList.add('sg-flash'); }
// scroll only when the item is not fully in view, instantly, landing just under the sticky jump bar (opened part included)
function show(el) {
  if (!el) return; const c = el.closest('.rbody'); if (!c) return;
  const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect(), bar = c.querySelector('.jump'), top = cr.top + (bar ? bar.offsetHeight : 0) + 8;
  if (r.top < top || r.bottom > cr.bottom - 8) glideScroll(c, c.scrollTop + r.top - top);
  flash(el);
}
// the map camera's easing, applied to the panel: each frame covers dt*10 of the remaining distance (exponential ease-out),
// so the panel and the map arrive together. Instant under reduced motion; a wheel or touch by the user takes over at once.
const glides = new Map();
function glideScroll(c, to) {
  to = Math.max(0, Math.min(to, c.scrollHeight - c.clientHeight));
  if (reduce) { c.scrollTop = to; return; }
  const run = { to, last: 0 }; glides.set(c, run);
  const stop = () => { if (glides.get(c) === run) glides.delete(c); c.removeEventListener('wheel', stop); c.removeEventListener('touchstart', stop); };
  c.addEventListener('wheel', stop, { passive: true }); c.addEventListener('touchstart', stop, { passive: true });
  const step = (now) => {
    if (glides.get(c) !== run) return;
    const dt = run.last ? Math.min(0.1, (now - run.last) / 1000) : 1 / 60; run.last = now;
    const d = run.to - c.scrollTop;
    if (Math.abs(d) < 0.5) { c.scrollTop = run.to; stop(); return; }
    c.scrollTop += d * Math.min(1, dt * 10);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function revealSession(id) {
  const s = byId(id); if (!s) return;
  select(id); openId = id;
  if (tab === 'proj') { SHUT['m-' + hostOf(s).id] = false; openProj = s.plot; renderProjects(); show(pProj.querySelector('[data-x="' + id + '"]')); return; }
  showTab('brief'); const g = GROUP_OF[s.state]; if (SHUT[g]) SHUT[g] = false;
  renderToday(); show(pBrief.querySelector('[data-x="' + id + '"]'));
}
function revealProject(pid) {
  const first = G.S.find((s) => s.plot === pid); if (!first) return;
  showTab('proj'); SHUT['m-' + hostOf(first).id] = false; openProj = pid; renderProjects(); show(pProj.querySelector('[data-proj="' + pid + '"]'));
}
function revealMachine(hid) {
  showTab('proj'); SHUT['m-' + hid] = false; openProj = null; renderProjects(); show(document.getElementById('g-m-' + hid));
}
function clearReveal() { select(null); openInfo(null); if (openId || openProj) { openId = null; openProj = null; renderToday(); renderProjects(); } }

// close: an open session's agent process ends (only when it is not working), and it leaves Overview; the transcript stays, so resume still works
// a destructive click asks once: the button turns into "confirm" for 3 seconds
function armed(btn, ids) {
  const ends = ids.some((id) => { const x = byId(id); return x && x.run; });
  if (!ends || btn.dataset.armed === '1') return true;
  btn.dataset.armed = '1'; const was = btn.textContent; btn.textContent = ids.length > 1 ? 'confirm: end ' + ids.filter((id) => byId(id) && byId(id).run).length + ' agents' : 'confirm: end the agent';
  btn.classList.add('is-armed'); setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = was; btn.classList.remove('is-armed'); } }, 3000);
  return false;
}
async function closeIds(ids) {
  const list = ids.map((id) => byId(id)).filter(Boolean); if (!list.length) return;
  const procs = list.filter((x) => x.run).length;
  if (live) {
    const errs = [];
    for (const x of list) { const r = await act('close', x.id); if (!r.ok) errs.push(x.title + ': ' + r.error.replace(/^Error:\s*/, '')); }
    openId = null; await refreshNow(G, null, rebuild);
    toast(errs.length ? 'Could not close ' + errs.join('; ') : (list.length === 1 ? 'Closed ' + list[0].title : 'Closed ' + list.length + ' sessions') + (procs ? ' · ' + procs + (procs > 1 ? ' agents' : ' agent') + ' ended' : '') + ' · transcripts kept');
    return;
  }
  for (const x of list) { const i = INITIAL.findIndex((y) => y.id === x.id); if (i >= 0) CLOSED.push(INITIAL.splice(i, 1)[0]); }
  openId = null; rebuild();
  toast((list.length === 1 ? 'Closed ' + list[0].title : 'Closed ' + list.length + ' sessions') + (procs ? ' · ' + procs + (procs > 1 ? ' agents' : ' agent') + ' ended' : '') + ' · transcripts kept');
}
pBrief.addEventListener('click', (e) => {
  const stop = () => e.stopImmediatePropagation();
  const ca = e.target.closest('[data-closeall]'); if (ca) { const ids = G.S.filter((s) => s.state === ca.getAttribute('data-closeall')).map((s) => s.id); if (armed(ca, ids)) closeIds(ids); stop(); return; }
  const rs = e.target.closest('[data-restore-m]'); if (rs) { restoreClosed(); stop(); return; }
  const sh = e.target.closest('[data-shut]'); if (sh) { const k = sh.getAttribute('data-shut'); toggleGroup(sh, k); stop(); return; }
  const jp = e.target.closest('[data-jump]'); if (jp) { const k = jp.getAttribute('data-jump'); if (SHUT[k]) { SHUT[k] = false; renderToday(); } show(document.getElementById('g-' + k)); stop(); return; }
  if (sessionClick(e, renderToday)) stop();
}, true);
async function restoreClosed() {
  if (live) { const r = await act('restore_all'); if (r.ok) { await refreshNow(G, null, rebuild); toast('Closed sessions are back'); } else toast('Could not bring them back: ' + r.error); return; }
  INITIAL.push(...CLOSED.splice(0)); rebuild(); toast('Closed sessions are back');
}
pBrief.addEventListener('keydown', (e) => keyOpen(e, renderToday));
pProj.addEventListener('keydown', (e) => keyOpen(e, renderProjects));
function renderBrief() { renderToday(); renderProjects(); }
function renderStatus() {
  crumb();
  const n = (st) => G.S.filter((s) => s.state === st).length;
  document.getElementById('status').innerHTML = '<button class="sg-status-item sg-status-item--brand" type="button" id="sb-fit" title="Fit every neighborhood">overview</button>' +
    '<button class="sg-status-item sg-status-item--wait" type="button" id="sb-wait" title="Jump to the next agent that needs you">' + icon('wait') + n('wait') + ' needs you</button>' +
    (n('err') ? '<button class="sg-status-item sg-status-item--err" type="button" data-sl="err" aria-expanded="false">' + icon('err') + n('err') + ' failed</button>' : '') +
    '<button class="sg-status-item" type="button" data-sl="run" aria-expanded="false">' + icon('run', !n('run')) + n('run') + ' running</button>' +
    '<button class="sg-status-item sg-status-item--done" type="button" data-sl="done" aria-expanded="false">' + icon('done') + n('done') + ' done</button>' +
    '<button class="sg-status-item" type="button" data-sl="idle" aria-expanded="false">' + icon('idle') + n('idle') + ' asleep</button>' +
    '<span class="sg-statusbar__spacer"></span>' + HOSTS.map((h) => '<button class="sg-status-item sg-status-host" type="button" data-fly="' + h.id + '" title="Fly to ' + h.name + '">' + h.name + (h.lat ? ' ' + h.lat : '') + '</button>').join('');
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
async function revealFolder(id) { const s = byId(id); const r = await act('reveal', id); toast(r.ok ? 'Showing ' + where(s.cwd) : 'Could not open the folder: ' + r.error); }
async function archiveSession(id) {
  const s = byId(id); const r = await act('close', id);
  if (!r.ok) { toast('Could not archive: ' + r.error); return; }
  toast('Archived ' + s.title.slice(0, 40) + '. Its files are untouched.'); select(null); await refreshNow(G, null, rebuild);
}
async function restoreAll() { const r = await act('restore_all'); if (r.ok) { toast('Archived sessions are back'); await refreshNow(G, null, rebuild); } }
pNow.addEventListener('click', (e) => {
  const o = e.target.closest('[data-open]'); if (o) { go(o.getAttribute('data-open')); return; }
  const rv = e.target.closest('[data-reveal]'); if (rv) { revealFolder(rv.getAttribute('data-reveal')); return; }
  const ar = e.target.closest('[data-archive]'); if (ar) { archiveSession(ar.getAttribute('data-archive')); return; }
  if (e.target.closest('[data-restore]')) { restoreAll(); return; }
  const tr = e.target.closest('[data-track]'); if (tr) { const s = byId(tr.getAttribute('data-track')); addTask(taskTitle(s) + ' (' + s.plot + ')', s.id, s.state === 'err' ? 'failed' : 'needs you'); toast('Tracking: ' + taskTitle(s)); return; }
  if (e.target.closest('[data-gotask]')) { showTab('tasks'); return; }
  const l = e.target.closest('[data-locate]') || e.target.closest('[data-id]'); if (!l) return;
  locate(l.getAttribute('data-locate') || l.getAttribute('data-id'));
});
pNow.addEventListener('keydown', (e) => { const el = e.target.closest('[data-id]'); if (!el || e.target.closest('button')) return; if (e.key === 'Enter') { e.preventDefault(); go(el.getAttribute('data-id')); } else if (e.key === ' ') { e.preventDefault(); locate(el.getAttribute('data-id')); } });
const TABS = { proj: [document.getElementById('t-proj'), document.getElementById('p-proj')], tasks: [document.getElementById('t-tasks'), pTasks], brief: [document.getElementById('t-brief'), pBrief] };
function showTab(w) { tab = w; for (const k in TABS) { TABS[k][0].setAttribute('aria-selected', k === w); TABS[k][1].hidden = k !== w; } }
for (const k in TABS) TABS[k][0].addEventListener('click', () => showTab(k));

/* ---------------- settings: machines (over the owner's ssh), summaries, about ---------------- */
const setEl = document.getElementById('settings'); let addOpen = false, renaming = null, sshHosts = null;
const SERVER = '<svg class="sg-icon" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="2" width="9" height="3.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="1.5" y="6.5" width="9" height="3.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>';
const OKI = '<svg class="sg-icon" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M3.8 6.1 5.3 7.6 8.2 4.6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
function machines() {
  if (live) return meta.machines;
  return HOSTS.filter((h) => h.sub === 'ssh').map((h) => ({ alias: h.id, name: h.name, status: 'connected', latency_ms: parseInt(h.lat, 10) || 0, sessions: G.S.filter((x) => hostOf(x).id === h.id).length, error: null }));
}
const CONNECTION_DOT = { connected: ' sg-dot--done', offline: ' sg-dot--err', connecting: ' sg-dot--pulse' };
const STATUS_WORD = { connected: 'connected', connecting: 'connecting…', offline: 'offline' };
function renderSettings() {
  const local = G.S.filter((x) => hostOf(x).id === (HOSTS[0] && HOSTS[0].id)).length;
  let h = '<div class="set-in"><header class="set-h"><h2>Settings</h2><button class="sg-tag sg-tag--button" type="button" data-sclose="1" aria-label="Close settings">Esc</button></header>';
  h += '<section class="set-s"><h3>machines</h3><p class="sg-lead">Your other computers, reached over your own ssh. Overview only reads their agents\' session files; nothing is installed there.</p><div class="mlist">';
  h += '<div class="mrow"><i class="sg-dot sg-dot--done" aria-hidden="true"></i><div class="mt"><b>This computer</b><span>' + esc((HOSTS[0] && HOSTS[0].name) || 'this computer') + ' · ' + local + (local === 1 ? ' session' : ' sessions') + '</span></div></div>';
  for (const m of machines()) {
    const sub = [m.alias !== m.name ? esc(m.alias) : '', STATUS_WORD[m.status] || esc(m.status), m.status === 'connected' && m.latency_ms ? m.latency_ms + ' ms' : '', m.status === 'connected' ? m.sessions + (m.sessions === 1 ? ' session' : ' sessions') : ''].filter(Boolean).join(' · ');
    h += '<div class="mrow"><i class="sg-dot' + (CONNECTION_DOT[m.status] || '') + '" aria-hidden="true"></i><div class="mt">' +
      (renaming === m.alias ? '<form data-mrenameform="' + esc(m.alias) + '"><input class="sg-input sg-input--edit" value="' + esc(m.name) + '" aria-label="Name for ' + esc(m.alias) + '" maxlength="40"></form>' : '<b>' + esc(m.name) + '</b>') +
      '<span>' + sub + '</span>' + (m.error && m.status !== 'connected' ? '<span class="merr">' + esc(m.error) + '</span>' : '') + '</div>' +
      '<div class="mact"><button class="sg-btn" type="button" data-mrename="' + esc(m.alias) + '">' + (renaming === m.alias ? 'save' : 'rename') + '</button><button class="sg-btn" type="button" data-mremove="' + esc(m.alias) + '">remove</button></div></div>';
  }
  h += '</div><button class="sg-btn sg-btn--lg" type="button" data-madd="1">Add a machine</button></section>';
  const l = meta.llm;
  h += '<section class="set-s"><h3>summaries</h3><p class="sg-lead">A small model reads the end of each session, after anything that looks secret is removed, and writes what was done, what is left and what it needs from you. The key lives in the keychain.</p>' +
    '<div class="sg-kv"><span class="sg-kv__label">model</span><span class="sg-kv__value">' + esc((l && l.model) || (live ? 'openai/gpt-oss-120b' : 'sample')) + '</span><span class="sg-kv__label">state</span><span class="sg-kv__value">' + (l ? (l.error ? '<span class="sg-tone-err">' + esc(l.error) + '</span>' : l.pending ? 'summarizing ' + l.pending : 'up to date') : 'sample data') + '</span></div></section>';
  h += '<section class="set-s"><h3>about</h3><div class="sg-kv"><span class="sg-kv__label">version</span><span class="sg-kv__value">Overview ' + esc(meta.version || 'unknown') + '</span><span class="sg-kv__label">reads</span><span class="sg-kv__value">Claude Code and Codex sessions, on this computer and over ssh</span></div></section></div>';
  if (addOpen) {
    const hosts = sshHosts || [];
    h += '<div class="sg-backdrop" data-dclose="1"></div><div class="sg-dialog" role="dialog" aria-label="Add a machine"><header class="set-h"><h3>Add a machine</h3><button class="sg-tag sg-tag--button" type="button" data-dclose="1" aria-label="Close">Esc</button></header>' +
      '<p class="sg-lead">A workstation, a server, a box at home: Overview reaches it over your ssh and reads its agents\' sessions. Agents there keep running while your laptop sleeps.</p>' +
      '<h4 class="sg-dialog__title">from your ssh config</h4><div class="hlist">' + (sshHosts === null ? '<div class="hrow"><span>reading ~/.ssh/config…</span></div>' : hosts.length ? hosts.map((x) => '<div class="hrow">' + SERVER + '<b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span>' + (x[2] ? '<em class="added">' + OKI + 'added</em>' : '<button class="sg-btn" type="button" data-hadd="' + esc(x[0]) + '">add</button>') + '</div>').join('') : '<div class="hrow"><span>No hosts in ~/.ssh/config.</span></div>') + '</div>' +
      '<h4 class="sg-dialog__title">or type how ssh reaches it</h4><form class="add" data-maddform="1"><input class="sg-input" id="maddi" type="text" placeholder="user@host" aria-label="ssh destination" autocomplete="off" spellcheck="false"><button class="sg-btn sg-btn--lg" type="submit">add</button></form></div>';
  }
  setEl.innerHTML = h;
  const ri = setEl.querySelector('.sg-input--edit'); if (ri) { ri.focus(); ri.select(); }
}
async function openSettings() { setEl.hidden = false; renderSettings(); setEl.querySelector('[data-sclose]').focus(); }
function closeSettings() { setEl.hidden = true; addOpen = false; renaming = null; document.getElementById('settings-btn').focus(); }
async function loadHosts() { sshHosts = null; renderSettings(); if (!live) { sshHosts = [['workstation', 'john@192.168.86.23', true], ['192.168.86.34', 'ubuntu@192.168.86.34', false]]; renderSettings(); return; } const r = await act('ssh_hosts'); sshHosts = r.ok ? r.value : []; renderSettings(); }
async function addMachine(alias) {
  if (!live) { toast('Prototype: would add ' + alias); return; }
  const r = await act('machine_add', null, { alias });
  if (!r.ok) { toast(r.error.replace(/^Error:\s*/, '')); return; }
  toast('Added ' + alias + ' · connecting…'); await loadHosts(); setTimeout(() => refreshNow(G, null, rebuild).then(() => { if (!setEl.hidden) renderSettings(); }), 2500);
}
document.getElementById('settings-btn').addEventListener('click', () => (setEl.hidden ? openSettings() : closeSettings()));
setEl.addEventListener('click', async (e) => {
  if (e.target.closest('[data-sclose]')) { closeSettings(); return; }
  if (e.target.closest('[data-dclose]')) { addOpen = false; renderSettings(); return; }
  if (e.target.closest('[data-madd]')) { addOpen = true; loadHosts(); return; }
  const ha = e.target.closest('[data-hadd]'); if (ha) { addMachine(ha.getAttribute('data-hadd')); return; }
  const rn = e.target.closest('[data-mrename]'); if (rn) { const a = rn.getAttribute('data-mrename'); if (renaming === a) setEl.querySelector('[data-mrenameform]').requestSubmit(); else { renaming = a; renderSettings(); } return; }
  const rm = e.target.closest('[data-mremove]'); if (rm) {
    const a = rm.getAttribute('data-mremove');
    if (rm.dataset.armed !== '1') { rm.dataset.armed = '1'; rm.textContent = 'confirm remove'; rm.classList.add('is-armed'); setTimeout(() => { if (rm.isConnected) { rm.dataset.armed = ''; rm.textContent = 'remove'; rm.classList.remove('is-armed'); } }, 3000); return; }
    if (!live) { toast('Prototype: would remove ' + a); return; }
    const r = await act('machine_remove', null, { alias: a }); toast(r.ok ? 'Removed ' + a + '. Nothing changed on it.' : r.error); if (r.ok) await refreshNow(G, null, rebuild); renderSettings();
  }
});
setEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rf = e.target.closest('[data-mrenameform]'); if (rf) { const a = rf.getAttribute('data-mrenameform'), v = rf.querySelector('input').value.trim(); renaming = null; if (live && v) { const r = await act('machine_rename', null, { alias: a, name: v }); if (!r.ok) toast(r.error); await refreshNow(G, null, rebuild); } renderSettings(); return; }
  if (e.target.closest('[data-maddform]')) { const v = document.getElementById('maddi').value.trim(); if (v) addMachine(v); }
});
setEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return; e.stopPropagation();
  if (renaming) { renaming = null; renderSettings(); } else if (addOpen) { addOpen = false; renderSettings(); } else closeSettings();
});

/* ---------------- toast + demo ---------------- */
const toastEl = document.getElementById('toast'); let tt;
function toast(m) { toastEl.textContent = m; toastEl.classList.remove('is-hidden'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.add('is-hidden'), 3200); }
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

// sessions came or went: rebuild the world from the fresh list
function rebuild() { resetLife(); G.S = clone(INITIAL); G.world = buildWorld(); G.S.forEach(body); renderAll(); }
zval(); renderAll();
if (live) {
  // real data: no demo; the tag says live; states update in place, and the world is rebuilt when sessions come or go
  demoBtn.style.display = 'none'; const tag = document.querySelector('.tright .sg-tag'); if (tag) tag.textContent = 'v' + meta.version;
  watch(G, (s, prev) => { if (s) onStateChange(s, prev); renderAll(); if (!setEl.hidden) renderSettings(); }, () => { rebuild(); if (!setEl.hidden) renderSettings(); });
} else setDemo(false);
requestAnimationFrame(frame);
{ const j = (location.hash.match(/jump=(\w+)/) || [])[1]; if (j) setTimeout(() => { const b = pBrief.querySelector('[data-jump="' + j + '"]'); if (b) b.click(); const g = document.getElementById('g-' + j); if (g) g.scrollIntoView({ block: 'start' }); }, 300); }   // #jump=<group> (for screenshots)
{ const t = (location.hash.match(/tab=(\w+)/) || [])[1]; if (t && TABS[t]) showTab(t); const p = (location.hash.match(/proj=([\w-]+)/) || [])[1]; if (p) { openProj = p; renderProjects(); } }   // #tab=<tab>&proj=<id> (for screenshots)
{ const k = (location.hash.match(/pick=([\w:-]+)/) || [])[1]; if (k) setTimeout(() => { if (k.startsWith('proj:')) revealProject(k.slice(5)); else if (k.startsWith('host:')) revealMachine(k.slice(5)); else revealSession(k); }, 400); }   // #pick=... simulates a map click (for screenshots)
{ const k = (location.hash.match(/info=(plot|island):([\w-]+)/) || []); if (k[1]) setTimeout(() => openInfo({ kind: k[1], id: k[2] }), 400); }   // #info=plot:<id> (for screenshots)
{ const k = (location.hash.match(/hover=(\w+)/) || [])[1]; if (k) setTimeout(() => { document.querySelectorAll('[data-x="' + k + '"]').forEach((r) => r.classList.add('is-hovered')); const g = document.querySelector('#g-done .sg-group__head'); if (g) g.classList.add('is-hovered'); }, 500); }   // #hover=<id> shows the hover state (for screenshots)
