// World v6: the organised grid of v3 (one island per machine, project plots in two columns, a commons),
// with nature growing on it. Each machine gets ONE signature landmark, chosen from its id.
// Everything in the world is a "place" that advertises what it offers (rest, food, company, fun); see life.js.
import { hash, HOSTS, PROJECTS, INITIAL } from './core.js';

export const OD = 4;          // plot depth
export const SLOT = 2;        // desk pitch
const GAP = 6, COMMONS = 6;
export function officeW(n) { return Math.max(5, SLOT * n + 2); }
export function key(u, v) { return u + ',' + v; }

// signature landmarks and what they offer: needs are energy, hunger, social, fun (0..1 per second of use)
export const SIGNATURES = {
  tree: { name: 'the great tree', offers: { energy: 0.05, social: 0.015 }, verb: 'resting under' },
  spring: { name: 'the glow spring', offers: { fun: 0.05, social: 0.02 }, verb: 'watching the lights at' },
  greenhouse: { name: 'the greenhouse', offers: { hunger: 0.06, fun: 0.01 }, verb: 'snacking in' },
  grove: { name: 'the mushroom grove', offers: { fun: 0.045, energy: 0.015 }, verb: 'wandering through' },
  stone: { name: 'the data stone', offers: { fun: 0.035, energy: 0.02 }, verb: 'listening to' }
};

export function buildWorld() {
  const W = { hoods: [], rooms: [], offices: {}, bridges: [], walk: {}, blocked: {}, roomAt: {}, spots: [], sprites: [], plants: [] };
  const sessionsOf = (pid) => INITIAL.filter((s) => s.plot === pid);
  const CW = Math.max(6, ...PROJECTS.map((p) => officeW(sessionsOf(p.id).length)));
  const IW = 2 * CW + 4;
  const sigOrder = Object.keys(SIGNATURES), used = new Set();
  const plans = HOSTS.map((h, i) => {
    const ps = PROJECTS.filter((p) => p.host === h.id), rows = Math.ceil(ps.length / 2);
    const order = sigOrder.slice().sort((a, b) => hash(h.id + a) - hash(h.id + b));
    const sig = order.find((k) => !used.has(k)) || order[0]; used.add(sig);
    return { h, i, ps, rows, sig, D: 1 + rows * (OD + 2) + COMMONS + 1 };
  });
  const rowD = []; plans.forEach((p) => { const r = Math.floor(p.i / 2); rowD[r] = Math.max(rowD[r] || 0, p.D); });

  plans.forEach((p) => {
    const row = Math.floor(p.i / 2); let V0 = 0; for (let q = 0; q < row; q++) V0 += rowD[q] + GAP;
    const U0 = (p.i % 2) * (IW + GAP);
    const isl = { h: p.h, idx: p.i, u0: U0, v0: V0, u1: U0 + IW, v1: V0 + p.D, sig: p.sig, rooms: [], mid: U0 + 1 + CW + 1 };
    for (let u = isl.u0; u < isl.u1; u++) for (let v = isl.v0; v < isl.v1; v++) W.walk[key(u, v)] = p.i;
    // project plots, two columns
    p.ps.forEach((proj, j) => {
      const n = sessionsOf(proj.id).length, w = officeW(n), c = j % 2, r = Math.floor(j / 2);
      const u0 = U0 + 1 + c * (CW + 2) + Math.floor((CW - w) / 2), v0 = V0 + 1 + r * (OD + 2);
      const room = { kind: 'office', project: proj.id, hood: isl, u0, v0, w, d: OD, spots: [] };
      for (let u = u0; u < u0 + w; u++) for (let v = v0; v < v0 + OD; v++) W.roomAt[key(u, v)] = room;
      room.desks = []; for (let k = 0; k < n; k++) room.desks.push({ u: u0 + 1.5 + SLOT * k, v: v0 + 1.75 });
      room.visit = room.desks.map((dk) => addSpot(W, room, dk.u - 0.5, dk.v + 1.5, 'visit', 1));
      room.harvest = room.desks.map((dk) => addSpot(W, room, dk.u + 0.5, dk.v + 1.5, 'harvest', -1));
      room.desks.forEach((dk, k) => W.plants.push({ room, k, u: dk.u + 0.85, v: dk.v - 0.85 }));
      W.offices[proj.id] = room; isl.rooms.push(room); W.rooms.push(room);
    });
    // the commons: benches on the left, the island's signature landmark on the right
    const cv0 = V0 + 1 + p.rows * (OD + 2), cu0 = U0 + 1, commons = { kind: 'commons', hood: isl, u0: cu0, v0: cv0, w: IW - 2, d: COMMONS - 1, spots: [] };
    for (let u = cu0; u < cu0 + commons.w; u++) for (let v = cv0; v < cv0 + commons.d; v++) W.roomAt[key(u, v)] = commons;
    const benches = [[cu0 + 1, cv0 + 1], [cu0 + 4, cv0 + 3]];
    for (const [bu, bv] of benches) {
      block(W, bu, bv); block(W, bu + 1, bv); W.sprites.push({ kind: 'bench', u: bu, v: bv, w: 2, d: 1 });
      addSpot(W, commons, bu + 0.5, bv + 1.5, 'bench', 1); addSpot(W, commons, bu + 1.5, bv + 1.5, 'bench', -1);
    }
    for (const [su, sv] of [[cu0 + 3, cv0 + 0], [cu0 + 0, cv0 + 3], [cu0 + 6, cv0 + 1], [cu0 + 2, cv0 + 4]]) addSpot(W, commons, su + 0.5, sv + 0.5, 'stand', 1);
    isl.rooms.push(commons); W.rooms.push(commons); isl.commons = commons;
    // signature landmark: a 3x3 footprint at the right of the commons, with places to stand or sit around it
    const su = isl.u1 - 1 - 4, sv = cv0 + 1, sig = { kind: 'sig', sig: p.sig, hood: isl, u0: su - 1, v0: sv - 1, w: 5, d: 5, spots: [], offers: SIGNATURES[p.sig].offers };
    for (let u = sig.u0; u < sig.u0 + sig.w; u++) for (let v = sig.v0; v < sig.v0 + sig.d; v++) if (W.walk[key(u, v)] != null) W.roomAt[key(u, v)] = sig;
    for (let u = su; u < su + 3; u++) for (let v = sv; v < sv + 3; v++) block(W, u, v);
    W.sprites.push({ kind: p.sig, u: su, v: sv, w: 3, d: 3 });
    for (const [au, av, f] of [[su - 1, sv + 1, 1], [su + 1, sv + 3, 1], [su + 3, sv + 1, -1], [su + 3, sv + 3, -1], [su - 1, sv + 3, 1]]) if (W.walk[key(au, av)] != null && !W.blocked[key(au, av)]) addSpot(W, sig, au + 0.5, av + 0.5, 'sig', f);
    isl.sigRoom = sig; isl.rooms.push(sig); W.rooms.push(sig);
    W.hoods.push(isl);
  });
  // bridges: neighbour along u at the commons row, neighbour along v through the middle street
  W.hoods.forEach((a, i) => {
    const right = W.hoods[i + 1], down = W.hoods[i + 2];
    if (right && i % 2 === 0) { const bv = Math.min(a.v1, right.v1) - 3, br = { a, b: right, cells: [], axis: 'u' }; for (let u = a.u1; u < right.u0; u++) { W.walk[key(u, bv)] = -1; br.cells.push([u, bv]); } W.bridges.push(br); }
    if (down) { const bu = a.mid, br = { a, b: down, cells: [], axis: 'v' }; for (let v = a.v1; v < down.v0; v++) { W.walk[key(bu, v)] = -1; br.cells.push([bu, v]); } W.bridges.push(br); }
  });
  return W;
}

function addSpot(W, room, u, v, kind, face) { const s = { u, v, kind, room, occ: null, face: face || 1 }; room.spots.push(s); W.spots.push(s); return s; }
function block(W, u, v) { W.blocked[key(u, v)] = true; }

/* ---------------- pathfinding: A* with a binary heap ---------------- */
export function passable(W, u, v) { const k = key(u, v); return W.walk[k] != null && !W.blocked[k]; }
export function findPath(W, su, sv, gu, gv) {
  su = Math.floor(su); sv = Math.floor(sv); gu = Math.floor(gu); gv = Math.floor(gv);
  if (su === gu && sv === gv) return [];
  const sk = key(su, sv), gk = key(gu, gv), came = {}, g = { [sk]: 0 }, heap = [[Math.abs(gu - su) + Math.abs(gv - sv), su, sv]];
  const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  let guard = 0;
  while (heap.length && guard++ < 8000) {
    const [, cu, cv] = pop(), ck = key(cu, cv);
    if (ck === gk) { const out = []; let kk = ck; while (kk !== sk) { const p = kk.split(','); out.unshift({ u: +p[0] + 0.5, v: +p[1] + 0.5 }); kk = came[kk]; } return out; }
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nu = cu + du, nv = cv + dv, nk = key(nu, nv);
      if (W.walk[nk] == null || (W.blocked[nk] && nk !== gk)) continue;
      const room = W.roomAt[nk], t = g[ck] + 1 + (room && room.kind === 'office' ? 0.6 : 0);
      if (g[nk] == null || t < g[nk]) { came[nk] = ck; g[nk] = t; push([t + Math.abs(gu - nu) + Math.abs(gv - nv), nu, nv]); }
    }
  }
  return null;
}
export function hoodAt(W, u, v) { const x = W.walk[key(Math.floor(u), Math.floor(v))]; return x == null || x < 0 ? null : W.hoods[x]; }
export function randomStreet(W, hood, r) {
  for (let t = 0; t < 60; t++) { const u = Math.floor(hood.u0 + r() * (hood.u1 - hood.u0)), v = Math.floor(hood.v0 + r() * (hood.v1 - hood.v0)), k = key(u, v); if (W.walk[k] != null && !W.blocked[k] && !W.roomAt[k]) return { u: u + 0.5, v: v + 0.5 }; }
  return { u: hood.mid + 0.5, v: hood.v0 + 1.5 };
}
export function deskOf(W, s) { const room = W.offices[s.plot], k = INITIAL.filter((x) => x.plot === s.plot).findIndex((x) => x.id === s.id); return room.desks[Math.max(0, k)]; }
