// Wild animals roaming the hub park: a stag and a badger. Scenery with a life of its own, never agents. Sprites come from assets/critters (see assets/CREDITS.md).
import { rng, hash } from './core.js';
import { randomStreet, findPath } from './world.js';

// frame size and frame count of each strip, per animal and action
export const KINDS = {
  stag: { w: 32, h: 41, frames: { idle: 24, walk: 11 }, speed: 1.1, fps: { idle: 8, walk: 12 } },
  badger: { w: 42, h: 32, frames: { idle: 22, walk: 9 }, speed: 0.7, fps: { idle: 8, walk: 12 } }
};
export const CRITTERS = [];
export function spawnCritters(W) {
  CRITTERS.length = 0;
  for (const kind of Object.keys(KINDS)) { const r = rng(hash('critter/' + kind)), c = randomStreet(W, W.hub, r); CRITTERS.push({ kind, u: c.u, v: c.v, path: [], dir: 'SE', until: 0, r, moving: false }); }
}
// screen direction of a step on the grid: +u is down-right (SE), +v is down-left (SW)
const dirOf = (du, dv) => (Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 'SE' : 'NW') : (dv > 0 ? 'SW' : 'NE'));
export function moveCritters(W, dt, t) {
  for (const c of CRITTERS) {
    if (c.path.length) {
      const n = c.path[0], du = n.u - c.u, dv = n.v - c.v, d = Math.hypot(du, dv), sp = KINDS[c.kind].speed * dt;
      c.moving = true; if (d > 0.01) c.dir = dirOf(du, dv);
      if (d <= sp) { c.u = n.u; c.v = n.v; c.path.shift(); } else { c.u += du / d * sp; c.v += dv / d * sp; }
      if (!c.path.length) { c.moving = false; c.until = t + 3 + c.r() * 7; }
      continue;
    }
    if (t < c.until) continue;
    // wander somewhere close on the hub, or graze a while longer
    if (c.r() < 0.6) { const g = randomStreet(W, W.hub, c.r), p = findPath(W, c.u, c.v, g.u, g.v); if (p && p.length < 14) { c.path = p; continue; } }
    c.until = t + 2 + c.r() * 5;
  }
}
