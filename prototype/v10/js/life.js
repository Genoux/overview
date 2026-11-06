// Life v10: a small, organised life after Hangar's floor. Every blob belongs to its desk.
//
// Real states always win: running, waiting and failed sessions work at their desk; a session quiet for a day dozes
// beside its dark slab. A finished session's blob is free, and it lives around its own plot:
//   at its desk, beside its slab: nap (sleepy), play ball (lively), read (calm, curious), tea (everyone; mornings and lunch),
//   music with headphones (lively, social), stretch (lively)
//   visit  a friend on its own machine (another plot, or a colleague) for a real exchange about the work, then come home
//          (social blobs; more at lunch). Machines are separate islands: a blob never leaves its own.
//   company  stand by a friend who is waiting for you   (more the longer it has waited)
// Each option has a pull (personality x time of day x friendship x nearness x variety); the blob picks among its top three,
// stays a while, then chooses again. No drawing here, so it can be tested on its own (test/life.test.js).
import { G, rng, hash, pick, wantsDesk, hourNow, isLunch, hostOf, INITIAL } from './core.js';
import { gene } from './creatures.js';
import { findPath, deskOf, homeOf, hoodAt, key } from './world.js';

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

/* ---------------- what each blob likes, and the time of day ---------------- */
export function likes(g) {
  const lively = (g.energy - 0.7) / 0.7;
  return { nap: 0.08 + g.sleepy * 1.6, play: 0.15 + g.curious * 0.35 + lively * 0.45, read: 0.1 + g.curious * 0.5 + (1 - lively) * 0.3, tea: 0.3, music: 0.08 + lively * 0.35 + g.social * 0.25, stretch: 0.05 + lively * 0.4,
    visit: 0.15 + g.social * 1.0, company: 0.4 + g.social * 0.3, linger: 0.3 };
}
export function routine() {
  const h = hourNow(), night = h >= 23 || h < 6, evening = h >= 19 && !night, lunch = isLunch(h);
  return { lunch, night, evening, tilt: { nap: night ? 4 : evening ? 1.5 : 1, play: night ? 0.4 : 1, music: night ? 0.4 : 1, stretch: night ? 0.5 : 1, tea: lunch || h < 10 ? 2 : 1, read: evening || night ? 1.6 : 1, visit: lunch ? 2.5 : night ? 0.5 : 1 } };
}
export const HOME = ['nap', 'play', 'read', 'tea', 'music', 'stretch'];
const STAY = { nap: [20, 40], play: [15, 30], read: [20, 40], tea: [12, 24], music: [15, 30], stretch: [6, 10], visit: [12, 22] };
export const LABEL = { nap: 'napping by its slab', play: 'playing ball by its slab', read: 'reading by its slab', tea: 'having a tea by its slab', music: 'listening to music by its slab', stretch: 'stretching by its slab', linger: 'pottering about its desk' };

/* ---------------- options: everything a free blob could do right now ---------------- */
function options(s, b, r) {
  r = r || b.r;
  const out = [], mine = homeOf(W(), s);
  // at home: nap or play at its own desk, beside its slab (its home spot is always free for it)
  for (const type of HOME) out.push({ type, spots: [mine], at: mine, label: LABEL[type] });
  for (const o of G.S) {
    if (o.id === s.id || o.state === 'idle' || hostOf(o) !== hostOf(s)) continue;   // its own machine only
    const a = affinity(s.id, o.id); if (a < 1) continue;
    const room = W().offices[o.plot], ob = G.bodies[o.id];
    if (o.state === 'run' || o.state === 'wait') {
      // a friend at work: drop by its desk; one waiting for you: keep it company (more the longer it waits)
      const spot = room.visit[INITIAL.filter((x) => x.plot === o.plot).findIndex((x) => x.id === o.id)];
      if (!spot || (spot.occ && spot.occ !== b.id)) continue;
      const waits = o.state === 'wait';
      out.push({ type: waits ? 'company' : 'visit', friend: o.id, spots: [spot], at: spot, stay: waits ? 16 : undefined, boost: Math.min(1.5, a / 4) * (waits ? 1 + Math.min(1, o.since / 20) : 1),
        label: waits ? 'keeping ' + gene(o.id).name + ' company while it waits' : 'visiting ' + gene(o.id).name + ' at work' });
    } else if (o.state === 'done' && ob && ob.spot && ob.spot.kind === 'home' && !ob.path.length && !ob.talk) {
      // a free friend at home on another plot: go and chat by its desk
      const spot = room.guest.filter((x) => !x.occ).sort((p, q) => Math.abs(p.u - ob.u) - Math.abs(q.u - ob.u))[0];
      if (spot) out.push({ type: 'visit', friend: o.id, spots: [spot], at: spot, boost: Math.min(1.5, a / 4), label: 'chatting with ' + gene(o.id).name + ' on ' + o.plot });
    }
  }
  const atHome = b.spot === mine;
  out.push({ type: 'linger', linger: true, keep: atHome && HOME.includes(b.act.type) ? b.act.type : null, at: { u: b.u, v: b.v }, stay: 6 + r() * 8 });
  return out;
}
// the pull of an option, and what it is made of (the explainer shows the parts)
export function pull(o, b, R) {
  const type = o.keep || o.type, like = likes(b.g)[type] || 0.3, tilt = R.tilt[type] || 1, boost = o.boost || 1;
  const dist = Math.abs(o.at.u - b.u) + Math.abs(o.at.v - b.v);
  const near = 1 / (1 + dist / (10 + 10 * b.g.curious)), variety = Math.pow(0.6, b.recent.filter((t) => t === type).length);
  return { like, tilt, boost, near, variety, score: like * tilt * boost * near * variety };
}
// every option for a blob right now, best first; uses its own randomness so looking never changes the world
export function rank(s) {
  const b = body(s), R = routine();
  return options(s, b, rng(hash(s.id) + Math.floor(G.t))).map((o) => { const p = pull(o, b, R); return { o, sc: p.score, parts: p }; }).sort((x, y) => y.sc - x.sc);
}
function choose(b, s, t) {
  const R = routine(), ranked = options(s, b).map((o) => ({ o, sc: pull(o, b, R).score })).sort((x, y) => y.sc - x.sc).slice(0, 3);
  const tot = ranked.reduce((a, x) => a + Math.max(0.01, x.sc), 0); let x = b.r() * tot, o = ranked[0].o;
  for (const it of ranked) { x -= Math.max(0.01, it.sc); if (x <= 0) { o = it.o; break; } }
  const type = o.keep || o.type;
  b.recent.push(type); if (b.recent.length > 3) b.recent.shift();
  b.log.push({ t, type }); if (b.log.length > 40) b.log.shift();
  const range = STAY[type], stay = o.stay || (range ? range[0] + b.r() * (range[1] - range[0]) * (type === 'nap' ? 0.6 + b.g.sleepy * 0.8 : 1) : 10);
  if (o.linger) { b.act = { type: o.keep || 'linger', until: t + o.stay, arrived: t, label: o.keep ? LABEL[o.keep] : LABEL.linger }; if (!o.keep && b.spot !== homeOf(W(), s)) { const mine = homeOf(W(), s); claim(b, mine); goTo(b, mine.u, mine.v); b.act.until = Infinity; b.act.stay = o.stay; } return; }
  const spot = o.spots[0]; claim(b, spot);
  if (!goTo(b, spot.u, spot.v)) return;
  b.act = { type, friend: o.friend, until: Infinity, stay, label: o.label };
}

/* ---------------- conversations: a real back-and-forth about the work ----------------
   A visit starts an exchange built from the two sessions' real data (title, progress summary, what a waiting one needs,
   what broke). The visitor asks, the host answers, turn by turn; the visit ends when the exchange does. */
const clip = (t, n) => { t = String(t || '').trim(); if (t.length <= n) return t; const cut = t.slice(0, n - 1); return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 8)) + '…'; };
const first = (t) => String(t || '').split(/ · |; /)[0];
const low = (t) => String(t || '').charAt(0).toLowerCase() + String(t || '').slice(1);
const MAX = 30;   // a bubble holds about 30 characters
// What happened lately, so blobs can talk about it (filled by onStateChange)
const NEWS = [];
const WHAT = { done: 'finished', err: 'failed', wait: 'is waiting on John', run: 'is back at work' };
const nameOf = (x) => gene(x.id).name;
// The exchange between a visitor (a) and its host (h): [who, line] pairs, 'a' or 'h'.
// A visit is two or three topics joined by small transitions. The first suits the moment (the host's work when it is busy);
// the next ones come from news, John, the machine, their projects, the agents themselves or small talk in character.
// Every topic has several phrasings, its replies depend on the real data, and topics used lately are avoided (RECENT).
const RECENT = [];
const num = (t) => { const m = String(t || '').match(/(\d+) of (\d+)/); return m ? +m[1] / +m[2] : null; };
function topicsFor(a, h, r) {
  const T = {}, prog = clip(first(String(h.summary).replace(/^ready to review · /, '')), MAX), mine = clip(first(String(a.summary).replace(/^ready to review · /, '')), MAX);
  const P = (...x) => pick(r, x);
  if (h.state === 'run') {
    const f = num(h.summary);
    T.work = () => [
      ['a', P('what are you on?', 'busy? what is it?', 'what are you building?', 'still on the same thing?')],
      ['h', clip(low(h.title), MAX)],
      ['a', P('how far along?', 'going well?', 'close?', 'how is it going?')],
      ['h', prog],
      ['a', f != null ? (f >= 0.5 ? 'more than half, nice' : 'early days then') : h.since > 30 ? h.since + 'm in, long one' : P('nice pace', 'sounds good')],
      ['h', f != null && f < 0.5 ? P('the hard part is done', 'slowly but surely') : h.since > 30 ? 'nearly there, I think' : P('feels good so far', 'no surprises yet')],
      ...P([['a', 'need a second pair of eyes?'], ['h', 'not yet, thanks']], [['a', 'tests passing so far?'], ['h', 'so far, yes']], [['a', 'any tricky bits?'], ['h', 'one weird edge case']])
    ];
  }
  if (h.state === 'wait') T.work = () => [
    ['a', P('still waiting on John?', 'stuck on John again?', 'any word from John?')],
    ['h', h.kind === 'question' ? clip('he has to pick: ' + low(h.bubble || h.q), MAX) : clip('he has to ok ' + (h.cmd || 'a command'), MAX)],
    ...(h.kind === 'question' ? P([['a', 'what would you pick?'], ['h', 'it is all in the session']], [['a', 'which way do you lean?'], ['h', 'I wrote up both sides']])
      : P([['a', 'is it safe?'], ['h', 'yes, I checked']], [['a', 'what does it do?'], ['h', /migrat/.test(h.cmd || '') ? 'changes the database' : /install|add/.test(h.cmd || '') ? 'adds a dependency' : 'one command, then done']])),
    ['a', h.since > 10 ? clip(h.since + 'm already…', MAX) : P('he will see it', 'he is quick')],
    ['h', h.since > 10 ? P('he must be busy', 'it happens') : 'hope so'],
    ['a', P('I can wait with you', 'want company?')],
    ['h', 'thanks for staying']
  ];
  if (h.state === 'err') T.work = () => [
    ['a', P('what broke?', 'ouch, what happened?', 'red again?')],
    ['h', clip(h.bubble || first(h.summary), MAX)],
    ['a', P('flaky, or real?', 'did it pass before?')],
    ['h', clip('real: ' + low(String(h.summary).split(' · ').slice(-1)[0]), MAX)],
    ...P([['a', 'want me to look too?'], ['h', 'I need John on this']], [['a', 'logs say anything?'], ['h', 'they are pretty clear']]),
    ['a', P('John will sort it out', 'he will be back soon')],
    ['h', P('I hope so', 'thanks')]
  ];
  if (h.state === 'done') T.work = () => [
    ['a', P('what did you ship?', 'you are done too?', 'finished? what was it?')],
    ['h', clip(low(h.title), MAX)],
    ['a', P('how big?', 'big change?')],
    ['h', prog],
    ['h', P('and you?', 'what about you?')],
    ['a', clip(low(a.title) + (mine ? ', ' + mine : ''), MAX)],
    ['h', P('nice, review time then', 'John has reading to do')]
  ];
  // news goes stale after a few minutes, so the same story is not told all afternoon
  const news = NEWS.filter((n) => n.id !== a.id && n.id !== h.id && G.t - n.t < 240), n = news.length ? news[news.length - 1] : null, ns = n && G.S.find((x) => x.id === n.id);
  if (ns) T.news = () => [
    ['a', P('did you see ' + nameOf(ns) + '?', 'heard about ' + nameOf(ns) + '?')],
    ['h', P('no, what happened?', 'no, tell me')],
    ['a', clip(nameOf(ns) + ' ' + WHAT[n.state] + ' on ' + ns.plot, MAX)],
    ['h', n.state === 'done' ? 'nice! what was it?' : n.state === 'err' ? 'oh no, what broke?' : 'about what?'],
    ['a', clip(n.state === 'done' ? low(ns.title) : n.state === 'err' ? (ns.bubble || first(ns.summary)) : n.state === 'wait' ? (ns.bubble || ns.cmd || low(ns.title)) : low(ns.title), MAX)],
    ['h', n.state === 'done' ? P('good for them', 'about time') : n.state === 'err' ? 'poor ' + nameOf(ns) : 'John will get to it']
  ];
  const waits = G.S.filter((x) => x.state === 'wait'), hr = hourNow(), fails = G.S.filter((x) => x.state === 'err');
  T.john = () => [
    ['a', P('is John around?', 'seen John lately?')],
    ['h', waits.length ? clip(waits.length === 1 ? nameOf(waits[0]) + ' is waiting on him' : waits.length + ' of us wait on him', MAX) : 'all quiet, nobody waits'],
    ['a', isLunch(hr) ? 'lunch, probably' : hr >= 22 || hr < 6 ? 'it is late for him' : hr < 10 ? 'early start today' : 'busy day for him'],
    ['h', isLunch(hr) ? 'let him eat' : hr >= 22 || hr < 6 ? 'he should sleep' : 'he will come'],
    ...(fails.length ? [['a', clip(fails.length + ' failed run' + (fails.length > 1 ? 's' : '') + ' for him too', MAX)], ['h', 'he will want coffee']] : [])
  ];
  const host = hostOf(h), here = G.S.filter((x) => hostOf(x) === host), busy = here.filter((x) => x.state === 'run').length;
  T.machine = () => host.lat ? [
    ['a', P('ssh feels slow today', 'is the link laggy?')],
    ['h', clip(host.lat + ' here, same as ever', MAX)],
    ['a', clip(busy + ' of us busy on ' + host.name, MAX)],
    ['h', busy > 1 ? 'it holds up fine' : 'quiet box today']
  ] : [
    ['a', clip(busy + ' of us busy on this mac', MAX)],
    ['h', busy > 1 ? 'fans are spinning' : 'nice and quiet'],
    ['a', 'local is so fast'],
    ['h', 'no ssh lag at least']
  ];
  if (h.plot !== a.plot) T.projects = () => [
    ['a', clip('what is ' + h.plot + ' about?', MAX)],
    ['h', clip(low(h.title), MAX)],
    ['h', clip('and ' + a.plot + '?', MAX)],
    ['a', clip(low(a.title), MAX)],
    ...P([['h', 'sounds fun'], ['a', 'it is, mostly']], [['h', 'want to swap?'], ['a', 'ha, no thanks']])
  ];
  if (h.agent !== a.agent) T.agents = () => [
    ['a', clip('how is ' + h.agent + ' life?', MAX)],
    ['h', P('fast and tidy', 'lots of reading')],
    ['h', clip('and ' + a.agent + '?', MAX)],
    ['a', P('lots of tests', 'good, chatty', 'quiet, focused')],
    ['h', 'we make a good team']
  ];
  const ga = gene(a.id);
  T.small = () => ga.sleepy > 0.6 ? [['a', 'I could nap for a week'], ['h', 'you nap every day'], ['a', 'that is the point'], ['h', 'fair']]
    : ga.curious > 0.6 ? [['a', 'tabs or spaces?'], ['h', 'whatever the linter says'], ['a', 'boring answer'], ['h', 'safe answer']]
    : P([['a', 'rebase or merge?'], ['h', 'rebase, always'], ['a', 'brave'], ['h', 'clean history']], [['a', 'tea or coffee?'], ['h', 'tea, by my slab'], ['a', 'very civilised'], ['h', 'always']]);
  return T;
}
export function dialogue(a, h, r) {
  const T = topicsFor(a, h, r), pk = pairKey(a.id, h.id);
  const weight = (k) => ({ work: h.state === 'done' ? 3 : 8, news: 4, john: 2, machine: 1.5, projects: 2, agents: 1.5, small: 1 })[k] * (RECENT.some((x) => x.k === k && x.pair === pk) ? 0.05 : RECENT.slice(-4).some((x) => x.k === k) ? 0.35 : 1);
  const pickTopic = (keys) => { const tot = keys.reduce((s, k) => s + weight(k), 0); let x = r() * tot; for (const k of keys) { x -= weight(k); if (x <= 0) return k; } return keys[0]; };
  let keys = Object.keys(T); const first = T.work && h.state !== 'done' ? 'work' : pickTopic(keys);
  if (first === 'work') keys = keys.filter((k) => k !== 'projects');   // its project was just covered
  const chosen = [first]; keys = keys.filter((k) => k !== first);
  const more = 1 + (r() < 0.5 ? 1 : 0);   // two or three topics per visit
  for (let i = 0; i < more && keys.length; i++) { const k = pickTopic(keys); chosen.push(k); keys = keys.filter((x) => x !== k); }
  const lines = [];
  chosen.forEach((k, i) => {
    const part = T[k]();
    // a transition belongs to whoever starts the next topic: joined into its first line when it fits
    if (i) { const tr = pick(r, ['oh, also', 'anyway,', 'by the way,', 'speaking of which,', 'different thing:']), [w, t0] = part[0], joined = tr + ' ' + t0; if (joined.length <= MAX) part[0] = [w, joined]; else part.unshift([w, tr.replace(/[,:]$/, '…')]); }
    lines.push(...part); RECENT.push({ k, pair: pk });
  });
  if (RECENT.length > 12) RECENT.splice(0, RECENT.length - 12);
  lines.push(['a', pick(r, ['right, back to my desk', 'see you later', 'good talk', 'catch you later'])], ['h', pick(r, ['see you', 'later!', 'bye'])]);
  return lines;
}
function startTalk(as, ab, hs, hb, t) {
  const lines = dialogue(as, hs, ab.r);
  ab.talk = hb.talk = { lines, i: 0, next: t + 0.6, a: ab, h: hb, aId: as.id, hId: hs.id };
  ab.act.until = Infinity;   // the visit lasts as long as the exchange
}
function endTalk(c, t) { if (c.a.talk === c) c.a.talk = null; if (c.h.talk === c) c.h.talk = null; if (c.a.act.until === Infinity) c.a.act.until = t + 1.5; }
function talkStep(t) {
  const seen = new Set();
  for (const s of G.S) {
    const b = G.bodies[s.id], c = b && b.talk; if (!c || seen.has(c)) continue; seen.add(c);
    // the exchange stops if either one is called away (work, a state change) or walks off
    const as = G.S.find((x) => x.id === c.aId), hs = G.S.find((x) => x.id === c.hId);
    if (!as || wantsDesk(as) || c.a.path.length || (c.h.path.length && !wantsDesk(hs))) { endTalk(c, t); continue; }
    if (t < c.next) continue;
    if (c.i >= c.lines.length) { endTalk(c, t); continue; }
    const [who, text] = c.lines[c.i++], sp = who === 'a' ? c.a : c.h, other = who === 'a' ? c.h : c.a;
    sp.say = { text, until: t + 2.8 };
    sp.face = Math.sign((other.u - other.v) - (sp.u - sp.v)) || sp.face;
    if (c.i === c.lines.length && c.a.g.social > 0.5) emote(c.a, 'heart', 1.2, 1.2);
    c.next = t + 3.1;
  }
}

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
  if (s.state !== prev && WHAT[s.state]) { NEWS.push({ t, id: s.id, state: s.state }); if (NEWS.length > 12) NEWS.shift(); }
  if (s.state === 'done' && prev !== 'done') {
    leave(b); b.path = []; b.act = { type: 'celebrate', until: t + 2.4, label: 'celebrating: work done' }; emote(b, 'star', 2.2);
    for (const o of G.S) { const ob = G.bodies[o.id]; if (ob && o.id !== s.id && o.state !== 'idle' && hoodOf(ob) === home(s)) emote(ob, 'star', 1.4, 0.3 + ob.r()); }
  } else if (s.state === 'err' && prev !== 'err') {
    emote(b, 'bang', 1.5);
    const room = W().offices[s.plot];
    G.S.filter((o) => o.state === 'done' && o.id !== s.id).sort((a, c) => affinity(s.id, c.id) - affinity(s.id, a.id)).slice(0, 2).forEach((f) => {
      const fb = body(f), spot = room.guest.find((sp) => !sp.occ); if (!spot || fb.act.type === 'celebrate') return;
      claim(fb, spot); if (!goTo(fb, spot.u, spot.v)) return;
      fb.act = { type: 'comfort', friend: s.id, until: Infinity, stay: 12, label: 'comforting ' + gene(s.id).name };
    });
  } else if (s.state === 'wait' || (prev === 'idle' && wantsDesk(s))) emote(b, 'bang', 1.6);
}

/* ---------------- reduced motion: put everyone where they belong ---------------- */
export function settle() {
  for (const s of G.S) {
    const b = body(s); b.path = []; b.moving = false;
    if (wantsDesk(s) || s.state === 'idle') { leave(b); const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.act = { type: s.state === 'idle' ? 'sleep' : 'desk', label: s.state === 'idle' ? 'asleep by its dark slab' : '' }; b.face = 1; continue; }
    b.atDesk = false; const mine = homeOf(W(), s); if (!b.spot) { claim(b, mine); b.act = { type: 'nap', until: Infinity, arrived: G.t, label: LABEL.nap }; }
    b.u = b.spot.u; b.v = b.spot.v;
  }
}

/* ---------------- the tick ---------------- */
export function simulate(dt, t) {
  for (const s of G.S) {
    const b = body(s);
    if (b.emote && t > b.emote.until) b.emote = null;
    if (b.say && t > b.say.until) b.say = null;
    if (b.sayQ && t >= b.sayQ.at) { b.say = { text: b.sayQ.text, until: t + 2.6 }; b.sayQ = null; }
    // 1. real states win: work (and sleep) keep the blob at its desk, whatever it was doing
    if (wantsDesk(s) || s.state === 'idle') {
      const kind = s.state === 'idle' ? 'sleep' : 'desk';
      if (b.act.type !== kind) { leave(b); b.act = { type: kind, label: kind === 'sleep' ? 'asleep by its dark slab' : '' }; b.atDesk = false; const d = deskOf(W(), s); goTo(b, d.u, d.v); }
      if (!b.atDesk) { if (stepAlong(b, s, dt)) { const d = deskOf(W(), s); b.u = d.u; b.v = d.v; b.atDesk = true; b.face = 1; } }
      else if (s.state === 'run' && t > b.thinkAt) { if (b.thinkAt) emote(b, b.r() < 0.6 ? 'dots' : 'note', 1.4); b.thinkAt = t + 12 + b.r() * 18; }
      else if (s.state === 'idle' && b.r() < dt * 0.05) emote(b, 'z', 1.4);
      continue;
    }
    b.atDesk = false;
    if (b.act.type === 'desk' || b.act.type === 'sleep') b.act = { type: 'none', until: 0 };
    if (b.act.type === 'celebrate') { if (t < b.act.until) continue; b.act = { type: 'none', until: 0 }; }
    // 2. free time: walking somewhere, staying a while, then choosing again
    if (b.path.length) { stepAlong(b, s, dt); b.seated = false; waveCheck(b, t); continue; }
    b.moving = false;
    if (b.noPath) { b.noPath = false; b.act = { type: 'none', until: t + 1 }; continue; }
    if (b.act.until === Infinity) {
      b.act.arrived = t; b.act.until = t + (b.act.stay || 15);
      if (b.spot) { b.u = b.spot.u; b.v = b.spot.v; b.seated = b.act.type === 'nap' || b.act.type === 'read' || b.act.type === 'tea'; b.face = b.spot.face; }
      const fb = b.act.friend && G.bodies[b.act.friend], fs = b.act.friend && G.S.find((x) => x.id === b.act.friend);
      if (fb && !fb.talk) {
        b.face = Math.sign((fb.u - fb.v) - (b.u - b.v)) || 1;
        const kind = b.act.type, glyph = kind === 'comfort' || kind === 'company' ? 'heart' : 'wave';
        emote(b, glyph, 1.6); emote(fb, glyph, 1.4, 0.4);
        startTalk(s, b, fs, fb, t);
        befriend(b.id, fs.id, kind === 'visit' ? 1 : 2);
      }
    }
    if (b.act.type === 'nap' && b.r() < dt * 0.05) emote(b, 'z', 1.4);
    if (b.act.type === 'music' && b.act.arrived && b.r() < dt * 0.25) emote(b, 'note', 1.2);
    if (t >= b.act.until) choose(b, s, t);
  }
  talkStep(t);
}

// a fresh world: forget relationships
export function resetLife() { for (const k in aff) delete aff[k]; NEWS.length = 0; RECENT.length = 0; G.bodies = {}; }

/* ---------------- what the UI shows ---------------- */
export function activity(s) {
  const b = G.bodies[s.id]; if (!b) return '';
  if (wantsDesk(s)) return b.atDesk ? (s.state === 'run' ? 'working' : s.state === 'wait' ? 'waiting for you' : 'stopped on a failure') : 'hurrying back to its desk';
  if (s.state === 'idle') return b.atDesk ? 'asleep by its dark slab' : 'shuffling back to sleep';
  if (b.say) return 'saying "' + b.say.text + '"';
  if (b.talk) return b.talk.a === b ? 'talking with ' + gene(b.talk.hId).name : 'talking with ' + gene(b.talk.aId).name;
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
    if (b.spot && b.spot.occ !== b.id) bad.push(s.id + ' thinks it holds a spot it does not');
    const here = hoodOf(b); if (here && here !== home(s)) bad.push(s.id + ' wandered off its own machine to ' + here.h.name);
  }
  return bad;
}
