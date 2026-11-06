// Rendering v8: camera, the grid, machine islands, plots (name on the floor, a floor of their own), the shared hub, creatures, overlays.
// No scenery: the world is geometry on a grid. Night darkens the plane; creatures and status colours are never shaded.
import { G, C, FONT, hash, wantsDesk, reduce, hostOf, byId, fmt, esc, waiting } from './core.js';
import { gene, sprite, coat, GLYPH, TOP } from './creatures.js';
import { key, ZONES } from './world.js';
import { body, activity, bestFriend, needsOf } from './life.js';

/* ---------------- camera ---------------- */
export const cv = document.getElementById('cv'), stage = document.getElementById('stage');
const mainCtx = cv.getContext('2d'), off = document.createElement('canvas'), offCtx = off.getContext('2d');
let ctx = mainCtx;
// during the world pass everything is drawn at 1 screen pixel per art pixel (rs = 1) into an offscreen image
const P = () => G.rs || G.cam.z * G.dpr;
function origin() { const p = P(), w = G.vw || G.W, h = G.vh || G.H; return [w / 2 - (G.cam.u - G.cam.v) * 16 * p, h / 2 - (G.cam.u + G.cam.v) * 8 * p]; }
export function toS(u, v) { const p = P(), o = origin(); return [o[0] + (u - v) * 16 * p, o[1] + (u + v) * 8 * p]; }
export function toW(X, Y) { const p = P(), o = origin(), a = (X - o[0]) / (16 * p), b = (Y - o[1]) / (8 * p); return [(a + b) / 2, (b - a) / 2]; }
export function resize() {
  const r = stage.getBoundingClientRect(); G.dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  G.W = Math.round(r.width * G.dpr); G.H = Math.round(r.height * G.dpr); cv.width = G.W; cv.height = G.H; ctx.imageSmoothingEnabled = false;
  G.levels = []; for (const k of [1, 2, 3, 4, 5, 6, 8]) { const z = k / G.dpr; if (z >= 0.3 && z <= 4) G.levels.push(z); }
}
function boundsOf(list) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const r of list) for (const [u, v] of [[r.u0, r.v0], [r.u1, r.v0], [r.u0, r.v1], [r.u1, r.v1]]) { const X = (u - v) * 16, Y = (u + v) * 8; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  return { x0: x0 - 24, x1: x1 + 24, y0: y0 - 80, y1: y1 + 24 };
}
export function frameTo(list, instant, minFloor) {
  const b = boundsOf(list), zMax = Math.min(G.W / G.dpr / (b.x1 - b.x0), G.H / G.dpr / (b.y1 - b.y0)); let z = G.levels[0];
  for (const l of G.levels) if (l <= zMax) z = l;
  const a = (b.x0 + b.x1) / 32, bb = (b.y0 + b.y1) / 16; G.tgt.u = (a + bb) / 2; G.tgt.v = (bb - a) / 2; G.tgt.z = z;
  if (minFloor) {
    const floor = G.levels.find((l) => l >= 0.45) || G.levels[0];
    if (zMax < Math.max(z, floor)) {
      G.tgt.z = Math.max(z, floor);
      const urgent = G.S.filter((s) => s.state === 'wait' || s.state === 'err').map((s) => body(s)).map((b) => ({ u0: b.u - 3, v0: b.v - 3, u1: b.u + 3, v1: b.v + 3 }));
      if (urgent.length) { const ub = boundsOf(urgent), zU = Math.min(G.W / G.dpr / (ub.x1 - ub.x0), G.H / G.dpr / (ub.y1 - ub.y0)); let z2 = G.levels[0]; for (const l of G.levels) if (l <= zU) z2 = l; G.tgt.z = Math.max(z2, floor); const a2 = (ub.x0 + ub.x1) / 32, b2 = (ub.y0 + ub.y1) / 16; G.tgt.u = (a2 + b2) / 2; G.tgt.v = (b2 - a2) / 2; }
    }
  }
  if (instant || reduce) Object.assign(G.cam, G.tgt);
}
export function fit(instant) { frameTo(G.world.hoods.concat([G.world.hub]), instant, true); }
export function zoomTo(z, X, Y) {
  z = Math.max(G.levels[0], Math.min(G.levels[G.levels.length - 1], z)); if (X == null) { X = G.W / 2; Y = G.H / 2; }
  const saved = Object.assign({}, G.cam); Object.assign(G.cam, G.tgt);
  const w = toW(X, Y); G.cam.z = z; const w2 = toW(X, Y); G.tgt.u = G.cam.u + (w[0] - w2[0]); G.tgt.v = G.cam.v + (w[1] - w2[1]); G.tgt.z = z;
  Object.assign(G.cam, saved); if (reduce) Object.assign(G.cam, G.tgt);
}
export function stepZoom(dir, X, Y) { let i = 0; G.levels.forEach((l, k) => { if (Math.abs(l - G.tgt.z) < 0.01) i = k; }); zoomTo(G.levels[Math.max(0, Math.min(G.levels.length - 1, i + dir))], X, Y); }
export function glide(u, v) { G.tgt.u = u; G.tgt.v = v; const two = G.levels.find((l) => l >= 1.5); if (G.tgt.z < 1.5 && two) G.tgt.z = two; if (reduce) Object.assign(G.cam, G.tgt); }

/* ---------------- primitives ---------------- */
function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function poly(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
function rhombus(u0, v0, u1, v1) { poly([toS(u0, v0), toS(u1, v0), toS(u1, v1), toS(u0, v1)]); }
function line(u0, v0, u1, v1) { const a = toS(u0, v0), b = toS(u1, v1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
function font(px, w) { ctx.font = (w || 400) + ' ' + Math.round(px * G.dpr) + 'px ' + FONT.mono; }
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const UH = () => 10 * P(); // screen px per unit of height
function up(p, h) { return [p[0], p[1] - h * UH()]; }
// an upright box: left face (+v side), right face (+u side), top
function box(u, v, w, d, h, top, left, right, edge) {
  const a = toS(u, v + d), b = toS(u + w, v + d), c = toS(u + w, v);
  ctx.fillStyle = left; poly([a, b, up(b, h), up(a, h)]); ctx.fill();
  ctx.fillStyle = right; poly([b, c, up(c, h), up(b, h)]); ctx.fill();
  poly([up(toS(u, v), h), up(c, h), up(b, h), up(a, h)]); ctx.fillStyle = top; ctx.fill();
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = G.dpr; ctx.stroke(); }
}
// a point on a box face: along = position along the face, hgt = height
function faceQuad(face, x0, x1, h0, h1) {
  const p0 = face(x0), p1 = face(x1);
  return [up(p0, h0), up(p1, h0), up(p1, h1), up(p0, h1)];
}

/* ---------------- lattice + graticule ---------------- */
function visibleRange() {
  const c = [toW(0, 0), toW(G.W, 0), toW(0, G.H), toW(G.W, G.H)];
  return { u0: Math.floor(Math.min(...c.map((q) => q[0]))) - 1, u1: Math.ceil(Math.max(...c.map((q) => q[0]))) + 1, v0: Math.floor(Math.min(...c.map((q) => q[1]))) - 1, v1: Math.ceil(Math.max(...c.map((q) => q[1]))) + 1 };
}
function drawGrid() {
  const r = visibleRange(), step = G.cam.z >= 1.5 ? 1 : 2;
  ctx.lineWidth = 1; ctx.beginPath(); ctx.strokeStyle = C.gridMinor;
  for (let i = Math.ceil(r.u0 / step) * step; i <= r.u1; i += step) if (i % 8) line(i, r.v0, i, r.v1);
  for (let i = Math.ceil(r.v0 / step) * step; i <= r.v1; i += step) if (i % 8) line(r.u0, i, r.u1, i);
  ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = C.gridMajor;
  for (let i = Math.ceil(r.u0 / 8) * 8; i <= r.u1; i += 8) line(i, r.v0, i, r.v1);
  for (let i = Math.ceil(r.v0 / 8) * 8; i <= r.v1; i += 8) line(r.u0, i, r.u1, i);
  ctx.stroke(); ctx.fillStyle = C.cross; const k = 3 * G.dpr;
  for (let u = Math.ceil(r.u0 / 8) * 8; u <= r.u1; u += 8) for (let v = Math.ceil(r.v0 / 8) * 8; v <= r.v1; v += 8) { const s = toS(u, v); ctx.fillRect(Math.round(s[0] - k), Math.round(s[1]), 2 * k + 1, 1); ctx.fillRect(Math.round(s[0]), Math.round(s[1] - k), 1, 2 * k + 1); }
}
const pad2 = (n) => { n = Math.round(n); return (n < 0 ? '−' : '') + (Math.abs(n) < 10 ? '0' : '') + Math.abs(n); };
function drawGraticule() {
  const p = P(), o = origin(), r = visibleRange(), tick = 6 * G.dpr, dpr = G.dpr;
  font(11); ctx.fillStyle = C.subtle; ctx.strokeStyle = C.tick; ctx.lineWidth = 1; ctx.beginPath(); ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  const bTop = -o[1] / (8 * p);
  for (let i = Math.ceil(r.u0 / 8) * 8; i <= r.u1; i += 8) { const X = o[0] + (2 * i - bTop) * 16 * p; if (X > 60 * dpr && X < G.W - 230 * dpr) { ctx.moveTo(Math.round(X) + 0.5, 0); ctx.lineTo(Math.round(X) + 0.5, tick); ctx.fillText('u ' + pad2(i), X, tick + 3 * dpr); } }
  const aLeft = -o[0] / (16 * p); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let i = Math.ceil(r.v0 / 8) * 8; i <= r.v1; i += 8) { const Y = o[1] + (aLeft + 2 * i) * 8 * p; if (Y > 34 * dpr && Y < G.H - 160 * dpr) { ctx.moveTo(0, Math.round(Y) + 0.5); ctx.lineTo(tick, Math.round(Y) + 0.5); ctx.fillText('v ' + pad2(i), tick + 4 * dpr, Y); } }
  ctx.stroke();
}

/* ---------------- islands, bridges, plots, zones ---------------- */
function slabFaces(u0, v0, u1, v1, th, cl, cr) {
  const a = toS(u0, v1), b = toS(u1, v1), c = toS(u1, v0);
  ctx.fillStyle = cl; poly([a, b, [b[0], b[1] + th], [a[0], a[1] + th]]); ctx.fill();
  ctx.fillStyle = cr; poly([b, c, [c[0], c[1] + th], [b[0], b[1] + th]]); ctx.fill();
}
// a machine island, or the hub (lighter top): selected in accent, hovered in a stronger line
function drawIsland(isl) {
  const hub = isl.kind === 'hub', on = G.sel.area && G.sel.area.kind === (hub ? 'hub' : 'island') && G.sel.area.id === isl.h.id, over = G.hover.area && G.hover.area.id === isl.h.id && G.hover.area.kind !== 'plot';
  slabFaces(isl.u0, isl.v0, isl.u1, isl.v1, 8, C.islandL, C.islandR);
  rhombus(isl.u0, isl.v0, isl.u1, isl.v1); ctx.fillStyle = hub ? C.commons : C.islandTop; ctx.fill();
  ctx.fillStyle = C.fg; ctx.globalAlpha = 0.09;
  for (let u = isl.u0 + 0.5; u < isl.u1; u += 1) for (let v = isl.v0 + 0.5; v < isl.v1; v += 1) { const q = toS(u, v); ctx.fillRect(Math.round(q[0]), Math.round(q[1]), 1, 1); }
  ctx.globalAlpha = 1;
  rhombus(isl.u0, isl.v0, isl.u1, isl.v1); ctx.strokeStyle = on ? C.accent : over ? C.strong : C.islandEdge; ctx.lineWidth = 1; ctx.stroke();
}
// 3x5 pixel capitals painted along a plot's edge: each column steps down one pixel per two (the 2:1 grid line), strokes stay upright so it reads
const PF = {
  A: '.x.x.xxxxx.xx.x', B: 'xx.x.xxx.x.xxx.', C: '.xxx..x..x...xx', D: 'xx.x.xx.xx.xxx.', E: 'xxxx..xx.x..xxx', F: 'xxxx..xx.x..x..', G: '.xxx..x.xx.x.xx', H: 'x.xx.xxxxx.xx.x', I: 'xxx.x..x..x.xxx',
  J: '..x..x..xx.x.x.', K: 'x.xx.xxx.x.xx.x', L: 'x..x..x..x..xxx', M: 'x.xxxxxxxx.xx.x', N: 'xx.x.xx.xx.xx.x', O: '.x.x.xx.xx.x.x.', P: 'xx.x.xxx.x..x..', Q: '.x.x.xx.xxxx.xx', R: 'xx.x.xxx.x.xx.x',
  S: '.xxx...x...xxx.', T: 'xxx.x..x..x..x.', U: 'x.xx.xx.xx.xxxx', V: 'x.xx.xx.xx.x.x.', W: 'x.xx.xxxxxxxx.x', X: 'x.xx.x.x.x.xx.x', Y: 'x.xx.x.x..x..x.', Z: 'xxx..x.x.x..xxx',
  0: '.x.x.xx.xx.x.x.', 1: '.x.xx..x..x.xxx', 2: 'xx...x.x.x..xxx', 3: 'xx...x.x...xxx.', 4: 'x.xx.xxxx..x..x', 5: 'xxxx..xx...xxx.', 6: '.xxx..xx.x.x.x.', 7: 'xxx..x.x..x..x.', 8: '.x.x.x.x.x.x.x.', 9: '.x.x.x.xx..xxx.',
  '-': '......xxx......', '.': '............x..', ' ': '...............'
};
function floorText(text, u, v, alpha) {
  const o = toS(u, v); ctx.globalAlpha = alpha; ctx.fillStyle = C.fg;
  let c0 = 0;
  for (const ch of text.toUpperCase()) {
    const g = PF[ch] || PF[' '];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === 'x') { const x = c0 + c; ctx.fillRect(Math.round(o[0]) + 2 * x, Math.round(o[1]) + x + r, 2, 1); }
    c0 += 4;
  }
  ctx.globalAlpha = 1;
}
function drawBridge(br) {
  const c0 = br.cells[0], c1 = br.cells[br.cells.length - 1]; if (!c0) return;
  const u0 = c0[0], v0 = c0[1], u1 = c1[0] + 1, v1 = c1[1] + 1;
  slabFaces(u0, v0, u1, v1, 3, C.islandL, C.islandR);
  rhombus(u0, v0, u1, v1); ctx.fillStyle = C.bridgeTop; ctx.fill(); ctx.strokeStyle = C.islandEdge; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = C.plank; ctx.beginPath(); for (const c of br.cells) { if (br.axis === 'u') line(c[0] + 0.5, c[1], c[0] + 0.5, c[1] + 1); else line(c[0], c[1] + 0.5, c[0] + 1, c[1] + 0.5); } ctx.stroke();
}
// a zone: a dotted square on the commons with its glyph stamped in the middle (rest, snack, circle, play)
function drawZone(z) {
  rhombus(z.u0, z.v0, z.u0 + z.w, z.v0 + z.d); ctx.fillStyle = C.plate; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
  ctx.setLineDash([1, 2]); ctx.strokeStyle = C.fg; ctx.globalAlpha = 0.3; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
  const c = toS(z.cu - 0.3, z.cv - 0.3), gm = GLYPH[ZONES[z.zone].glyph], x0 = Math.round(c[0]) - 2, y0 = Math.round(c[1]) - 2;
  ctx.fillStyle = C.fg; ctx.globalAlpha = 0.34;
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) if (gm[r][q] === 'x') ctx.fillRect(x0 + q, y0 + r, 1, 1);
  ctx.globalAlpha = 1;
  floorText(z.zone, z.u0 + 0.4, z.v0 + z.d - 0.8, 0.24);
}
// a project plot: its own floor pattern, a pad under each desk (so an empty plot still shows its seats), its name on the floor
function drawPlate(room) {
  const { u0, v0, w, d } = room, th = 4, on = G.sel.area && G.sel.area.kind === 'plot' && G.sel.area.id === room.project, over = G.hover.area && G.hover.area.kind === 'plot' && G.hover.area.id === room.project;
  slabFaces(u0, v0, u0 + w, v0 + d, th, C.faceL, C.faceR);
  rhombus(u0, v0, u0 + w, v0 + d); ctx.fillStyle = C.plate; ctx.fill();
  ctx.save(); rhombus(u0, v0, u0 + w, v0 + d); ctx.clip(); floor(room); ctx.restore();
  ctx.strokeStyle = C.fg; ctx.globalAlpha = 0.16; ctx.lineWidth = 1;
  for (const dk of room.desks) { rhombus(dk.u - 0.55, dk.v - 0.55, dk.u + 0.55, dk.v + 0.55); ctx.stroke(); }
  ctx.globalAlpha = 1;
  floorText(room.project, u0 + 0.45, v0 + d - 0.8, on || over ? 0.5 : 0.24);
  rhombus(u0, v0, u0 + w, v0 + d); ctx.lineWidth = 1; ctx.strokeStyle = on ? C.accent : over ? C.strong : C.plateEdge; ctx.stroke();
}
// six floors, chosen from the project's name (world.js FLOORS): faint, never louder than a creature
function floor(room) {
  const { u0, v0, w, d } = room, u1 = u0 + w, v1 = v0 + d, dot = (u, v) => { const q = toS(u, v); ctx.fillRect(Math.round(q[0]), Math.round(q[1]), 1, 1); };
  ctx.fillStyle = C.fg; ctx.strokeStyle = C.fg; ctx.globalAlpha = 0.11; ctx.lineWidth = 1; ctx.beginPath();
  switch (room.floor) {
    case 'dots': for (let u = u0 + 0.5; u < u1; u++) for (let v = v0 + 0.5; v < v1; v++) dot(u, v); break;
    case 'rows': for (let v = v0 + 1; v < v1; v++) line(u0, v, u1, v); break;
    case 'grid': for (let v = v0 + 1; v < v1; v++) line(u0, v, u1, v); for (let u = u0 + 1; u < u1; u++) line(u, v0, u, v1); break;
    case 'hatch': for (let u = u0 + 0.5; u < u1; u += 1) line(u, v0, u, v1); break;
    case 'cross': for (let u = u0 + 1; u < u1; u++) for (let v = v0 + 1; v < v1; v++) { line(u - 0.15, v, u + 0.15, v); line(u, v - 0.15, u, v + 0.15); } break;
    case 'rings': for (let u = u0; u < u1; u += 2) for (let v = v0; v < v1; v += 2) { const a = toS(u + 0.6, v + 1), b = toS(u + 1, v + 0.6), c = toS(u + 1.4, v + 1), e = toS(u + 1, v + 1.4); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); ctx.closePath(); } break;
  }
  ctx.stroke(); ctx.globalAlpha = 1;
}
/* ---------------- creatures ---------------- */
function slab(X, Y, s, k) {
  const rows = [2, 6, 10, 6, 2], col = { run: C.run, wait: C.wait, done: C.done, err: C.err }[s.state];
  for (let r = 0; r < 5; r++) { const w = rows[r], x = X - w / 2 * k, y = Y + r * k; if (col) { ctx.globalAlpha = s.state === 'run' ? 0.8 : 0.95; R(x, y, w * k, k, col); } else { R(x, y, k, k, C.slabRim); R(x + (w - 1) * k, y, k, k, C.slabRim); } }
  ctx.globalAlpha = 1;
  if (s.state === 'run') { const f = Math.floor(G.t * 6 + (s.id.charCodeAt(1) % 5)) % 6; R(X + (f - 3) * k, Y + 2 * k, k, k, C.slabCursor); }
  if (s.state === 'err') { R(X - k, Y + k, k, k, C.slabCrack); R(X, Y + 2 * k, k, k, C.slabCrack); R(X + k, Y + 3 * k, k, k, C.slabCrack); }
}
function diamond(X, Y, k) { [1, 3, 5, 7, 5, 3, 1].forEach((w, r) => R(X - w / 2 * k, Y + r * k, w * k, k, C.wait)); }
function bubble(X, Y, glyph, k, alpha) {
  const w = 9 * k, h = 9 * k, x = Math.round(X - w / 2), y = Math.round(Y - h);
  ctx.globalAlpha = alpha;
  R(x + k, y, w - 2 * k, h, C.line2); R(x, y + k, w, h - 2 * k, C.line2); R(x + 3 * k, y + h, 2 * k, k, C.line2); R(x + 2 * k, y + h + k, k, k, C.line2);
  R(x + 2 * k, y + k, w - 4 * k, h - 2 * k, C.panel); R(x + k, y + 2 * k, w - 2 * k, h - 4 * k, C.panel); R(x + 3 * k, y + h - k, 2 * k, k, C.panel);
  const gm = GLYPH[glyph] || GLYPH.dots; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (gm[r][c] === 'x') R(x + (2 + c) * k, y + (2 + r) * k, k, k, C.dim);
  ctx.globalAlpha = 1;
}
function faceFor(s, b, t, seed) {
  const blink = ((t + seed * 5) % 3.8) < 0.12, atDesk = wantsDesk(s) && b.atDesk;
  if (s.state === 'idle' && !b.path.length) return 'closed';
  if (b.act.type === 'rest' && b.act.arrived && !b.path.length) return 'closed';
  if (s.state === 'err' && atDesk) return 'x';
  if (b.emote && b.emote.g === 'bang' && t >= b.emote.from) return 'surprised';
  if (blink) return 'blink';
  if (s.state === 'wait' && atDesk) return 'worried';
  if (s.state === 'run' && atDesk) return 'focus';
  if (b.act.type === 'comfort' || b.act.type === 'company') return 'worried';
  if ((b.act.type === 'play' || b.act.type === 'snack') && b.act.arrived && !b.path.length) return 'happy';
  if (b.act.type === 'celebrate' || (s.state === 'done' && !b.moving)) return b.say ? 'open' : 'happy';
  return 'open';
}
export const labelQ = [];
function drawCreature(s, b, t) {
  const f = toS(b.u, b.v), k = Math.max(1, Math.round(P())), X = Math.round(f[0]), Y = Math.round(f[1]), g = gene(s.id), dpr = G.dpr;
  const seed = (hash(s.id) % 997) / 997, atDesk = wantsDesk(s) && b.atDesk, flat = s.state === 'err' && atDesk;
  const face = faceFor(s, b, t, seed), spr = sprite(s, face, s.state === 'idle', flat), sw = spr.width * k, sh = spr.height * k;
  let lift = 0, squash = 0;
  if (!reduce) {
    if (s.state === 'wait' && atDesk) { lift = Math.round(Math.abs(Math.sin((t + seed) * Math.PI * 1.25)) * 4) * k; if (!lift) squash = k; }
    else if (b.act.type === 'celebrate') { lift = Math.round(Math.abs(Math.sin(t * Math.PI * 2.4)) * 7) * k; if (!lift) squash = k; }
    else if (s.state === 'run' && atDesk) lift = (Math.floor(t * 3 + seed * 3) % 2) * k;
    else if (b.moving) lift = (Math.floor(t * 8 * g.energy + seed * 4) % 2) * k;
    else if (b.say) lift = (Math.floor(t * 5) % 2) * k;
  }
  // path preview for the hovered or selected walker
  if ((s.id === G.selId || s.id === G.hover.agent) && b.path.length) {
    ctx.fillStyle = C.faint; b.path.forEach((n, i) => { if (i % 2) return; const q = toS(n.u, n.v); ctx.fillRect(Math.round(q[0]) - dpr, Math.round(q[1]) - dpr, 2 * dpr, 2 * dpr); });
    const en = b.path[b.path.length - 1]; ctx.strokeStyle = C.faint; ctx.lineWidth = dpr; rhombus(en.u - 0.4, en.v - 0.4, en.u + 0.4, en.v + 0.4); ctx.stroke();
  }
  ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(X, Y, (spr.width / 2) * k, 3 * k, 0, 0, Math.PI * 2); ctx.fill();
  if (s.state === 'wait' && atDesk) { ctx.strokeStyle = C.wait; ctx.lineWidth = Math.max(1, dpr); rhombus(b.u - 0.85, b.v - 0.85, b.u + 0.85, b.v + 0.85); ctx.stroke(); }
  const sink = b.seated && !b.moving ? 2 * k : 0, sx = Math.round(X - sw / 2), sy = Math.round(Y - sh + 2 * k - lift + sink + squash);
  const dy = flat ? Math.round(Y - sh + 3 * k) : sy, dh = sh - squash;
  if (b.face < 0 && !atDesk) { ctx.save(); ctx.translate(sx + sw, dy); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0, sw, dh); ctx.restore(); }
  else ctx.drawImage(spr, sx, dy, sw, dh);
  const bodyTop = dy + TOP * k;
  if (atDesk) {
    const slY = flat ? Y - 3 * k : Y - Math.round((sh - TOP * k) * 0.55) - (s.state === 'run' ? 0 : lift / 2);
    slab(X + sw / 2 + 4 * k, slY, s, k);
    if (s.state === 'run') { const tap = Math.floor(t * 6 + seed * 6) % 2; R(sx + sw - k, slY + tap * k, 2 * k, 2 * k, coat(g).d); }
  }
  if (b.seated && /coffee/.test(b.act.label || '')) { const cx2 = b.face > 0 ? sx + sw - k : sx - k; R(cx2, bodyTop + (sh - TOP * k) * 0.45, 2 * k, 2 * k, C.subtle); }
  if (flat) { const dx = X + 6 * k, dyy = Y - 9 * k - ((Math.floor(t * 2) % 2) * k); R(dx, dyy, k, k, C.dim); R(dx - k, dyy + k, 3 * k, 2 * k, C.dim); }
  const kd = Math.max(k, Math.round(1.6 * dpr)); let top = bodyTop;
  if (s.state === 'wait') { top = bodyTop - 9 * kd; diamond(X, top + (reduce ? 0 : (Math.floor(t * 2) % 2) * kd), kd); }
  b.callout = (s.state === 'wait' || s.state === 'err') && s.bubble ? { X, sw, sy: dy, sh, top, k } : null;
  if (face === 'closed' && !reduce) for (let z = 0; z < 2; z++) { const ph = (t * 0.35 + seed + z * 0.5) % 1; ctx.globalAlpha = 1 - ph; const zx = sx + sw - 2 * k + ph * 4 * k, zy = bodyTop - ph * 10 * k; R(zx, zy, 3 * k, k, C.faint); R(zx + k, zy + k, k, k, C.faint); R(zx, zy + 2 * k, 3 * k, k, C.faint); ctx.globalAlpha = 1; }
  // speech: words when close enough to read, a glyph bubble otherwise
  b.speech = b.say ? { X, Y: top - 2 * k } : null;
  if (b.say && G.cam.z < 1.5) bubble(X + (b.face > 0 ? 6 : -6) * k, top - 2 * k, 'dots', k, 1);
  else if (b.emote && t >= b.emote.from && s.state !== 'wait') { const span = b.emote.until - b.emote.from, ph = (t - b.emote.from) / span, a = Math.min(1, Math.min(ph, 1 - ph) * 5); bubble(X + (b.face > 0 ? 6 : -6) * k, top - 2 * k - Math.round(ph * 3) * k, b.emote.g, k, a); }
  const bt = s.state === 'wait' ? top - kd : bodyTop;
  G.boxes[s.id] = { x: sx, y: bt, w: sw + (atDesk ? 14 * k : 0), h: Y + 3 * k - bt, fx: X, fy: Y };
}
function bracket(b, col) {
  const dpr = G.dpr, p = 4 * dpr, L = 6 * dpr, x = b.x - p, y = b.y - p, w = b.w + 2 * p, h = b.h + 2 * p, t = Math.max(1, Math.round(dpr));
  ctx.fillStyle = col;
  for (const q of [[x, y, L, t], [x, y, t, L], [x + w - L, y, L, t], [x + w - t, y, t, L], [x, y + h - t, L, t], [x, y + h - L, t, L], [x + w - L, y + h - t, L, t], [x + w - t, y + h - L, t, L]]) ctx.fillRect(Math.round(q[0]), Math.round(q[1]), q[2], q[3]);
}

/* ---------------- floating labels: callouts (status) and speech, never on top of each other ---------------- */
function callout(text, X, Y, col, o) {
  const dpr = G.dpr; font(o.size || 11); const tw = ctx.measureText(text).width, padX = 7 * dpr, h = (o.h || 20) * dpr, w = tw + padX * 2;
  if (o.measure) return { w, h };
  const x = Math.round(o.at.x), y = Math.round(o.at.y), mode = o.mode || 'above';
  if (mode !== 'above') { ctx.strokeStyle = col; ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(1, dpr); ctx.beginPath(); ctx.moveTo(mode === 'right' ? x : x + w, y + h / 2); ctx.lineTo(X, Y); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.fillStyle = C.panel; roundRect(x, y, w, h, 5 * dpr); ctx.fill();
  ctx.strokeStyle = col; ctx.globalAlpha = o.quiet ? 1 : 0.7; ctx.lineWidth = Math.max(1, dpr); roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 5 * dpr); ctx.stroke(); ctx.globalAlpha = 1;
  if (mode === 'above') { const tx = Math.max(x + 8 * dpr, Math.min(x + w - 8 * dpr, X)); ctx.fillStyle = C.panel; ctx.beginPath(); ctx.moveTo(tx - 4 * dpr, y + h - 1); ctx.lineTo(tx + 4 * dpr, y + h - 1); ctx.lineTo(tx, y + h + 4 * dpr); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = o.ink || C.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + padX, y + h / 2 + 0.5 * dpr);
}
function queueCallout(s, X, sw, sy, sh, top, k) {
  const bt = s.bubble, bc = s.state === 'wait' ? C.wait : C.err, ay = top - 2 * G.dpr, side = sy + Math.round(sh * 0.45), dpr = G.dpr;
  labelQ.push({ prio: 0, must: true, own: s.id, cands: [{ mode: 'above', X, Y: ay, off: 8 * dpr }, { mode: 'right', X: X + sw / 2 + 16 * k, Y: side, off: 10 * dpr }, { mode: 'left', X: X - sw / 2, Y: side, off: 10 * dpr }],
    variants: [{ m: () => callout(bt, 0, 0, bc, { measure: true }), draw: (x, y, c) => { const tx = c.mode === 'right' ? X + sw / 2 + 10 * k : c.mode === 'left' ? X - sw / 2 : X; callout(bt, tx, c.mode === 'above' ? ay : side, bc, { at: { x, y }, mode: c.mode }); } }] });
}
function queueSpeech(s, b, X, Y) {
  const text = b.say.text, dpr = G.dpr, o = { size: 10.5, h: 18, quiet: true, ink: C.dim };
  labelQ.push({ prio: 4, own: s.id, cands: [{ mode: 'above', X, Y, off: 6 * dpr }, { mode: 'above', X: X + 30 * dpr, Y: Y - 4 * dpr, off: 6 * dpr }, { mode: 'above', X: X - 30 * dpr, Y: Y - 4 * dpr, off: 6 * dpr }],
    variants: [{ m: () => callout(text, 0, 0, C.line2, Object.assign({ measure: true }, o)), draw: (x, y, c) => callout(text, c.X, Y, C.line2, Object.assign({ at: { x, y }, mode: c.mode }, o)) }],
    fallback: () => { const k = Math.max(1, Math.round(P())); bubble(X + (b.face > 0 ? 6 : -6) * k, Y, 'dots', k, 1); } });
}
function overlayRects() {
  const sr = stage.getBoundingClientRect(), dpr = G.dpr, out = [{ x: 0, y: 0, w: G.W, h: 26 * dpr }, { x: 0, y: 0, w: 52 * dpr, h: G.H }];
  stage.querySelectorAll('.zoom, .mini, .edge, .info').forEach((el) => { const r = el.getBoundingClientRect(); out.push({ x: (r.left - sr.left) * dpr, y: (r.top - sr.top) * dpr, w: r.width * dpr, h: r.height * dpr }); });
  return out;
}
function rectAt(c, m) {
  const off = c.off != null ? c.off : 6 * G.dpr;
  if (c.mode === 'above') return { x: c.X - m.w / 2, y: c.Y - off - m.h, w: m.w, h: m.h };
  if (c.mode === 'left') return { x: c.X - off - m.w, y: c.Y - m.h / 2, w: m.w, h: m.h };
  return { x: c.X + off, y: c.Y - m.h / 2, w: m.w, h: m.h };
}
function overlaps(r, list) { const M = 6 * G.dpr; for (const o of list) if (r.x < o.x + o.w + M && r.x + r.w + M > o.x && r.y < o.y + o.h + M && r.y + r.h + M > o.y) return true; return false; }
function placeLabels() {
  const taken = overlayRects(), dpr = G.dpr;
  for (const s of G.S) { const b = G.boxes[s.id]; if (b) taken.push({ x: b.x, y: b.y, w: b.w, h: b.h, own: s.id }); }
  labelQ.sort((a, b) => a.prio - b.prio).forEach((it) => {
    const others = taken.filter((o) => o.own !== it.own);
    for (const v of it.variants) { const m = v.m(); for (const c of it.cands) { const r = rectAt(c, m); if (r.x < 2 * dpr || r.y < 2 * dpr || r.x + r.w > G.W - 2 * dpr || r.y + r.h > G.H - 2 * dpr) continue; if (overlaps(r, others)) continue; taken.push(r); v.draw(r.x, r.y, c); return; } }
    const c0 = it.cands[0];
    if (it.must && c0.X >= 0 && c0.X <= G.W && c0.Y >= 0 && c0.Y <= G.H) { const v0 = it.variants[0], m0 = v0.m(), r0 = rectAt(c0, m0); r0.x = Math.max(2 * dpr, Math.min(G.W - r0.w - 2 * dpr, r0.x)); r0.y = Math.max(2 * dpr, Math.min(G.H - r0.h - 2 * dpr, r0.y)); taken.push(r0); v0.draw(r0.x, r0.y, c0); }
    else if (it.fallback) it.fallback();
  });
}

/* ---------------- district and plot labels (floating, as in v3) ---------------- */
function labelBox(text, sub, opts) {
  const dpr = G.dpr, size = opts.size || 11.5, gap = 6 * dpr, padX = 5 * dpr, h = 18 * dpr;
  font(size, 500); const tw = ctx.measureText(text).width; let sw = 0;
  if (sub) { font(size); sw = ctx.measureText(sub).width + gap; }
  const bw = opts.badge ? 15 * dpr + gap : 0, w = tw + sw + bw + padX * 2;
  if (opts.measure) return { w, h };
  const x = Math.round(opts.at.x), y = Math.round(opts.at.y);
  ctx.fillStyle = C.labelBg; roundRect(x, y, w, h, 3 * dpr); ctx.fill();
  if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = Math.max(1, dpr); roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 3 * dpr); ctx.stroke(); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  font(size, 500); ctx.fillStyle = C.fg; ctx.fillText(text, x + padX, y + h / 2 + 0.5 * dpr);
  if (sub) { font(size); ctx.fillStyle = C.subtle; ctx.fillText(sub, x + padX + tw + gap, y + h / 2 + 0.5 * dpr); }
  if (opts.badge) { const bx = x + padX + tw + sw + gap; ctx.fillStyle = C.wait; roundRect(bx, y + 3 * dpr, 15 * dpr, 12 * dpr, 2 * dpr); ctx.fill(); font(10.5, 500); ctx.fillStyle = C.onAccent; ctx.textAlign = 'center'; ctx.fillText(String(opts.badge), bx + 7.5 * dpr, y + h / 2 + 0.5 * dpr); }
  return { x, y, w, h };
}
/* ---------------- the frame ---------------- */
export function draw(t) {
  const W = G.world, sc = G.cam.z * G.dpr, dprSave = G.dpr;
  ctx = mainCtx; ctx.fillStyle = C.ground; ctx.fillRect(0, 0, G.W, G.H);
  if (G.night > 0) { ctx.fillStyle = C.night; ctx.globalAlpha = G.night * 0.7; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
  drawGrid();
  // world pass: one art pixel = one pixel, then the whole image is enlarged at once, so nothing slides while zooming
  const bw = Math.ceil(G.W / sc) + 2, bh = Math.ceil(G.H / sc) + 2;
  if (off.width !== bw || off.height !== bh) { off.width = bw; off.height = bh; } else offCtx.clearRect(0, 0, bw, bh);
  ctx = offCtx; ctx.imageSmoothingEnabled = false; G.rs = 1; G.vw = bw; G.vh = bh; G.dpr = 1;
  W.bridges.forEach(drawBridge);
  W.hoods.forEach(drawIsland); drawIsland(W.hub);
  W.rooms.forEach((r) => { if (r.kind === 'office') drawPlate(r); });
  W.zones.forEach(drawZone);
  const things = [];
  for (const s of G.S) { const b = body(s); things.push({ d: b.u + b.v + 0.05, draw: () => drawCreature(s, b, t) }); }
  things.sort((a, b) => a.d - b.d).forEach((x) => x.draw());
  G.rs = 0; G.vw = 0; G.vh = 0; G.dpr = dprSave; ctx = mainCtx;
  const ox = G.W / 2 - bw / 2 * sc, oy = G.H / 2 - bh / 2 * sc;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, bw, bh, ox, oy, bw * sc, bh * sc);
  // creature boxes and label anchors move to screen space
  for (const id in G.boxes) { const b = G.boxes[id]; G.boxes[id] = { x: ox + b.x * sc, y: oy + b.y * sc, w: b.w * sc, h: b.h * sc, fx: ox + b.fx * sc, fy: oy + b.fy * sc }; }
  labelQ.length = 0;
  for (const s of G.S) {
    const b = G.bodies[s.id]; if (!b) continue;
    if (b.callout) { const c = b.callout; queueCallout(s, ox + c.X * sc, c.sw * sc, oy + c.sy * sc, c.sh * sc, oy + c.top * sc, c.k * sc); }
    if (b.speech && G.cam.z >= 1.5) queueSpeech(s, b, ox + b.speech.X * sc, oy + b.speech.Y * sc);
  }
  drawGraticule();
  placeLabels();
  if (G.hover.agent && G.hover.agent !== G.selId && G.boxes[G.hover.agent]) bracket(G.boxes[G.hover.agent], C.strong);
  if (G.selId && G.boxes[G.selId]) bracket(G.boxes[G.selId], C.accent);
}

/* ---------------- overlays: edge markers, tooltip, minimap ---------------- */
const edgesEl = document.getElementById('edges'), edgeEls = {};
const CROSS = '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" stroke="var(--err)" stroke-width="1.5"/></svg>';
export const DIAM = '<svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 11 6 6 11 1 6Z" fill="var(--wait)"/></svg>';
export function edgeMarkers(onLocate) {
  const cw = G.W / G.dpr, ch = G.H / G.dpr, pad = 26, seen = {};
  for (const s of G.S) {
    if ((s.state !== 'wait' && s.state !== 'err') || !G.boxes[s.id]) continue;
    const b = G.boxes[s.id], x = b.fx / G.dpr, y = (b.y + b.h / 2) / G.dpr;
    if (x > 0 && x < cw && y > 0 && y < ch) continue;
    seen[s.id] = 1;
    const cx = cw / 2, cy = ch / 2, dx = x - cx, dy = y - cy, sc = Math.min((cw / 2 - pad - 60) / Math.abs(dx || 1e-6), (ch / 2 - pad - 34) / Math.abs(dy || 1e-6)), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    let el = edgeEls[s.id];
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'edge'; el.addEventListener('click', () => onLocate(s.id)); edgesEl.appendChild(el); edgeEls[s.id] = el; }
    el.classList.toggle('err', s.state === 'err');
    const label = (s.state === 'err' ? CROSS : DIAM) + '<span>' + s.plot + '</span> ' + fmt(s.since) + '<svg class="ar" viewBox="0 0 10 10" style="transform:rotate(' + ang.toFixed(0) + 'deg)" aria-hidden="true"><path d="M2 5h6M5.5 2.5 8 5 5.5 7.5" fill="none" stroke="var(--dim)" stroke-width="1.2"/></svg>';
    if (el._l !== label) { el.innerHTML = label; el._l = label; el.setAttribute('aria-label', s.plot + (s.state === 'err' ? ' failed' : ' needs you') + ', off screen. Go to it.'); }
    let ex = cx + dx * sc, ey = cy + dy * sc;
    const sr = stage.getBoundingClientRect();
    const hw = el.offsetWidth / 2 + 6, hh = el.offsetHeight / 2 + 6;
    stage.querySelectorAll('.zoom, .mini').forEach((ov) => { const r = ov.getBoundingClientRect(), x0 = r.left - sr.left - hw, x1 = r.right - sr.left + hw, y0 = r.top - sr.top - hh, y1 = r.bottom - sr.top + hh; if (ex > x0 && ex < x1 && ey > y0 && ey < y1) ey = ov.classList.contains('zoom') ? y1 : y0; });
    ex = Math.max(hw, Math.min(cw - hw, ex));
    el.style.left = ex + 'px'; el.style.top = ey + 'px';
  }
  for (const id in edgeEls) if (!seen[id]) { edgeEls[id].remove(); delete edgeEls[id]; }
}
const tip = document.getElementById('tip'); let tipKey = '';
const WORD = { run: 'running', wait: 'needs you', done: 'done', err: 'failed', idle: 'asleep' };
export function placeTip(icon, dragging) {
  const id = G.hover.agent || G.selId, s = id && byId(id), b = id && G.boxes[id];
  if (!s || !b || dragging) { tip.hidden = true; tipKey = ''; return; }
  const act = activity(s), bf = bestFriend(s.id), nd0 = needsOf(s.id), keyNow = id + s.state + act + (bf ? bf.id : '') + (nd0 ? ['energy', 'hunger', 'social', 'fun'].map((n) => Math.round(nd0[n] * 20)).join('') : '');
  if (keyNow !== tipKey) {
    const nd = needsOf(s.id), bars = nd ? '<div class="needs">' + ['energy', 'hunger', 'social', 'fun'].map((n) => '<span><i style="width:' + Math.round(nd[n] * 100) + '%"></i>' + n + '</span>').join('') + '</div>' : '';
    tip.innerHTML = '<div class="n">' + esc(gene(s.id).name) + ' · ' + s.agent + ' on ' + hostOf(s).name + (bf ? ' · friends with ' + esc(gene(bf.id).name) : '') + '</div><div class="t">' + esc(s.title) + '</div><div class="s">' + icon(s.state) + WORD[s.state] + ' · ' + fmt(s.since) + ' · ' + esc(act) + '</div>' + bars;
    tipKey = keyNow;
  }
  tip.style.left = Math.max(150, Math.min(G.W / G.dpr - 150, (b.x + b.w / 2) / G.dpr)) + 'px'; tip.style.top = Math.max(90, b.y / G.dpr) + 'px'; tip.hidden = false;
}
const mm = document.getElementById('mm'), mg = mm.getContext('2d'); let mmT = null;
export function minimap() {
  const b = boundsOf(G.world.hoods.concat([G.world.hub])), MW = mm.width, MH = mm.height, sc = Math.min((MW - 16) / (b.x1 - b.x0), (MH - 16) / (b.y1 - b.y0)), ox = MW / 2 - (b.x0 + b.x1) / 2 * sc, oy = MH / 2 - (b.y0 + b.y1) / 2 * sc;
  mmT = { sc, ox, oy };
  const pr = (u, v) => [ox + (u - v) * 16 * sc, oy + (u + v) * 8 * sc];
  const rh = (u0, v0, u1, v1, col) => { const q = [pr(u0, v0), pr(u1, v0), pr(u1, v1), pr(u0, v1)]; mg.beginPath(); mg.moveTo(q[0][0], q[0][1]); q.slice(1).forEach((c) => mg.lineTo(c[0], c[1])); mg.closePath(); mg.fillStyle = col; mg.fill(); };
  mg.fillStyle = C.side; mg.fillRect(0, 0, MW, MH);
  for (const h of G.world.hoods.concat([G.world.hub])) rh(h.u0, h.v0, h.u1, h.v1, '#232426');
  for (const r of G.world.rooms) rh(r.u0, r.v0, r.u0 + r.w, r.v0 + r.d, r.kind === 'office' ? C.minimapPlate : C.line2);
  for (const s of G.S) { const bb = G.bodies[s.id]; if (!bb) continue; const c = pr(bb.u, bb.v); if (s.state === 'wait' || s.state === 'err') { mg.fillStyle = s.state === 'wait' ? C.wait : C.err; mg.beginPath(); mg.moveTo(c[0], c[1] - 4); mg.lineTo(c[0] + 4, c[1]); mg.lineTo(c[0], c[1] + 4); mg.lineTo(c[0] - 4, c[1]); mg.closePath(); mg.fill(); } else { mg.fillStyle = C.subtle; mg.fillRect(Math.round(c[0]) - 1, Math.round(c[1]) - 1, 2, 2); } }
  const tl = toW(0, 0), br = toW(G.W, G.H), A1 = pr(tl[0], tl[1]), B1 = pr(br[0], br[1]);
  mg.strokeStyle = C.dim; mg.lineWidth = 1.5; mg.strokeRect(Math.round(A1[0]) + 0.5, Math.round(A1[1]) + 0.5, Math.round(B1[0] - A1[0]), Math.round(B1[1] - A1[1]));
  const n = G.S.filter((s) => s.state === 'wait').length, mc = document.getElementById('mcount'), txt = n ? n + ' need you' : 'clear';
  if (mc.textContent !== txt) { mc.textContent = txt; mc.style.color = n ? 'var(--wait)' : ''; }
}
export function mmJump(e) { const r = mm.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * mm.width, y = (e.clientY - r.top) / r.height * mm.height, X = (x - mmT.ox) / mmT.sc, Y = (y - mmT.oy) / mmT.sc, a = X / 16, b = Y / 8; G.tgt.u = (a + b) / 2; G.tgt.v = (b - a) / 2; if (reduce) Object.assign(G.cam, G.tgt); }
export function hitAgent(X, Y) { const dpr = G.dpr; let f = null; for (const s of G.S) { const b = G.boxes[s.id]; if (b && X >= b.x - 4 * dpr && X <= b.x + b.w + 4 * dpr && Y >= b.y - 4 * dpr && Y <= b.y + b.h + 2 * dpr) f = s.id; } return f; }
// the area under the pointer: a project plot, a machine island, or the hub (bridges are nothing)
export function hitArea(X, Y) {
  const w = toW(X, Y), k = key(Math.floor(w[0]), Math.floor(w[1])), room = G.world.roomAt[k], x = G.world.walk[k];
  if (room && room.kind === 'office') return { kind: 'plot', id: room.project };
  if (x === 'hub') return { kind: 'hub', id: 'hub' };
  if (x != null && x >= 0) return { kind: 'island', id: G.world.hoods[x].h.id };
  return null;
}
