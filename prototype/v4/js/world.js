// World generation: each machine is a neighborhood generated from its id.
// Layout per neighborhood (u runs right-down, v runs left-down on screen):
//   back strip: a skyline of closed buildings | rows of project offices (2 columns) | an amenity row (café + canteen or park)
//   streets between lots, and a name strip along the front-right edge where the machine name is painted on the ground.
import { hash, rng, pick, HOSTS, PROJECTS, INITIAL, TINTS } from './core.js';

export const OD = 6;          // room depth (office, café, canteen, park)
export const SLOT = 2;        // desk pitch in an office
const GAP = 6;                // water between neighborhoods (bridged)
const SKY = 3;                // skyline strip depth
const NAME = 3;               // name strip width along the front-right edge
const TEXTURES = ['dots', 'hatch', 'grid', 'stipple', 'lines'];

export function officeW(n) { return Math.max(6, SLOT * n + 3); }
export function key(u, v) { return u + ',' + v; }

export function buildWorld() {
  const W = { hoods: [], rooms: [], offices: {}, bridges: [], walk: {}, blocked: {}, roomAt: {}, spots: [] };
  const sessionsOf = (pid) => INITIAL.filter((s) => s.plot === pid);
  const CW = Math.max(8, ...PROJECTS.map((p) => officeW(sessionsOf(p.id).length)));
  const IW = 1 + CW + 2 + CW + NAME;
  const tintKeys = Object.keys(TINTS), usedTint = new Set(), usedTex = new Set();

  const plans = HOSTS.map((h, i) => {
    const r = rng(hash(h.id + '/hood'));
    const order = tintKeys.slice().sort((a, b) => hash(h.id + a) - hash(h.id + b));
    const tint = order.find((t) => !usedTint.has(t)) || order[0]; usedTint.add(tint);
    const texOrder = TEXTURES.slice().sort((a, b) => hash(h.id + 't' + a) - hash(h.id + 't' + b));
    const tex = texOrder.find((t) => !usedTex.has(t)) || texOrder[0]; usedTex.add(tex);
    const ps = PROJECTS.filter((p) => p.host === h.id);
    const amen = ['cafe', r() < 0.5 ? 'canteen' : 'park'];
    if (ps.length % 2) amen.push(amen[1] === 'park' ? 'canteen' : 'park');
    const slots = ps.map((p) => ({ kind: 'office', project: p.id })).concat(amen.map((k) => ({ kind: k })));
    const rows = Math.ceil(slots.length / 2);
    return { h, i, r, tint, tex, slots, rows, D: SKY + 1 + rows * (OD + 2) + 1 };
  });
  // make sure the world has at least one canteen and one park
  const kinds = plans.flatMap((p) => p.slots.map((s) => s.kind));
  if (!kinds.includes('canteen')) plans[plans.length - 1].slots.find((s) => s.kind === 'park').kind = 'canteen';
  if (!kinds.includes('park')) plans[0].slots.find((s) => s.kind === 'canteen').kind = 'park';

  const rowD = [];
  plans.forEach((p) => { const r = Math.floor(p.i / 2); rowD[r] = Math.max(rowD[r] || 0, p.D); });

  plans.forEach((p) => {
    const row = Math.floor(p.i / 2); let V0 = 0; for (let q = 0; q < row; q++) V0 += rowD[q] + GAP;
    const U0 = (p.i % 2) * (IW + GAP);
    const hood = { h: p.h, idx: p.i, tint: p.tint, tex: p.tex, u0: U0, v0: V0, u1: U0 + IW, v1: V0 + p.D, rooms: [], buildings: [], streetU: U0 + 1 + CW, nameU: U0 + IW - NAME };
    for (let u = hood.u0; u < hood.u1; u++) for (let v = hood.v0; v < hood.v1; v++) W.walk[key(u, v)] = p.i;

    // skyline: closed buildings along the back, leaving the middle street open
    let x = U0 + 1; const limit = hood.nameU - 1, r = p.r;
    while (x < limit) {
      if (x >= hood.streetU && x < hood.streetU + 2) { x = hood.streetU + 2; continue; }
      const w = 2 + Math.floor(r() * 3), maxW = Math.min(limit - x, x < hood.streetU ? hood.streetU - x : limit - x);
      if (maxW < 2) { x += maxW + 1; continue; }
      const bw = Math.min(w, maxW), d = 2 + (r() < 0.5 ? 1 : 0), hgt = 2 + Math.floor(r() * 5);
      const b = { u: x, v: V0, w: bw, d, h: hgt, roof: pick(r, ['none', 'ac', 'antenna', 'tank', 'none']), seed: Math.floor(r() * 1e6) };
      hood.buildings.push(b);
      for (let u = b.u; u < b.u + b.w; u++) for (let v = b.v; v < b.v + b.d; v++) W.blocked[key(u, v)] = true;
      x += bw + (r() < 0.45 ? 1 : 0);
    }

    // lots
    p.slots.forEach((slot, j) => {
      const c = j % 2, rr = Math.floor(j / 2);
      const lotU = U0 + 1 + c * (CW + 2), lotV = V0 + SKY + 1 + rr * (OD + 2);
      const w = slot.kind === 'office' ? officeW(sessionsOf(slot.project).length) : 8;
      const room = { kind: slot.kind, project: slot.project, hood, u0: lotU + Math.floor((CW - w) / 2), v0: lotV, w, d: OD, spots: [], furniture: [], walls: slot.kind !== 'park' };
      makeRoom(W, room, rng(hash(p.h.id + '/' + j)));
      hood.rooms.push(room); W.rooms.push(room);
      if (slot.kind === 'office') W.offices[slot.project] = room; else hood[slot.kind] = room;
    });
    W.hoods.push(hood);
  });

  // bridges: right neighbour along u, lower neighbour along v (through the middle street)
  W.hoods.forEach((a, i) => {
    const right = W.hoods[i + 1], down = W.hoods[i + 2];
    if (right && i % 2 === 0) { const bv = Math.min(a.v1, right.v1) - 2, br = { a, b: right, cells: [], axis: 'u' }; for (let u = a.u1; u < right.u0; u++) { W.walk[key(u, bv)] = -1; br.cells.push([u, bv]); } W.bridges.push(br); }
    if (down) { const bu = a.streetU, bd = { a, b: down, cells: [], axis: 'v' }; for (let v = a.v1; v < down.v0; v++) { W.walk[key(bu, v)] = -1; bd.cells.push([bu, v]); } W.bridges.push(bd); }
  });
  return W;
}

function addSpot(W, room, u, v, kind, face) { const s = { u, v, kind, room, occ: null, face: face || 1 }; room.spots.push(s); W.spots.push(s); return s; }
function block(W, u, v) { W.blocked[key(u, v)] = true; }

function makeRoom(W, room, r) {
  const { u0, v0, w, d } = room;
  for (let u = u0; u < u0 + w; u++) for (let v = v0; v < v0 + d; v++) W.roomAt[key(u, v)] = room;
  if (room.walls) { for (let u = u0; u < u0 + w; u++) block(W, u, v0); for (let v = v0; v < v0 + d; v++) block(W, u0, v); }
  if (room.kind === 'office') {
    const n = INITIAL.filter((s) => s.plot === room.project).length;
    room.desks = []; for (let k = 0; k < n; k++) room.desks.push({ u: u0 + 2.5 + SLOT * k, v: v0 + 2.5 });
    room.visit = room.desks.map((dk) => addSpot(W, room, dk.u - 0.6, dk.v + 1.6, 'visit', 1));
    const pu = u0 + w - 1, pv = v0 + 1; block(W, pu, pv); room.furniture.push({ kind: 'plant', u: pu, v: pv });
  } else if (room.kind === 'cafe') {
    for (let u = u0 + 1; u <= u0 + 3; u++) block(W, u, v0 + 1);
    room.furniture.push({ kind: 'counter', u: u0 + 1, v: v0 + 1, w: 3, d: 1, h: 0.9, machine: true });
    room.counter = addSpot(W, room, u0 + 2.5, v0 + 2.5, 'counter', 1);
    for (const [tu, tv] of [[u0 + 2, v0 + 4], [u0 + 5, v0 + 3]]) {
      block(W, tu, tv); room.furniture.push({ kind: 'table', u: tu, v: tv, w: 1, d: 1, h: 0.6 });
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const su = tu + du, sv = tv + dv;
        if (su > u0 && su < u0 + w && sv > v0 && sv < v0 + d && !W.blocked[key(su, sv)]) addSpot(W, room, su + 0.5, sv + 0.5, 'seat', (du - dv) >= 0 ? -1 : 1);
      }
    }
  } else if (room.kind === 'canteen') {
    for (let u = u0 + 2; u <= u0 + 6; u++) block(W, u, v0 + 3);
    room.furniture.push({ kind: 'table', u: u0 + 2, v: v0 + 3, w: 5, d: 1, h: 0.6 });
    for (let u = u0 + 2; u <= u0 + 6; u++) { addSpot(W, room, u + 0.5, v0 + 2.5, 'seat', -1); addSpot(W, room, u + 0.5, v0 + 4.5, 'seat', 1); }
    room.furniture.push({ kind: 'counter', u: u0 + 5, v: v0 + 1, w: 2, d: 1, h: 0.9, food: true });
    for (let u = u0 + 5; u <= u0 + 6; u++) block(W, u, v0 + 1);
  } else if (room.kind === 'park') {
    const cells = [];
    for (let u = u0; u < u0 + w; u++) for (let v = v0; v < v0 + d; v++) cells.push([u, v]);
    for (let u = u0 + 2; u <= u0 + 3; u++) block(W, u, v0 + 3);
    room.furniture.push({ kind: 'bench', u: u0 + 2, v: v0 + 3, w: 2, d: 1, h: 0.45 });
    room.bench = [addSpot(W, room, u0 + 2.5, v0 + 4.5, 'bench', 1), addSpot(W, room, u0 + 3.5, v0 + 4.5, 'bench', -1)];
    let trees = 0;
    for (const [u, v] of cells.sort(() => r() - 0.5)) {
      if (trees >= 4) break;
      if (Math.abs(u - (u0 + 3)) <= 1 && v >= v0 + 2) continue;
      if (W.blocked[key(u, v)] || (u === u0 + w - 1 && v === v0 + d - 1)) continue;
      block(W, u, v); room.furniture.push({ kind: 'tree', u, v, s: 0.8 + r() * 0.5 }); trees++;
    }
    for (let k = 0; k < 4; k++) { const c = cells[Math.floor(r() * cells.length)]; if (!W.blocked[key(c[0], c[1])]) addSpot(W, room, c[0] + 0.5, c[1] + 0.5, 'stand', 1); }
  }
}

/* ---------------- pathfinding: A* with a binary heap ---------------- */
export function passable(W, u, v) { const k = key(u, v); return W.walk[k] != null && !W.blocked[k]; }
export function findPath(W, su, sv, gu, gv) {
  su = Math.floor(su); sv = Math.floor(sv); gu = Math.floor(gu); gv = Math.floor(gv);
  if (su === gu && sv === gv) return [];
  const sk = key(su, sv), gk = key(gu, gv), came = {}, g = { [sk]: 0 }, heap = [[Math.abs(gu - su) + Math.abs(gv - sv), su, sv]];
  const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  let guard = 0;
  while (heap.length && guard++ < 6000) {
    const [, cu, cv] = pop(), ck = key(cu, cv);
    if (ck === gk) { const out = []; let kk = ck; while (kk !== sk) { const p = kk.split(','); out.unshift({ u: +p[0] + 0.5, v: +p[1] + 0.5 }); kk = came[kk]; } return out; }
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nu = cu + du, nv = cv + dv, nk = key(nu, nv);
      if (W.walk[nk] == null || (W.blocked[nk] && nk !== gk)) continue;
      const t = g[ck] + 1 + (W.roomAt[nk] ? 0.5 : 0);
      if (g[nk] == null || t < g[nk]) { came[nk] = ck; g[nk] = t; push([t + Math.abs(gu - nu) + Math.abs(gv - nv), nu, nv]); }
    }
  }
  return null;
}
export function hoodAt(W, u, v) { const x = W.walk[key(Math.floor(u), Math.floor(v))]; return x == null || x < 0 ? null : W.hoods[x]; }
export function randomStreet(W, hood, r) {
  for (let t = 0; t < 60; t++) {
    const u = Math.floor(hood.u0 + r() * (hood.u1 - hood.u0)), v = Math.floor(hood.v0 + SKY + r() * (hood.v1 - hood.v0 - SKY));
    if (passable(W, u, v) && !W.roomAt[key(u, v)]) return { u: u + 0.5, v: v + 0.5 };
  }
  return { u: hood.streetU + 0.5, v: hood.v0 + SKY + 0.5 };
}
export function deskOf(W, s) { const room = W.offices[s.plot], k = INITIAL.filter((x) => x.plot === s.plot).findIndex((x) => x.id === s.id); return room.desks[Math.max(0, k)]; }
