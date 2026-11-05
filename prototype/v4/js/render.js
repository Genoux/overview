// Rendering: camera, terrain, neighborhoods, buildings, creatures, ground lettering, labels, overlays.
// Terrain and buildings are shaded toward night by the real clock; creatures and status colours never are.
import { G, C, TEX, TINTS, FONT, hash, shade, wantsDesk, reduce, hostOf, byId, fmt, esc, waiting } from './core.js';
import { gene, sprite, coat, GLYPH, TOP } from './creatures.js';
import { OD, key, deskOf } from './world.js';
import { body, activity, bestFriend } from './life.js';

/* ---------------- camera ---------------- */
export const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), stage = document.getElementById('stage');
const P = () => G.cam.z * G.dpr;
function origin() { const p = P(); return [G.W / 2 - (G.cam.u - G.cam.v) * 16 * p, G.H / 2 - (G.cam.u + G.cam.v) * 8 * p]; }
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
    const floor = G.levels.find((l) => l >= 0.66) || G.levels[0];
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
const N = (c) => shade(c, G.night);
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

/* ---------------- ground lettering (names painted on the plane, reading up-right) ---------------- */
function groundText(text, u, v, size, color, alpha, weight, spacing) {
  const p = P(), o = toS(u, v), sc = size / 20;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.setTransform(16 * p * sc, -8 * p * sc, 16 * p * sc, 8 * p * sc, o[0], o[1]);
  ctx.font = (weight || 500) + ' 20px ' + FONT.mono; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  let x = 0; const sp = (spacing || 0) / sc;
  for (const ch of text) { ctx.fillText(ch, x, 0); x += ctx.measureText(ch).width + sp; }
  ctx.restore();
  return x * sc; // length in world units along -v
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

/* ---------------- neighborhoods ---------------- */
function slabFaces(u0, v0, u1, v1, th, cl, cr) {
  const a = toS(u0, v1), b = toS(u1, v1), c = toS(u1, v0);
  ctx.fillStyle = cl; poly([a, b, [b[0], b[1] + th], [a[0], a[1] + th]]); ctx.fill();
  ctx.fillStyle = cr; poly([b, c, [c[0], c[1] + th], [b[0], b[1] + th]]); ctx.fill();
}
function onScreen(u0, v0, u1, v1, pad) { const pts = [toS(u0, v0), toS(u1, v0), toS(u0, v1), toS(u1, v1)], m = (pad || 0) * G.dpr; return Math.max(...pts.map((p) => p[0])) > -m && Math.min(...pts.map((p) => p[0])) < G.W + m && Math.max(...pts.map((p) => p[1])) > -m && Math.min(...pts.map((p) => p[1])) < G.H + m; }
function drawHood(h) {
  if (!onScreen(h.u0, h.v0, h.u1, h.v1, 200)) return;
  const T = TINTS[h.tint], dpr = G.dpr, th = Math.max(4, Math.round(10 * G.cam.z)) * dpr;
  slabFaces(h.u0, h.v0, h.u1, h.v1, th, N(C.islandL), N(C.islandR));
  rhombus(h.u0, h.v0, h.u1, h.v1); ctx.fillStyle = N(T.ground); ctx.fill();
  ctx.save(); rhombus(h.u0, h.v0, h.u1, h.v1); ctx.clip(); ctx.globalAlpha = TEX[h.tex] || 0.07; ctx.fillStyle = C.fg; ctx.strokeStyle = C.fg; ctx.lineWidth = dpr;
  if (h.tex === 'dots' || h.tex === 'stipple') {
    if (!h.dots) { h.dots = []; const st = h.tex === 'dots' ? 0.5 : 0.34; for (let u = h.u0; u <= h.u1; u += st) for (let v = h.v0; v <= h.v1; v += st) if (h.tex === 'dots' || !(hash(u.toFixed(2) + ':' + v.toFixed(2)) & 3)) h.dots.push(u, v); }
    for (let i = 0; i < h.dots.length; i += 2) { const q = toS(h.dots[i], h.dots[i + 1]); if (q[0] < 0 || q[1] < 0 || q[0] > G.W || q[1] > G.H) continue; ctx.fillRect(Math.round(q[0]), Math.round(q[1]), dpr, dpr); }
  }
  else if (h.tex === 'hatch') { ctx.beginPath(); for (let s = h.u0 + h.v0; s <= h.u1 + h.v1; s += 0.5) line(s - h.v0, h.v0, s - h.v1, h.v1); ctx.stroke(); }
  else if (h.tex === 'lines') { ctx.beginPath(); for (let v = h.v0; v <= h.v1; v += 0.5) line(h.u0, v, h.u1, v); ctx.stroke(); }
  else { ctx.beginPath(); for (let u = h.u0; u <= h.u1; u++) line(u, h.v0, u, h.v1); for (let v = h.v0; v <= h.v1; v++) line(h.u0, v, h.u1, v); ctx.stroke(); }
  ctx.restore();
  rhombus(h.u0, h.v0, h.u1, h.v1); ctx.strokeStyle = N(C.islandEdge); ctx.lineWidth = dpr; ctx.stroke();
  // the machine's name, painted big and faint along the front-right edge
  const sessions = G.S.filter((s) => hostOf(s).id === h.h.id), need = sessions.filter((s) => s.state === 'wait').length;
  const name = h.h.name.toUpperCase(), edge = h.v1 - h.v0;
  if (!h.nameSize) { ctx.font = '500 20px ' + FONT.mono; let wsum = 0; for (const ch of name) wsum += ctx.measureText(ch).width; h.nameSize = Math.min(4.2, (0.8 * edge) / (wsum / 20 + 0.3 * name.length)); }
  const ns = h.nameSize;
  groundText(name, h.u1 - 0.95, h.v1 - 0.1 * edge, ns, C.fg, 0.09, 600, 0.3 * ns);
  const sub = h.h.sub + (h.h.lat ? ' ' + h.h.lat : '') + ' · ' + sessions.length + ' agents';
  const l2 = groundText(sub, h.u1 - 0.18, h.v1 - 0.1 * edge, 0.55, C.fg, 0.45, 400, 0.04);
  if (need) groundText('· ' + need + ' needs you', h.u1 - 0.18, h.v1 - 0.1 * edge - l2 - 0.3, 0.55, C.wait, 0.95, 500, 0.04);
}
function drawBridge(br) {
  const c0 = br.cells[0], c1 = br.cells[br.cells.length - 1], u0 = c0[0], v0 = c0[1], u1 = c1[0] + 1, v1 = c1[1] + 1, dpr = G.dpr;
  slabFaces(u0, v0, u1, v1, Math.max(2, Math.round(3 * G.cam.z)) * dpr, N(C.islandL), N(C.islandR));
  rhombus(u0, v0, u1, v1); ctx.fillStyle = N(C.bridgeTop); ctx.fill(); ctx.strokeStyle = N(C.islandEdge); ctx.lineWidth = dpr; ctx.stroke();
  ctx.strokeStyle = C.plank; ctx.beginPath(); for (const c of br.cells) { if (br.axis === 'u') line(c[0] + 0.5, c[1], c[0] + 0.5, c[1] + 1); else line(c[0], c[1] + 0.5, c[0] + 1, c[1] + 0.5); } ctx.stroke();
  const host = br.b.h; if (host.lat) { const c = br.cells[Math.floor(br.cells.length / 2)]; groundText('ssh ' + host.lat, c[0] + (br.axis === 'u' ? 0.9 : 0.85), c[1] + (br.axis === 'u' ? 0.85 : 1.6), 0.5, C.fg, 0.45, 400, 0.02); }
}
const FLOOR_NAME = { cafe: 'café', canteen: 'canteen', park: 'park' };
function drawFloor(room) {
  const { u0, v0, w, d } = room, T = TINTS[room.hood.tint], dpr = G.dpr;
  if (room.kind === 'park') {
    rhombus(u0, v0, u0 + w, v0 + d); ctx.fillStyle = N(C.park); ctx.fill();
    ctx.fillStyle = N(C.treeDark); for (let i = 0; i < 9; i++) { const q = toS(u0 + 0.5 + i * (w - 1) / 8, v0 + d - 1.5 + Math.sin(i) * 0.3); ctx.fillRect(Math.round(q[0]) - dpr, Math.round(q[1]), 2 * dpr, dpr); }
  } else {
    slabFaces(u0, v0, u0 + w, v0 + d, 3 * G.cam.z * dpr, N(C.faceL), N(C.faceR));
    rhombus(u0, v0, u0 + w, v0 + d); ctx.fillStyle = N(C.plate); ctx.fill();
    if (room.kind === 'cafe') { ctx.fillStyle = C.fg; ctx.globalAlpha = 0.035; for (let u = u0 + 1; u < u0 + w; u++) for (let v = v0 + 1; v < v0 + d; v++) if ((u + v) % 2) { rhombus(u, v, u + 1, v + 1); ctx.fill(); } ctx.globalAlpha = 1; }
    rhombus(u0, v0, u0 + w, v0 + d); ctx.strokeStyle = N(G.hover.plot === room.project && room.project ? C.strong : C.plateEdge); ctx.lineWidth = Math.max(1, dpr); ctx.stroke();
  }
  const label = room.kind === 'office' ? room.project : FLOOR_NAME[room.kind];
  groundText(label, u0 + w - 0.3, v0 + d - 0.45, room.kind === 'office' ? 0.62 : 0.58, C.fg, room.kind === 'office' ? 0.5 : 0.3, 500, 0.03);
}
// room walls are split into unit segments so creatures sort correctly against them
function wallThings(room, list) {
  if (!room.walls) return;
  const T = TINTS[room.hood.tint], h = 1.4;
  for (let u = room.u0; u < room.u0 + room.w; u++) list.push({ d: u + room.v0 + 0.2, draw: () => { const a = toS(u, room.v0 + 0.15), b = toS(u + 1, room.v0 + 0.15); ctx.fillStyle = N(T.wall); poly([a, b, up(b, h), up(a, h)]); ctx.fill(); const c = up(a, h), e = up(b, h); ctx.strokeStyle = N(T.roof); ctx.lineWidth = 2 * G.dpr; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); if (room.kind === 'cafe' && u === room.u0 + 5) cupSign(u + 0.5, room.v0 + 0.15, h * 0.6); } });
  for (let v = room.v0; v < room.v0 + room.d; v++) list.push({ d: room.u0 + v + 0.2, draw: () => { const a = toS(room.u0 + 0.15, v + 1), b = toS(room.u0 + 0.15, v); ctx.fillStyle = N(T.wallShade); poly([a, b, up(b, h), up(a, h)]); ctx.fill(); const c = up(a, h), e = up(b, h); ctx.strokeStyle = N(T.roof); ctx.lineWidth = 2 * G.dpr; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); } });
}
function cupSign(u, v, h) { const p = up(toS(u, v), h), k = Math.max(1, Math.round(G.cam.z * G.dpr)); const g = GLYPH.coffee; ctx.fillStyle = N(C.dim); for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r][c] === 'x') ctx.fillRect(Math.round(p[0] - 2.5 * k + c * k), Math.round(p[1] - 2.5 * k + r * k), k, k); }
function furnitureThing(f, room, list) {
  const dpr = G.dpr;
  if (f.kind === 'tree') { list.push({ d: f.u + f.v + 0.6, draw: () => { const q = toS(f.u + 0.5, f.v + 0.5), k = P(), s = f.s; ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(q[0], q[1], 9 * k * s, 4 * k * s, 0, 0, Math.PI * 2); ctx.fill(); R(q[0] - 1.5 * k, q[1] - 9 * k * s, 3 * k, 9 * k * s, N(C.trunk)); ctx.fillStyle = N(C.treeDark); ctx.beginPath(); ctx.arc(q[0], q[1] - 15 * k * s, 8 * k * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = N(C.treeLight); ctx.beginPath(); ctx.arc(q[0] - 2 * k * s, q[1] - 17 * k * s, 5 * k * s, 0, Math.PI * 2); ctx.fill(); } }); return; }
  if (f.kind === 'plant') { list.push({ d: f.u + f.v + 0.5, draw: () => { const q = toS(f.u + 0.5, f.v + 0.5), k = P(); R(q[0] - 3 * k, q[1] - 5 * k, 6 * k, 5 * k, N(C.furniture)); ctx.fillStyle = N(C.treeLight); for (const [dx, dy] of [[-3, -9], [1, -11], [3, -7], [-1, -7]]) ctx.fillRect(Math.round(q[0] + dx * k), Math.round(q[1] + dy * k), 2 * k, 3 * k); } }); return; }
  const top = f.kind === 'bench' ? C.furnitureTop : C.furnitureTop;
  list.push({ d: f.u + f.w - 1 + f.v + f.d - 1 + 0.5, draw: () => {
    box(f.u + 0.08, f.v + 0.12, f.w - 0.16, f.d - 0.24, f.h, N(top), N(C.furniture), N(shade(C.furniture, 0.25)), null);
    if (f.machine) { const p = up(toS(f.u + 0.6, f.v + 0.6), f.h), k = P(); R(p[0] - 3 * k, p[1] - 7 * k, 6 * k, 7 * k, N(C.creatureInk)); R(p[0] + k, p[1] - 5 * k, k, k, N(C.faint)); }
    if (f.food) { const k = P(); for (let i = 0; i < 2; i++) { const p = up(toS(f.u + 0.6 + i, f.v + 0.5), f.h); R(p[0] - 3 * k, p[1] - 2 * k, 6 * k, 2 * k, N(C.dim)); } }
  } });
}
function buildingThing(b, h, list) {
  const T = TINTS[h.tint];
  list.push({ d: b.u + b.w - 1 + b.v + b.d - 1 + 0.4, draw: () => {
    box(b.u, b.v, b.w, b.d, b.h, N(T.roof), N(T.wall), N(T.wallShade), N(shade(T.wallShade, 0.3)));
    const lit = G.night > 0.15, glass = N(C.windowDay);
    if (!b.litMap) { b.litMap = {}; for (let fi = 0; fi < 2; fi++) for (let x = 0; x < (fi ? b.d : b.w); x++) for (let y = 0; y < b.h; y++) b.litMap[fi + ':' + x + ':' + y] = (hash(b.seed + ':' + fi + x + ':' + y) % 100) < 20; }
    const leftFace = (x) => toS(b.u + x, b.v + b.d), rightFace = (x) => toS(b.u + b.w, b.v + b.d - x);
    for (let fi = 0; fi < 2; fi++) {
      const face = fi ? rightFace : leftFace, len = fi ? b.d : b.w;
      for (let x = 0; x < len; x++) for (let y = 0; y < b.h - 0.5; y++) {
        const on = lit && b.litMap[fi + ':' + x + ':' + y];
        ctx.fillStyle = on ? C.windowLit : glass; ctx.globalAlpha = on ? 0.5 : 1;
        poly(faceQuad(face, x + 0.3, x + 0.7, y + 0.45, y + 0.95)); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    const k = P(), rp = up(toS(b.u + b.w / 2, b.v + b.d / 2), b.h);
    if (b.roof === 'ac') R(rp[0] - 4 * k, rp[1] - 4 * k, 8 * k, 4 * k, N(shade(T.roof, 0.3)));
    else if (b.roof === 'antenna') { R(rp[0], rp[1] - 12 * k, k, 12 * k, N(C.dim)); R(rp[0], rp[1] - 13 * k, k, k, N(C.faint)); }
    else if (b.roof === 'tank') { R(rp[0] - 3 * k, rp[1] - 7 * k, 6 * k, 6 * k, N(shade(T.wallShade, 0.2))); R(rp[0] - 4 * k, rp[1] - 8 * k, 8 * k, k, N(T.roof)); }
  } });
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
  if (b.act.type === 'nap' && !b.path.length && b.act.until !== Infinity) return 'closed';
  if (s.state === 'err' && atDesk) return 'x';
  if (b.emote && b.emote.g === 'bang' && t >= b.emote.from) return 'surprised';
  if (blink) return 'blink';
  if (s.state === 'wait' && atDesk) return 'worried';
  if (s.state === 'run' && atDesk) return 'focus';
  if (b.act.type === 'comfort') return 'worried';
  if (b.act.type === 'celebrate' || (s.state === 'done' && !b.moving)) return b.say ? 'open' : 'happy';
  return 'open';
}
export const labelQ = [];
function drawCreature(s, b, t) {
  const f = toS(b.u, b.v), k = Math.max(1, Math.round(G.cam.z * G.dpr)), X = Math.round(f[0]), Y = Math.round(f[1]), g = gene(s.id), dpr = G.dpr;
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
    if (s.state === 'run') { const tap = Math.floor(t * 6 + seed * 6) % 2; R(sx + sw - k, slY + (tap ? 1 : 0) * k, 2 * k, 2 * k, coat(g).d); }
  }
  if (b.seated && /coffee/.test(b.act.label || '')) { const cx2 = b.face > 0 ? sx + sw - k : sx - k; R(cx2, bodyTop + (sh - TOP * k) * 0.45, 2 * k, 2 * k, C.subtle); }
  if (flat) { const dx = X + 6 * k, dyy = Y - 9 * k - ((Math.floor(t * 2) % 2) * k); R(dx, dyy, k, k, C.dim); R(dx - k, dyy + k, 3 * k, 2 * k, C.dim); }
  const kd = Math.max(k, Math.round(1.6 * dpr)); let top = bodyTop;
  if (s.state === 'wait') { top = bodyTop - 9 * kd; diamond(X, top + (reduce ? 0 : (Math.floor(t * 2) % 2) * kd), kd); }
  if ((s.state === 'wait' || s.state === 'err') && s.bubble) queueCallout(s, X, sw, dy, sh, top, k);
  if (face === 'closed' && !reduce) for (let z = 0; z < 2; z++) { const ph = (t * 0.35 + seed + z * 0.5) % 1; ctx.globalAlpha = 1 - ph; const zx = sx + sw - 2 * k + ph * 4 * k, zy = bodyTop - ph * 10 * k; R(zx, zy, 3 * k, k, C.faint); R(zx + k, zy + k, k, k, C.faint); R(zx, zy + 2 * k, 3 * k, k, C.faint); ctx.globalAlpha = 1; }
  // speech: words when close enough to read, a glyph bubble otherwise
  if (b.say) { if (G.cam.z >= 1.5) queueSpeech(s, b, X, top - 2 * k); else bubble(X + (b.face > 0 ? 6 : -6) * k, top - 2 * k, 'dots', k, 1); }
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
    fallback: () => bubble(X + (b.face > 0 ? 6 : -6) * Math.max(1, Math.round(G.cam.z * dpr)), Y, 'dots', Math.max(1, Math.round(G.cam.z * dpr)), 1) });
}
function overlayRects() {
  const sr = stage.getBoundingClientRect(), dpr = G.dpr, out = [{ x: 0, y: 0, w: G.W, h: 26 * dpr }, { x: 0, y: 0, w: 52 * dpr, h: G.H }];
  stage.querySelectorAll('.zoom, .mini, .edge').forEach((el) => { const r = el.getBoundingClientRect(); out.push({ x: (r.left - sr.left) * dpr, y: (r.top - sr.top) * dpr, w: r.width * dpr, h: r.height * dpr }); });
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

/* ---------------- the frame ---------------- */
export function draw(t) {
  const W = G.world;
  ctx.fillStyle = C.ground; ctx.fillRect(0, 0, G.W, G.H);
  drawGrid();
  W.bridges.forEach(drawBridge);
  W.hoods.forEach(drawHood);
  W.rooms.forEach(drawFloor);
  labelQ.length = 0;
  const things = [];
  for (const h of W.hoods) for (const b of h.buildings) buildingThing(b, h, things);
  for (const room of W.rooms) { wallThings(room, things); for (const f of room.furniture) furnitureThing(f, room, things); }
  for (const s of G.S) { const b = body(s); things.push({ d: b.u + b.v + 0.05, draw: () => drawCreature(s, b, t) }); }
  things.sort((a, b) => a.d - b.d).forEach((x) => x.draw());
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
  const act = activity(s), bf = bestFriend(s.id), keyNow = id + s.state + act + (bf ? bf.id : '');
  if (keyNow !== tipKey) {
    tip.innerHTML = '<div class="n">' + esc(gene(s.id).name) + ' · ' + s.agent + ' on ' + hostOf(s).name + (bf ? ' · friends with ' + esc(gene(bf.id).name) : '') + '</div><div class="t">' + esc(s.title) + '</div><div class="s">' + icon(s.state) + WORD[s.state] + ' · ' + fmt(s.since) + ' · ' + esc(act) + '</div>';
    tipKey = keyNow;
  }
  tip.style.left = Math.max(150, Math.min(G.W / G.dpr - 150, (b.x + b.w / 2) / G.dpr)) + 'px'; tip.style.top = Math.max(90, b.y / G.dpr) + 'px'; tip.hidden = false;
}
const mm = document.getElementById('mm'), mg = mm.getContext('2d'); let mmT = null;
export function minimap() {
  const b = boundsOf(G.world.hoods), MW = mm.width, MH = mm.height, sc = Math.min((MW - 16) / (b.x1 - b.x0), (MH - 16) / (b.y1 - b.y0)), ox = MW / 2 - (b.x0 + b.x1) / 2 * sc, oy = MH / 2 - (b.y0 + b.y1) / 2 * sc;
  mmT = { sc, ox, oy };
  const pr = (u, v) => [ox + (u - v) * 16 * sc, oy + (u + v) * 8 * sc];
  const rh = (u0, v0, u1, v1, col) => { const q = [pr(u0, v0), pr(u1, v0), pr(u1, v1), pr(u0, v1)]; mg.beginPath(); mg.moveTo(q[0][0], q[0][1]); q.slice(1).forEach((c) => mg.lineTo(c[0], c[1])); mg.closePath(); mg.fillStyle = col; mg.fill(); };
  mg.fillStyle = C.side; mg.fillRect(0, 0, MW, MH);
  for (const h of G.world.hoods) rh(h.u0, h.v0, h.u1, h.v1, TINTS[h.tint].ground === undefined ? C.plate : TINTS[h.tint].wallShade);
  for (const r of G.world.rooms) rh(r.u0, r.v0, r.u0 + r.w, r.v0 + r.d, r.kind === 'park' ? C.treeDark : C.minimapPlate);
  for (const s of G.S) { const bb = G.bodies[s.id]; if (!bb) continue; const c = pr(bb.u, bb.v); if (s.state === 'wait' || s.state === 'err') { mg.fillStyle = s.state === 'wait' ? C.wait : C.err; mg.beginPath(); mg.moveTo(c[0], c[1] - 4); mg.lineTo(c[0] + 4, c[1]); mg.lineTo(c[0], c[1] + 4); mg.lineTo(c[0] - 4, c[1]); mg.closePath(); mg.fill(); } else { mg.fillStyle = C.subtle; mg.fillRect(Math.round(c[0]) - 1, Math.round(c[1]) - 1, 2, 2); } }
  const tl = toW(0, 0), br = toW(G.W, G.H), A1 = pr(tl[0], tl[1]), B1 = pr(br[0], br[1]);
  mg.strokeStyle = C.dim; mg.lineWidth = 1.5; mg.strokeRect(Math.round(A1[0]) + 0.5, Math.round(A1[1]) + 0.5, Math.round(B1[0] - A1[0]), Math.round(B1[1] - A1[1]));
  const n = G.S.filter((s) => s.state === 'wait').length, mc = document.getElementById('mcount'), txt = n ? n + ' need you' : 'clear';
  if (mc.textContent !== txt) { mc.textContent = txt; mc.style.color = n ? 'var(--wait)' : ''; }
}
export function mmJump(e) { const r = mm.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * mm.width, y = (e.clientY - r.top) / r.height * mm.height, X = (x - mmT.ox) / mmT.sc, Y = (y - mmT.oy) / mmT.sc, a = X / 16, b = Y / 8; G.tgt.u = (a + b) / 2; G.tgt.v = (b - a) / 2; if (reduce) Object.assign(G.cam, G.tgt); }
export function hitAgent(X, Y) { const dpr = G.dpr; let f = null; for (const s of G.S) { const b = G.boxes[s.id]; if (b && X >= b.x - 4 * dpr && X <= b.x + b.w + 4 * dpr && Y >= b.y - 4 * dpr && Y <= b.y + b.h + 2 * dpr) f = s.id; } return f; }
export function hitPlot(X, Y) { const w = toW(X, Y), room = G.world.roomAt[key(Math.floor(w[0]), Math.floor(w[1]))]; return room && room.kind === 'office' ? room.project : null; }
