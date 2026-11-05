// Life v6: a needs-based society (the model behind The Sims). Every creature has four needs that drain over time:
// energy, hunger, social, fun (1 = fully met). Places advertise what they restore; a creature scores every option
// by how urgent its needs are and by its personality, then picks among its top three, so it is never robotic.
// Desk states (running, waiting, failed) always win; asleep sessions sleep. Real data drives the needs:
// long work sessions drain energy, lunch time drains hunger, a long wait worries friends.
import { G, hash, rng, pick, wantsDesk, hourNow, isLunch, hostOf } from './core.js';
import { gene } from './creatures.js';
import { findPath, deskOf, hoodAt, randomStreet, key, SIGNATURES } from './world.js';

const W = () => G.world;
const NEEDS = ['energy', 'hunger', 'social', 'fun'];
const aff = {};
const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
export function affinity(a, b) { return aff[pairKey(a, b)] || 0; }
export function bestFriend(id) { let best = null, bv = 4; for (const s of G.S) { if (s.id === id) continue; const v = affinity(id, s.id); if (v > bv) { bv = v; best = s; } } return best; }

export function body(s) {
  if (G.bodies[s.id]) return G.bodies[s.id];
  const d = deskOf(W(), s), r = rng(hash(s.id + '/life'));
  const b = { id: s.id, u: d.u, v: d.v, path: [], act: { type: 'none', until: 0 }, face: 1, atDesk: true, moving: false, r, emote: null, say: null, spot: null, seated: false, waveCD: 0, thinkAt: 0,
    needs: { energy: 0.45 + r() * 0.5, hunger: 0.45 + r() * 0.5, social: 0.4 + r() * 0.5, fun: 0.4 + r() * 0.5 } };
  G.bodies[s.id] = b;
  return b;
}
const home = (s) => W().offices[s.plot].hood;
const hoodOf = (b) => hoodAt(W(), b.u, b.v);
function goTo(b, u, v) { const p = findPath(W(), b.u, b.v, u, v); b.path = p || []; if (!p) { leave(b); b.noPath = true; } return !!p; }
function claim(b, spot) { leave(b); spot.occ = b.id; b.spot = spot; }
function leave(b) { if (b.spot && b.spot.occ === b.id) b.spot.occ = null; b.spot = null; b.seated = false; }
const freeSpots = (room, kind) => (room ? room.spots.filter((x) => (!kind || x.kind === kind) && !x.occ) : []);
export function emote(b, g, dur, delay) { const t = G.t + (delay || 0); b.emote = { g, from: t, until: t + (dur || 1.6) }; }
const clamp = (x) => Math.max(0, Math.min(1, x));

/* ---------------- plants: one per desk; done plants bear fruit that regrows ---------------- */
export function plantState(p) {
  const s = sessionAtDesk(p); if (!s) return 'idle:0:0';
  if (s.state === 'run') return 'run:' + Math.min(3, Math.floor(s.since / 8)) + ':0';
  if (s.state === 'done') return 'done:3:' + (p.fruit == null ? (p.fruit = 2) : p.fruit);
  return s.state + ':2:0';
}
function sessionAtDesk(p) { const list = G.S.filter((x) => x.plot === p.room.project); return list[p.k]; }

/* ---------------- what each option offers, per second spent there ---------------- */
function options(s, b) {
  const hm = home(s), hd = hoodOf(b) || hm, lunch = isLunch(hourNow()), out = [];
  const crowd = (room) => room.spots.filter((x) => x.occ).length;
  for (const h of W().hoods) {
    const far = h === hd ? 0 : 1;
    if (h.commons) {
      const c = crowd(h.commons), ben = freeSpots(h.commons, 'bench'), st = freeSpots(h.commons, 'stand');
      if (ben.length) out.push({ type: 'bench', room: h.commons, spot: ben, offers: { energy: 0.045, social: 0.01 + 0.01 * c }, far, label: 'resting on a bench' });
      if (st.length) out.push({ type: 'chat', room: h.commons, spot: st, offers: { social: 0.015 + 0.02 * Math.min(3, c), fun: 0.01 }, far, label: 'hanging out at the commons' });
    }
    if (h.sigRoom) { const sp = freeSpots(h.sigRoom, 'sig'); if (sp.length) out.push({ type: 'sig', room: h.sigRoom, spot: sp, offers: h.sigRoom.offers, far, label: SIGNATURES[h.sig].verb + ' ' + SIGNATURES[h.sig].name }); }
  }
  for (const p of W().plants) {
    if (!p.fruit || plantState(p).indexOf('done') !== 0) continue;
    const spot = p.room.harvest[p.k]; if (spot.occ) continue;
    out.push({ type: 'harvest', plant: p, spot: [spot], offers: { hunger: lunch ? 0.12 : 0.08 }, far: p.room.hood === hd ? 0 : 1, label: 'picking fruit at ' + p.room.project });
  }
  for (const o of G.S) {
    if (o.id === s.id || o.state !== 'run' || affinity(s.id, o.id) < 1.5) continue;
    const room = W().offices[o.plot], sp = room.visit.filter((x) => !x.occ); if (!sp.length) continue;
    out.push({ type: 'visit', friend: o.id, spot: sp, offers: { social: 0.03 }, far: room.hood === hd ? 0 : 1, label: 'visiting ' + gene(o.id).name + ' at work' });
  }
  out.push({ type: 'walk', offers: { fun: 0.012, energy: -0.004 }, far: 0, label: 'taking a walk' });
  return out;
}
function score(opt, b, g) {
  const trait = { energy: 0.7 + g.sleepy * 0.8, hunger: 0.6 + g.energy * 0.5, social: 0.5 + g.social, fun: 0.5 + g.curious };
  let s = 0;
  for (const n of NEEDS) { const o = opt.offers[n] || 0; if (o > 0) s += o * Math.pow(1 - b.needs[n], 2) * trait[n] * 40; }
  return s - opt.far * (0.12 - g.curious * 0.1);
}
function choose(b, s, t) {
  const g = gene(s.id), opts = options(s, b).map((o) => ({ o, sc: score(o, b, g) })).sort((x, y) => y.sc - x.sc).slice(0, 3);
  leave(b);
  const tot = opts.reduce((a, x) => a + Math.max(0.01, x.sc), 0); let x = b.r() * tot, chosen = opts[0].o;
  for (const it of opts) { x -= Math.max(0.01, it.sc); if (x <= 0) { chosen = it.o; break; } }
  if (chosen.type === 'walk') { const hd = b.r() < 0.25 + g.curious * 0.3 ? pick(b.r, W().hoods) : (hoodOf(b) || home(s)), c = randomStreet(W(), hd, b.r); goTo(b, c.u, c.v); b.act = { type: 'walk', until: Infinity, stay: 1 + b.r() * 2, offers: chosen.offers, label: hd === home(s) ? chosen.label : 'exploring ' + hd.h.name }; return; }
  const spot = pick(b.r, chosen.spot); claim(b, spot); goTo(b, spot.u, spot.v);
  b.act = { type: chosen.type, room: chosen.room, plant: chosen.plant, friend: chosen.friend, until: Infinity, offers: chosen.offers, label: chosen.label, stay: chosen.type === 'harvest' ? 2.5 : chosen.type === 'visit' ? 4 : 30 };
}

/* ---------------- conversation lines, from the real sessions and the needs ---------------- */
const SMALL = ['nice grid today', 'who broke main?', 'git pull first', 'tabs or spaces?', 'one more test', 'brb', 'ha!', 'same', 'true true', 'ship it?', 'rebase or merge?'];
const REPLY = ['yes!', 'always', 'no idea', 'later', 'sure', 'hmm', 'ha, same', 'never'];
const trunc = (t) => (t.length > 22 ? t.slice(0, 21) + '…' : t);
function lineFor(s, prev, r) {
  if (prev && /\?$/.test(prev) && r() < 0.7) return pick(r, REPLY);
  const b = G.bodies[s.id], low = NEEDS.filter((n) => b.needs[n] < 0.35), x = r();
  if (low.length && x < 0.35) return pick(r, { energy: ['need a nap', 'so tired…', 'long day'], hunger: ['so hungry', 'fruit anyone?', 'lunch?'], social: ['missed you all', 'talk to me!'], fun: ['bored…', 'anything new?'] }[pick(r, low)]);
  if (x < 0.55) { const o = pick(r, G.S.filter((y) => y.id !== s.id)), n = gene(o.id).name; return trunc(pick(r, { wait: [n + ' waits on John', 'John, check ' + o.plot + '!'], err: [n + ' wilted :(', 'poor ' + n], run: [o.since > 20 ? n + ' is at it ' + o.since + 'm' : n + ' on ' + o.plot, n + ' is heads-down'], done: [n + "'s plant bloomed", 'go ' + n + '!'], idle: [n + ' sleeps a lot'] }[o.state])); }
  if (x < 0.7 && s.state === 'done') return trunc(pick(r, [s.title.toLowerCase().split(' ').slice(0, 3).join(' ') + ' done', 'my plant bloomed', 'shipped it!']));
  const h = hostOf(s), pool = SMALL.concat(h.lat ? ['ssh ' + h.lat + '… slow'] : []), sig = (hoodOf(G.bodies[s.id]) || home(s)).sig;
  pool.push({ tree: 'love this tree', spring: 'the spring glows', greenhouse: 'fresh fruit in here', grove: 'mushrooms glow', stone: 'the stone hums' }[sig]);
  return trunc(pick(r, pool));
}
const REACT = ['heart', 'star', 'q', 'bang', 'dots', 'note'];

/* ---------------- movement ---------------- */
function speedOf(s, b) { return (wantsDesk(s) ? 2.4 : 1.2 + 0.4 * b.needs.energy) * gene(s.id).energy; }
function stepAlong(b, s, dt) {
  if (!b.path.length) { b.moving = false; return true; }
  const n = b.path[0], du = n.u - b.u, dv = n.v - b.v, dist = Math.hypot(du, dv), sp = speedOf(s, b) * dt;
  b.moving = true; const sx = du - dv; if (Math.abs(sx) > 0.01) b.face = sx > 0 ? 1 : -1;
  if (dist <= sp) { b.u = n.u; b.v = n.v; b.path.shift(); } else { b.u += du / dist * sp; b.v += dv / dist * sp; }
  return !b.path.length;
}
function waveCheck(b, t) {
  if (b.waveCD > t) return;
  for (const o of G.S) { const ob = G.bodies[o.id]; if (!ob || ob === b || !ob.moving || ob.waveCD > t) continue; if (Math.abs(ob.u - b.u) + Math.abs(ob.v - b.v) < 1.3) { emote(b, 'wave', 1.3); emote(ob, 'wave', 1.3, 0.2); b.waveCD = ob.waveCD = t + 10; aff[pairKey(b.id, o.id)] = (aff[pairKey(b.id, o.id)] || 0) + 1; return; } }
}

/* ---------------- state changes ---------------- */
export function onStateChange(s, prev) {
  const b = body(s), t = G.t;
  if (s.state === 'done' && prev !== 'done') {
    b.act = { type: 'celebrate', until: t + 2.4, label: 'celebrating: the plant bloomed' }; emote(b, 'star', 2.2);
    const p = W().plants.find((x) => sessionAtDesk(x) === s); if (p) { p.fruit = 1; p.regrow = t + 25; }
    for (const o of G.S) { const ob = G.bodies[o.id]; if (ob && o.state === 'done' && o.id !== s.id && hoodOf(ob) === home(s)) emote(ob, 'star', 1.4, 0.3 + Math.random()); }
  } else if (s.state === 'err') {
    emote(b, 'bang', 1.5);
    const room = W().offices[s.plot];
    G.S.filter((o) => o.state === 'done' && o.id !== s.id).sort((a, c) => affinity(s.id, c.id) - affinity(s.id, a.id)).slice(0, 2).forEach((f) => {
      const fb = body(f), spot = room.visit.find((sp) => !sp.occ); if (!spot) return;
      leave(fb); claim(fb, spot); goTo(fb, spot.u, spot.v); fb.act = { type: 'comfort', friend: s.id, until: Infinity, stay: 6, offers: { social: 0.02 }, label: 'comforting ' + gene(s.id).name };
    });
  } else if (s.state === 'wait' || (prev === 'idle' && wantsDesk(s))) emote(b, 'bang', 1.6);
}

/* ---------------- reduced motion: settle everyone where they belong ---------------- */
export function settle() {
  for (const s of G.S) {
    const b = body(s); b.path = []; b.moving = false;
    if (wantsDesk(s)) { leave(b); const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.act = { type: 'desk' }; b.face = 1; continue; }
    b.atDesk = false; if (b.spot) continue;
    const room = home(s).commons, spot = freeSpots(room, s.state === 'idle' ? 'bench' : 'stand')[0] || freeSpots(room)[0];
    if (spot) { claim(b, spot); b.u = spot.u; b.v = spot.v; b.seated = spot.kind === 'bench'; b.face = spot.face; b.act = { type: s.state === 'idle' ? 'sleep' : 'chat', room, until: Infinity, label: s.state === 'idle' ? 'asleep' : 'hanging out at the commons' }; }
  }
}

/* ---------------- the tick ---------------- */
export function simulate(dt, t) {
  const lunch = isLunch(hourNow());
  for (const p of W().plants) if (p.regrow && t > p.regrow && p.fruit < 3) { p.fruit++; p.regrow = t + 25; }
  for (const s of G.S) {
    const b = body(s), g = gene(s.id), N = b.needs;
    if (b.emote && t > b.emote.until) b.emote = null;
    if (b.say && t > b.say.until) b.say = null;
    // needs drain: working is tiring (more so in long sessions), lunch makes everyone hungry
    const work = wantsDesk(s) && s.state === 'run' ? 1 + Math.min(2, s.since / 60) : 0;
    N.energy = clamp(N.energy - dt * (0.004 + 0.004 * work + (b.moving ? 0.003 : 0)));
    N.hunger = clamp(N.hunger - dt * (0.0035 + (lunch ? 0.008 : 0)) * (0.7 + g.energy * 0.4));
    N.social = clamp(N.social - dt * 0.006 * (0.5 + g.social));
    N.fun = clamp(N.fun - dt * 0.0045 * (0.5 + g.curious));
    if (wantsDesk(s)) {
      if (b.act.type !== 'desk') { leave(b); b.act = { type: 'desk' }; if (!b.atDesk) { const d = deskOf(W(), s); goTo(b, d.u, d.v); } }
      if (!b.atDesk) { if (stepAlong(b, s, dt)) { const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.face = 1; } }
      else if (s.state === 'run' && t > b.thinkAt) { if (b.thinkAt) emote(b, N.energy < 0.3 ? 'dots' : N.hunger < 0.3 ? 'food' : b.r() < 0.6 ? 'dots' : 'note', 1.4); b.thinkAt = t + 12 + b.r() * 18; }
      continue;
    }
    b.atDesk = false;
    if (b.act.type === 'desk') b.act = { type: 'none', until: 0 };
    if (b.act.type === 'celebrate') { if (t < b.act.until) continue; b.act = { type: 'none', until: 0 }; }
    if (s.state === 'idle') {
      N.energy = clamp(N.energy + dt * 0.02);
      if (b.act.type !== 'sleep') { const room = home(s).commons, spot = freeSpots(room, 'bench')[0] || freeSpots(room, 'stand')[0]; if (spot) { claim(b, spot); if (!goTo(b, spot.u, spot.v)) leave(b); } b.act = { type: 'sleep', until: Infinity, label: 'asleep' }; }
      if (stepAlong(b, s, dt) && b.spot) { b.seated = b.spot.kind === 'bench'; b.face = b.spot.face; }
      continue;
    }
    if (b.act.type === 'sleep') b.act = { type: 'none', until: 0 };
    if (b.path.length) { stepAlong(b, s, dt); b.seated = false; waveCheck(b, t); continue; }
    b.moving = false;
    if (b.noPath) { b.noPath = false; b.act = { type: 'none', until: t + 1 }; continue; }
    if (b.act.until === Infinity) {
      b.act.until = t + (b.act.stay || 3); b.act.arrived = t;
      if (b.spot) { b.seated = b.spot.kind === 'bench'; b.face = b.spot.face; }
      if (b.act.type === 'harvest') { const p = b.act.plant; if (p && p.fruit > 0) { p.fruit--; p.regrow = p.regrow && p.regrow > t ? p.regrow : t + 25; N.hunger = clamp(N.hunger + 0.45); emote(b, 'food', 1.8); } }
      if (b.act.type === 'visit' || b.act.type === 'comfort') { const fb = G.bodies[b.act.friend]; emote(b, b.act.type === 'visit' ? 'wave' : 'heart', 2); if (fb) { emote(fb, b.act.type === 'visit' ? 'wave' : 'heart', 1.6, 0.6); fb.needs.social = clamp(fb.needs.social + 0.3); } b.face = 1; }
      if (b.act.type === 'bench' && N.energy < 0.3) emote(b, 'dots', 1.5);
    }
    // being somewhere restores what that place offers; leave once satisfied
    if (b.act.offers) for (const n of NEEDS) { const o = b.act.offers[n]; if (o) N[n] = clamp(N[n] + o * dt * 1.6); }
    const main = b.act.offers ? NEEDS.reduce((m, n) => ((b.act.offers[n] || 0) > (b.act.offers[m] || 0) ? n : m), 'fun') : null;
    const satisfied = main && N[main] > 0.92 && t > (b.act.arrived || 0) + 3;
    if (t >= b.act.until || satisfied) choose(b, s, t);
  }
  converse(t, dt);
}

/* ---------------- conversations: groups that share a place talk in turns ---------------- */
const convs = {};
function converse(t, dt) {
  const groups = {};
  for (const s of G.S) {
    const b = G.bodies[s.id]; if (!b || b.moving || wantsDesk(s) || s.state === 'idle') continue;
    const room = W().roomAt[key(Math.floor(b.u), Math.floor(b.v))];
    if (room && room.kind === 'office' && b.act.type !== 'visit' && b.act.type !== 'comfort') continue;
    let gk = room && room.kind !== 'office' ? 'r' + room.u0 + ',' + room.v0 : null;
    if (!gk) for (const k in groups) { if (!k.startsWith('st')) continue; const f = G.bodies[groups[k][0].id]; if (Math.abs(f.u - b.u) + Math.abs(f.v - b.v) < 2.6) { gk = k; break; } }
    (groups[gk || 'st' + s.id] = groups[gk || 'st' + s.id] || []).push(s);
  }
  for (const k in convs) if (!groups[k] || groups[k].length < 2) delete convs[k];
  for (const k in groups) {
    const members = groups[k]; if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) { G.bodies[members[i].id].needs.social = clamp(G.bodies[members[i].id].needs.social + dt * 0.02); for (let j = i + 1; j < members.length; j++) { const pk = pairKey(members[i].id, members[j].id); aff[pk] = (aff[pk] || 0) + dt; } }
    const c = convs[k] || (convs[k] = { next: t + 0.8, last: null, prev: null });
    if (t < c.next) continue;
    const cands = members.filter((m) => m.id !== c.last), r = G.bodies[cands[0].id].r;
    let tot = cands.reduce((a, m) => a + gene(m.id).talk, 0), x = r() * tot, sp = cands[0];
    for (const m of cands) { x -= gene(m.id).talk; if (x <= 0) { sp = m; break; } }
    const text = lineFor(sp, c.prev, r), sb = G.bodies[sp.id];
    sb.say = { text, until: t + 2.6 };
    for (const m of members) { if (m.id === sp.id) continue; const mb = G.bodies[m.id]; mb.face = Math.sign((sb.u - sb.v) - (mb.u - mb.v)) || mb.face; if (r() < 0.3) emote(mb, pick(r, REACT), 1.2, 1); mb.needs.fun = clamp(mb.needs.fun + 0.02); }
    c.last = sp.id; c.prev = text; c.next = t + 2.8 + r() * 0.8;
  }
}

export function activity(s) {
  const b = G.bodies[s.id]; if (!b) return '';
  if (wantsDesk(s)) return b.atDesk ? (s.state === 'run' ? (b.needs.energy < 0.3 ? 'working, getting tired' : 'tending its work') : s.state === 'wait' ? 'waiting for you' : 'wilted at its desk') : 'hurrying back to its desk';
  if (s.state === 'idle') return b.path.length ? 'shuffling off to sleep' : 'asleep';
  if (b.say) return 'saying "' + b.say.text + '"';
  return b.act.label || 'idling';
}
export function needsOf(id) { const b = G.bodies[id]; return b ? b.needs : null; }
