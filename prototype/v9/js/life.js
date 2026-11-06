// Life v9: blobs live their free time by personality, the time of day and their friends. No meters to refill.
//
// Real states always win: a running, waiting or failed session sends its blob straight to its desk, whatever it was doing;
// a session quiet for a day sleeps. Everything below only decides what a free blob (a finished session) does meanwhile:
// 1. Every option has a pull: how much this blob likes it (its personality), tilted by the time of day (snacks at lunch,
//    rest at night) and by who is already there (friends and company draw blobs in).
// 2. A far option pulls less, and so does whatever it did lately (variety).
// 3. It picks among its top three, weighted by pull, stays a while (15 to 40 seconds at the hub), then chooses again.
// The hub is one park: an activity is not a place. Chatting, playing and snacking happen next to whoever is already there
// (so groups form), resting somewhere quiet; play leans to the pond, snacks to the logs (parkSpot below).
// No drawing here, so it can be tested on its own (test/life.test.js).
import { G, rng, hash, pick, wantsDesk, hourNow, isLunch, hostOf, INITIAL } from './core.js';
import { gene } from './creatures.js';
import { findPath, deskOf, hoodAt, randomStreet, key } from './world.js';

const W = () => G.world;

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
  const d = deskOf(W(), s), r = rng(hash(s.id + '/life'));
  const b = { id: s.id, u: d.u, v: d.v, path: [], act: { type: 'none', until: 0 }, face: 1, atDesk: true, moving: false, r, emote: null, say: null, sayQ: null,
    spot: null, seated: false, waveCD: 0, thinkAt: 0, recent: [], log: [], g: gene(s.id, s.agent) };
  G.bodies[s.id] = b;
  return b;
}
const home = (s) => W().offices[s.plot].hood;
const hoodOf = (b) => hoodAt(W(), b.u, b.v);
function goTo(b, u, v) { const p = findPath(W(), b.u, b.v, u, v); b.path = p || []; if (!p) { leave(b); b.noPath = true; } return !!p; }
function claim(b, spot) { leave(b); spot.occ = b.id; b.spot = spot; }
function leave(b) { if (b.spot && b.spot.occ === b.id) b.spot.occ = null; b.spot = null; b.seated = false; }
export function emote(b, g, dur, delay) { const t = G.t + (delay || 0); b.emote = { g, from: t, until: t + (dur || 1.6) }; }
function say(b, text, delay) { b.sayQ = { text, at: G.t + (delay || 0) }; }

/* ---------------- what each blob likes: its personality, the time of day ---------------- */
// liking for each activity, from the five traits (0..1 each; energy is stored 0.7..1.4)
export function likes(g) {
  const lively = (g.energy - 0.7) / 0.7;
  return {
    rest: 0.15 + g.sleepy * 1.5,
    snack: 0.4 + lively * 0.3,
    chat: 0.3 + g.social * 1.1,
    play: 0.3 + g.curious * 0.6 + lively * 0.4,
    walk: 0.2 + g.curious * 0.5,
    visit: 0.2 + g.social * 0.4,
    company: 0.4 + g.social * 0.3,
    linger: 0.3
  };
}
export function routine() {
  const h = hourNow(), night = h >= 23 || h < 6, evening = h >= 19 && !night, lunch = isLunch(h);
  return { lunch, night, evening, tilt: { rest: night ? 4 : evening ? 1.5 : 1, snack: lunch ? 3 : 1, play: night ? 0.5 : 1, walk: night ? 0.5 : 1 } };
}
const STAY = { rest: [20, 40], snack: [12, 24], chat: [15, 35], play: [15, 30] };
export const PARK = ['rest', 'chat', 'play', 'snack'];
const LABEL = { rest: 'resting in the park', chat: 'hanging out in the park', play: 'playing in the park', snack: 'having a snack in the park' };
const near2 = (a, b) => Math.max(Math.abs(a.u - b.u), Math.abs(a.v - b.v));
// blobs settled in the park right now (arrived, on a park spot)
function inPark(except) { return G.S.filter((o) => { const ob = G.bodies[o.id]; return o.id !== except && ob && ob.spot && ob.spot.kind === 'park' && ob.act.arrived && !ob.path.length; }).map((o) => G.bodies[o.id]); }
// where in the park to do an activity: next to the group for social ones, alone for rest; play by water, snacks by a log
function parkSpot(kind, b, r) {
  const W0 = W(), free = W0.hub.spots.filter((x) => !x.occ), others = inPark(b.id), near = (sp, list) => list.some((p) => Math.max(Math.abs(p.u + 0.5 - sp.u), Math.abs(p.v + 0.5 - sp.v)) <= 1.6);
  const logs = W0.props.filter((p) => 'oxt'.includes(p.kind)), shelter = W0.props.filter((p) => 'oxtkgG'.includes(p.kind)).concat(W0.tiles.filter((t) => t.tile >= 30 && t.tile <= 36)), water = W0.tiles.filter((t) => t.water);
  if (!free.length) return null;
  const sample = []; for (let i = 0; i < 16; i++) sample.push(free[Math.floor(r() * free.length)]);
  let best = null, bv = -1e9;
  for (const sp of sample) {
    const crowd = others.filter((o) => near2(o, sp) <= 1.6).length, quiet = others.every((o) => near2(o, sp) > 2.5);
    let v = r() * 0.3;
    if (kind === 'rest') v += (quiet ? 2 : -2) + (near(sp, shelter) ? 0.6 : 0);
    else v += Math.min(3, crowd) * (kind === 'chat' ? 1.2 : 0.8) + (kind === 'play' && near(sp, water) ? 1 : 0) + ((kind === 'snack' || kind === 'chat') && near(sp, logs) ? 0.8 : 0);
    if (v > bv) { bv = v; best = sp; }
  }
  return best;
}

/* ---------------- options: everything a free blob could do right now ---------------- */
function options(s, b, r) {
  r = r || b.r;
  const out = [], here = hoodOf(b) || home(s);
  for (const kind of PARK) {
    const sp = parkSpot(kind, b, r); if (!sp) continue;
    const there = inPark(b.id).filter((o) => near2(o, sp) <= 1.6), friends = there.reduce((a, o) => a + Math.min(1, affinity(b.id, o.id) / 6), 0);
    // company draws blobs to chat and play; friends draw them to anything but rest
    const crowd = (kind === 'chat' ? 0.25 : kind === 'play' ? 0.15 : kind === 'snack' ? 0.1 : 0) * Math.min(3, there.length);
    const names = there.slice(0, 2).map((o) => o.g.name).join(' and ');
    out.push({ type: kind, spots: [sp], at: sp, boost: 1 + crowd + (kind === 'rest' ? 0 : friends * 0.4),
      label: kind === 'chat' && names ? 'chatting with ' + names : kind === 'play' && names ? 'playing with ' + names : LABEL[kind] });
  }
  for (const o of G.S) {
    // someone it knows at a desk: drop by while they work, or keep them company while they wait for you (more the longer they wait)
    if (o.id === s.id || (o.state !== 'run' && o.state !== 'wait')) continue;
    const a = affinity(s.id, o.id); if (a < 1) continue;
    const room = W().offices[o.plot], k = INITIAL.filter((x) => x.plot === o.plot).findIndex((x) => x.id === o.id), spot = room.visit[Math.max(0, k)];
    if (!spot || spot.occ) continue;
    const waits = o.state === 'wait';
    out.push({ type: waits ? 'company' : 'visit', friend: o.id, spots: [spot], at: spot, stay: waits ? 14 : 10, boost: Math.min(1.5, a / 4) * (waits ? 1 + Math.min(1, o.since / 20) : 1),
      label: waits ? 'keeping ' + gene(o.id).name + ' company while it waits' : 'visiting ' + gene(o.id).name + ' at work' });
  }
  const c = randomStreet(W(), r() < b.g.curious * 0.4 ? pick(r, W().hoods) : here, r);
  out.push({ type: 'walk', target: c, at: c, stay: 1 + r() * 2, label: walkLabel(hoodAt(W(), c.u, c.v), s) });
  const keep = b.spot && b.spot.kind === 'park' && PARK.includes(b.act.type) ? b.act.type : null;   // carry on with what it is doing
  out.push({ type: keep || 'linger', linger: true, keep, at: { u: b.u, v: b.v }, stay: 6 + r() * 8, label: keep ? b.act.label : 'looking around' });
  return out;
}
function walkLabel(h, s) { return !h ? 'taking a walk' : h.kind === 'hub' ? 'strolling around the hub' : h === home(s) ? 'walking around ' + h.h.name : 'exploring ' + h.h.name; }
// the pull of an option, and what it is made of (the explainer shows the parts)
export function pull(o, b, R) {
  const like = likes(b.g)[o.type] || 0.3, tilt = R.tilt[o.type] || 1, boost = o.boost || 1;
  const dist = Math.abs(o.at.u0 != null ? o.at.cu - b.u : o.at.u - b.u) + Math.abs(o.at.v0 != null ? o.at.cv - b.v : o.at.v - b.v);
  const near = 1 / (1 + dist / (8 + 10 * b.g.curious)), variety = Math.pow(0.6, b.recent.filter((t) => t === o.type).length);
  return { like, tilt, boost, near, variety, score: like * tilt * boost * near * variety };
}
// every option for a blob right now, best first (for the explainer); uses its own randomness so looking never changes the world
export function rank(s) {
  const b = body(s), R = routine();
  return options(s, b, rng(hash(s.id) + Math.floor(G.t))).map((o) => { const p = pull(o, b, R); return { o, sc: p.score, parts: p }; }).sort((x, y) => y.sc - x.sc);
}
function choose(b, s, t) {
  const R = routine(), ranked = options(s, b).map((o) => ({ o, sc: pull(o, b, R).score })).sort((x, y) => y.sc - x.sc).slice(0, 3);
  const tot = ranked.reduce((a, x) => a + Math.max(0.01, x.sc), 0); let x = b.r() * tot, o = ranked[0].o;
  for (const it of ranked) { x -= Math.max(0.01, it.sc); if (x <= 0) { o = it.o; break; } }
  b.recent.push(o.type); if (b.recent.length > 3) b.recent.shift();
  b.log.push({ t, type: o.type }); if (b.log.length > 40) b.log.shift();
  const range = STAY[o.type], stay = o.stay || (range ? range[0] + b.r() * (range[1] - range[0]) * (o.type === 'rest' ? 0.6 + b.g.sleepy * 0.8 : 1) : 10);
  if (o.linger) { b.act = { type: o.type, until: t + o.stay, arrived: t, label: o.label }; if (!o.keep) leave(b); return; }
  leave(b);
  if (o.type === 'walk') { goTo(b, o.target.u, o.target.v); b.act = { type: 'walk', until: Infinity, stay, label: o.label }; return; }
  const spot = pick(b.r, o.spots); claim(b, spot);
  if (!goTo(b, spot.u, spot.v)) return;
  b.act = { type: o.type, friend: o.friend, until: Infinity, stay, label: o.label };
}

/* ---------------- conversation lines: from the real sessions and the place ---------------- */
const SMALL = ['nice grid today', 'who broke main?', 'git pull first', 'tabs or spaces?', 'one more test', 'brb', 'ha!', 'same', 'ship it?', 'rebase or merge?'];
const REPLY = ['yes!', 'always', 'no idea', 'later', 'sure', 'hmm', 'ha, same', 'never'];
const PLACE = { snack: ['good snack', 'pass the chips', 'crunchy'], chat: ['so, how was it?', 'tell me more', 'busy day'], play: ['your turn!', 'again!', 'got you'] };
const trunc = (t) => (t.length > 22 ? t.slice(0, 21) + '…' : t);
export function lineFor(s, prev, r) {
  if (prev && /\?$/.test(prev) && r() < 0.7) return pick(r, REPLY);
  const b = G.bodies[s.id], x = r();
  if (PLACE[b.act.type] && x < 0.25) return pick(r, PLACE[b.act.type]);
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
function speedOf(s, b) { return (wantsDesk(s) ? 2.4 : 1.6) * b.g.energy; }
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
      fb.act = { type: 'comfort', friend: s.id, until: Infinity, stay: 12, label: 'comforting ' + gene(s.id).name };
    });
  } else if (s.state === 'wait' || (prev === 'idle' && wantsDesk(s))) emote(b, 'bang', 1.6);
}

/* ---------------- reduced motion: put everyone where they belong ---------------- */
export function settle() {
  for (const s of G.S) {
    const b = body(s); b.path = []; b.moving = false;
    if (wantsDesk(s)) { leave(b); const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.act = { type: 'desk' }; b.face = 1; continue; }
    b.atDesk = false; if (b.spot) { b.u = b.spot.u; b.v = b.spot.v; continue; }
    const spot = parkSpot(s.state === 'idle' ? 'rest' : 'chat', b, b.r);
    if (spot) { claim(b, spot); b.u = spot.u; b.v = spot.v; b.face = spot.face; b.act = { type: s.state === 'idle' ? 'sleep' : 'chat', until: Infinity, arrived: G.t, label: s.state === 'idle' ? 'asleep' : LABEL.chat }; }
  }
}

/* ---------------- the tick ---------------- */
export function simulate(dt, t) {
  for (const s of G.S) {
    const b = body(s);
    if (b.emote && t > b.emote.until) b.emote = null;
    if (b.say && t > b.say.until) b.say = null;
    if (b.sayQ && t >= b.sayQ.at) { b.say = { text: b.sayQ.text, until: t + 2.6 }; b.sayQ = null; }
    // 1. real states win: work pulls the blob to its desk, wherever it is and whatever it was doing
    if (wantsDesk(s)) {
      if (b.act.type !== 'desk') { leave(b); b.act = { type: 'desk' }; b.atDesk = false; const d = deskOf(W(), s); goTo(b, d.u, d.v); }
      if (!b.atDesk) { if (stepAlong(b, s, dt)) { const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.face = 1; } }
      else if (s.state === 'run' && t > b.thinkAt) { if (b.thinkAt) emote(b, b.r() < 0.6 ? 'dots' : 'note', 1.4); b.thinkAt = t + 12 + b.r() * 18; }
      continue;
    }
    b.atDesk = false;
    if (b.act.type === 'desk') b.act = { type: 'none', until: 0 };
    if (b.act.type === 'celebrate') { if (t < b.act.until) continue; b.act = { type: 'none', until: 0 }; }
    if (s.state === 'idle') {   // asleep: a quiet spot in the park
      if (b.act.type !== 'sleep') {
        const spot = parkSpot('rest', b, b.r);
        if (spot) { claim(b, spot); goTo(b, spot.u, spot.v); }
        b.act = { type: 'sleep', until: Infinity, label: 'asleep' };
      }
      if (stepAlong(b, s, dt) && b.spot) { b.seated = true; b.face = b.spot.face; }
      continue;
    }
    if (b.act.type === 'sleep') { leave(b); b.act = { type: 'none', until: 0 }; }
    // 2. free time: walking somewhere, staying a while, then choosing again
    if (b.path.length) { stepAlong(b, s, dt); b.seated = false; waveCheck(b, t); continue; }
    b.moving = false;
    if (b.noPath) { b.noPath = false; b.act = { type: 'none', until: t + 1 }; continue; }
    if (b.act.until === Infinity) {
      b.act.arrived = t; b.act.until = t + (b.act.stay || 15);
      if (b.spot) { b.u = b.spot.u; b.v = b.spot.v; b.seated = b.act.type === 'rest' || b.act.type === 'snack'; b.face = b.spot.face; }
      const fb = b.act.friend && G.bodies[b.act.friend], fs = b.act.friend && G.S.find((x) => x.id === b.act.friend);
      if (fb) {
        b.face = 1;
        const kind = b.act.type, glyph = kind === 'visit' ? 'wave' : 'heart';
        emote(b, glyph, 1.8); emote(fb, glyph, 1.6, 0.6);
        say(b, kind === 'visit' ? pick(b.r, ['how is it going?', 'need a hand?', 'coffee later?']) : kind === 'comfort' ? pick(b.r, ['you got this', 'tests again?', 'happens to all']) : pick(b.r, ['John will come', 'still waiting?', 'I\'ll wait too']));
        say(fb, kind === 'visit' ? pick(fb.r, ['almost done', 'busy busy', 'later!']) : kind === 'comfort' ? pick(fb.r, ['thanks…', 'ugh', ':(']) : pick(fb.r, ['thanks', 'ages…', 'hm']), 1.4);
        befriend(b.id, fs.id, kind === 'visit' ? 1 : 2);
      }
    }
    if (b.act.type === 'play' && b.act.arrived) for (const o of inPark(b.id)) if (near2(o, b) <= 1.6) befriend(b.id, o.id, dt * 0.15);
    if (b.act.type === 'rest' && b.r() < dt * 0.05) emote(b, 'z', 1.4);
    if (t >= b.act.until) choose(b, s, t);
  }
  converse(t, dt);
}

/* ---------------- conversations: blobs standing close (in the park or on a street) talk in turns ---------------- */
const convs = {};
// a fresh world: forget relationships and running conversations
export function resetLife() { for (const k in aff) delete aff[k]; for (const k in convs) delete convs[k]; G.bodies = {}; }
function converse(t, dt) {
  const groups = {};
  for (const s of G.S) {
    const b = G.bodies[s.id]; if (!b || b.moving || wantsDesk(s) || s.state === 'idle' || !b.act.arrived) continue;
    if (['visit', 'comfort', 'company'].includes(b.act.type)) continue;   // those have their own exchange
    if (b.act.type === 'rest') continue;   // resting blobs do not chat
    let gk = null;
    for (const k in groups) { const f = G.bodies[groups[k][0].id]; if (Math.abs(f.u - b.u) + Math.abs(f.v - b.v) < 2.6) { gk = k; break; } }
    (groups[gk || 'st' + s.id] = groups[gk || 'st' + s.id] || []).push(s);
  }
  for (const k in convs) if (!groups[k] || groups[k].length < 2) delete convs[k];
  for (const k in groups) {
    const members = groups[k]; if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) befriend(members[i].id, members[j].id, dt * 0.1);
    const c = convs[k] || (convs[k] = { next: t + 0.8, last: null, prev: null });
    if (t < c.next) continue;
    const cands = members.filter((m) => m.id !== c.last), r = G.bodies[cands[0].id].r;
    const tot = cands.reduce((a, m) => a + G.bodies[m.id].g.talk, 0); let x = r() * tot, sp = cands[0];
    for (const m of cands) { x -= G.bodies[m.id].g.talk; if (x <= 0) { sp = m; break; } }
    const text = lineFor(sp, c.prev, r), sb = G.bodies[sp.id];
    sb.say = { text, until: t + 2.6 };
    for (const m of members) { if (m.id === sp.id) continue; const mb = G.bodies[m.id]; mb.face = Math.sign((sb.u - sb.v) - (mb.u - mb.v)) || mb.face; if (r() < 0.3) emote(mb, pick(r, REACT), 1.2, 1); }
    c.last = sp.id; c.prev = text; c.next = t + 2.8 + r() * 0.8;
  }
}

/* ---------------- what the UI shows ---------------- */
export function activity(s) {
  const b = G.bodies[s.id]; if (!b) return '';
  if (wantsDesk(s)) return b.atDesk ? (s.state === 'run' ? 'working' : s.state === 'wait' ? 'waiting for you' : 'stopped on a failure') : 'hurrying back to its desk';
  if (s.state === 'idle') return b.path.length ? 'shuffling off to sleep' : 'asleep';
  if (b.say) return 'saying "' + b.say.text + '"';
  return (b.path.length && b.act.label ? 'heading off: ' : '') + (b.act.label || 'looking around');
}

/* ---------------- invariants, checked by the tests ---------------- */
export function audit() {
  const bad = [], seen = {};
  for (const sp of W().spots) if (sp.occ) { if (seen[sp.occ]) bad.push(sp.occ + ' holds two spots'); seen[sp.occ] = true; const b = G.bodies[sp.occ]; if (!b || b.spot !== sp) bad.push(sp.occ + ' spot not mirrored'); }
  for (const s of G.S) {
    const b = G.bodies[s.id]; if (!b) continue;
    if (!isFinite(b.u) || !isFinite(b.v)) bad.push(s.id + ' NaN position');
    if (W().walk[key(Math.floor(b.u), Math.floor(b.v))] == null) bad.push(s.id + ' off the walkable grid at ' + b.u.toFixed(2) + ',' + b.v.toFixed(2));
    if (W().blocked[key(Math.floor(b.u), Math.floor(b.v))] && !b.path.length && !wantsDesk(s)) bad.push(s.id + ' standing inside a blocked cell');
    if (b.spot && b.spot.occ !== b.id) bad.push(s.id + ' thinks it holds a spot it does not');
  }
  return bad;
}
