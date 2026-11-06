// Life v7: a needs-based society (the model behind The Sims), with no drawing in it so it can be tested on its own.
//
// 1. Every creature has four needs from 0 (empty) to 1 (full): energy, hunger, social, fun. They drain every second,
//    faster or slower depending on real data: a long work session drains energy, lunch time drains hunger, night drains energy.
// 2. Places advertise what they restore (the four zones of each commons, a friend's desk, a walk). See ZONES in world.js.
// 3. A free creature scores every option: what it restores x how urgent that need is x personality, divided by the walk,
//    with a bonus for friends already there and a penalty for repeating itself. It picks among its top three, weighted.
// 4. It stays until the need it came for is full (or a time limit), then chooses again. A need that turns critical
//    cuts in, but only once the current need is at least half met (otherwise it would thrash between two places).
// Real states always win: running, waiting and failed sessions go to their desk; sessions quiet for a day sleep.
import { G, rng, hash, pick, wantsDesk, hourNow, isLunch, hostOf, INITIAL } from './core.js';
import { gene } from './creatures.js';
import { ZONES, findPath, deskOf, hoodAt, randomStreet, key } from './world.js';

const W = () => G.world;
export const NEEDS = ['energy', 'hunger', 'social', 'fun'];
// base drain per second: a full need is half empty after 3 to 5 minutes
export const DRAIN = { energy: 0.00175, hunger: 0.0015, social: 0.00225, fun: 0.002 };
const MIN_STAY = 4, MAX_STAY = 50, CRITICAL = 0.12, FULL = 0.95;
const clamp = (x) => Math.max(0, Math.min(1, x));
const urgency = (x) => (1 - x) * (1 - x);   // a curve: half-full is mild (0.25), nearly empty is pressing (0.8+)

/* ---------------- relationships ---------------- */
// colleagues on the same project start as friends, neighbours on the same machine as acquaintances
const aff = {};
const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
export function affinity(a, b) {
  const k = pairKey(a, b);
  if (aff[k] == null) { const sa = INITIAL.find((x) => x.id === a), sb = INITIAL.find((x) => x.id === b); aff[k] = !sa || !sb ? 0 : sa.plot === sb.plot ? 3 : hostOf(sa) === hostOf(sb) ? 1 : 0; }
  return aff[k];
}
function befriend(a, b, x) { affinity(a, b); aff[pairKey(a, b)] += x; }
export function bestFriend(id) { let best = null, bv = 4; for (const s of G.S) { if (s.id === id) continue; const v = affinity(id, s.id); if (v > bv) { bv = v; best = s; } } return best; }

/* ---------------- bodies ---------------- */
export function body(s) {
  if (G.bodies[s.id]) return G.bodies[s.id];
  const d = deskOf(W(), s), r = rng(hash(s.id + '/life')), g = gene(s.id, s.agent);
  const b = { id: s.id, u: d.u, v: d.v, path: [], act: { type: 'none', until: 0 }, face: 1, atDesk: true, moving: false, r, emote: null, say: null, sayQ: null,
    spot: null, seated: false, waveCD: 0, thinkAt: 0, recent: [], log: [],
    needs: { energy: 0.5 + r() * 0.45, hunger: 0.5 + r() * 0.45, social: 0.4 + r() * 0.5, fun: 0.4 + r() * 0.5 } };
  b.g = g;
  G.bodies[s.id] = b;
  return b;
}
const home = (s) => W().offices[s.plot].hood;
const hoodOf = (b) => hoodAt(W(), b.u, b.v);
function goTo(b, u, v) { const p = findPath(W(), b.u, b.v, u, v); b.path = p || []; if (!p) { leave(b); b.noPath = true; } return !!p; }
function claim(b, spot) { leave(b); spot.occ = b.id; b.spot = spot; }
function leave(b) { if (b.spot && b.spot.occ === b.id) b.spot.occ = null; b.spot = null; b.seated = false; }
const freeSpots = (room) => (room ? room.spots.filter((x) => !x.occ) : []);
const occupants = (room, except) => room.spots.filter((x) => x.occ && x.occ !== except).map((x) => x.occ);
export function emote(b, g, dur, delay) { const t = G.t + (delay || 0); b.emote = { g, from: t, until: t + (dur || 1.6) }; }
function say(b, text, delay) { b.sayQ = { text, at: G.t + (delay || 0) }; }
const NEED_GLYPH = { energy: 'z', hunger: 'food', social: 'wave', fun: 'q' };
const NEED_WORD = { energy: 'tired', hunger: 'hungry', social: 'lonely', fun: 'bored' };

/* ---------------- time of day: the routine ---------------- */
function routine() {
  const h = hourNow(), night = h >= 23 || h < 6, evening = h >= 19 && !night;
  return { lunch: isLunch(h), night, evening, energyDrain: night ? 1.8 : evening ? 1.3 : 1, hungerDrain: isLunch(h) ? 2.5 : 1 };
}

/* ---------------- options: everything a free creature could do right now ---------------- */
function zoneOffer(z, me) {
  const k = ZONES[z.zone], peers = Math.min(3, occupants(z, me).length), o = {};
  for (const n of NEEDS) { const v = (k.offers[n] || 0) + (k.perPeer[n] || 0) * peers; if (v) o[n] = v; }
  return o;
}
function options(s, b) {
  const out = [], here = hoodOf(b) || home(s);
  for (const z of W().zones) {
    const sp = freeSpots(z); if (!sp.length || z === b.act.zone) continue;
    // friends already there make the company worth more
    const friends = occupants(z, b.id).reduce((a, id) => a + Math.min(1, affinity(b.id, id) / 6), 0);
    out.push({ type: z.zone, zone: z, spots: sp, offers: zoneOffer(z, b.id), social: 1 + friends * 0.5, at: z, label: ZONES[z.zone].label + (z.hood === home(s) ? '' : ' on ' + z.hood.h.name) });
  }
  for (const o of G.S) {
    // someone it knows at a desk: drop by while they work, or keep them company while they wait for you (worth more the longer they wait)
    if (o.id === s.id || (o.state !== 'run' && o.state !== 'wait')) continue;
    const a = affinity(s.id, o.id); if (a < 1) continue;
    const room = W().offices[o.plot], k = INITIAL.filter((x) => x.plot === o.plot).findIndex((x) => x.id === o.id), spot = room.visit[Math.max(0, k)];
    if (!spot || spot.occ) continue;
    const waits = o.state === 'wait';
    out.push({ type: waits ? 'company' : 'visit', friend: o.id, spots: [spot], offers: { social: 0.016 }, at: spot, stay: 16,
      social: 1 + Math.min(1, a / 8) + (waits ? Math.min(1, o.since / 20) : 0),
      label: waits ? 'keeping ' + gene(o.id).name + ' company while it waits' : 'visiting ' + gene(o.id).name + ' at work' });
  }
  // two options that cost nothing when all is well: a stroll, or staying put
  const c = randomStreet(W(), b.r() < b.g.curious * 0.4 ? pick(b.r, W().hoods) : here, b.r);
  out.push({ type: 'walk', target: c, offers: { fun: 0.006 }, at: c, base: 0.08 + b.g.curious * 0.1, stay: 1 + b.r() * 2, label: hoodAt(W(), c.u, c.v) === home(s) ? 'taking a walk' : 'exploring ' + hoodAt(W(), c.u, c.v).h.name });
  const z = b.act.zone && b.spot && b.spot.room === b.act.zone ? b.act.zone : null;
  out.push({ type: z ? z.zone : 'linger', linger: true, zone: z, offers: z ? zoneOffer(z, b.id) : {}, at: { u: b.u, v: b.v }, base: 0.14, stay: 5 + b.r() * 6, label: z ? ZONES[z.zone].label : 'looking around' });
  return out;
}
// how much this creature wants each need right now (personality and time of day tilt it)
function weights(b, R) {
  const g = b.g;
  return { energy: (0.7 + g.sleepy * 0.8) * (R.night ? 2 : R.evening ? 1.3 : 1), hunger: (0.6 + g.energy * 0.4) * (R.lunch ? 1.8 : 1), social: 0.5 + g.social, fun: 0.5 + g.curious };
}
// what an option is worth for each need right now
function needValue(o, b, R, n) { const x = o.offers[n] || 0; return x > 0 ? x * 100 * urgency(b.needs[n]) * weights(b, R)[n] * (n === 'social' ? o.social || 1 : 1) : 0; }
export function score(o, b, R) {
  let s = o.base || 0;
  for (const n of NEEDS) s += needValue(o, b, R, n);
  const dist = Math.abs(o.at.u0 != null ? o.at.cu - b.u : o.at.u - b.u) + Math.abs(o.at.v0 != null ? o.at.cv - b.v : o.at.v - b.v);
  const repeats = b.recent.filter((t) => t === o.type).length;
  // farther is worth less: at 8 to 18 cells an option is worth half (curious creatures mind the walk less)
  return s / (1 + dist / (8 + 10 * b.g.curious)) * Math.pow(0.75, repeats);
}
// the need an option mainly serves for this creature now, or null when it serves none that is low
function mainNeed(o, b, R) { let best = null, bv = 0.05; for (const n of NEEDS) { const x = needValue(o, b, R, n); if (x > bv) { bv = x; best = n; } } return best; }
function choose(b, s, t) {
  const R = routine(), ranked = options(s, b).map((o) => ({ o, sc: score(o, b, R) })).sort((x, y) => y.sc - x.sc).slice(0, 3);
  const tot = ranked.reduce((a, x) => a + Math.max(0.01, x.sc), 0); let x = b.r() * tot, o = ranked[0].o;
  for (const it of ranked) { x -= Math.max(0.01, it.sc); if (x <= 0) { o = it.o; break; } }
  const why = mainNeed(o, b, R);
  b.recent.push(o.type); if (b.recent.length > 3) b.recent.shift();
  b.log.push({ t, type: o.type }); if (b.log.length > 40) b.log.shift();
  if (why && b.needs[why] < 0.35) emote(b, NEED_GLYPH[why], 1.4);
  if (o.linger) { b.act = { type: o.type, zone: o.zone, until: t + o.stay, arrived: t, offers: o.offers, label: o.label, why }; if (!o.zone) leave(b); return; }
  leave(b);
  if (o.type === 'walk') { goTo(b, o.target.u, o.target.v); b.act = { type: 'walk', until: Infinity, stay: o.stay, offers: o.offers, label: o.label, why }; return; }
  const spot = pick(b.r, o.spots); claim(b, spot);
  if (!goTo(b, spot.u, spot.v)) return;
  b.act = { type: o.type, zone: o.zone, friend: o.friend, until: Infinity, stay: o.stay, offers: o.offers, label: o.label, why };
}

/* ---------------- conversation lines: from the needs and the real sessions ---------------- */
const SMALL = ['nice grid today', 'who broke main?', 'git pull first', 'tabs or spaces?', 'one more test', 'brb', 'ha!', 'same', 'ship it?', 'rebase or merge?'];
const REPLY = ['yes!', 'always', 'no idea', 'later', 'sure', 'hmm', 'ha, same', 'never'];
const NEED_LINES = { energy: ['need a nap', 'so tired…', 'long day'], hunger: ['so hungry', 'snack time?', 'lunch?'], social: ['missed you all', 'talk to me!'], fun: ['bored…', 'anything new?'] };
const trunc = (t) => (t.length > 22 ? t.slice(0, 21) + '…' : t);
export function lineFor(s, prev, r) {
  if (prev && /\?$/.test(prev) && r() < 0.7) return pick(r, REPLY);
  const b = G.bodies[s.id], low = NEEDS.filter((n) => b.needs[n] < 0.35), x = r();
  if (low.length && x < 0.3) return pick(r, NEED_LINES[pick(r, low)]);
  if (x < 0.6) {
    const others = G.S.filter((y) => y.id !== s.id), o = others.slice().sort((a, c) => affinity(s.id, c.id) - affinity(s.id, a.id))[Math.floor(r() * Math.min(4, others.length))], n = gene(o.id).name;
    return trunc(pick(r, { wait: [n + ' waits on John', 'John, check ' + o.plot + '!'], err: [n + ' failed :(', 'poor ' + n], run: [o.since > 20 ? n + ' is at it ' + o.since + 'm' : n + ' on ' + o.plot, n + ' is heads-down'], done: [n + ' shipped!', 'go ' + n + '!'], idle: [n + ' sleeps a lot'] }[o.state]));
  }
  if (x < 0.72 && s.state === 'done') return trunc(pick(r, [s.title.toLowerCase().split(' ').slice(0, 3).join(' ') + ' done', 'shipped it!', 'my work is in']));
  const h = hostOf(s);
  return trunc(pick(r, SMALL.concat(h.lat ? ['ssh ' + h.lat + '… slow'] : [])));
}
const REACT = ['heart', 'star', 'q', 'bang', 'dots', 'note'];

/* ---------------- movement ---------------- */
function speedOf(s, b) { return (wantsDesk(s) ? 2.4 : 1.4 + 0.6 * b.needs.energy) * b.g.energy; }
function stepAlong(b, s, dt) {
  if (!b.path.length) { b.moving = false; return true; }
  const n = b.path[0], du = n.u - b.u, dv = n.v - b.v, dist = Math.hypot(du, dv), sp = speedOf(s, b) * dt;
  b.moving = true; const sx = du - dv; if (Math.abs(sx) > 0.01) b.face = sx > 0 ? 1 : -1;
  if (dist <= sp) { b.u = n.u; b.v = n.v; b.path.shift(); } else { b.u += du / dist * sp; b.v += dv / dist * sp; }
  return !b.path.length;
}
function waveCheck(b, t) {
  if (b.waveCD > t) return;
  for (const o of G.S) { const ob = G.bodies[o.id]; if (!ob || ob === b || !ob.moving || ob.waveCD > t) continue; if (Math.abs(ob.u - b.u) + Math.abs(ob.v - b.v) < 1.3) { emote(b, 'wave', 1.3); emote(ob, 'wave', 1.3, 0.2); b.waveCD = ob.waveCD = t + 10; befriend(b.id, o.id, 0.5); return; } }
}

/* ---------------- events from real data ---------------- */
export function onStateChange(s, prev) {
  const b = body(s), t = G.t;
  if (s.state === 'done' && prev !== 'done') {
    leave(b); b.path = []; b.act = { type: 'celebrate', until: t + 2.4, label: 'celebrating: work done' }; emote(b, 'star', 2.2);
    for (const o of G.S) { const ob = G.bodies[o.id]; if (ob && o.id !== s.id && !wantsDesk(o) && o.state !== 'idle' && hoodOf(ob) === home(s)) emote(ob, 'star', 1.4, 0.3 + ob.r()); }
  } else if (s.state === 'err' && prev !== 'err') {
    emote(b, 'bang', 1.5);
    const room = W().offices[s.plot];
    G.S.filter((o) => o.state === 'done' && o.id !== s.id).sort((a, c) => affinity(s.id, c.id) - affinity(s.id, a.id)).slice(0, 2).forEach((f) => {
      const fb = body(f), spot = room.visit.find((sp) => !sp.occ); if (!spot || fb.act.type === 'celebrate') return;
      claim(fb, spot); if (!goTo(fb, spot.u, spot.v)) return;
      fb.act = { type: 'comfort', friend: s.id, until: Infinity, stay: 12, offers: { social: 0.012 }, label: 'comforting ' + gene(s.id).name, why: 'social' };
    });
  } else if (s.state === 'wait' || (prev === 'idle' && wantsDesk(s))) emote(b, 'bang', 1.6);
}
/* ---------------- reduced motion: put everyone where they belong ---------------- */
export function settle() {
  for (const s of G.S) {
    const b = body(s); b.path = []; b.moving = false;
    if (wantsDesk(s)) { leave(b); const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.act = { type: 'desk' }; b.face = 1; continue; }
    b.atDesk = false; if (b.spot) { b.u = b.spot.u; b.v = b.spot.v; continue; }
    const z = home(s).zones.find((x) => x.zone === (s.state === 'idle' ? 'rest' : 'circle')), spot = freeSpots(z)[0];
    if (spot) { claim(b, spot); b.u = spot.u; b.v = spot.v; b.face = spot.face; b.act = { type: s.state === 'idle' ? 'sleep' : 'circle', zone: z, until: Infinity, label: s.state === 'idle' ? 'asleep' : ZONES.circle.label }; }
  }
}

/* ---------------- the tick ---------------- */
export function simulate(dt, t) {
  const R = routine();
  for (const s of G.S) {
    const b = body(s), g = b.g, N = b.needs;
    if (b.emote && t > b.emote.until) b.emote = null;
    if (b.say && t > b.say.until) b.say = null;
    if (b.sayQ && t >= b.sayQ.at) { b.say = { text: b.sayQ.text, until: t + 2.6 }; b.sayQ = null; }
    // 1. needs drain, driven by real data and the clock
    const work = wantsDesk(s) && s.state === 'run' ? 1 + Math.min(2, s.since / 60) : 0;
    if (s.state !== 'idle') {
      N.energy = clamp(N.energy - dt * DRAIN.energy * (1 + work + (b.moving ? 0.5 : 0)) * R.energyDrain);
      const focus = s.state === 'run' ? 0.5 : 1;   // absorbing work: fun and company matter less while running
      N.hunger = clamp(N.hunger - dt * DRAIN.hunger * R.hungerDrain * (0.7 + g.energy * 0.4));
      N.social = clamp(N.social - dt * DRAIN.social * (0.5 + g.social) * (s.state === 'wait' ? 1.4 : focus));
      N.fun = clamp(N.fun - dt * DRAIN.fun * (0.5 + g.curious) * focus);
    }
    // 2. real states win
    if (wantsDesk(s)) {
      if (b.act.type !== 'desk') { leave(b); b.act = { type: 'desk' }; b.atDesk = false; const d = deskOf(W(), s); goTo(b, d.u, d.v); }
      if (!b.atDesk) { if (stepAlong(b, s, dt)) { const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.face = 1; } }
      else if (s.state === 'run' && t > b.thinkAt) { if (b.thinkAt) emote(b, N.energy < 0.25 ? 'z' : N.hunger < 0.25 ? 'food' : b.r() < 0.6 ? 'dots' : 'note', 1.4); b.thinkAt = t + 12 + b.r() * 18; }
      continue;
    }
    b.atDesk = false;
    if (b.act.type === 'desk') b.act = { type: 'none', until: 0 };
    if (b.act.type === 'celebrate') { if (t < b.act.until) continue; b.act = { type: 'none', until: 0 }; }
    if (s.state === 'idle') {   // asleep: find a bed in the rest zone, refill energy
      N.energy = clamp(N.energy + dt * 0.01);
      if (b.act.type !== 'sleep') {
        const z = home(s).zones.find((x) => x.zone === 'rest'), spot = freeSpots(z)[0] || W().zones.filter((x) => x.zone === 'rest').map(freeSpots).flat()[0];
        if (spot) { claim(b, spot); goTo(b, spot.u, spot.v); }
        b.act = { type: 'sleep', until: Infinity, label: 'asleep' };
      }
      if (stepAlong(b, s, dt) && b.spot) { b.seated = true; b.face = b.spot.face; }
      continue;
    }
    if (b.act.type === 'sleep') { leave(b); b.act = { type: 'none', until: 0 }; }
    // 3. walking somewhere
    if (b.path.length) { stepAlong(b, s, dt); b.seated = false; waveCheck(b, t); continue; }
    b.moving = false;
    if (b.noPath) { b.noPath = false; b.act = { type: 'none', until: t + 1 }; continue; }
    // 4. arrived: the stay begins
    if (b.act.until === Infinity) {
      b.act.arrived = t; b.act.until = t + (b.act.stay || MAX_STAY);
      if (b.spot) { b.u = b.spot.u; b.v = b.spot.v; b.seated = b.act.type === 'rest' || b.act.type === 'snack'; b.face = b.spot.face; }
      const fb = b.act.friend && G.bodies[b.act.friend], fs = b.act.friend && G.S.find((x) => x.id === b.act.friend);
      if (fb) {
        b.face = 1;
        const kind = b.act.type, glyph = kind === 'visit' ? 'wave' : 'heart';
        emote(b, glyph, 1.8); emote(fb, glyph, 1.6, 0.6);
        say(b, kind === 'visit' ? pick(b.r, ['how is it going?', 'need a hand?', 'coffee later?']) : kind === 'comfort' ? pick(b.r, ['you got this', 'tests again?', 'happens to all']) : pick(b.r, ['John will come', 'still waiting?', 'I\'ll wait too']));
        say(fb, kind === 'visit' ? pick(fb.r, ['almost done', 'busy busy', 'later!']) : kind === 'comfort' ? pick(fb.r, ['thanks…', 'ugh', ':(']) : pick(fb.r, ['thanks', 'ages…', 'hm']), 1.4);
        fb.needs.social = clamp(fb.needs.social + 0.2); befriend(b.id, fs.id, kind === 'visit' ? 1 : 2);
      }
    }
    // 5. staying: the place restores what it offers (group zones are re-read every tick, so company counts)
    const offers = b.act.zone ? zoneOffer(b.act.zone, b.id) : b.act.offers;
    if (offers) for (const n of NEEDS) { const o = offers[n]; if (o) N[n] = clamp(N[n] + o * dt); }
    if (b.act.type === 'play') for (const id of occupants(b.act.zone, b.id)) befriend(b.id, id, dt * 0.15);
    if (b.act.type === 'rest' && b.r() < dt * 0.05) emote(b, 'z', 1.4);
    // 6. leave when the need it came for is full, the time is up, or another need turns critical
    const filled = b.act.why && N[b.act.why] >= FULL && t > (b.act.arrived || 0) + MIN_STAY;
    const critical = t > (b.act.arrived || 0) + MIN_STAY && (!b.act.why || N[b.act.why] >= 0.5) && NEEDS.some((n) => N[n] < CRITICAL && !(offers && offers[n]));
    if (t >= b.act.until || filled || critical) choose(b, s, t);
  }
  converse(t, dt);
}

/* ---------------- conversations: creatures sharing a zone, or standing close on a street, talk in turns ---------------- */
const convs = {};
// a fresh world: forget relationships and running conversations
export function resetLife() { for (const k in aff) delete aff[k]; for (const k in convs) delete convs[k]; G.bodies = {}; }
function converse(t, dt) {
  const groups = {};
  for (const s of G.S) {
    const b = G.bodies[s.id]; if (!b || b.moving || wantsDesk(s) || s.state === 'idle' || !b.act.arrived) continue;
    if (['visit', 'comfort', 'company'].includes(b.act.type)) continue;   // those have their own exchange
    let gk = b.act.zone && b.act.zone.zone !== 'rest' ? 'z' + b.act.zone.u0 + ',' + b.act.zone.v0 : null;
    if (!gk && !b.act.zone) for (const k in groups) { if (!k.startsWith('st')) continue; const f = G.bodies[groups[k][0].id]; if (Math.abs(f.u - b.u) + Math.abs(f.v - b.v) < 2.6) { gk = k; break; } }
    if (!gk && b.act.zone) continue;   // resting creatures do not chat
    (groups[gk || 'st' + s.id] = groups[gk || 'st' + s.id] || []).push(s);
  }
  for (const k in convs) if (!groups[k] || groups[k].length < 2) delete convs[k];
  for (const k in groups) {
    const members = groups[k]; if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) { const mb = G.bodies[members[i].id]; if (k[0] === 's') mb.needs.social = clamp(mb.needs.social + dt * 0.008); for (let j = i + 1; j < members.length; j++) befriend(members[i].id, members[j].id, dt * 0.1); }
    const c = convs[k] || (convs[k] = { next: t + 0.8, last: null, prev: null });
    if (t < c.next) continue;
    const cands = members.filter((m) => m.id !== c.last), r = G.bodies[cands[0].id].r;
    const tot = cands.reduce((a, m) => a + G.bodies[m.id].g.talk, 0); let x = r() * tot, sp = cands[0];
    for (const m of cands) { x -= G.bodies[m.id].g.talk; if (x <= 0) { sp = m; break; } }
    const text = lineFor(sp, c.prev, r), sb = G.bodies[sp.id];
    sb.say = { text, until: t + 2.6 };
    for (const m of members) { if (m.id === sp.id) continue; const mb = G.bodies[m.id]; if (!mb.act.zone) mb.face = Math.sign((sb.u - sb.v) - (mb.u - mb.v)) || mb.face; if (r() < 0.3) emote(mb, pick(r, REACT), 1.2, 1); mb.needs.fun = clamp(mb.needs.fun + 0.01); }
    c.last = sp.id; c.prev = text; c.next = t + 2.8 + r() * 0.8;
  }
}

/* ---------------- what the UI shows ---------------- */
export function activity(s) {
  const b = G.bodies[s.id]; if (!b) return '';
  if (wantsDesk(s)) return b.atDesk ? (s.state === 'run' ? (b.needs.energy < 0.25 ? 'working, getting tired' : 'working') : s.state === 'wait' ? 'waiting for you' : 'stopped on a failure') : 'hurrying back to its desk';
  if (s.state === 'idle') return b.path.length ? 'shuffling off to sleep' : 'asleep';
  if (b.say) return 'saying "' + b.say.text + '"';
  const why = b.act.why && b.act.type !== 'walk' ? ' (was ' + NEED_WORD[b.act.why] + ')' : '';
  return (b.path.length && b.act.label ? 'heading off: ' : '') + (b.act.label || 'looking around') + why;
}
export function needsOf(id) { const b = G.bodies[id]; return b ? b.needs : null; }

/* ---------------- invariants, checked by the tests ---------------- */
export function audit() {
  const bad = [], seen = {};
  for (const sp of W().spots) if (sp.occ) { if (seen[sp.occ]) bad.push(sp.occ + ' holds two spots'); seen[sp.occ] = true; const b = G.bodies[sp.occ]; if (!b || b.spot !== sp) bad.push(sp.occ + ' spot not mirrored'); }
  for (const s of G.S) {
    const b = G.bodies[s.id]; if (!b) continue;
    if (!isFinite(b.u) || !isFinite(b.v)) bad.push(s.id + ' NaN position');
    if (W().walk[key(Math.floor(b.u), Math.floor(b.v))] == null) bad.push(s.id + ' off the walkable grid at ' + b.u.toFixed(2) + ',' + b.v.toFixed(2));
    if (b.spot && b.spot.occ !== b.id) bad.push(s.id + ' thinks it holds a spot it does not');
    for (const n of NEEDS) if (!(b.needs[n] >= 0 && b.needs[n] <= 1)) bad.push(s.id + ' ' + n + ' out of range');
  }
  return bad;
}
