// Tests for the blob generator and the society, run with `npm test` (no browser needed).
// The simulation runs at 20 ticks a second of simulated time, much faster than real time.
import assert from 'node:assert/strict';
import { G, INITIAL, EVENTS, clone } from '../js/core.js';
import { genome, validate, gene, resetGenes, RULES } from '../js/creatures.js';
import { NOT_WORDS } from '../js/notwords.js';
import { buildWorld, findPath } from '../js/world.js';
import { HUBS } from '../js/hubmaps.js';
import { body, simulate, onStateChange, audit, resetLife, affinity } from '../js/life.js';

let failed = 0;
function test(name, fn) { try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); } }

/* ---------------- the generator ---------------- */
test('20,000 random blobs break no rule (' + RULES.length + ' rules)', () => {
  const bad = {};
  for (let i = 0; i < 20000; i++) { const g = genome(i * 7919 + 13, ['claude', 'codex', 'gemini'][i % 3]); for (const v of validate(g)) bad[v] = (bad[v] || 0) + 1; }
  assert.deepEqual(bad, {});
});
test('the same seed always gives the same blob', () => {
  assert.deepEqual(genome(42, 'claude'), genome(42, 'claude'));
});
test('variety: every build, coat, eye, accessory and pattern shows up', () => {
  const seen = { build: new Set(), coat: new Set(), eyes: new Set(), acc: new Set(), pattern: new Set(), mouth: new Set() };
  for (let i = 0; i < 3000; i++) { const g = genome(i, ['claude', 'codex', 'gemini'][i % 3]); for (const k in seen) seen[k].add(g[k]); }
  assert.equal(seen.build.size, 5); assert.equal(seen.coat.size, 3); assert.equal(seen.eyes.size, 3); assert.equal(seen.acc.size, 6); assert.equal(seen.pattern.size, 5); assert.equal(seen.mouth.size, 3);
});
test('the look follows the personality: sleepy blobs mostly have sleepy eyes, curious ones wide eyes', () => {
  let sleepy = 0, sleepyN = 0, alert = 0, alertN = 0;
  for (let i = 0; i < 6000; i++) { const g = genome(i, 'claude'); if (g.sleepy > 0.8) { sleepyN++; if (g.eyes === 'sleepy') sleepy++; } if (g.sleepy < 0.2) { alertN++; if (g.eyes === 'sleepy') alert++; } }
  assert.ok(sleepy / sleepyN > 3 * (alert / alertN), 'sleepy eyes ' + (sleepy / sleepyN).toFixed(2) + ' vs ' + (alert / alertN).toFixed(2));
});
test('no name is a real word (checked against the system dictionary list)', () => {
  for (let i = 0; i < 5000; i++) { const n = genome(i * 31 + 5, 'claude').name.toLowerCase(); assert.ok(!NOT_WORDS.has(n), n + ' is a real word'); }
});
test('names are unique in a world of 300 blobs', () => {
  resetGenes(); const names = new Set();
  for (let i = 0; i < 300; i++) names.add(gene('x' + i, 'claude').name);
  assert.equal(names.size, 300); resetGenes();
});

/* ---------------- the society ---------------- */
function boot(hour, allFree) {
  resetLife(); G.S = clone(INITIAL); if (allFree) G.S.forEach((x) => { x.state = 'done'; });
  G.world = buildWorld(); G.hourOverride = hour; G.t = 0;
  G.S.forEach(body);
}
// runs the world; returns per-creature traces sampled once a second
function run(seconds, { events = false, check = true } = {}) {
  const dt = 0.05, trace = {}; let t = G.t, nextEvent = 40, ev = 0; const problems = [];
  for (const s of G.S) trace[s.id] = { time: {}, types: new Set(), still: 0, maxStill: 0, said: 0, deskLate: 0, moving: 0, samples: 0 };
  for (let i = 0; i < seconds / dt; i++) {
    t += dt; G.t = t; simulate(dt, t);
    if (events && t > nextEvent && ev < EVENTS.length) { const e = EVENTS[ev++], s = G.S.find((x) => x.id === e.id), prev = s.state; Object.assign(s, e.set); onStateChange(s, prev); nextEvent = t + 40; }
    if (i % 20) continue;
    if (check) { const bad = audit(); if (bad.length) problems.push(t.toFixed(1) + 's ' + bad[0]); }
    for (const s of G.S) {
      const b = G.bodies[s.id], tr = trace[s.id];
      if (s.state === 'run' || s.state === 'wait' || s.state === 'err') { if (!b.atDesk) tr.deskLate++; else tr.deskLate = 0; continue; }
      if (s.state === 'idle') continue;
      tr.samples++; tr.types.add(b.act.type); tr.time[b.act.type] = (tr.time[b.act.type] || 0) + 1; tr.moving += b.moving ? 1 : 0; if (b.say) tr.said++;
      const busy = b.moving || (b.act.until && b.act.until > t);
      tr.still = busy ? 0 : tr.still + 1; tr.maxStill = Math.max(tr.maxStill, tr.still);
    }
  }
  return { trace, problems };
}
const free = () => G.S.filter((s) => s.state === 'done');
// the share of free time spent on one activity at a given hour (every session free, so there are enough blobs to count)
function share(hour, type) { boot(hour, true); const { trace } = run(400, { check: false }); let x = 0, all = 0; for (const s of free()) for (const k in trace[s.id].time) { all += trace[s.id].time[k]; if (k === type) x += trace[s.id].time[k]; } return x / all; }

boot(15);
const day = run(600);
test('invariants hold for 10 minutes: one spot per blob, always on the grid, never inside a prop', () => assert.deepEqual(day.problems.slice(0, 3), []));
test('no free blob stands around with nothing to do for more than 5 seconds', () => {
  const worst = free().map((s) => [s.id, day.trace[s.id].maxStill]).filter((x) => x[1] > 5); assert.deepEqual(worst, []);
});
// three, not four: staying put now carries on the same activity, so a content blob may only chat, snack and play
test('life has variety: every free blob does at least 3 different things in 10 minutes', () => {
  for (const s of free()) assert.ok(day.trace[s.id].types.size >= 3, s.id + ' only did ' + [...day.trace[s.id].types].join(', '));
});
test('blobs talk: every free blob speaks, and friendships grow', () => {
  for (const s of free()) assert.ok(day.trace[s.id].said > 0, s.id + ' never spoke');
  const grown = free().filter((s) => G.S.some((o) => o.id !== s.id && affinity(s.id, o.id) >= 4));
  assert.ok(grown.length >= 2, 'only ' + grown.length + ' blobs made a friend');
});
test('they walk less than half of their free time', () => {
  let m = 0, n = 0; for (const s of free()) { m += day.trace[s.id].moving; n += day.trace[s.id].samples; }
  assert.ok(m / n < 0.5, 'walking ' + Math.round(m / n * 100) + '%');
});
test('personality shows: the sleepiest blobs rest more than the most awake ones', () => {
  boot(15, true); const { trace } = run(900, { check: false });
  const rest = (s) => (trace[s.id].time.rest || 0) / trace[s.id].samples, byS = G.S.slice().sort((a, b) => G.bodies[a.id].g.sleepy - G.bodies[b.id].g.sleepy);
  const lo = byS.slice(0, 4).reduce((a, s) => a + rest(s), 0) / 4, hi = byS.slice(-4).reduce((a, s) => a + rest(s), 0) / 4;
  assert.ok(hi > lo * 1.5, 'rest share sleepiest ' + hi.toFixed(2) + ' vs most awake ' + lo.toFixed(2));
});
test('lunch: more time snacking than mid-afternoon', () => {
  const lunch = share(12.5, 'snack'), after = share(15.5, 'snack');
  assert.ok(lunch > after * 1.5, 'snack share lunch ' + lunch.toFixed(2) + ' vs afternoon ' + after.toFixed(2));
});
test('night: more time resting than the day', () => {
  const night = share(23.5, 'rest'), noon = share(15, 'rest');
  assert.ok(night > noon * 1.3, 'rest share night ' + night.toFixed(2) + ' vs day ' + noon.toFixed(2));
});

boot(15);
const live = run(320, { events: true });
test('with live state changes, invariants still hold', () => assert.deepEqual(live.problems.slice(0, 3), []));
test('work wins: a session that needs its desk gets there within 25 seconds, whatever it was doing', () => {
  for (const s of G.S) assert.ok(live.trace[s.id].deskLate <= 25, s.id + ' still not at its desk after ' + live.trace[s.id].deskLate + 's');
});
test('every hub composition: each bridge reaches every open cell of the park', () => {
  for (const name of Object.keys(HUBS)) {
    G.hub = name; const W = buildWorld(), h = W.hub, open = h.spots;
    for (const [u, v] of [[h.cu, h.v0], [h.cu, h.v1 - 1], [h.u0, h.cv], [h.u1 - 1, h.cv]]) assert.ok(!W.blocked[u + ',' + v], name + ': bridge entry ' + u + ',' + v + ' is blocked');
    const unreachable = open.filter((sp) => !findPath(W, h.cu + 0.5, h.v0 + 0.5, sp.u, sp.v) && !(Math.floor(sp.u) === h.cu && Math.floor(sp.v) === h.v0));
    assert.deepEqual(unreachable.map((sp) => name + ' ' + sp.u + ',' + sp.v).slice(0, 3), []);
  }
  G.hub = undefined;
});
test('deterministic: the same start gives the same world', () => {
  const snap = () => { boot(15); run(120, { events: true, check: false }); return G.S.map((s) => { const b = G.bodies[s.id]; return [s.id, b.u.toFixed(3), b.v.toFixed(3), b.act.type].join(' '); }); };
  assert.deepEqual(snap(), snap());
});

console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exitCode = failed ? 1 : 0;
