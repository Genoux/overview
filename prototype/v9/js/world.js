// World v9: one island per machine holds that machine's project plots (plain plates, no scenery); every machine connects
// by a bridge to ONE shared hub in the middle: a park where free blobs gather and do what they like before going back to work.
// Only the hub is dressed, with tiles from the isometric tileset in assets/ (see assets/CREDITS.md): see dressHub().
// The park is one of the authored compositions in hubmaps.js (G.hub picks it, ?hub= in the URL). Any open cell is a spot a
// blob can take; life.js decides which (near friends, by the water, somewhere quiet).
import { G, HOSTS, PROJECTS, INITIAL, hash } from './core.js';
import { HUBS, DEFAULT_HUB, GROUND_TILES, PROP_TILES, BLOCKING_GROUND, BLOCKING_PROPS } from './hubmaps.js';

export const OD = 4;          // plot depth
export const SLOT = 2;        // desk pitch
const GAP = 5;
export function officeW(n) { return Math.max(8, SLOT * n + 2); }   // 8 wide at least: room for the name on the floor
export function key(u, v) { return u + ',' + v; }

export function buildWorld() {
  const W = { hoods: [], rooms: [], offices: {}, bridges: [], walk: {}, blocked: {}, roomAt: {}, spots: [] };
  const sessionsOf = (pid) => INITIAL.filter((s) => s.plot === pid);
  const CW = Math.max(8, ...PROJECTS.map((p) => officeW(sessionsOf(p.id).length)));
  const IW = 2 * CW + 4;
  // the hub: one square park centred on (0,0)
  const HS = 17, h0 = -Math.floor(HS / 2);
  const hub = { kind: 'hub', h: { id: 'hub', name: 'the hub' }, u0: h0, v0: h0, u1: h0 + HS, v1: h0 + HS, spots: [], rooms: [] };
  hub.cu = h0 + Math.floor(HS / 2); hub.cv = hub.cu;   // the middle cell: bridges arrive in line with it
  for (let u = hub.u0; u < hub.u1; u++) for (let v = hub.v0; v < hub.v1; v++) W.walk[key(u, v)] = 'hub';
  W.hub = hub;
  // machines around the hub: north, east, south, west (then further out on the same axes)
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]], reach = [0, 0, 0, 0];
  HOSTS.forEach((host, i) => {
    const ps = PROJECTS.filter((p) => p.host === host.id), rows = Math.max(1, Math.ceil(ps.length / 2)), D = 1 + rows * (OD + 2);
    const dir = i % 4, [du, dv] = DIRS[dir], streetV = 1 + OD;   // the first street row of an island, where an east/west bridge lands
    let U0, V0;
    if (du === 0) { U0 = hub.cu - (1 + CW + 1); V0 = dv < 0 ? hub.v0 - GAP - D - reach[dir] : hub.v1 + GAP + reach[dir]; reach[dir] += D + GAP; }
    else { V0 = hub.cv - streetV; U0 = du < 0 ? hub.u0 - GAP - IW - reach[dir] : hub.u1 + GAP + reach[dir]; reach[dir] += IW + GAP; }
    const isl = { h: host, idx: i, dir, u0: U0, v0: V0, u1: U0 + IW, v1: V0 + D, rooms: [], mid: U0 + 1 + CW + 1, street: V0 + streetV };
    for (let u = isl.u0; u < isl.u1; u++) for (let v = isl.v0; v < isl.v1; v++) W.walk[key(u, v)] = i;
    // project plots, two columns; one desk per session, a visitor spot in front of each desk
    ps.forEach((proj, j) => {
      const n = sessionsOf(proj.id).length, w = officeW(n), c = j % 2, r = Math.floor(j / 2);
      const u0 = U0 + 1 + c * (CW + 2) + Math.floor((CW - w) / 2), v0 = V0 + 1 + r * (OD + 2);
      const room = { kind: 'office', project: proj.id, hood: isl, u0, v0, w, d: OD, spots: [] };
      for (let u = u0; u < u0 + w; u++) for (let v = v0; v < v0 + OD; v++) W.roomAt[key(u, v)] = room;
      room.desks = []; for (let k = 0; k < n; k++) room.desks.push({ u: u0 + 1.5 + SLOT * k, v: v0 + 1.75 });
      room.visit = room.desks.map((dk) => addSpot(W, room, dk.u - 0.5, dk.v + 1.5, 'visit', 1));
      W.offices[proj.id] = room; isl.rooms.push(room); W.rooms.push(room);
    });
    // the bridge to the hub (or to the island before it on the same axis)
    const br = { a: isl, b: hub, cells: [], axis: du === 0 ? 'v' : 'u' };
    // cells already walkable (an inner island on the same axis) are crossed, not rebuilt
    if (du === 0) { const a = dv < 0 ? isl.v1 : hub.v1, b = dv < 0 ? hub.v0 : isl.v0; for (let v = Math.min(a, b); v < Math.max(a, b); v++) if (W.walk[key(isl.mid, v)] == null) { W.walk[key(isl.mid, v)] = -1; br.cells.push([isl.mid, v]); } }
    else { const a = du < 0 ? isl.u1 : hub.u1, b = du < 0 ? hub.u0 : isl.u0; for (let u = Math.min(a, b); u < Math.max(a, b); u++) if (W.walk[key(u, isl.street)] == null) { W.walk[key(u, isl.street)] = -1; br.cells.push([u, isl.street]); } }
    W.bridges.push(br);
    W.hoods.push(isl);
  });
  dressHub(W, hub);
  // every open cell of the park is a spot
  for (let u = hub.u0; u < hub.u1; u++) for (let v = hub.v0; v < hub.v1; v++) if (!W.blocked[key(u, v)]) addSpot(W, hub, u + 0.5, v + 0.5, 'park', (u + v) % 2 ? 1 : -1);
  return W;
}

// The hub's dress: the chosen composition from hubmaps.js, cell by cell. Colours are the artist's, untouched.
function dressHub(W, hub) {
  W.tiles = []; W.props = [];
  const map = HUBS[G.hub] || HUBS[DEFAULT_HUB], pickOf = (list, u, v, salt) => list[hash(u + ',' + v + salt) % list.length];
  for (let v = 0; v < map.ground.length; v++) for (let u = 0; u < map.ground[v].length; u++) {
    const cu = hub.u0 + u, cv = hub.v0 + v, g = map.ground[v][u], p = map.props[v][u];
    W.tiles.push({ u: cu, v: cv, tile: pickOf(GROUND_TILES[g], u, v, g), water: 'vwWrR'.includes(g) });
    if (p !== ' ') W.props.push({ u: cu, v: cv, tile: pickOf(PROP_TILES[p], u, v, p), kind: p });
    if (BLOCKING_GROUND.includes(g) || BLOCKING_PROPS.includes(p)) W.blocked[key(cu, cv)] = true;
  }
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
export function hoodAt(W, u, v) { const x = W.walk[key(Math.floor(u), Math.floor(v))]; return x === 'hub' ? W.hub : x == null || x < 0 ? null : W.hoods[x]; }
// a free cell on an island's streets or the hub's walkways
export function randomStreet(W, hood, r) {
  for (let t = 0; t < 60; t++) {
    const u = Math.floor(hood.u0 + r() * (hood.u1 - hood.u0)), v = Math.floor(hood.v0 + r() * (hood.v1 - hood.v0)), k = key(u, v), room = W.roomAt[k];
    if (W.walk[k] != null && !W.blocked[k] && !room) return { u: u + 0.5, v: v + 0.5 };
  }
  return hood.kind === 'hub' ? { u: hood.cu + 0.5, v: hood.cv + 0.5 } : { u: hood.mid + 0.5, v: hood.v0 + 0.5 };
}
export function deskOf(W, s) { const room = W.offices[s.plot], k = INITIAL.filter((x) => x.plot === s.plot).findIndex((x) => x.id === s.id); return room.desks[Math.max(0, k)]; }
