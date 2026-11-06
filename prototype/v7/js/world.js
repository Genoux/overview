// World v7: only the grid. One island per machine, project plots in two columns, and a commons with four zones.
// A zone is a marked square on the ground that advertises what it restores (see ZONES); there is no scenery.
import { HOSTS, PROJECTS, INITIAL } from './core.js';

export const OD = 4;          // plot depth
export const SLOT = 2;        // desk pitch
const GAP = 6, COMMONS = 8;
export function officeW(n) { return Math.max(5, SLOT * n + 2); }
export function key(u, v) { return u + ',' + v; }

// What each zone restores, per second spent there (needs run from 0 = empty to 1 = full).
// circle and play get better with company: `perPeer` is added for each other creature present (up to 3).
export const ZONES = {
  rest:   { glyph: 'z',    label: 'resting',                offers: { energy: 0.024 },              perPeer: {} },
  snack:  { glyph: 'food', label: 'having a snack',         offers: { hunger: 0.032 },              perPeer: { social: 0.002 } },
  circle: { glyph: 'dots', label: 'chatting in the circle', offers: { social: 0.004, fun: 0.002 },  perPeer: { social: 0.007 } },
  play:   { glyph: 'note', label: 'playing',                offers: { fun: 0.012, social: 0.002 },  perPeer: { fun: 0.01, social: 0.003 } }
};
// spots inside a 3x3 zone, relative to its corner; everyone faces the middle cell
const ZONE_SPOTS = {
  rest: [[0, 0], [2, 0], [0, 2], [2, 2]],
  snack: [[0, 1], [2, 1], [1, 2]],
  circle: [[1, 0], [2, 1], [1, 2], [0, 1]],
  play: [[0, 1], [2, 1], [1, 0], [1, 2]]
};

export function buildWorld() {
  const W = { hoods: [], rooms: [], zones: [], offices: {}, bridges: [], walk: {}, blocked: {}, roomAt: {}, spots: [] };
  const sessionsOf = (pid) => INITIAL.filter((s) => s.plot === pid);
  const CW = Math.max(6, ...PROJECTS.map((p) => officeW(sessionsOf(p.id).length)));
  const IW = 2 * CW + 4;
  const plans = HOSTS.map((h, i) => {
    const ps = PROJECTS.filter((p) => p.host === h.id), rows = Math.ceil(ps.length / 2);
    return { h, i, ps, rows, D: 1 + rows * (OD + 2) + COMMONS + 1 };
  });
  const rowD = []; plans.forEach((p) => { const r = Math.floor(p.i / 2); rowD[r] = Math.max(rowD[r] || 0, p.D); });

  plans.forEach((p) => {
    const row = Math.floor(p.i / 2); let V0 = 0; for (let q = 0; q < row; q++) V0 += rowD[q] + GAP;
    const U0 = (p.i % 2) * (IW + GAP);
    const isl = { h: p.h, idx: p.i, u0: U0, v0: V0, u1: U0 + IW, v1: V0 + p.D, rooms: [], zones: [], mid: U0 + 1 + CW + 1 };
    for (let u = isl.u0; u < isl.u1; u++) for (let v = isl.v0; v < isl.v1; v++) W.walk[key(u, v)] = p.i;
    // project plots, two columns; one desk per session, a visitor spot in front of each desk
    p.ps.forEach((proj, j) => {
      const n = sessionsOf(proj.id).length, w = officeW(n), c = j % 2, r = Math.floor(j / 2);
      const u0 = U0 + 1 + c * (CW + 2) + Math.floor((CW - w) / 2), v0 = V0 + 1 + r * (OD + 2);
      const room = { kind: 'office', project: proj.id, hood: isl, u0, v0, w, d: OD, spots: [] };
      for (let u = u0; u < u0 + w; u++) for (let v = v0; v < v0 + OD; v++) W.roomAt[key(u, v)] = room;
      room.desks = []; for (let k = 0; k < n; k++) room.desks.push({ u: u0 + 1.5 + SLOT * k, v: v0 + 1.75 });
      room.visit = room.desks.map((dk) => addSpot(W, room, dk.u - 0.5, dk.v + 1.5, 'visit', 1));
      W.offices[proj.id] = room; isl.rooms.push(room); W.rooms.push(room);
    });
    // the commons: four 3x3 zones in a 2x2 layout with walkways between them
    const cv0 = V0 + 1 + p.rows * (OD + 2), cu0 = U0 + 1, commons = { kind: 'commons', hood: isl, u0: cu0, v0: cv0, w: IW - 2, d: COMMONS - 1, spots: [] };
    for (let u = cu0; u < cu0 + commons.w; u++) for (let v = cv0; v < cv0 + commons.d; v++) W.roomAt[key(u, v)] = commons;
    const right = cu0 + commons.w - 4, layout = [['circle', cu0 + 1, cv0], ['play', right, cv0], ['rest', cu0 + 1, cv0 + 4], ['snack', right, cv0 + 4]];
    for (const [kind, zu, zv] of layout) {
      const z = { kind: 'zone', zone: kind, hood: isl, u0: zu, v0: zv, w: 3, d: 3, spots: [], cu: zu + 1.5, cv: zv + 1.5 };
      for (let u = zu; u < zu + 3; u++) for (let v = zv; v < zv + 3; v++) W.roomAt[key(u, v)] = z;
      for (const [du, dv] of ZONE_SPOTS[kind]) { const su = zu + du + 0.5, sv = zv + dv + 0.5; addSpot(W, z, su, sv, kind, Math.sign((z.cu - z.cv) - (su - sv)) || 1); }
      isl.zones.push(z); W.zones.push(z);
    }
    isl.rooms.push(commons); W.rooms.push(commons); isl.commons = commons;
    W.hoods.push(isl);
  });
  // bridges: neighbour along u near the bottom, neighbour along v through the middle street
  W.hoods.forEach((a, i) => {
    const right = W.hoods[i + 1], down = W.hoods[i + 2];
    if (right && i % 2 === 0) { const bv = Math.min(a.v1, right.v1) - 1, br = { a, b: right, cells: [], axis: 'u' }; for (let u = a.u1; u < right.u0; u++) { W.walk[key(u, bv)] = -1; br.cells.push([u, bv]); } W.bridges.push(br); }
    if (down) { const bu = a.mid, br = { a, b: down, cells: [], axis: 'v' }; for (let v = a.v1; v < down.v0; v++) { W.walk[key(bu, v)] = -1; br.cells.push([bu, v]); } W.bridges.push(br); }
  });
  return W;
}

function addSpot(W, room, u, v, kind, face) { const s = { u, v, kind, room, occ: null, face: face || 1 }; room.spots.push(s); W.spots.push(s); return s; }

/* ---------------- pathfinding: A* with a binary heap ---------------- */
export function passable(W, u, v) { const k = key(Math.floor(u), Math.floor(v)); return W.walk[k] != null && !W.blocked[k]; }
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
      const room = W.roomAt[nk], t = g[ck] + 1 + (room && room.kind === 'office' ? 0.6 : room && room.kind === 'zone' ? 0.3 : 0);
      if (g[nk] == null || t < g[nk]) { came[nk] = ck; g[nk] = t; push([t + Math.abs(gu - nu) + Math.abs(gv - nv), nu, nv]); }
    }
  }
  return null;
}
export function hoodAt(W, u, v) { const x = W.walk[key(Math.floor(u), Math.floor(v))]; return x == null || x < 0 ? null : W.hoods[x]; }
// a free cell on the island's streets or the open part of its commons
export function randomStreet(W, hood, r) {
  for (let t = 0; t < 60; t++) {
    const u = Math.floor(hood.u0 + r() * (hood.u1 - hood.u0)), v = Math.floor(hood.v0 + r() * (hood.v1 - hood.v0)), k = key(u, v), room = W.roomAt[k];
    if (W.walk[k] != null && !W.blocked[k] && (!room || room.kind === 'commons')) return { u: u + 0.5, v: v + 0.5 };
  }
  return { u: hood.mid + 0.5, v: hood.v0 + 0.5 };
}
export function deskOf(W, s) { const room = W.offices[s.plot], k = INITIAL.filter((x) => x.plot === s.plot).findIndex((x) => x.id === s.id); return room.desks[Math.max(0, k)]; }
