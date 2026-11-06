// Creatures: a seeded genome per session, pixel sprites with expressions, and emote glyphs.
import { hash, rng, pick, C, RAMPS, INITIAL } from './core.js';
import { NOT_WORDS } from './notwords.js';


/* ---------------- the genome ----------------
   Personality is rolled first; the look is drawn from it, so you can read a blob's character from its face.
   Then a rule pass repairs anything that would look wrong (see RULES), so every random blob is a good blob. */
export const BUILDS = { round: [1.06, 0.94], tall: [0.94, 1.12], squat: [1.18, 0.84], small: [0.88, 0.88], big: [1.12, 1.1] };
const COST = { pattern: { none: 0, belly: 0.5, freckles: 0.5, spots: 1, band: 1 }, acc: { none: 0, tuft: 0.5, sprout: 1, antenna: 1, cap: 1, horns: 1 }, mouth: { none: 0, smile: 0.5, o: 0.5 }, eyes: { dot: 0, sleepy: 0, wide: 0.5 } };
export const BUDGET = 2;
export const RULES = [
  ['silhouette', 'the body shape is the agent type (Claude a droplet, Codex a cube, Gemini twin lobes) and is never changed'],
  ['build', 'proportions come from five tested builds (round, tall, squat, small, big), never free-form scaling'],
  ['coat', 'one of three graphite coats; colour stays reserved for status'],
  ['budget', 'at most ' + BUDGET + ' points of decoration (pattern + accessory + mouth + wide eyes), so no blob is busy'],
  ['fit', 'Gemini has its own ears: no cap or horns; caps sit only on Codex\'s flat top; small blobs wear nothing wider than a tuft'],
  ['spots', 'only bodies wide enough to show them get spots or bands (not small or tall)'],
  ['mouth', 'a mouth needs room under the eyes (not on small or squat bodies)'],
  ['name', 'two soft syllables, no repeated syllable, no real word, unique in the world']
];
const SYL_C = ['p', 't', 'k', 'm', 'n', 'b', 'd', 'l', 'r', 'v', 's', 'f', 'g'], SYL_V = ['a', 'e', 'i', 'o', 'u'], SYL_END = ['n', 'm', 'l', 'r', 's'];
const NOT_NAMES = new Set(['Tobe', 'Bimbo', 'Dildo', 'Pupu', 'Kaka', 'Nazi', 'Pedo', 'Fuk', 'Sex', 'Rape', 'Dumb', 'Fat', 'Gay', 'Damn', 'Hell', 'Dame', 'Mama', 'Papa', 'Dada', 'Baba', 'Lame', 'Mole', 'Rude', 'Sore', 'Pain', 'Kill', 'Dead', 'Dole', 'Pile', 'Mute', 'Tumor', 'Vomit', 'Rapes', 'Lusus', 'Penis', 'Anus', 'Tits', 'Pubes', 'Nude', 'Butt', 'Poop', 'Pisa']);
const usedNames = new Set();
function makeName(r) {
  for (let t = 0; t < 40; t++) {
    const a = pick(r, SYL_C) + pick(r, SYL_V), b = pick(r, SYL_C) + pick(r, SYL_V);
    if (a === b) continue;
    const n0 = a + b + (r() < 0.3 ? pick(r, SYL_END) : ''), n = n0[0].toUpperCase() + n0.slice(1);
    if (NOT_NAMES.has(n) || NOT_WORDS.has(n0) || usedNames.has(n)) continue;
    return n;
  }
  return 'Blob' + Math.floor(r() * 1000);
}
// a weighted pick: weights may depend on personality
function wpick(r, table) { let tot = 0; for (const k in table) tot += Math.max(0, table[k]); let x = r() * tot; for (const k in table) { x -= Math.max(0, table[k]); if (x <= 0) return k; } return Object.keys(table)[0]; }

// 1 + 2: roll the personality, then the look from it (before any rule)
function roll(r, agent) {
  const p = { social: r(), energy: 0.7 + r() * 0.7, curious: r(), sleepy: r(), talk: 0.3 + r() * 0.7 };
  const lively = (p.energy - 0.7) / 0.7;
  return Object.assign(p, {
    agent,
    build: wpick(r, { round: 1 + p.social, tall: 0.6 + lively, squat: 0.4 + p.sleepy, small: 0.5 + lively * 0.6, big: 0.6 + (1 - lively) * 0.6 }),
    coat: wpick(r, { pale: 1, mid: 1.4, dusk: 1 }),
    eyes: wpick(r, { dot: 1.6, sleepy: p.sleepy * 1.8, wide: p.curious * 1.4 }),
    mouth: wpick(r, { none: 1.2, smile: p.social * 1.4, o: p.talk > 0.8 ? 0.6 : 0.05 }),
    acc: wpick(r, { none: 1.4, antenna: p.curious * 1.2, tuft: lively * 1.1, sprout: (1 - lively) * 0.9, cap: 0.5, horns: (1 - p.social) * 0.8 }),
    pattern: wpick(r, { none: 1.6, belly: 0.7, freckles: p.social * 0.8, spots: 0.6, band: 0.5 }),
    spotSeed: Math.floor(r() * 1e6)
  });
}
// 3: the rule pass. It repairs, never rejects, so the result is still seeded and stable. Returns the rules it applied.
function repair(g) {
  const fixed = [];
  const set = (k, v, rule) => { if (g[k] !== v) { g[k] = v; fixed.push(rule); } };
  if (g.agent === 'gemini' && (g.acc === 'cap' || g.acc === 'horns')) set('acc', 'sprout', 'fit');
  if (g.agent !== 'codex' && g.acc === 'cap') set('acc', g.social > 0.5 ? 'sprout' : 'tuft', 'fit');
  if (g.build === 'small' && COST.acc[g.acc] > 0.5) set('acc', 'tuft', 'fit');
  if ((g.build === 'small' || g.build === 'tall') && (g.pattern === 'spots' || g.pattern === 'band')) set('pattern', 'belly', 'spots');
  if ((g.build === 'small' || g.build === 'squat') && g.mouth !== 'none') set('mouth', 'none', 'mouth');
  const down = { pattern: 'none', mouth: 'none', eyes: 'dot', acc: 'tuft' };
  for (const f of ['pattern', 'mouth', 'eyes', 'acc']) { if (cost(g) <= BUDGET) break; set(f, down[f], 'budget'); }
  g.hs = BUILDS[g.build][1]; g.ws = BUILDS[g.build][0];
  return fixed;
}
export function genome(seed, agent) { return explainGenome(seed, agent).g; }
// the same blob with its raw roll and the rules that changed it (for the explainer)
export function explainGenome(seed, agent) {
  const r = rng(seed), g = roll(r, agent), raw = Object.assign({}, g, { hs: BUILDS[g.build][1], ws: BUILDS[g.build][0] }), fixed = repair(g);
  g.name = makeName(r); raw.name = g.name;
  return { g, raw, fixed };
}
export function cost(g) { return COST.pattern[g.pattern] + COST.acc[g.acc] + COST.mouth[g.mouth] + COST.eyes[g.eyes]; }
// every rule as a check; the tests run thousands of genomes through this and expect no violations
export function validate(g) {
  const v = [];
  if (!BUILDS[g.build]) v.push('build');
  if (!['pale', 'mid', 'dusk'].includes(g.coat)) v.push('coat');
  if (cost(g) > BUDGET) v.push('budget');
  if (g.agent === 'gemini' && (g.acc === 'cap' || g.acc === 'horns')) v.push('fit');
  if (g.agent !== 'codex' && g.acc === 'cap') v.push('fit');
  if (g.build === 'small' && COST.acc[g.acc] > 0.5) v.push('fit');
  if ((g.build === 'small' || g.build === 'tall') && (g.pattern === 'spots' || g.pattern === 'band')) v.push('spots');
  if ((g.build === 'small' || g.build === 'squat') && g.mouth !== 'none') v.push('mouth');
  if (!/^[A-Z][a-z]{3,4}$/.test(g.name) || g.name.slice(0, 2).toLowerCase() === g.name.slice(2, 4) || NOT_NAMES.has(g.name) || NOT_WORDS.has(g.name.toLowerCase())) v.push('name');
  return v;
}

const GENES = {};
export function gene(id, agent) {
  if (GENES[id]) return GENES[id];
  const known = INITIAL.find((x) => x.id === id), g = genome(hash(id + '/signal'), agent || (known && known.agent) || 'claude');
  usedNames.add(g.name);
  return (GENES[id] = g);
}
export function resetGenes() { for (const k in GENES) delete GENES[k]; usedNames.clear(); }

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
  const g = s.g || gene(s.id, s.agent), INK = C.creatureInk, issues = [];
  const sh = scaled(parseShape((flat ? FLAT : SHAPES)[s.agent]), g.ws, flat ? 1 : g.hs), W = sh.W + 2, H = sh.H + 2 + TOP;
  const T = coat(g, asleep), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gx = cv.getContext('2d'), cx = sh.W / 2, cy = sh.H * 0.58, rx = sh.W / 2, ry = sh.H * 0.5, oy = TOP + 1;
  const px = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) issues.push('clipped'); gx.fillStyle = c; gx.fillRect(x, y, 1, 1); };
  const inb = sh.inside;
  // face pixels must sit on the body with a body pixel on every side, or the face stops reading as a face
  const solid = (x, y) => inb(x - 1, y - oy) && inb(x - 2, y - oy) && inb(x, y - oy) && inb(x - 1, y - oy - 1) && inb(x - 1, y - oy + 1);
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
  const fx = (x, y, c) => { if (!solid(x, y)) issues.push('face'); px(x, y, c); };
  const mx = Math.round((e0 + e1 + 1) / 2);
  const eyes = () => {
    if (g.eyes === 'wide') [e0, e1].forEach((e) => { fx(e, Y, INK); fx(e + 1, Y, INK); fx(e, Y + 1, INK); fx(e + 1, Y + 1, INK); fx(e, Y, T.h); });
    else if (g.eyes === 'sleepy') [e0, e1].forEach((e) => { fx(e, Y + 1, INK); fx(e + 1, Y + 1, INK); });
    else { fx(e0, Y, INK); fx(e0, Y + 1, INK); fx(e1 + 1, Y, INK); fx(e1 + 1, Y + 1, INK); }
  };
  if (face === 'open') eyes();
  else if (face === 'blink') { fx(e0, Y + 1, INK); fx(e1 + 1, Y + 1, INK); }
  else if (face === 'closed') { fx(e0 - 1, Y + 1, INK); fx(e0, Y + 1, INK); fx(e1 + 1, Y + 1, INK); fx(e1 + 2, Y + 1, INK); }
  else if (face === 'happy') [e0, e1 + 1].forEach((e) => { fx(e - 1, Y + 1, INK); fx(e, Y, INK); fx(e + 1, Y + 1, INK); });
  else if (face === 'x') [e0 - 1, e1].forEach((e) => { fx(e, Y, INK); fx(e + 1, Y + 1, INK); fx(e + 1, Y, INK); fx(e, Y + 1, INK); });
  else if (face === 'focus') { fx(e0, Y + 1, INK); fx(e0 + 1, Y + 1, INK); fx(e1, Y + 1, INK); fx(e1 + 1, Y + 1, INK); fx(e0, Y, T.d); fx(e1 + 1, Y, T.d); }
  else if (face === 'surprised') [e0, e1].forEach((e) => { fx(e, Y - 1, INK); fx(e + 1, Y - 1, INK); fx(e, Y, INK); fx(e + 1, Y, INK); fx(e, Y + 1, INK); fx(e + 1, Y + 1, INK); fx(e, Y - 1, T.h); });
  else if (face === 'worried') { eyes(); fx(e0 - 1, Y - 2, INK); fx(e0, Y - 1, INK); fx(e1 + 2, Y - 2, INK); fx(e1 + 1, Y - 1, INK); }
  if (!flat) {
    if (face === 'happy' || (face === 'open' && g.mouth === 'smile')) { fx(mx - 1, Y + 3, INK); fx(mx, Y + 3, INK); }
    else if (face === 'surprised') { fx(mx - 1, Y + 3, INK); fx(mx, Y + 3, INK); fx(mx - 1, Y + 4, INK); fx(mx, Y + 4, INK); }
    else if (face === 'worried') { fx(mx - 2, Y + 4, INK); fx(mx - 1, Y + 3, INK); fx(mx, Y + 4, INK); fx(mx + 1, Y + 3, INK); }
    else if (face === 'open' && g.mouth === 'o') fx(mx, Y + 3, INK);
  }
  cv.issues = [...new Set(issues)];
  return (cache[key] = cv);
}
export function clearSprites() { for (const k in cache) delete cache[k]; }

// 5x5 emote glyphs, drawn inside a quiet outlined bubble
export const GLYPH = {
  dots: ['.....', '.....', 'x.x.x', '.....', '.....'], heart: ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'], q: ['.xxx.', '...x.', '..x..', '.....', '..x..'],
  note: ['..xx.', '..x.x', '..x..', 'xxx..', 'xx...'], star: ['..x..', '.xxx.', 'xxxxx', '.x.x.', 'x...x'], bang: ['..x..', '..x..', '..x..', '.....', '..x..'],
  coffee: ['.x.x.', '.....', 'xxxx.', 'xxx.x', '.xx..'], wave: ['x.x.x', 'x.x.x', 'xxxxx', 'xxxx.', '.xxx.'], food: ['.xxx.', 'xxxxx', '.....', 'xxxxx', '.xxx.'],
  sun: ['x.x.x', '.xxx.', 'xxxxx', '.xxx.', 'x.x.x'], z: ['xxxx.', '..x..', '.x...', 'xxxx.', '.....']
};
