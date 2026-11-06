// World v10: a tiny, dense world after Hangar's floor. One island per machine, side by side; no bridges: each machine's
// blobs keep to their own island.
// Each island holds its workspaces (project plots) in two tidy columns. A plot is three rows deep: a margin behind,
// the desks (each blob's home, beside its slab, as in Hangar), and a front row where visitors stand.
import { HOSTS, PROJECTS, INITIAL } from './core.js';

export const OD = 3;          // plot depth: margin, desks, front row
export const SLOT = 2;        // desk pitch
const GAP = 2;                // empty grid between islands
export function officeW(n) { return Math.max(5, SLOT * n + 1); }
export function key(u, v) { return u + ',' + v; }

export function buildWorld() {
  const W = { hoods: [], rooms: [], offices: {}, bridges: [], walk: {}, blocked: {}, roomAt: {}, spots: [] };
  const sessionsOf = (pid) => INITIAL.filter((s) => s.plot === pid);
  let U = 0;
  HOSTS.forEach((host, i) => {
    const ps = PROJECTS.filter((p) => p.host === host.id), rows = Math.max(1, Math.ceil(ps.length / 2));
    // even sizes from an even start: the background grid draws a line every 2 cells, so every island corner lands on one
    const even = (n) => n + (n % 2);
    const CW = Math.max(...ps.map((p) => officeW(sessionsOf(p.id).length))), IW = even(2 * CW + 3), D = even(1 + rows * (OD + 1));
    const isl = { h: host, idx: i, u0: U, v0: 0, u1: U + IW, v1: D, rooms: [], mid: U + 1 + CW };
    for (let u = isl.u0; u < isl.u1; u++) for (let v = isl.v0; v < isl.v1; v++) W.walk[key(u, v)] = i;
    ps.forEach((proj, j) => {
      const n = sessionsOf(proj.id).length, w = officeW(n), c = j % 2, r = Math.floor(j / 2);
      const u0 = U + 1 + c * (CW + 1), v0 = 1 + r * (OD + 1);
      const room = { kind: 'office', project: proj.id, hood: isl, u0, v0, w, d: OD, spots: [] };
      for (let u = u0; u < u0 + w; u++) for (let v = v0; v < v0 + OD; v++) W.roomAt[key(u, v)] = room;
      room.desks = []; for (let k = 0; k < n; k++) room.desks.push({ u: u0 + 1.5 + SLOT * k, v: v0 + 1.5 });
      // each blob's home is its desk, right beside its slab (it naps or plays there when free); the front row is for visitors
      room.home = room.desks.map((dk) => addSpot(W, room, dk.u, dk.v, 'home', 1));
      room.guest = []; for (let u = u0; u < u0 + w; u++) room.guest.push(addSpot(W, room, u + 0.5, v0 + 2.5, 'guest', 1));
      room.visit = room.desks.map((dk, k) => room.guest.find((g) => Math.abs(g.u - dk.u) <= 1.01) || room.home[k]);
      W.offices[proj.id] = room; isl.rooms.push(room); W.rooms.push(room);
    });
    W.hoods.push(isl);
    U += IW + GAP;
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
      // walking through someone else's plot costs a little more, so blobs keep to the streets
      const room = W.roomAt[nk], t = g[ck] + 1 + (room ? 0.6 : 0);
      if (g[nk] == null || t < g[nk]) { came[nk] = ck; g[nk] = t; push([t + Math.abs(gu - nu) + Math.abs(gv - nv), nu, nv]); }
    }
  }
  return null;
}
export function hoodAt(W, u, v) { const x = W.walk[key(Math.floor(u), Math.floor(v))]; return x == null || x < 0 ? null : W.hoods[x]; }
export function deskOf(W, s) { const room = W.offices[s.plot], k = INITIAL.filter((x) => x.plot === s.plot).findIndex((x) => x.id === s.id); return room.desks[Math.max(0, k)]; }
export function homeOf(W, s) { const room = W.offices[s.plot], k = INITIAL.filter((x) => x.plot === s.plot).findIndex((x) => x.id === s.id); return room.home[Math.max(0, k)]; }
