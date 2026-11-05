// Creatures: a seeded genome per session, pixel sprites with expressions, and emote glyphs.
import { hash, rng, pick, C, RAMPS } from './core.js';

const SYL_C = ['p', 't', 'k', 'm', 'n', 'b', 'd', 'l', 'r', 'v', 'z', 's', 'f'], SYL_V = ['a', 'e', 'i', 'o', 'u', 'a', 'o'];
function makeName(r) { const syl = () => pick(r, SYL_C) + pick(r, SYL_V); const n = syl() + syl() + (r() < 0.3 ? pick(r, SYL_C) : ''); return n[0].toUpperCase() + n.slice(1); }

const GENES = {};
export function gene(id) {
  if (GENES[id]) return GENES[id];
  const r = rng(hash(id + '/signal'));
  return (GENES[id] = {
    hs: pick(r, [0.76, 0.88, 1, 1.12, 1.24]), ws: pick(r, [0.84, 0.94, 1.06, 1.2]), coat: pick(r, ['pale', 'mid', 'mid', 'dusk']),
    pattern: pick(r, ['none', 'spots', 'belly', 'band', 'freckles', 'none']), acc: pick(r, ['none', 'sprout', 'antenna', 'cap', 'horns', 'tuft', 'none']),
    eyes: pick(r, ['dot', 'dot', 'wide', 'sleepy', 'odd']), mouth: pick(r, ['none', 'smile', 'o', 'none']),
    social: r(), energy: 0.7 + r() * 0.7, curious: r(), sleepy: r(), talk: 0.3 + r() * 0.7, spotSeed: Math.floor(r() * 1e6), name: makeName(r)
  });
}

const SHAPES = {
  claude: ['10-12', '8-11', '7-11', '6-12', '4-14', '3-15', '2-16', '1-17', '1-17', '0-18', '0-18', '0-18', '0-18', '0-18', '0-18', '1-17', '2-16'],
  codex: ['4-12', '2-14', '1-15', '0-16', '0-16', '0-16', '0-16', '0-16', '0-16', '0-16', '0-16', '0-16', '0-16', '1-15', '2-14'],
  gemini: ['3-7,11-15', '2-8,10-16', '2-8,10-16', '2-16', '3-15', '2-16', '1-17', '0-18', '0-18', '0-18', '0-18', '0-18', '0-18', '0-18', '1-17', '2-16']
};
const FLAT = {
  claude: ['15-17', '9-16', '7-17', '5-19', '3-21', '1-23', '0-24', '0-24', '2-22'],
  codex: ['7-17', '5-19', '4-20', '2-22', '1-23', '0-24', '0-24', '2-22'],
  gemini: ['5-8,16-19', '4-20', '5-19', '3-21', '1-23', '0-24', '0-24', '2-22']
};
const DEF = {
  pale: { d: '#66686d', b: '#9a9ca1', l: '#bfc1c5', h: '#e1e2e5' }, lit: { d: '#56585d', b: '#85878c', l: '#a9abaf', h: '#d3d4d7' },
  dusk: { d: '#3f4145', b: '#66686d', l: '#86888c', h: '#a9abaf' }, dim: { d: '#38393d', b: '#515357', l: '#626468', h: '#75777b' }
};
function ramp(name) { return RAMPS[name] || DEF[name]; }
export function coat(g, asleep) { return asleep ? ramp('dim') : ramp(g.coat === 'mid' ? 'lit' : g.coat); }

function parseShape(rows) {
  let W = 0; const m = rows.map((r) => r.split(',').map((s) => { const p = s.split('-'); W = Math.max(W, +p[1]); return [+p[0], +p[1]]; }));
  return { W, H: rows.length, inside: (x, y) => y >= 0 && y < m.length && m[y].some((sp) => x >= sp[0] && x < sp[1]) };
}
function scaled(base, ws, hs) {
  const W = Math.max(10, Math.round(base.W * ws)), H = Math.max(8, Math.round(base.H * hs));
  return { W, H, inside: (x, y) => x >= 0 && y >= 0 && x < W && y < H && base.inside(Math.floor(x * base.W / W), Math.floor(y * base.H / H)) };
}

export const TOP = 5; // headroom for accessories
const cache = {};
// face: open | blink | closed | happy | x | focus | surprised | worried
export function sprite(s, face, asleep, flat) {
  const key = s.id + face + (asleep ? 'z' : '') + (flat ? 'f' : '');
  if (cache[key]) return cache[key];
  const g = gene(s.id), INK = C.creatureInk;
  const sh = scaled(parseShape((flat ? FLAT : SHAPES)[s.agent]), g.ws, flat ? 1 : g.hs), W = sh.W + 2, H = sh.H + 2 + TOP;
  const T = coat(g, asleep), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gx = cv.getContext('2d'), cx = sh.W / 2, cy = sh.H * 0.58, rx = sh.W / 2, ry = sh.H * 0.5, oy = TOP + 1;
  const px = (x, y, c) => { gx.fillStyle = c; gx.fillRect(x, y, 1, 1); };
  const inb = sh.inside;
  for (let y = -1; y <= sh.H; y++) for (let x = -1; x <= sh.W; x++) {
    if (inb(x, y)) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = -0.62 * nx - 0.78 * ny;
      let c = d > 0.62 ? T.h : d > 0.22 ? T.l : d > -0.38 ? T.b : T.d;
      if (y >= sh.H - 2) c = T.d;
      if (!flat && g.pattern === 'belly' && y > sh.H * 0.55 && y < sh.H - 2 && Math.abs(x + 0.5 - cx) < sh.W * 0.26) c = T.l;
      if (!flat && g.pattern === 'band' && Math.abs(y - Math.round(sh.H * 0.32)) < 1 && inb(x - 1, y) && inb(x + 1, y)) c = T.d;
      px(x + 1, y + oy, c);
    } else if (inb(x - 1, y) || inb(x + 1, y) || inb(x, y - 1) || inb(x, y + 1)) px(x + 1, y + oy, INK);
  }
  const ey = flat ? Math.floor(sh.H * 0.45) : Math.round(sh.H * (s.agent === 'codex' ? 0.42 : 0.5)), e0 = Math.round(cx) - 2, e1 = Math.round(cx) + 2, Y = ey + oy;
  if (!flat && g.pattern === 'spots') { const r = rng(g.spotSeed); for (let k = 0; k < 4; k++) { const sx = Math.floor(2 + r() * (sh.W - 4)), sy = Math.floor(sh.H * 0.25 + r() * sh.H * 0.55); if (inb(sx - 1, sy) && inb(sx + 1, sy) && Math.abs(sy - ey) > 1) px(sx + 1, sy + oy, T.d); } }
  if (!flat && g.pattern === 'freckles') { px(e0, Y + 2, T.d); px(e1 + 2, Y + 2, T.d); }
  if (!flat) {
    let topY = 0, topX = Math.round(cx);
    for (let yy = 0; yy < sh.H; yy++) { const xs = []; for (let xx = 0; xx < sh.W; xx++) if (inb(xx, yy)) xs.push(xx); if (xs.length) { topY = yy; topX = Math.round((xs[0] + xs[xs.length - 1]) / 2); break; } }
    if (s.agent === 'gemini') { topX = Math.round(cx); topY = 3; }
    const ax = topX + 1, ay = topY + oy - 1;
    if (g.acc === 'sprout') { px(ax, ay, INK); px(ax, ay - 1, INK); px(ax - 1, ay - 2, T.l); px(ax - 2, ay - 2, INK); px(ax - 1, ay - 3, INK); px(ax + 1, ay - 2, T.l); px(ax + 2, ay - 2, INK); px(ax + 1, ay - 3, INK); }
    else if (g.acc === 'antenna') { px(ax, ay, INK); px(ax, ay - 1, INK); px(ax, ay - 2, INK); px(ax - 1, ay - 4, T.h); px(ax, ay - 4, T.h); px(ax - 1, ay - 3, T.l); px(ax, ay - 3, T.l); }
    else if (g.acc === 'cap') { for (let c2 = -2; c2 <= 2; c2++) { px(ax + c2, ay, T.d); px(ax + c2, ay - 1, INK); } px(ax + 3, ay, INK); px(ax + 4, ay, INK); }
    else if (g.acc === 'horns') { px(ax - 3, ay, INK); px(ax - 3, ay - 1, T.l); px(ax - 3, ay - 2, INK); px(ax + 3, ay, INK); px(ax + 3, ay - 1, T.l); px(ax + 3, ay - 2, INK); }
    else if (g.acc === 'tuft') { px(ax - 1, ay, INK); px(ax, ay - 1, INK); px(ax + 1, ay, INK); px(ax + 1, ay - 2, INK); px(ax - 1, ay - 2, INK); }
  }
  const mx = Math.round((e0 + e1 + 1) / 2);
  const eyes = () => {
    if (g.eyes === 'wide') [e0, e1].forEach((e) => { px(e, Y, INK); px(e + 1, Y, INK); px(e, Y + 1, INK); px(e + 1, Y + 1, INK); px(e, Y, T.h); });
    else if (g.eyes === 'sleepy') [e0, e1].forEach((e) => { px(e, Y + 1, INK); px(e + 1, Y + 1, INK); });
    else if (g.eyes === 'odd') { px(e0, Y, INK); px(e0, Y + 1, INK); px(e1, Y, INK); px(e1 + 1, Y, INK); px(e1, Y + 1, INK); px(e1 + 1, Y + 1, INK); }
    else { px(e0, Y, INK); px(e0, Y + 1, INK); px(e1 + 1, Y, INK); px(e1 + 1, Y + 1, INK); }
  };
  if (face === 'open') eyes();
  else if (face === 'blink') { px(e0, Y + 1, INK); px(e1 + 1, Y + 1, INK); }
  else if (face === 'closed') { px(e0 - 1, Y + 1, INK); px(e0, Y + 1, INK); px(e1 + 1, Y + 1, INK); px(e1 + 2, Y + 1, INK); }
  else if (face === 'happy') [e0, e1 + 1].forEach((e) => { px(e - 1, Y + 1, INK); px(e, Y, INK); px(e + 1, Y + 1, INK); });
  else if (face === 'x') [e0 - 1, e1].forEach((e) => { px(e, Y, INK); px(e + 1, Y + 1, INK); px(e + 1, Y, INK); px(e, Y + 1, INK); });
  else if (face === 'focus') { px(e0, Y + 1, INK); px(e0 + 1, Y + 1, INK); px(e1, Y + 1, INK); px(e1 + 1, Y + 1, INK); px(e0, Y, T.d); px(e1 + 1, Y, T.d); }
  else if (face === 'surprised') [e0, e1].forEach((e) => { px(e, Y - 1, INK); px(e + 1, Y - 1, INK); px(e, Y, INK); px(e + 1, Y, INK); px(e, Y + 1, INK); px(e + 1, Y + 1, INK); px(e, Y - 1, T.h); });
  else if (face === 'worried') { eyes(); px(e0 - 1, Y - 2, INK); px(e0, Y - 1, INK); px(e1 + 2, Y - 2, INK); px(e1 + 1, Y - 1, INK); }
  if (!flat) {
    if (face === 'happy' || (face === 'open' && g.mouth === 'smile')) { px(mx - 1, Y + 3, INK); px(mx, Y + 3, INK); }
    else if (face === 'surprised') { px(mx - 1, Y + 3, INK); px(mx, Y + 3, INK); px(mx - 1, Y + 4, INK); px(mx, Y + 4, INK); }
    else if (face === 'worried') { px(mx - 2, Y + 4, INK); px(mx - 1, Y + 3, INK); px(mx, Y + 4, INK); px(mx + 1, Y + 3, INK); }
    else if (face === 'open' && g.mouth === 'o') px(mx, Y + 3, INK);
  }
  return (cache[key] = cv);
}
export function clearSprites() { for (const k in cache) delete cache[k]; }

// 5x5 emote glyphs, drawn inside a quiet outlined bubble
export const GLYPH = {
  dots: ['.....', '.....', 'x.x.x', '.....', '.....'], heart: ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'], q: ['.xxx.', '...x.', '..x..', '.....', '..x..'],
  note: ['..xx.', '..x.x', '..x..', 'xxx..', 'xx...'], star: ['..x..', '.xxx.', 'xxxxx', '.x.x.', 'x...x'], bang: ['..x..', '..x..', '..x..', '.....', '..x..'],
  coffee: ['.x.x.', '.....', 'xxxx.', 'xxx.x', '.xx..'], wave: ['x.x.x', 'x.x.x', 'xxxxx', 'xxxx.', '.xxx.'], food: ['.xxx.', 'xxxxx', '.....', 'xxxxx', '.xxx.'],
  sun: ['x.x.x', '.xxx.', 'xxxxx', '.xxx.', 'x.x.x']
};
