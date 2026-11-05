// Life: what every creature does with its time. Desk states (running, waiting, failed) always win;
// free creatures (done) pick activities by personality; asleep ones sleep. Groups that settle in the
// same room talk, using lines drawn from the real sessions.
import { G, hash, rng, pick, wantsDesk, hourNow, isLunch, hostOf, reduce } from './core.js';
import { gene } from './creatures.js';
import { findPath, deskOf, hoodAt, randomStreet, key } from './world.js';

const W = () => G.world;
const aff = {};                       // friendship: pair key -> seconds spent talking
const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
export function affinity(a, b) { return aff[pairKey(a, b)] || 0; }
export function bestFriend(id) { let best = null, bv = 4; for (const s of G.S) { if (s.id === id) continue; const v = affinity(id, s.id); if (v > bv) { bv = v; best = s; } } return best; }

export function body(s) {
  if (G.bodies[s.id]) return G.bodies[s.id];
  const d = deskOf(W(), s), b = { id: s.id, u: d.u, v: d.v, path: [], act: { type: 'none', until: 0 }, face: 1, atDesk: true, moving: false, r: rng(hash(s.id + '/life')), emote: null, say: null, spot: null, seated: false, waveCD: 0, thinkAt: 0 };
  G.bodies[s.id] = b;
  return b;
}
function home(s) { return W().offices[s.plot].hood; }
function hoodOf(b) { return hoodAt(W(), b.u, b.v); }
function goTo(b, u, v) { const p = findPath(W(), b.u, b.v, u, v); b.path = p || []; if (!p) { leave(b); b.noPath = true; } return !!p; }
function claim(b, spot) { leave(b); spot.occ = b.id; b.spot = spot; }
function leave(b) { if (b.spot && b.spot.occ === b.id) b.spot.occ = null; b.spot = null; b.seated = false; }
function freeSpot(room, kind) { if (!room) return null; const free = room.spots.filter((x) => (!kind || x.kind === kind) && !x.occ); return free.length ? free[Math.floor(Math.random() * free.length)] : null; }
export function emote(b, g, dur, delay) { const t = G.t + (delay || 0); b.emote = { g, from: t, until: t + (dur || 1.6) }; }

/* ---------------- conversation lines, from the real sessions ---------------- */
const SMALL = ['coffee?', 'nice grid today', 'lunch soon?', 'who broke main?', 'git pull first', 'tabs or spaces?', 'one more test', 'brb', 'ha!', 'same', 'true true', 'love this spot', 'ship it?', 'rebase or merge?'];
const REPLY = ['yes!', 'always', 'no idea', 'later', 'sure', 'hmm', 'ha, same', 'never'];
const trunc = (t) => (t.length > 22 ? t.slice(0, 21) + '…' : t);
function short(title) { return title.toLowerCase().split(' ').slice(0, 3).join(' '); }
function selfLine(s, r) {
  const pool = [];
  if (s.state === 'done') { pool.push(short(s.title) + ' done', 'shipped it!', 'waiting for review'); const f = /(\d+) files?/.exec(s.summary || ''), t = /(\d+) tests?/.exec(s.summary || ''); if (f) pool.push(f[1] + ' files to review'); if (t) pool.push(t[1] + ' tests pass'); }
  else if (s.state === 'idle') pool.push('so sleepy', s.plot + ' can wait');
  else pool.push('back to ' + s.plot + ' soon');
  return pick(r, pool);
}
function gossipLine(s, r) {
  const o = pick(r, G.S.filter((x) => x.id !== s.id)), n = gene(o.id).name;
  const lines = {
    wait: [n + ' waits on John', 'John, check ' + o.plot + '!'], err: [n + ' melted :(', 'poor ' + n, o.plot + ' is red'],
    run: [n + ' is heads-down', n + ' on ' + o.plot], done: [n + ' finished too', 'go ' + n + '!'], idle: [n + ' sleeps a lot']
  };
  return pick(r, lines[o.state]);
}
function smallLine(s, r) {
  const h = hostOf(s), pool = SMALL.slice();
  if (h.lat) pool.push('ssh ' + h.lat + '… slow');
  const hr = hourNow(); if (hr > 20 || hr < 6) pool.push('night shift?'); if (isLunch(hr)) pool.push('so hungry');
  return pick(r, pool);
}
function lineFor(s, prev, r) {
  if (prev && /\?$/.test(prev) && r() < 0.7) return pick(r, REPLY);
  const x = r(); return trunc(x < 0.35 ? selfLine(s, r) : x < 0.65 ? gossipLine(s, r) : smallLine(s, r));
}
const REACT = ['heart', 'star', 'q', 'bang', 'dots', 'note'];

/* ---------------- choosing what to do ---------------- */
function choose(b, s, t) {
  const g = gene(s.id), hd = hoodOf(b) || home(s), hm = home(s), r = b.r, lunch = isLunch(hourNow());
  const working = G.S.filter((o) => wantsDesk(o) && o.state === 'run' && affinity(s.id, o.id) > 2);
  const opts = [['cafe', 0.9 + g.social], ['wander', 0.7], ['desk', 0.15], ['visit', 0.1 + 0.6 * g.curious]];
  if (hm.park || hd.park) opts.push(['park', 0.5 + 0.5 * g.sleepy]);
  if (hm.canteen || hd.canteen) opts.push(['canteen', lunch ? 3.5 : 0.25]);
  if (working.length) opts.push(['greet', 0.3 + 0.6 * g.social]);
  let tot = opts.reduce((a, o) => a + o[1], 0), x = r() * tot, pickd = 'wander';
  for (const o of opts) { x -= o[1]; if (x <= 0) { pickd = o[0]; break; } }
  leave(b);
  const occ = (room) => room.spots.filter((x) => x.occ).length;
  const near = (kind) => { const rooms = W().hoods.map((h) => h[kind]).filter(Boolean); if (!rooms.length) return null; let best = hm[kind] || hd[kind] || rooms[0], bv = -1; for (const rm of rooms) { const v = occ(rm) * (1 + g.social) + (rm.hood === hm ? 0.6 : rm.hood === hd ? 0.3 : 0) + r() * 0.5; if (v > bv && rm.spots.some((x) => !x.occ)) { bv = v; best = rm; } } return best; };
  if (pickd === 'cafe') {
    const room = near('cafe'), c = room && freeSpot(room, 'counter');
    if (c) { claim(b, c); goTo(b, c.u, c.v); b.act = { type: 'cafe', phase: 'counter', room, until: Infinity, label: 'getting a coffee' }; return; }
    const seat = room && freeSpot(room, 'seat');
    if (seat) { claim(b, seat); goTo(b, seat.u, seat.v); b.act = { type: 'sit', room, until: Infinity, stay: 8 + r() * 10, label: 'having a coffee' }; return; }
    pickd = 'wander';
  }
  if (pickd === 'canteen') {
    const room = near('canteen'), seat = room && freeSpot(room, 'seat');
    if (seat) { claim(b, seat); goTo(b, seat.u, seat.v); b.act = { type: 'sit', room, until: Infinity, stay: 10 + r() * 10, label: 'having lunch', food: true }; return; }
    pickd = 'wander';
  }
  if (pickd === 'park') {
    const room = near('park'), sleepy = g.sleepy > 0.55, spot = room && (sleepy ? freeSpot(room, 'bench') : null) || (room && freeSpot(room, 'stand'));
    if (spot) { claim(b, spot); goTo(b, spot.u, spot.v); b.act = { type: spot.kind === 'bench' ? 'nap' : 'hang', room, until: Infinity, stay: 6 + r() * 8, label: spot.kind === 'bench' ? 'napping in the park' : 'hanging out in the park' }; return; }
    pickd = 'wander';
  }
  if (pickd === 'greet') {
    const f = pick(r, working), room = W().offices[f.plot], spot = room.visit.find((sp) => !sp.occ);
    if (spot) { claim(b, spot); goTo(b, spot.u, spot.v); b.act = { type: 'greet', friend: f.id, until: Infinity, stay: 3.5, label: 'visiting ' + gene(f.id).name + ' at work' }; return; }
    pickd = 'wander';
  }
  if (pickd === 'desk') { const d = deskOf(W(), s); goTo(b, d.u, d.v + 1); b.act = { type: 'pause', until: Infinity, stay: 2.5, label: 'checking its desk' }; return; }
  if (pickd === 'visit') { const others = W().hoods.filter((o) => o !== hd), dest = pick(r, others), c = randomStreet(W(), dest, r); goTo(b, c.u, c.v); b.act = { type: 'pause', until: Infinity, stay: 5 + r() * 5, label: 'visiting ' + dest.h.name }; return; }
  const idlers = G.S.filter((o) => o.id !== s.id && o.state === 'done' && G.bodies[o.id] && !G.bodies[o.id].moving && !G.bodies[o.id].seated && !W().roomAt[key(Math.floor(G.bodies[o.id].u), Math.floor(G.bodies[o.id].v))]);
  if (idlers.length && r() < 0.35 + 0.5 * g.social) { const o = G.bodies[pick(r, idlers).id]; for (const [du, dv] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const tu = Math.floor(o.u) + du, tv = Math.floor(o.v) + dv; if (goTo(b, tu + 0.5, tv + 0.5) && b.path.length) { b.act = { type: 'hang', until: Infinity, stay: 6 + r() * 6, label: 'chatting in the street' }; return; } } }
  const c = randomStreet(W(), hd, r); goTo(b, c.u, c.v); b.act = { type: 'pause', until: Infinity, stay: 1 + r() * 3, label: 'taking a walk' };
}

function speedOf(s) { return (wantsDesk(s) ? 2.4 : 1.3) * gene(s.id).energy; }
function stepAlong(b, s, dt) {
  if (!b.path.length) { b.moving = false; return true; }
  const n = b.path[0], du = n.u - b.u, dv = n.v - b.v, dist = Math.hypot(du, dv), sp = speedOf(s) * dt;
  b.moving = true; const sx = du - dv; if (Math.abs(sx) > 0.01) b.face = sx > 0 ? 1 : -1;
  if (dist <= sp) { b.u = n.u; b.v = n.v; b.path.shift(); } else { b.u += du / dist * sp; b.v += dv / dist * sp; }
  return !b.path.length;
}
function waveCheck(b, t) {
  if (b.waveCD > t) return;
  for (const o of G.S) {
    const ob = G.bodies[o.id]; if (!ob || ob === b || !ob.moving || ob.waveCD > t) continue;
    if (Math.abs(ob.u - b.u) + Math.abs(ob.v - b.v) < 1.3) { emote(b, 'wave', 1.3); emote(ob, 'wave', 1.3, 0.2); b.waveCD = ob.waveCD = t + 10; aff[pairKey(b.id, o.id)] = (aff[pairKey(b.id, o.id)] || 0) + 1; return; }
  }
}

/* ---------------- state changes (called when a session changes) ---------------- */
export function onStateChange(s, prev) {
  const b = body(s), t = G.t;
  if (s.state === 'done' && prev !== 'done') {
    b.act = { type: 'celebrate', until: t + 2.4, label: 'celebrating' }; emote(b, 'star', 2.2);
    for (const o of G.S) { const ob = G.bodies[o.id]; if (ob && o.state === 'done' && o.id !== s.id && hoodOf(ob) === home(s)) emote(ob, 'star', 1.4, 0.3 + Math.random()); }
  } else if (s.state === 'err') {
    emote(b, 'bang', 1.5);
    const friends = G.S.filter((o) => o.state === 'done' && o.id !== s.id).sort((a, c) => affinity(s.id, c.id) - affinity(s.id, a.id)).slice(0, 2);
    const room = W().offices[s.plot];
    friends.forEach((f) => { const fb = body(f), spot = room.visit.find((sp) => !sp.occ); if (spot) { leave(fb); claim(fb, spot); goTo(fb, spot.u, spot.v); fb.act = { type: 'comfort', friend: s.id, until: Infinity, stay: 6, label: 'comforting ' + gene(s.id).name }; } });
  } else if (s.state === 'wait' || (prev === 'idle' && wantsDesk(s))) emote(b, 'bang', 1.6);
}

/* ---------------- reduced motion: everyone settles where they belong ---------------- */
export function settle() {
  for (const s of G.S) {
    const b = body(s); b.path = []; b.moving = false;
    if (wantsDesk(s)) { leave(b); const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.act = { type: 'desk' }; b.face = 1; continue; }
    b.atDesk = false;
    if (b.spot) continue;
    const hm = home(s), room = s.state === 'idle' ? (hm.park || hm.cafe) : (hm.cafe || hm.canteen || hm.park);
    const spot = room && (freeSpot(room, s.state === 'idle' ? 'bench' : 'seat') || freeSpot(room, 'seat') || freeSpot(room, 'bench'));
    if (spot) { claim(b, spot); b.u = spot.u; b.v = spot.v; b.seated = spot.kind === 'seat' || spot.kind === 'bench'; b.face = spot.face; b.act = { type: s.state === 'idle' ? 'sleep' : 'sit', room, until: Infinity, label: s.state === 'idle' ? 'asleep' : 'having a coffee' }; }
  }
}

/* ---------------- the tick ---------------- */
export function simulate(dt, t) {
  for (const s of G.S) {
    const b = body(s);
    if (b.emote && t > b.emote.until) b.emote = null;
    if (b.say && t > b.say.until) b.say = null;
    if (wantsDesk(s)) {
      if (b.act.type !== 'desk') { leave(b); b.act = { type: 'desk' }; if (!b.atDesk) { const d = deskOf(W(), s); goTo(b, d.u, d.v); } }
      if (!b.atDesk) { if (stepAlong(b, s, dt)) { const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.face = 1; } }
      else if (s.state === 'run' && t > b.thinkAt) { if (b.thinkAt) emote(b, b.r() < 0.7 ? 'dots' : 'coffee', 1.4); b.thinkAt = t + 14 + b.r() * 20; }
      continue;
    }
    b.atDesk = false;
    if (b.act.type === 'desk') b.act = { type: 'none', until: 0 };
    if (b.act.type === 'celebrate') { if (t < b.act.until) continue; b.act = { type: 'none', until: 0 }; }
    if (s.state === 'idle') {
      if (b.act.type !== 'sleep') { const hm = home(s), room = hm.park || hm.cafe, spot = room && (freeSpot(room, 'bench') || freeSpot(room, 'seat')); if (spot) { claim(b, spot); if (!goTo(b, spot.u, spot.v)) leave(b); } b.act = { type: 'sleep', until: Infinity, label: 'asleep' }; }
      if (stepAlong(b, s, dt) && b.spot) { b.seated = true; b.face = b.spot.face; }
      continue;
    }
    if (b.act.type === 'sleep') b.act = { type: 'none', until: 0 };
    if (b.path.length) { stepAlong(b, s, dt); b.seated = false; waveCheck(b, t); continue; }
    b.moving = false;
    if (b.noPath) { b.noPath = false; b.act = { type: 'pause', until: t + 1, label: 'looking around' }; continue; }
    // arrived somewhere: start the stay timer
    if (b.act.until === Infinity) {
      if (b.act.type === 'cafe' && b.act.phase === 'counter') {
        b.act = { type: 'cafe', phase: 'coffee', room: b.act.room, until: t + 2, label: 'getting a coffee' }; emote(b, 'coffee', 1.8); b.face = 1;
      } else {
        b.act.until = t + (b.act.stay || 3);
        if (b.spot) { b.seated = b.spot.kind === 'seat' || b.spot.kind === 'bench'; b.face = b.spot.face; }
        if (b.act.food) emote(b, 'food', 1.6);
        if (b.act.type === 'greet' || b.act.type === 'comfort') { const fb = G.bodies[b.act.friend]; emote(b, b.act.type === 'greet' ? 'wave' : 'heart', 2); if (fb) emote(fb, b.act.type === 'greet' ? 'wave' : 'heart', 1.6, 0.6); b.face = 1; }
      }
    }
    if (t >= b.act.until) {
      if (b.act.type === 'cafe' && b.act.phase === 'coffee') {
        const seat = freeSpot(b.act.room, 'seat');
        if (seat) { claim(b, seat); goTo(b, seat.u, seat.v); b.act = { type: 'sit', room: b.act.room, until: Infinity, stay: 8 + b.r() * 10, label: 'having a coffee' }; continue; }
      }
      choose(b, s, t);
    }
  }
  converse(t, dt);
}

/* ---------------- conversations: groups that share a room talk in turns ---------------- */
const convs = {};
function converse(t, dt) {
  const groups = {};
  for (const s of G.S) {
    const b = G.bodies[s.id]; if (!b || b.moving || wantsDesk(s) || s.state === 'idle' || b.act.type === 'nap') continue;
    const room = W().roomAt[key(Math.floor(b.u), Math.floor(b.v))];
    if (room && room.kind === 'office') continue;
    if (room) { (groups[room.u0 + ',' + room.v0] = groups[room.u0 + ',' + room.v0] || []).push(s); continue; }
    let gk = null; for (const k in groups) { if (!k.startsWith('st')) continue; const f = G.bodies[groups[k][0].id]; if (Math.abs(f.u - b.u) + Math.abs(f.v - b.v) < 2.6) { gk = k; break; } }
    (groups[gk || 'st' + s.id] = groups[gk || 'st' + s.id] || []).push(s);
  }
  for (const k in convs) if (!groups[k] || groups[k].length < 2) delete convs[k];
  for (const k in groups) {
    const members = groups[k]; if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) { const pk = pairKey(members[i].id, members[j].id); aff[pk] = (aff[pk] || 0) + dt; }
    const c = convs[k] || (convs[k] = { next: t + 0.8, last: null, prev: null });
    if (t < c.next) continue;
    const cands = members.filter((m) => m.id !== c.last), r = G.bodies[cands[0].id].r;
    let tot = cands.reduce((a, m) => a + gene(m.id).talk, 0), x = r() * tot, sp = cands[0];
    for (const m of cands) { x -= gene(m.id).talk; if (x <= 0) { sp = m; break; } }
    const text = lineFor(sp, c.prev, r), sb = G.bodies[sp.id];
    sb.say = { text, until: t + 2.6 };
    for (const m of members) { if (m.id === sp.id) continue; const mb = G.bodies[m.id]; mb.face = Math.sign((sb.u - sb.v) - (mb.u - mb.v)) || mb.face; if (r() < 0.3) emote(mb, pick(r, REACT), 1.2, 1); }
    c.last = sp.id; c.prev = text; c.next = t + 2.8 + r() * 0.8;
  }
}

export function activity(s) {
  const b = G.bodies[s.id]; if (!b) return '';
  if (wantsDesk(s)) return b.atDesk ? (s.state === 'run' ? 'typing at its slab' : s.state === 'wait' ? 'waiting for you' : 'melted at its desk') : 'hurrying back to its desk';
  if (s.state === 'idle') return b.path.length ? 'shuffling off to sleep' : 'asleep';
  if (b.say) return 'saying "' + b.say.text + '"';
  return b.act.label || 'idling';
}
