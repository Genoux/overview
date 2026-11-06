// Rendering v10: a tiny world after Hangar's floor. Camera, the grid, machine islands, plots with names flat on the floor, desk slabs, creatures, overlays.
// No scenery: the world is geometry on a grid. Night darkens the plane; creatures and status colours are never shaded.
import { G, C, FONT, hash, wantsDesk, reduce, hostOf, byId, fmt, esc, waiting } from './core.js';
import { gene, sprite, coat, GLYPH, TOP } from './creatures.js';
import { key } from './world.js';
import { body, activity, bestFriend } from './life.js';

/* ---------------- camera ---------------- */
export const cv = document.getElementById('cv'), stage = document.getElementById('stage');
const mainCtx = cv.getContext('2d'), off = document.createElement('canvas'), offCtx = off.getContext('2d'), off2 = document.createElement('canvas'), off2Ctx = off2.getContext('2d');
let ctx = mainCtx;
// during the world pass everything is drawn at 1 screen pixel per art pixel (rs = 1) into an offscreen image
const P = () => G.rs || G.cam.z * G.dpr;
function origin() {
  const p = P(), w = G.vw || G.W, h = G.vh || G.H, x = w / 2 - (G.cam.u - G.cam.v) * 16 * p, y = h / 2 - (G.cam.u + G.cam.v) * 8 * p;
  // in the world pass the origin sits on a whole art pixel; the leftover is added back when the image is enlarged (draw),
  // so the islands land exactly on the grid lines drawn on screen
  return G.rs ? [Math.floor(x), Math.floor(y)] : [x, y];
}
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
export function fit(instant) { frameTo(G.world.hoods, instant, true); }
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

/* ---------------- islands and plots ---------------- */
function slabFaces(u0, v0, u1, v1, th, cl, cr) {
  const a = toS(u0, v1), b = toS(u1, v1), c = toS(u1, v0);
  ctx.fillStyle = cl; poly([a, b, [b[0], b[1] + th], [a[0], a[1] + th]]); ctx.fill();
  ctx.fillStyle = cr; poly([b, c, [c[0], c[1] + th], [b[0], b[1] + th]]); ctx.fill();
}
// a machine island: Hangar's plotter-paper dots, corner ticks; selected in accent, hovered in a stronger line
function drawIsland(isl) {
  const on = G.sel.area && G.sel.area.kind === 'island' && G.sel.area.id === isl.h.id, over = G.hover.area && G.hover.area.id === isl.h.id && G.hover.area.kind !== 'plot';
  slabFaces(isl.u0, isl.v0, isl.u1, isl.v1, 8, C.islandL, C.islandR);
  rhombus(isl.u0, isl.v0, isl.u1, isl.v1); ctx.fillStyle = C.islandTop; ctx.fill();
  rhombus(isl.u0, isl.v0, isl.u1, isl.v1); ctx.strokeStyle = on ? C.accent : over ? C.strong : C.islandEdge; ctx.lineWidth = 1; ctx.stroke();
  {   // corner ticks, as Hangar frames each host
    ctx.strokeStyle = on ? C.accent : C.strong; ctx.beginPath(); const L = 1.2;
    for (const [u, v, du, dv] of [[isl.u0, isl.v0, 1, 1], [isl.u1, isl.v0, -1, 1], [isl.u1, isl.v1, -1, -1], [isl.u0, isl.v1, 1, -1]]) { line(u, v, u + du * L, v); line(u, v, u, v + dv * L); }
    ctx.stroke();
  }
}
// names lie flat on the floor in a normal font: text runs along the u axis and its height along v, drawn sharp at screen
// resolution between the ground layer and the creatures (so creatures walk over it)
const floorQ = [];
function floorText(text, u, v, alpha) { floorQ.push({ text, u, v, alpha }); }
function drawFloorText() {
  const p = G.cam.z * G.dpr, s = p * 0.72;
  ctx.save(); ctx.font = '500 11px ' + FONT.mono; ctx.textBaseline = 'top'; ctx.fillStyle = C.fg;
  for (const f of floorQ) { const q = toS(f.u, f.v); ctx.globalAlpha = f.alpha; ctx.setTransform(s, s / 2, -s, s / 2, q[0], q[1]); ctx.fillText(f.text, 0, 0); }
  ctx.restore(); floorQ.length = 0;
}
// Hangar's plotter-paper ground: a dot every half cell; the dots around each desk light up in its session's colour
// (waiting pulses, running breathes, done glows faint), so the floor itself shows where things happen
function litDots(isl) {
  const lights = [];
  for (const room of isl.rooms) {
    const sess = G.S.filter((x) => x.plot === room.project);
    room.desks.forEach((dk, k) => {
      const s = sess[k]; if (!s || s.state === 'idle') return;
      const t = G.t + k * 0.7, R = s.state === 'wait' ? (reduce ? 2.2 : 2 + 0.45 * Math.round((Math.sin(t * 2.4) + 1) / 2)) : s.state === 'run' ? 1.7 + (reduce ? 0 : 0.15 * Math.round((Math.sin(t * 1.3) + 1) / 2)) : 1.4;
      lights.push({ u: dk.u, v: dk.v + 0.4, R, c: C[s.state], k: s.state === 'done' ? 0.5 : 1 });
    });
  }
  const base = mixC(C.islandTop, C.fg, 0.11);
  for (let u = isl.u0 + 0.25; u < isl.u1; u += 0.5) for (let v = isl.v0 + 0.25; v < isl.v1; v += 0.5) {
    let best = 0, col = null;
    for (const L of lights) { const d = Math.hypot(u - L.u, (v - L.v) * 1.15) / L.R, w = (1 - d) * L.k; if (w > best) { best = w; col = L.c; } }
    const q = toS(u, v);
    R(Math.round(q[0]), Math.round(q[1]), 1, 1, col && best > 0.05 ? mixC(C.islandTop, col, best > 0.55 ? 0.85 : best > 0.28 ? 0.55 : 0.3) : base);
  }
}
// a project plot: a plain plate with its name flat on the floor; outlined when hovered (grey) or selected (accent)
function drawPlate(room) {
  const { u0, v0, w, d } = room, th = 4, on = G.sel.area && G.sel.area.kind === 'plot' && G.sel.area.id === room.project, over = G.hover.area && G.hover.area.kind === 'plot' && G.hover.area.id === room.project;
  slabFaces(u0, v0, u0 + w, v0 + d, th, C.faceL, C.faceR);
  rhombus(u0, v0, u0 + w, v0 + d); ctx.fillStyle = C.plate; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = on ? C.accent : over ? C.strong : C.plateEdge; ctx.stroke();
  // on the floor just in front of the plot, as Hangar labels a workspace under it: the plot itself is full of slabs and blobs
  floorText(room.project, u0 + 0.2, v0 + d + 0.1, on || over ? 0.75 : 0.42);
}
/* ---------------- creatures ---------------- */
/* ---------- the session's slab, ported from Hangar (inputs/floor/blobs.js): a floating pane of glass lit by the session ----------
   running: three lines typing with a cursor · waiting: a cut gem that pulses · done: a check · failed: cracked, the right half
   sagging, glitching now and then · asleep (or no session at the desk): dark glass. 12 x 10 art pixels. */
const SW = 12, SH = 10, DIA7 = ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], CHECK = ['.....X', '....X.', 'X..X..', '.XX...'];
const hx = (c) => { if (c[0] !== '#') return (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixC = (a, b, t) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const slabTones = {};
function tonesFor(st) {
  const key = st + C.plate + C[st]; if (slabTones[key]) return slabTones[key];
  const plate = C.plate, calm = { run: 0.12, done: 0.15, wait: 0, err: 0.06, off: 0 }, sc = st === 'off' ? mixC(plate, C.fg, 0.35) : mixC(C[st], plate, calm[st]);
  return (slabTones[key] = { c: sc, rim: mixC(plate, sc, st === 'off' ? 0.5 : 0.62), rimHi: st === 'off' ? mixC(plate, sc, 0.7) : mixC(sc, C.fg, 0.3), glass: mixC(plate, sc, st === 'off' ? 0.12 : 0.17), glass2: mixC(plate, sc, 0.11), glass3: mixC(plate, sc, 0.07), halo: mixC(plate, sc, 0.06), text: mixC(sc, C.fg, 0.12), textDim: mixC(plate, sc, 0.5), soft: mixC(plate, sc, 0.45), ring2: mixC(plate, sc, 0.4) });
}
const rnd = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
function stampPx(map, x, y, c) { for (let r = 0; r < map.length; r++) for (let q = 0; q < map[r].length; q++) if (map[r][q] === 'X') R(x + q, y + r, 1, 1, c); }
function slabBody(x, y, Q, flare, sag) {
  const half = Math.floor(SW / 2);
  for (let part = 0; part < 2; part++) {
    const xx = x + part * half, ww = half, yy = y + (part ? sag : 0);
    R(xx + (part ? 0 : 1), yy - 1, ww - 1, 1, Q.halo); R(xx + (part ? 0 : 1), yy + SH, ww - 1, 1, Q.halo);
    R(xx, yy + 1, ww, SH - 4, Q.glass); R(xx, yy + SH - 3, ww, 2, Q.glass2); R(xx, yy + SH - 1, ww, 1, Q.glass3);
    R(xx, yy, ww, 1, flare ? Q.rimHi : Q.rim);
  }
  R(x - 1, y + 1, 1, SH - 2, Q.halo); R(x + SW, y + 1 + sag, 1, SH - 2, Q.halo);
  R(x, y, 1, 1, Q.glass2); R(x + SW - 1, y + sag, 1, 1, Q.glass2);
  R(x + 1, y, 4, 1, Q.rimHi); R(x, y + 1, 1, SH - 4, Q.rim);
}
function gem(x, y, Q, on) {
  stampPx(DIA7, x, y, on ? Q.c : Q.rim);
  const e = on ? Q.rim : Q.ring2; R(x + 6, y + 3, 1, 1, e); R(x + 5, y + 4, 1, 1, e); R(x + 4, y + 5, 1, 1, e); R(x + 3, y + 6, 1, 1, e);
  R(x + 3, y + 1, 1, 1, Q.rimHi); R(x + 2, y + 2, 2, 1, Q.rimHi); R(x + 1, y + 3, 1, 1, Q.rimHi);
}
// t is in ticks of 1/10 s, like Hangar's floor clock; idx gives each slab its own text
function hslab(x, y, st, t, idx) {
  const Q = tonesFor(st), tt = Math.floor(t * 10) + idx * 7;
  if (st === 'run') {
    slabBody(x, y, Q, false, 0);
    const stp = reduce ? 0 : Math.floor(tt / 3), sub = reduce ? 2 : tt % 3;
    for (let q = 0; q < 3; q++) {
      const seed = stp + q, ind = rnd(idx, seed * 3.1) < 0.35 ? 2 : 0, len = 2 + Math.floor(rnd(idx + 9, seed) * (6 - ind)), yy = y + 2 + q * 2;
      if (q < 2) R(x + 2 + ind, yy, len, 1, q === 0 ? Q.textDim : Q.text);
      else { const shown = Math.min(len, (sub + 1) * 2); R(x + 2 + ind, yy, shown, 1, Q.text); if ((tt >> 1) % 2 === 0 || reduce) R(x + 2 + ind + shown + 1, yy, 1, 1, Q.rimHi); }
    }
  } else if (st === 'wait') { const on = reduce || (tt >> 2) % 2 === 0; slabBody(x, y, Q, on, 0); if (on) R(x, y + 1, 1, SH - 3, Q.rimHi); gem(x + 2, y + 1, Q, on); }
  else if (st === 'done') { slabBody(x, y, Q, false, 0); stampPx(CHECK, x + 3, y + 3, Q.text); }
  else if (st === 'err') {
    const glitch = !reduce && (tt % 13 === 0 || tt % 17 === 6);
    slabBody(x, y, Q, glitch, 1);
    R(x + 2, y + 2, 3, 1, Q.textDim); R(x + 2, y + 4, 2, 1, Q.text); R(x + 8, y + 6, 2, 1, Q.textDim);
    for (const [cx, cy] of [[6, 0], [6, 1], [5, 2], [6, 3], [6, 4], [5, 5], [6, 6], [6, 7], [5, 8]]) R(x + cx, y + cy + (cx >= 6 ? 1 : 0), 1, 1, C.creatureInk);
    if (glitch) { R(x + 1, y + 5, SW - 2, 1, Q.soft); R(x + 3, y + 5, 3, 1, Q.text); R(x + SW, y + 5, 2, 1, Q.rim); }
  }
}
// The slab is open while its blob is at the desk (working, waiting, failed, or done and home). A finished blob that walks
// off leaves a green check painted flat on the floor where its slab stood, so the desk still says "done, ready for review"
// without a screen floating on its own. An asleep session has nothing running: no slab at all.
function floorCheck(dk) {
  const q = toS(dk.u, dk.v), x0 = Math.round(q[0]) - 3, y0 = Math.round(q[1]) - 4, col = mixC(C.plate, C.done, 0.75), pad = mixC(C.plate, C.done, 0.3);
  ctx.strokeStyle = pad; ctx.lineWidth = 1; rhombus(dk.u - 0.42, dk.v - 0.42, dk.u + 0.42, dk.v + 0.42); ctx.stroke();
  stampPx(CHECK, x0, y0 + 1, col);   // upright, like the slab's own check: a slanted one stops reading as a check
}
function deskSlabs(list, t) {
  for (const room of G.world.rooms) {
    if (room.kind !== 'office') continue;
    const sess = G.S.filter((x) => x.plot === room.project);
    room.desks.forEach((dk, k) => {
      const s = sess[k]; if (!s || s.state === 'idle') return;
      const b = G.bodies[s.id], home = room.home[k], present = wantsDesk(s) || (b && b.spot === home && !b.path.length && Math.abs(b.u - dk.u) + Math.abs(b.v - dk.v) < 0.2);
      if (s.state === 'done' && !present) { list.push({ d: -1e6 + dk.u + dk.v, draw: () => floorCheck(dk) }); return; }
      const bob = s.state === 'run' && !reduce ? Math.floor(t * 1.25 + k) % 2 : 0;
      list.push({ d: dk.u + dk.v + 0.06, draw: () => { const q = toS(dk.u, dk.v); hslab(Math.round(q[0]) + 12, Math.round(q[1]) - 17 + (s.state === 'err' ? 3 : bob), s.state, t, hash(s.id) % 97); } });
    });
  }
}
function diamond(X, Y, k) { [1, 3, 5, 7, 5, 3, 1].forEach((w, r) => R(X - w / 2 * k, Y + r * k, w * k, k, C.wait)); }
// an emote: the glyph alone, light pixels with a one-pixel dark outline, floating above the blob (no box behind it,
// so it never reads as a patch on the terrain)
function bubble(X, Y, glyph, k, alpha) {
  const x = Math.round(X - 2.5 * k), y = Math.round(Y - 6 * k), gm = GLYPH[glyph] || GLYPH.dots, on = (r, c) => r >= 0 && r < 5 && c >= 0 && c < 5 && gm[r][c] === 'x';
  ctx.globalAlpha = alpha;
  for (let r = -1; r <= 5; r++) for (let c = -1; c <= 5; c++) if (!on(r, c) && (on(r - 1, c) || on(r + 1, c) || on(r, c - 1) || on(r, c + 1))) R(x + c * k, y + r * k, k, k, C.creatureInk);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (on(r, c)) R(x + c * k, y + r * k, k, k, C.fg);
  ctx.globalAlpha = 1;
}
function faceFor(s, b, t, seed) {
  const blink = ((t + seed * 5) % 3.8) < 0.12, atDesk = wantsDesk(s) && b.atDesk;
  if (s.state === 'idle' && !b.path.length) return 'closed';
  if (b.act.type === 'nap' && b.act.arrived && !b.path.length) return 'closed';
  if (s.state === 'err' && atDesk) return 'x';
  if (b.emote && b.emote.g === 'bang' && t >= b.emote.from) return 'surprised';
  if (blink) return 'blink';
  if (s.state === 'wait' && atDesk) return 'worried';
  if (s.state === 'run' && atDesk) return 'focus';
  if (b.act.type === 'comfort' || b.act.type === 'company') return 'worried';
  if ((b.act.type === 'play' || b.act.type === 'music' || b.act.type === 'tea') && b.act.arrived && !b.path.length) return 'happy';
  if (b.act.type === 'read' && b.act.arrived && !b.path.length) return 'focus';
  if (b.act.type === 'stretch' && b.act.arrived && !b.path.length) return 'closed';
  if (b.act.type === 'celebrate' || (s.state === 'done' && !b.moving)) return b.say ? 'open' : 'happy';
  return 'open';
}
export const labelQ = [];
function drawCreature(s, b, t) {
  const f = toS(b.u, b.v), k = Math.max(1, Math.round(P())), X = Math.round(f[0]), Y = Math.round(f[1]), g = gene(s.id), dpr = G.dpr;
  const seed = (hash(s.id) % 997) / 997, atDesk = wantsDesk(s) && b.atDesk, flat = s.state === 'err' && atDesk;
  // while it works, the blob's lit edge catches its slab's colour (as in Hangar)
  const tint = atDesk ? { run: C.run, wait: C.wait, err: C.err }[s.state] || null : null;
  const face = faceFor(s, b, t, seed), spr = sprite(s, face, s.state === 'idle', flat, tint), sw = spr.width * k, sh = spr.height * k;
  let lift = 0, squash = 0;
  if (!reduce) {
    if (s.state === 'wait' && atDesk) { lift = Math.round(Math.abs(Math.sin((t + seed) * Math.PI * 1.25)) * 4) * k; if (!lift) squash = k; }
    else if (b.act.type === 'celebrate') { lift = Math.round(Math.abs(Math.sin(t * Math.PI * 2.4)) * 7) * k; if (!lift) squash = k; }
    else if (s.state === 'run' && atDesk) lift = (Math.floor(t * 3 + seed * 3) % 2) * k;
    else if (b.moving) lift = (Math.floor(t * 8 * g.energy + seed * 4) % 2) * k;
    else if (b.say) lift = (Math.floor(t * 5) % 2) * k;
    else if (b.act.type === 'stretch' && b.act.arrived && !b.path.length) lift = (Math.floor(t * 1.2 + seed) % 2) * 2 * k;
  }
  // path preview for the hovered or selected walker
  if ((s.id === G.selId || s.id === G.hover.agent) && b.path.length) {
    ctx.fillStyle = C.faint; b.path.forEach((n, i) => { if (i % 2) return; const q = toS(n.u, n.v); ctx.fillRect(Math.round(q[0]) - dpr, Math.round(q[1]) - dpr, 2 * dpr, 2 * dpr); });
    const en = b.path[b.path.length - 1]; ctx.strokeStyle = C.faint; ctx.lineWidth = dpr; rhombus(en.u - 0.4, en.v - 0.4, en.u + 0.4, en.v + 0.4); ctx.stroke();
  }
  const sinkNow = b.seated && !b.moving ? 2 * k : 0, footY = flat ? Y : Y + sinkNow;
  ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(X, footY + k, (spr.width / 2 + 1) * k, 3 * k, 0, 0, Math.PI * 2); ctx.fill();
  if (s.state === 'wait' && atDesk) { ctx.strokeStyle = C.wait; ctx.lineWidth = Math.max(1, dpr); rhombus(b.u - 0.85, b.v - 0.85, b.u + 0.85, b.v + 0.85); ctx.stroke(); }
  const sink = b.seated && !b.moving ? 2 * k : 0, sx = Math.round(X - sw / 2), sy = Math.round(Y - sh + 2 * k - lift + sink + squash);
  const dy = flat ? Math.round(Y - sh + 3 * k) : sy, dh = sh - squash;
  if (b.face < 0 && !atDesk) { ctx.save(); ctx.translate(sx + sw, dy); ctx.scale(-1, 1); ctx.drawImage(spr, 0, 0, sw, dh); ctx.restore(); }
  else ctx.drawImage(spr, sx, dy, sw, dh);
  const bodyTop = dy + TOP * k;
  if (b.act.type === 'play' && b.act.arrived && !b.path.length && !reduce) {
    const ph = (t * 1.6 + seed) % 1, hgt = Math.round(Math.sin(ph * Math.PI) * 9) * k, bx = X - 15 * k, by = Y - 5 * k - hgt;   // the side away from the slab
    R(bx + k, by, 3 * k, k, C.fg); R(bx, by + k, 5 * k, 3 * k, C.fg); R(bx + k, by + 4 * k, 3 * k, k, C.fg); R(bx + 3 * k, by + 2 * k, 2 * k, 2 * k, C.dim);
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(bx + 2.5 * k, Y + k, (2.5 - hgt / k / 9) * k, k, 0, 0, Math.PI * 2); ctx.fill();
  }
  // desk-side pastimes, each a tiny prop in the body's own greys, on the side away from the slab
  if (b.act.arrived && !b.path.length && atHomeDesk(s, b)) {
    const T = coat(g), lx = X - 13 * k, ty = Y - 9 * k;
    if (b.act.type === 'read') {   // an open book held in front: two pages and a spine, a page turning now and then
      R(lx, ty, 9 * k, 5 * k, C.creatureInk); R(lx + k, ty + k, 3 * k, 3 * k, T.h); R(lx + 5 * k, ty + k, 3 * k, 3 * k, T.l); R(lx + 4 * k, ty + k, k, 4 * k, T.d);
      if (!reduce && Math.floor(t * 0.5 + seed * 3) % 6 === 0) R(lx + 5 * k, ty, 3 * k, k, T.h);
    } else if (b.act.type === 'tea') {   // a mug with a handle and a curl of steam
      R(lx + 2 * k, ty + k, 5 * k, 5 * k, C.creatureInk); R(lx + 3 * k, ty + 2 * k, 3 * k, 3 * k, T.l); R(lx + 7 * k, ty + 2 * k, k, 2 * k, C.creatureInk);
      if (!reduce) { const st = Math.floor(t * 2 + seed * 4) % 3; ctx.globalAlpha = 0.6; R(lx + (3 + (st % 2)) * k, ty - (1 + st) * k, k, k, C.dim); R(lx + (4 - (st % 2)) * k, ty - (3 + st) * k, k, k, C.dim); ctx.globalAlpha = 1; }
    } else if (b.act.type === 'music') {   // headphones: a band over the top, a cup on each side
      const top = Y - sh + (TOP + 2) * k - lift; ctx.fillStyle = C.creatureInk;
      R(X - 5 * k, top - k, 10 * k, k, C.creatureInk); R(X - 7 * k, top, 2 * k, 2 * k, C.creatureInk); R(X + 5 * k, top, 2 * k, 2 * k, C.creatureInk);
      R(X - sw / 2 - k, top + 3 * k, 3 * k, 4 * k, T.d); R(X + sw / 2 - 2 * k, top + 3 * k, 3 * k, 4 * k, T.d);
    }
  }
  // running: a nub taps the slab's edge (the slab itself belongs to the desk, see deskSlabs)
  if (atDesk && s.state === 'run') { const tap = Math.floor(t * 6 + seed * 6) % 2; R(X + 10 * k, Y - 12 * k + tap * k, 2 * k, 2 * k, coat(g).d); }
  if (b.seated && /coffee/.test(b.act.label || '')) { const cx2 = b.face > 0 ? sx + sw - k : sx - k; R(cx2, bodyTop + (sh - TOP * k) * 0.45, 2 * k, 2 * k, C.subtle); }
  if (flat) { const dx = X + 6 * k, dyy = Y - 9 * k - ((Math.floor(t * 2) % 2) * k); R(dx, dyy, k, k, C.dim); R(dx - k, dyy + k, 3 * k, 2 * k, C.dim); }
  const kd = Math.max(k, Math.round(1.6 * dpr)); let top = bodyTop;
  if (s.state === 'wait') { top = bodyTop - 9 * kd; diamond(X, top + (reduce ? 0 : (Math.floor(t * 2) % 2) * kd), kd); }
  // layout uses the blob's resting place, not its hop or bob, so its bubble and its reserved space never jitter between spots
  const restDy = flat ? dy : Math.round(Y - sh + 2 * k + sink), restBody = restDy + TOP * k, restTop = s.state === 'wait' ? restBody - 9 * kd : restBody;
  b.callout = (s.state === 'wait' || s.state === 'err') && s.bubble ? { X, sw, sy: restDy, sh, top: restTop, k } : null;
  if (face === 'closed' && !reduce) for (let z = 0; z < 2; z++) { const ph = (t * 0.35 + seed + z * 0.5) % 1; ctx.globalAlpha = 1 - ph; const zx = sx + sw - 2 * k + ph * 4 * k, zy = bodyTop - ph * 10 * k; R(zx, zy, 3 * k, k, C.faint); R(zx + k, zy + k, k, k, C.faint); R(zx, zy + 2 * k, 3 * k, k, C.faint); ctx.globalAlpha = 1; }
  // speech: words when close enough to read, a glyph bubble otherwise
  b.speech = b.say ? { X, Y: restTop - 2 * k } : null;
  if (b.say && G.cam.z < 1.5) bubble(X + (b.face > 0 ? 6 : -6) * k, top - 2 * k, 'dots', k, 1);
  else if (b.emote && t >= b.emote.from && s.state !== 'wait') { const span = b.emote.until - b.emote.from, ph = (t - b.emote.from) / span, a = Math.min(1, Math.min(ph, 1 - ph) * 5); bubble(X + (b.face > 0 ? 6 : -6) * k, top - 2 * k - Math.round(ph * 3) * k, b.emote.g, k, a); }
  const bt = s.state === 'wait' ? restTop - kd : restBody;
  G.boxes[s.id] = { x: sx, y: bt, w: sw + (atDesk ? 16 * k : 0), h: Y + 3 * k - bt, fx: X, fy: Y };
}
function atHomeDesk(s, b) { const room = G.world.offices[s.plot], k = G.S.filter((x) => x.plot === s.plot).indexOf(s), h = room.home[k]; return h && b.spot === h; }
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
const placeMemo = {};
function placeLabels() {
  const taken = overlayRects().concat(flagRects), dpr = G.dpr;
  for (const s of G.S) { const b = G.boxes[s.id]; if (b) taken.push({ x: b.x, y: b.y, w: b.w, h: b.h, own: s.id }); }
  labelQ.sort((a, b) => a.prio - b.prio).forEach((it) => {
    const others = taken.filter((o) => o.own !== it.own), mk = it.prio + ':' + it.own, last = placeMemo[mk];
    const fits = (vi, ci) => { const v = it.variants[vi], c = it.cands[ci]; if (!v || !c) return null; const r = rectAt(c, v.m()); if (r.x < 2 * dpr || r.y < 2 * dpr || r.x + r.w > G.W - 2 * dpr || r.y + r.h > G.H - 2 * dpr || overlaps(r, others)) return null; return r; };
    // keep last frame's place while it still fits, so a label never hops between spots
    const order = []; if (last) order.push(last); it.variants.forEach((_, vi) => it.cands.forEach((_, ci) => order.push([vi, ci])));
    for (const [vi, ci] of order) { const r = fits(vi, ci); if (r) { taken.push(r); placeMemo[mk] = [vi, ci]; it.variants[vi].draw(r.x, r.y, it.cands[ci]); return; } }
    delete placeMemo[mk];
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
  if (opts.lift) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 8 * dpr; ctx.shadowOffsetY = 3 * dpr; }
  ctx.fillStyle = opts.bg || C.labelBg; roundRect(x, y, w, h, 3 * dpr); ctx.fill();
  if (opts.lift) ctx.restore();
  if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = Math.max(1, dpr); roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 3 * dpr); ctx.stroke(); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  font(size, 500); ctx.fillStyle = C.fg; ctx.fillText(text, x + padX, y + h / 2 + 0.5 * dpr);
  if (sub) { font(size); ctx.fillStyle = C.subtle; ctx.fillText(sub, x + padX + tw + gap, y + h / 2 + 0.5 * dpr); }
  if (opts.badge) { const bx = x + padX + tw + sw + gap; ctx.fillStyle = C.wait; roundRect(bx, y + 3 * dpr, 15 * dpr, 12 * dpr, 2 * dpr); ctx.fill(); font(10.5, 500); ctx.fillStyle = C.onAccent; ctx.textAlign = 'center'; ctx.fillText(String(opts.badge), bx + 7.5 * dpr, y + h / 2 + 0.5 * dpr); }
  return { x, y, w, h };
}
// machine names: a flag on a thin line rising from the island's top point. Fixed in place and always the full name, so it
// never flickers; message bubbles are placed around it and drawn over it, so it never hides what a blob says.
const flagRects = [];
function drawIslandFlags() {
  const dpr = G.dpr, rise = 36 * dpr; flagRects.length = 0;
  for (const h of G.world.hoods) {
    const top = toS(h.u0, h.v0), x = Math.round(top[0]) + 0.5, y = Math.round(top[1]), sub = h.h.sub === 'local' ? 'local' : 'ssh' + (h.h.lat ? ' ' + h.h.lat : '');
    if (y < -rise || y > G.H + rise || x < -300 * dpr || x > G.W + 300 * dpr) continue;
    const on = G.sel.area && G.sel.area.kind === 'island' && G.sel.area.id === h.h.id;
    // a raised chip on a pole: solid panel, fine border, a soft shadow under it and a small one where the pole meets the floor
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(x, y + dpr, 5 * dpr, 2 * dpr, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = on ? C.accent : C.strong; ctx.lineWidth = Math.max(1, dpr); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - rise); ctx.stroke();
    ctx.fillStyle = on ? C.accent : C.dim; ctx.fillRect(x - 1.5 * dpr, y - 1.5 * dpr, 3 * dpr, 3 * dpr);
    const m = labelBox(h.h.name, sub, { measure: true, size: 11 }), bx = x - 6 * dpr, by = y - rise - m.h;
    labelBox(h.h.name, sub, { at: { x: bx, y: by }, size: 11, bg: C.panel, border: on ? C.accent : C.line2, lift: true });
    flagRects.push({ x: bx, y: by, w: m.w, h: m.h + rise, own: 'flag:' + h.h.id });
  }
}
/* ---------------- the frame ---------------- */
export function draw(t) {
  const W = G.world, sc = G.cam.z * G.dpr, dprSave = G.dpr;
  ctx = mainCtx; ctx.fillStyle = C.ground; ctx.fillRect(0, 0, G.W, G.H);
  if (G.night > 0) { ctx.fillStyle = C.night; ctx.globalAlpha = G.night * 0.7; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
  drawGrid();
  // world pass: one art pixel = one pixel, then the whole image is enlarged at once, so nothing slides while zooming
  const bw = Math.ceil(G.W / sc) + 2, bh = Math.ceil(G.H / sc) + 2;
  for (const c of [off, off2]) { if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; } else c.getContext('2d').clearRect(0, 0, bw, bh); }
  G.rs = 1; G.vw = bw; G.vh = bh; G.dpr = 1;
  ctx = offCtx; ctx.imageSmoothingEnabled = false;
  W.hoods.forEach(drawIsland);
  W.rooms.forEach((r) => { if (r.kind === 'office') drawPlate(r); });
  W.hoods.forEach(litDots);   // after the plots, so the light around each desk shows on its plot
  if (G.night > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = C.night; ctx.globalAlpha = G.night * 0.6; ctx.fillRect(0, 0, bw, bh); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  ctx = off2Ctx; ctx.imageSmoothingEnabled = false;
  const things = [];
  for (const s of G.S) { const b = body(s); things.push({ d: b.u + b.v + 0.05, draw: () => drawCreature(s, b, t) }); }
  deskSlabs(things, t);
  things.sort((a, b) => a.d - b.d).forEach((x) => x.draw());
  G.rs = 0; G.vw = 0; G.vh = 0; G.dpr = dprSave; ctx = mainCtx;
  const wx = bw / 2 - (G.cam.u - G.cam.v) * 16, wy = bh / 2 - (G.cam.u + G.cam.v) * 8;
  const ox = G.W / 2 - bw / 2 * sc + (wx - Math.floor(wx)) * sc, oy = G.H / 2 - bh / 2 * sc + (wy - Math.floor(wy)) * sc;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, bw, bh, ox, oy, bw * sc, bh * sc);
  drawFloorText();
  ctx.drawImage(off2, 0, 0, bw, bh, ox, oy, bw * sc, bh * sc);
  // creature boxes and label anchors move to screen space
  for (const id in G.boxes) { const b = G.boxes[id]; G.boxes[id] = { x: ox + b.x * sc, y: oy + b.y * sc, w: b.w * sc, h: b.h * sc, fx: ox + b.fx * sc, fy: oy + b.fy * sc }; }
  labelQ.length = 0;
  for (const s of G.S) {
    const b = G.bodies[s.id]; if (!b) continue;
    if (b.callout) { const c = b.callout; queueCallout(s, ox + c.X * sc, c.sw * sc, oy + c.sy * sc, c.sh * sc, oy + c.top * sc, c.k * sc); }
    if (b.speech && G.cam.z >= 1.5) queueSpeech(s, b, ox + b.speech.X * sc, oy + b.speech.Y * sc);
  }
  drawGraticule();
  drawIslandFlags();
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
    // never under a corner overlay: below the zoom group, above the minimap, beside the open info panel
    stage.querySelectorAll('.zoom, .mini, .info:not([hidden])').forEach((ov) => { const r = ov.getBoundingClientRect(), x0 = r.left - sr.left - hw, x1 = r.right - sr.left + hw, y0 = r.top - sr.top - hh, y1 = r.bottom - sr.top + hh; if (ex > x0 && ex < x1 && ey > y0 && ey < y1) { if (ov.classList.contains('zoom')) ey = y1; else if (ov.classList.contains('info')) ex = x1; else ey = y0; } });
    ex = Math.max(hw, Math.min(cw - hw, ex));
    el.style.left = ex + 'px'; el.style.top = ey + 'px';
  }
  for (const id in edgeEls) if (!seen[id]) { edgeEls[id].remove(); delete edgeEls[id]; }
}
const tip = document.getElementById('tip'); let tipKey = '';
const WORD = { run: 'running', wait: 'needs you', done: 'done', err: 'failed', idle: 'asleep' };
export function placeTip(icon, dragging) {
  // hover only (the selected blob's details live in the rail), and below the feet: above is where its message bubble is
  const id = G.hover.agent, s = id && byId(id), b = id && G.boxes[id];
  if (!s || !b || dragging) { tip.hidden = true; tipKey = ''; return; }
  const act = activity(s), bf = bestFriend(s.id), keyNow = id + s.state + act + (bf ? bf.id : '');
  if (keyNow !== tipKey) {
    tip.innerHTML = '<div class="n">' + esc(gene(s.id).name) + ' · ' + s.agent + ' on ' + hostOf(s).name + (bf ? ' · friends with ' + esc(gene(bf.id).name) : '') + '</div><div class="t">' + esc(s.title) + '</div><div class="s">' + icon(s.state) + WORD[s.state] + ' · ' + fmt(s.since) + ' · ' + esc(act) + '</div>';
    tipKey = keyNow;
  }
  const below = (b.y + b.h) / G.dpr + 10, room = G.H / G.dpr - below - 12;
  tip.hidden = false;
  tip.style.left = Math.max(150, Math.min(G.W / G.dpr - 150, (b.x + b.w / 2) / G.dpr)) + 'px';
  // flip above only when there is no room below the feet
  if (tip.offsetHeight > room) { tip.style.top = Math.max(8, b.y / G.dpr - 10) + 'px'; tip.style.transform = 'translate(-50%, -100%)'; }
  else { tip.style.top = below + 'px'; tip.style.transform = 'translate(-50%, 0)'; }
}
const mm = document.getElementById('mm'), mg = mm.getContext('2d'); let mmT = null;
export function minimap() {
  const b = boundsOf(G.world.hoods), MW = mm.width, MH = mm.height, sc = Math.min((MW - 16) / (b.x1 - b.x0), (MH - 16) / (b.y1 - b.y0)), ox = MW / 2 - (b.x0 + b.x1) / 2 * sc, oy = MH / 2 - (b.y0 + b.y1) / 2 * sc;
  mmT = { sc, ox, oy };
  const pr = (u, v) => [ox + (u - v) * 16 * sc, oy + (u + v) * 8 * sc];
  const rh = (u0, v0, u1, v1, col) => { const q = [pr(u0, v0), pr(u1, v0), pr(u1, v1), pr(u0, v1)]; mg.beginPath(); mg.moveTo(q[0][0], q[0][1]); q.slice(1).forEach((c) => mg.lineTo(c[0], c[1])); mg.closePath(); mg.fillStyle = col; mg.fill(); };
  mg.fillStyle = C.side; mg.fillRect(0, 0, MW, MH);
  for (const h of G.world.hoods) rh(h.u0, h.v0, h.u1, h.v1, '#232426');
  for (const r of G.world.rooms) rh(r.u0, r.v0, r.u0 + r.w, r.v0 + r.d, r.kind === 'office' ? C.minimapPlate : C.line2);
  for (const s of G.S) { const bb = G.bodies[s.id]; if (!bb) continue; const c = pr(bb.u, bb.v); if (s.state === 'wait' || s.state === 'err') { mg.fillStyle = s.state === 'wait' ? C.wait : C.err; mg.beginPath(); mg.moveTo(c[0], c[1] - 4); mg.lineTo(c[0] + 4, c[1]); mg.lineTo(c[0], c[1] + 4); mg.lineTo(c[0] - 4, c[1]); mg.closePath(); mg.fill(); } else { mg.fillStyle = C.subtle; mg.fillRect(Math.round(c[0]) - 1, Math.round(c[1]) - 1, 2, 2); } }
  const tl = toW(0, 0), br = toW(G.W, G.H), A1 = pr(tl[0], tl[1]), B1 = pr(br[0], br[1]);
  mg.strokeStyle = C.dim; mg.lineWidth = 1.5; mg.strokeRect(Math.round(A1[0]) + 0.5, Math.round(A1[1]) + 0.5, Math.round(B1[0] - A1[0]), Math.round(B1[1] - A1[1]));
  const n = G.S.filter((s) => s.state === 'wait').length, mc = document.getElementById('mcount'), txt = n ? n + ' need you' : 'clear';
  if (mc.textContent !== txt) { mc.textContent = txt; mc.style.color = n ? 'var(--wait)' : ''; }
}
export function mmJump(e) { const r = mm.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * mm.width, y = (e.clientY - r.top) / r.height * mm.height, X = (x - mmT.ox) / mmT.sc, Y = (y - mmT.oy) / mmT.sc, a = X / 16, b = Y / 8; G.tgt.u = (a + b) / 2; G.tgt.v = (b - a) / 2; if (reduce) Object.assign(G.cam, G.tgt); }
export function hitAgent(X, Y) { const dpr = G.dpr; let f = null; for (const s of G.S) { const b = G.boxes[s.id]; if (b && X >= b.x - 4 * dpr && X <= b.x + b.w + 4 * dpr && Y >= b.y - 4 * dpr && Y <= b.y + b.h + 2 * dpr) f = s.id; } return f; }
// the area under the pointer: a project plot or a machine island
export function hitArea(X, Y) {
  const w = toW(X, Y), k = key(Math.floor(w[0]), Math.floor(w[1])), room = G.world.roomAt[k], x = G.world.walk[k];
  if (room && room.kind === 'office') return { kind: 'plot', id: room.project };
  if (x != null && x >= 0) return { kind: 'island', id: G.world.hoods[x].h.id };
  return null;
}
