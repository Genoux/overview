// Tests for the blob generator and the society, run with `npm test` (no browser needed).
// The simulation runs at 20 ticks a second of simulated time, much faster than real time.
import assert from 'node:assert/strict';
import { G, INITIAL, EVENTS, clone } from '../js/core.js';
import { genome, validate, gene, resetGenes, RULES } from '../js/creatures.js';
import { buildWorld } from '../js/world.js';
import { body, simulate, onStateChange, audit, resetLife, affinity, NEEDS } from '../js/life.js';

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
test('names are unique in a world of 300 blobs', () => {
  resetGenes(); const names = new Set();
  for (let i = 0; i < 300; i++) names.add(gene('x' + i, 'claude').name);
  assert.equal(names.size, 300); resetGenes();
});

/* ---------------- the society ---------------- */
function boot(hour) {
  resetLife(); G.S = clone(INITIAL); G.world = buildWorld(); G.hourOverride = hour; G.t = 0;
  G.S.forEach(body);
}
// runs the world; returns per-creature traces sampled once a second
function run(seconds, { events = false, check = true } = {}) {
  const dt = 0.05, trace = {}; let t = G.t, nextEvent = 40, ev = 0, problems = [];
  for (const s of G.S) trace[s.id] = { time: {}, needs: [], types: new Set(), still: 0, maxStill: 0, low: {}, maxLow: {}, said: 0, deskLate: 0 };
  for (let i = 0; i < seconds / dt; i++) {
    t += dt; G.t = t; simulate(dt, t);
    if (events && t > nextEvent && ev < EVENTS.length) { const e = EVENTS[ev++], s = G.S.find((x) => x.id === e.id), prev = s.state; Object.assign(s, e.set); onStateChange(s, prev); nextEvent = t + 40; }
    if (i % 20) continue;
    if (check) { const bad = audit(); if (bad.length) problems.push(t.toFixed(1) + 's ' + bad[0]); }
    for (const s of G.S) {
      const b = G.bodies[s.id], tr = trace[s.id];
      if (s.state === 'run' || s.state === 'wait' || s.state === 'err') { if (!b.atDesk) tr.deskLate++; else tr.deskLate = 0; continue; }
      if (s.state === 'idle') continue;
      tr.needs.push(Object.assign({}, b.needs)); tr.moving = (tr.moving || 0) + (b.moving ? 1 : 0); tr.types.add(b.act.type); tr.time[b.act.type] = (tr.time[b.act.type] || 0) + 1; if (b.say) tr.said++;
      const busy = b.moving || (b.act.until && b.act.until > t);
      tr.still = busy ? 0 : tr.still + 1; tr.maxStill = Math.max(tr.maxStill, tr.still);
      for (const n of NEEDS) { tr.low[n] = b.needs[n] < 0.1 ? (tr.low[n] || 0) + 1 : 0; tr.maxLow[n] = Math.max(tr.maxLow[n] || 0, tr.low[n]); }
    }
  }
  return { trace, problems };
}
const free = () => G.S.filter((s) => s.state === 'done');
// the share of free time spent on one activity at a given hour
function share(hour, type) { boot(hour); const { trace } = run(400, { check: false }); let x = 0, all = 0; for (const s of free()) for (const k in trace[s.id].time) { all += trace[s.id].time[k]; if (k === type) x += trace[s.id].time[k]; } return x / all; }

boot(15);
const day = run(600);
test('invariants hold for 10 minutes: one spot per creature, always on the grid, needs in range', () => assert.deepEqual(day.problems.slice(0, 3), []));
test('no free creature stands around with nothing to do for more than 5 seconds', () => {
  const worst = free().map((s) => [s.id, day.trace[s.id].maxStill]).filter((x) => x[1] > 5); assert.deepEqual(worst, []);
});
test('needs stay healthy: on average between 40% and 95%, and none stays below 10% for over 20 seconds', () => {
  for (const s of free()) {
    const tr = day.trace[s.id];
    for (const n of NEEDS) {
      const avg = tr.needs.reduce((a, x) => a + x[n], 0) / tr.needs.length;
      assert.ok(avg > 0.4 && avg < 0.95, s.id + ' ' + n + ' average ' + avg.toFixed(2));
      assert.ok((tr.maxLow[n] || 0) <= 20, s.id + ' ' + n + ' below 10% for ' + tr.maxLow[n] + 's');
    }
  }
});
test('life has variety: every free creature does at least 4 different things in 10 minutes', () => {
  for (const s of free()) assert.ok(day.trace[s.id].types.size >= 4, s.id + ' only did ' + [...day.trace[s.id].types].join(', '));
});
test('creatures talk: every free creature speaks, and friendships grow', () => {
  for (const s of free()) assert.ok(day.trace[s.id].said > 0, s.id + ' never spoke');
  const grown = free().filter((s) => G.S.some((o) => o.id !== s.id && affinity(s.id, o.id) >= 4));
  assert.ok(grown.length >= 2, 'only ' + grown.length + ' creatures made a friend');
});

test('lunch: more time snacking than mid-afternoon', () => {
  const snackShare = (hour) => share(hour, 'snack');
  const lunch = snackShare(12.5), after = snackShare(15.5);
  assert.ok(lunch > after * 1.3, 'snack share lunch ' + lunch.toFixed(2) + ' vs afternoon ' + after.toFixed(2));
});
test('night: more time resting than the day', () => {
  const restShare = (hour) => share(hour, 'rest');
  const night = restShare(23.5), noon = restShare(15);
  assert.ok(night > noon * 1.3, 'rest share night ' + night.toFixed(2) + ' vs day ' + noon.toFixed(2));
});

test('a long lunch (30 minutes) does not wear them out, and they walk less than half the time', () => {
  boot(12.5); const { trace } = run(1800, { check: false }); let walking = 0, all = 0;
  for (const s of free()) {
    for (const n of NEEDS) { const avg = trace[s.id].needs.reduce((a, x) => a + x[n], 0) / trace[s.id].needs.length; assert.ok(avg > 0.4, s.id + ' ' + n + ' average ' + avg.toFixed(2)); }
    walking += trace[s.id].moving; all += trace[s.id].needs.length;
  }
  assert.ok(walking / all < 0.5, 'walking ' + Math.round(walking / all * 100) + '% of the time');
});

boot(15);
const live = run(320, { events: true });
test('with live state changes, invariants still hold', () => assert.deepEqual(live.problems.slice(0, 3), []));
test('a session that needs its desk gets there within 25 seconds', () => {
  for (const s of G.S) assert.ok(live.trace[s.id].deskLate * 1 <= 25, s.id + ' still not at its desk after ' + live.trace[s.id].deskLate + 's');
});
test('deterministic: the same start gives the same world', () => {
  const snap = () => { boot(15); run(120, { events: true, check: false }); return G.S.map((s) => { const b = G.bodies[s.id]; return [s.id, b.u.toFixed(3), b.v.toFixed(3), b.act.type, NEEDS.map((n) => b.needs[n].toFixed(3)).join('/')].join(' '); }); };
  assert.deepEqual(snap(), snap());
});

console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exitCode = failed ? 1 : 0;
