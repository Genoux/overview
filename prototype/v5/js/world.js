// World v5: the grid is the world. Each machine is a district of project plots joined by a spine of traces
// to its hub. A few landmarks (one restaurant, one café, one garden) sit in the world as nodes. Creatures walk
// only on the network: plots, the traces between them, the hub aprons, landmark aprons and the bridges.
import { hash, rng, HOSTS, PROJECTS, INITIAL } from './core.js';

export const OD = 4;          // plot depth
export const SLOT = 2;        // desk pitch
const GAP = 6;
export function officeW(n) { return Math.max(5, SLOT * n + 2); }
export function key(u, v) { return u + ',' + v; }
const LANDMARK_W = { restaurant: 5, cafe: 4, garden: 5 };

export function buildWorld() {
  const W = { hoods: [], rooms: [], offices: {}, bridges: [], walk: {}, blocked: {}, roomAt: {}, spots: [], traces: [], pads: [], sprites: [] };
  const sessionsOf = (pid) => INITIAL.filter((s) => s.plot === pid);
  const CW = Math.max(6, ...PROJECTS.map((p) => officeW(sessionsOf(p.id).length)), ...Object.values(LANDMARK_W));
  const IW = 1 + CW + 2 + CW + 1;
  // one of each landmark across the whole world, dealt to districts by a seeded order
  const kinds = ['restaurant', 'cafe', 'garden'].sort((a, b) => hash('lm' + a) - hash('lm' + b));
  const landmarksFor = HOSTS.map(() => []);
  kinds.forEach((k, i) => landmarksFor[i % HOSTS.length].push(k));

  const plans = HOSTS.map((h, i) => {
    const slots = PROJECTS.filter((p) => p.host === h.id).map((p) => ({ kind: 'office', project: p.id })).concat(landmarksFor[i].map((k) => ({ kind: k })));
    const rows = Math.ceil(slots.length / 2);
    return { h, i, slots, rows, D: 1 + rows * (OD + 2) + 5 };
  });
  const rowD = []; plans.forEach((p) => { const r = Math.floor(p.i / 2); rowD[r] = Math.max(rowD[r] || 0, p.D); });
  const walk = (u, v, hi) => { W.walk[key(u, v)] = hi; };
  const trace = (u0, v0, u1, v1) => W.traces.push([u0 + 0.5, v0 + 0.5, u1 + 0.5, v1 + 0.5]);

  plans.forEach((p) => {
    const row = Math.floor(p.i / 2); let V0 = 0; for (let q = 0; q < row; q++) V0 += rowD[q] + GAP;
    const U0 = (p.i % 2) * (IW + GAP);
    const hood = { h: p.h, idx: p.i, u0: U0, v0: V0, u1: U0 + IW, v1: V0 + p.D, rooms: [], streetU: U0 + 1 + CW, hubV: V0 + 1 + p.rows * (OD + 2) + 1 };
    const spineTop = V0 + 1, spineBot = hood.hubV - 1;
    for (let v = spineTop; v <= spineBot; v++) walk(hood.streetU, v, p.i);
    trace(hood.streetU, spineTop, hood.streetU, spineBot);
    W.pads.push({ u: hood.streetU + 0.5, v: spineTop + 0.5, lit: false });

    p.slots.forEach((slot, j) => {
      const c = j % 2, rr = Math.floor(j / 2);
      const w = slot.kind === 'office' ? officeW(sessionsOf(slot.project).length) : LANDMARK_W[slot.kind];
      const u0 = c === 0 ? hood.streetU - 1 - w : hood.streetU + 2, v0 = V0 + 1 + rr * (OD + 2);
      const room = { kind: slot.kind, project: slot.project, hood, u0, v0, w, d: OD, spots: [], furniture: [] };
      for (let u = u0; u < u0 + w; u++) for (let v = v0; v < v0 + OD; v++) { walk(u, v, p.i); W.roomAt[key(u, v)] = room; }
      // branch from the spine to the plot's entry
      const bv = v0 + 2, eu = c === 0 ? u0 + w : u0 - 1;
      if (c === 0) { for (let u = eu; u < hood.streetU; u++) walk(u, bv, p.i); trace(eu - 1, bv, hood.streetU, bv); }
      else { for (let u = hood.streetU + 1; u <= eu; u++) walk(u, bv, p.i); trace(hood.streetU, bv, eu + 1, bv); }
      W.pads.push({ u: hood.streetU + 0.5, v: bv + 0.5, lit: true }, { u: (c === 0 ? eu - 1 : eu + 1) + 0.5, v: bv + 0.5, lit: false });
      makeRoom(W, room, rng(hash(p.h.id + '/' + j)));
      hood.rooms.push(room); W.rooms.push(room);
      if (slot.kind === 'office') W.offices[slot.project] = room; else hood[slot.kind] = room;
    });

    // the hub: a 2x2 tower at the foot of the spine, with an apron to stand on
    const hu = hood.streetU, hv = hood.hubV, hubRoom = { kind: 'hub', hood, u0: hu - 1, v0: hv - 1, w: 4, d: 4, spots: [], furniture: [] };
    for (let u = hu - 1; u <= hu + 2; u++) for (let v = hv - 1; v <= hv + 2; v++) { walk(u, v, p.i); W.roomAt[key(u, v)] = hubRoom; }
    for (let u = hu; u <= hu + 1; u++) for (let v = hv; v <= hv + 1; v++) W.blocked[key(u, v)] = true;
    for (const [u, v] of [[hu - 1, hv - 1], [hu + 2, hv - 1], [hu - 1, hv + 2], [hu + 2, hv + 2], [hu - 1, hv + 0.5], [hu + 2, hv + 0.5]]) addSpot(W, hubRoom, Math.floor(u) + 0.5, Math.floor(v) + 0.5, 'stand', 1);
    W.sprites.push({ kind: 'hub', u: hu, v: hv, w: 2, d: 2 });
    hood.hub = hubRoom; W.rooms.push(hubRoom);
    W.pads.push({ u: hu + 0.5, v: hv - 1 + 0.5, lit: true });
    W.hoods.push(hood);
  });

  // bridges between districts, joined to each spine by a trace
  W.hoods.forEach((a, i) => {
    const right = W.hoods[i + 1], down = W.hoods[i + 2];
    if (right && i % 2 === 0) {
      const bv = Math.min(a.hubV, right.hubV) - 1, br = { a, b: right, cells: [], axis: 'u' };
      for (let u = a.streetU + 1; u < a.u1; u++) walk(u, bv, a.idx);
      for (let u = a.u1; u < right.u0; u++) { walk(u, bv, -1); br.cells.push([u, bv]); }
      for (let u = right.u0; u < right.streetU; u++) walk(u, bv, right.idx);
      trace(a.streetU, bv, right.streetU, bv); W.bridges.push(br);
      W.pads.push({ u: a.u1 - 0.5, v: bv + 0.5, lit: true }, { u: right.u0 + 0.5, v: bv + 0.5, lit: true });
    }
    if (down) {
      const bu = a.streetU, br = { a, b: down, cells: [], axis: 'v' };
      for (let v = a.hubV + 3; v < a.v1; v++) walk(bu, v, a.idx);
      for (let v = a.v1; v < down.v0; v++) { walk(bu, v, -1); br.cells.push([bu, v]); }
      walk(bu, down.v0, down.idx);
      trace(bu, a.hubV + 2, bu, down.v0 + 1); W.bridges.push(br);
    }
  });
  return W;
}

function addSpot(W, room, u, v, kind, face) { const s = { u, v, kind, room, occ: null, face: face || 1 }; room.spots.push(s); W.spots.push(s); return s; }
function block(W, u, v) { W.blocked[key(u, v)] = true; }

function makeRoom(W, room, r) {
  const { u0, v0, w, d } = room;
  if (room.kind === 'office') {
    const n = INITIAL.filter((s) => s.plot === room.project).length;
    room.desks = []; for (let k = 0; k < n; k++) room.desks.push({ u: u0 + 1.5 + SLOT * k, v: v0 + 1.75 });
    room.visit = room.desks.map((dk) => addSpot(W, room, dk.u - 0.5, dk.v + 1.5, 'visit', 1));
  } else if (room.kind === 'restaurant') {
    for (let u = u0 + 1; u < u0 + 4; u++) for (let v = v0; v < v0 + 2; v++) block(W, u, v);
    W.sprites.push({ kind: 'restaurant', u: u0 + 1, v: v0, w: 3, d: 2 });
    for (const tu of [u0 + 1, u0 + 3]) {
      const tv = v0 + 3; block(W, tu, tv); W.sprites.push({ kind: 'table', u: tu, v: tv, w: 1, d: 1 });
      for (const [du, dv] of [[1, 0], [-1, 0]]) { const su = tu + du; if (su >= u0 && su < u0 + w && !W.blocked[key(su, tv)]) addSpot(W, room, su + 0.5, tv + 0.5, 'seat', du > 0 ? -1 : 1); }
      addSpot(W, room, tu + 0.5, tv - 0.5, 'seat', 1);
    }
  } else if (room.kind === 'cafe') {
    for (let u = u0 + 1; u < u0 + 3; u++) for (let v = v0; v < v0 + 2; v++) block(W, u, v);
    W.sprites.push({ kind: 'cafe', u: u0 + 1, v: v0, w: 2, d: 2 });
    room.counter = addSpot(W, room, u0 + 1.5, v0 + 2.5, 'counter', 1);
    const tu = u0 + 3, tv = v0 + 2; block(W, tu, tv); W.sprites.push({ kind: 'table', u: tu, v: tv, w: 1, d: 1 });
    addSpot(W, room, tu + 0.5, tv + 1.5, 'seat', 1); addSpot(W, room, tu - 0.5 + 0, tv + 1.5, 'seat', 1); addSpot(W, room, u0 + 0.5, v0 + 3.5, 'seat', 1);
  } else if (room.kind === 'garden') {
    W.sprites.push({ kind: 'garden', u: u0 + 0.5, v: v0 + 0.5, w: 4, d: 3, ground: true });
    for (const [tu, tv] of [[u0 + 1, v0 + 1], [u0 + 3, v0 + 1], [u0 + 3, v0 + 2]]) block(W, tu, tv);
    block(W, u0 + 1, v0 + 2); block(W, u0 + 2, v0 + 2);
    room.bench = [addSpot(W, room, u0 + 1.5, v0 + 3.5, 'bench', 1), addSpot(W, room, u0 + 2.5, v0 + 3.5, 'bench', -1)];
    addSpot(W, room, u0 + 0.5, v0 + 3.5, 'stand', 1); addSpot(W, room, u0 + 4.5, v0 + 3.5, 'stand', -1); addSpot(W, room, u0 + 4.5, v0 + 0.5, 'stand', -1);
  }
}

/* ---------------- pathfinding: A* with a binary heap over the network ---------------- */
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
      const t = g[ck] + 1;
      if (g[nk] == null || t < g[nk]) { came[nk] = ck; g[nk] = t; push([t + Math.abs(gu - nu) + Math.abs(gv - nv), nu, nv]); }
    }
  }
  return null;
}
export function hoodAt(W, u, v) { const x = W.walk[key(Math.floor(u), Math.floor(v))]; return x == null || x < 0 ? null : W.hoods[x]; }
// a stroll target: a waypoint on the spine, or a point on the hub apron
export function randomStreet(W, hood, r) {
  const pick = r() < 0.4 ? { u: hood.streetU, v: hood.hubV - 1 } : { u: hood.streetU, v: hood.v0 + 1 + Math.floor(r() * (hood.hubV - 1 - hood.v0)) };
  return { u: pick.u + 0.5, v: pick.v + 0.5 };
}
export function deskOf(W, s) { const room = W.offices[s.plot], k = INITIAL.filter((x) => x.plot === s.plot).findIndex((x) => x.id === s.id); return room.desks[Math.max(0, k)]; }
