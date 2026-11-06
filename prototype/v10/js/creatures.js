// Creatures: a seeded genome per session, pixel sprites with expressions, and emote glyphs.
import { hash, rng, pick, C, INITIAL } from './core.js';
import { NOT_WORDS } from './notwords.js';


/* ---------------- the genome ----------------
   Personality is rolled first; the look is drawn from it, so you can read a blob's character from its face.
   Then a rule pass repairs anything that would look wrong (see RULES), so every random blob is a good blob. */
export const BUILDS = { round: [1.06, 0.94], tall: [0.94, 1.12], squat: [1.18, 0.84], small: [0.88, 0.88], big: [1.12, 1.1] };
const COST = { pattern: { none: 0, belly: 0.5, freckles: 0.5, spots: 1, band: 1 }, acc: { none: 0, tuft: 0.5, leaf: 0.5, sprout: 1, antenna: 1, cap: 1, horns: 1, crest: 1 }, mouth: { none: 0, smile: 0.5, o: 0.5 }, eyes: { dot: 0, sleepy: 0, wide: 0.5 } };
export const BUDGET = 2;
export const RULES = [
  ['silhouette', 'the body shape is the agent type (Claude a droplet, Codex a cube, Gemini twin lobes) and is never changed'],
  ['build', 'proportions come from five tested builds (round, tall, squat, small, big), never free-form scaling'],
  ['coat', 'one of five graphite greys; colour stays reserved for status'],
  ['budget', 'at most ' + BUDGET + ' points of decoration (accessory + wide eyes), so no blob is busy'],
  ['fit', 'Gemini has its own ears: no cap or horns; caps sit only on Codex\'s flat top; small blobs wear nothing wider than a tuft or a leaf, and keep their eyes close or normal'],
  ['unique', 'no two blobs in one world look the same: a newcomer that would copy someone changes its accessory, then its grey, then its build, then its eye spacing'],
  ['face', 'two small eyes and no mouth, as Hangar draws them; expressions change only the eyes'],
  ['gel', 'one smooth gel body lit from the top left: no painted patterns, so every blob shades the same way'],
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
    coat: wpick(r, { pale: 1, light: 1, mid: 1.2, dusk: 1, deep: 0.8 }),
    eyes: wpick(r, { dot: 1.6, sleepy: p.sleepy * 1.8, wide: p.curious * 1.4 }),
    mouth: wpick(r, { none: 1.2, smile: p.social * 1.4, o: p.talk > 0.8 ? 0.6 : 0.05 }),
    acc: wpick(r, { none: 1.2, antenna: p.curious * 1.2, tuft: lively * 1.1, sprout: (1 - lively) * 0.9, cap: 0.5, horns: (1 - p.social) * 0.8, crest: lively * 0.8, leaf: (1 - lively) * 0.7 }),
    pattern: wpick(r, { none: 1.6, belly: 0.7, freckles: p.social * 0.8, spots: 0.6, band: 0.5 }),
    spotSeed: Math.floor(r() * 1e6),
    gap: wpick(r, { close: 1, normal: 1.6, wide: p.curious + 0.4 })   // eye spacing
  });
}
// 3: the rule pass. It repairs, never rejects, so the result is still seeded and stable. Returns the rules it applied.
function repair(g) {
  const fixed = [];
  g.pattern = 'none'; g.mouth = 'none';   // the gel body: no pattern, no mouth (rules 'gel' and 'face')
  const set = (k, v, rule) => { if (g[k] !== v) { g[k] = v; fixed.push(rule); } };
  if (g.agent === 'gemini' && (g.acc === 'cap' || g.acc === 'horns')) set('acc', 'sprout', 'fit');
  if (g.agent !== 'codex' && g.acc === 'cap') set('acc', g.social > 0.5 ? 'sprout' : 'tuft', 'fit');
  if (g.build === 'small' && COST.acc[g.acc] > 0.5) set('acc', 'tuft', 'fit');
  if (g.build === 'small' && g.gap === 'wide') set('gap', 'normal', 'fit');
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
  if (!COATS.includes(g.coat)) v.push('coat');
  if (cost(g) > BUDGET) v.push('budget');
  if (g.agent === 'gemini' && (g.acc === 'cap' || g.acc === 'horns')) v.push('fit');
  if (g.agent !== 'codex' && g.acc === 'cap') v.push('fit');
  if (g.build === 'small' && (COST.acc[g.acc] > 0.5 || g.gap === 'wide')) v.push('fit');
  if (!['close', 'normal', 'wide'].includes(g.gap)) v.push('fit');
  if (g.pattern !== 'none') v.push('gel');
  if (g.mouth !== 'none') v.push('face');
  if (!/^[A-Z][a-z]{3,4}$/.test(g.name) || g.name.slice(0, 2).toLowerCase() === g.name.slice(2, 4) || NOT_NAMES.has(g.name) || NOT_WORDS.has(g.name.toLowerCase())) v.push('name');
  return v;
}

const COATS = ['pale', 'light', 'mid', 'dusk', 'deep'], ACCS = Object.keys(COST.acc), GAPS = ['close', 'normal', 'wide'];
// what makes two blobs look alike: same shape, build, grey, eyes, eye spacing and accessory
export const lookOf = (g) => [g.agent, g.build, g.coat, g.eyes, g.gap, g.acc].join('|');
const GENES = {}, usedLooks = new Set();
// rule 'unique': a blob that would copy someone already in the world changes, in this order, its accessory, its grey, its
// build, its eye spacing, picking the first combination that is free and still breaks no rule. Deterministic for a given world.
function makeUnique(g) {
  if (!usedLooks.has(lookOf(g))) return g;
  const rot = (list, from) => list.slice(list.indexOf(from)).concat(list.slice(0, list.indexOf(from)));
  for (const gap of rot(GAPS, g.gap)) for (const build of rot(Object.keys(BUILDS), g.build)) for (const coat of rot(COATS, g.coat)) for (const acc of rot(ACCS, g.acc)) {
    const c = Object.assign({}, g, { gap, build, coat, acc, hs: BUILDS[build][1], ws: BUILDS[build][0] });
    if (!usedLooks.has(lookOf(c)) && !validate(c).length) return c;
  }
  return g;
}
export function gene(id, agent) {
  if (GENES[id]) return GENES[id];
  const known = INITIAL.find((x) => x.id === id), g = makeUnique(genome(hash(id + '/signal'), agent || (known && known.agent) || 'claude'));
  usedNames.add(g.name); usedLooks.add(lookOf(g));
  return (GENES[id] = g);
}
export function resetGenes() { for (const k in GENES) delete GENES[k]; usedNames.clear(); usedLooks.clear(); }

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
function parseShape(rows) {
  let W = 0; const m = rows.map((r) => r.split(',').map((s) => { const p = s.split('-'); W = Math.max(W, +p[1]); return [+p[0], +p[1]]; }));
  return { W, H: rows.length, inside: (x, y) => y >= 0 && y < m.length && m[y].some((sp) => x >= sp[0] && x < sp[1]) };
}
function scaled(base, ws, hs) {
  const W = Math.max(10, Math.round(base.W * ws)), H = Math.max(8, Math.round(base.H * hs));
  return { W, H, inside: (x, y) => x >= 0 && y >= 0 && x < W && y < H && base.inside(Math.floor(x * base.W / W), Math.floor(y * base.H / H)) };
}

export const TOP = 5; // headroom for accessories
/* ---------- the gel body, after Hangar (inputs/floor/blobs.js) ----------
   No black outline: the edge is a darker tone of the body itself (darker on the shaded side), lit from the top left, with
   a soft shadow side, a bounce of light near the floor, a three-pixel glint and blended pixels in the outline's corners.
   The lit right edge catches a little of the slab's colour while the blob works. */
const T_OUT = 1, T_SH = 2, T_BASE = 3, T_HL = 4, T_SPEC = 5, T_BNC = 6, T_LOUT = 7;
const FORM = { claude: { p: 2, cy: 0.58, ry: 0.46, ey: 0.5 }, codex: { p: 3.2, cy: 0.5, ry: 0.5, ey: 0.42 }, gemini: { p: 2.4, cy: 0.58, ry: 0.44, ey: 0.5 } };
const hx = (c) => { if (c[0] !== '#') return (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
// body tones for a coat: how far each tone sits between the ground and the light (Hangar's dark-theme mix), scaled by the coat
const COAT_K = { pale: 1, light: 0.94, mid: 0.88, dusk: 0.8, deep: 0.73, dim: 0.64 };
export function tones(coatName, tint) {
  const bg = C.ground, fg = C.fg, k = COAT_K[coatName] || 1, m = (f) => mix(bg, fg, f * k);
  const T = { out: m(0.34), lout: m(0.66), sh: m(0.5), bounce: m(0.6), base: m(0.68), hl: m(0.84), spec: mix(bg, fg, Math.min(1, 1 * k + 0.1)), eye: C.side };
  T.aaD = mix(T.out, C.plate, 0.55); T.aaL = mix(T.lout, C.plate, 0.5);
  if (tint) { T.edge = mix(T.out, tint, 0.5); T.tint = mix(T.base, tint, 0.22); }
  return T;
}
export function coat(g, asleep) { const T = tones(asleep ? 'dim' : g.coat); return { d: T.sh, b: T.base, l: T.hl, h: T.spec }; }
function bodyGrid(mask, W, H, kind, flat) {
  const F = FORM[kind] || FORM.claude, at = (x, y) => y >= 0 && y < H && x >= 0 && x < W && mask(x, y);
  const hxh = W / 2, cy = (flat ? 0.55 : F.cy) * H, ry = (flat ? 0.5 : F.ry) * H, Lx = hxh - 0.38 * hxh, Ly = cy - 0.42 * ry;
  const side = (x, y) => ((x + 0.5 - hxh) / hxh) * 0.55 + ((y + 0.5 - cy) / ry) * 0.85;
  const E = [], g = [];
  for (let y = 0; y < H; y++) { E.push([]); g.push([]); for (let x = 0; x < W; x++) { const ed = at(x, y) && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)); E[y].push(ed ? (side(x, y) > -0.12 ? 2 : 1) : 0); g[y].push(0); } }
  const nearE = (x, y, k) => (x > 0 && E[y][x - 1] === k) || (x < W - 1 && E[y][x + 1] === k) || (y > 0 && E[y - 1][x] === k) || (y < H - 1 && E[y + 1][x] === k);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue;
    const dx = Math.abs((x + 0.5 - Lx) / hxh), dy = Math.abs((y + 0.5 - Ly) / ry), d = Math.pow(Math.pow(dx, F.p) + Math.pow(dy, F.p), 1 / F.p);
    let t = d < 1.02 ? T_BASE : T_SH;
    if (E[y][x] === 2) t = T_OUT; else if (E[y][x] === 1) t = T_LOUT;
    else if (nearE(x, y, 1) && side(x, y) < -0.4) t = T_HL;
    else if (((y + 1 < H && E[y + 1][x] === 2) || (x + 1 < W && E[y][x + 1] === 2)) && (y + 0.5 - cy) / ry > 0.2) t = T_BNC;
    g[y][x] = t;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const c = g[y][x]; if (!c || c === T_OUT || c === T_LOUT) continue; const a = g[y - 1][x]; if (a === g[y + 1][x] && a === g[y][x - 1] && a === g[y][x + 1] && a !== c && a && a !== T_OUT && a !== T_LOUT) g[y][x] = a; }
  const sx = Math.round(Lx) - 1, sy = flat ? 2 : Math.max(Math.round(Ly) - 2, kind === 'gemini' ? 5 : 2);
  for (const [px, py] of [[sx, sy], [sx + 1, sy], [sx - 1, sy + 1]]) if (at(px, py) && !E[py][px]) g[py][px] = T_SPEC;
  const AA = [];
  for (let y = 0; y < H - 3; y++) for (let x = 0; x < W; x++) { if (at(x, y)) continue; const L1 = at(x - 1, y), R1 = at(x + 1, y), U1 = at(x, y - 1), D1 = at(x, y + 1); if ((L1 || R1) && (U1 || D1) && !(L1 && R1)) AA.push([x, y, side(x, y) > -0.12]); }
  const span = []; for (let y = 0; y < H; y++) { let lo = -1, hi = -1; for (let x = 0; x < W; x++) if (at(x, y)) { if (lo < 0) lo = x; hi = x; } span.push([lo, hi]); }
  return { g, AA, span };
}
const cache = {};
const XEYE = ['X.X', '.X.', 'X.X'], HAPPY = ['.X.', 'X.X'];
// face: open | blink | closed | happy | x | focus | surprised | worried. tint: a status colour for the lit edge, or null
export function sprite(s, face, asleep, flat, tint) {
  const key = s.id + face + (asleep ? 'z' : '') + (flat ? 'f' : '') + (tint || '');
  if (cache[key]) return cache[key];
  const g = s.g || gene(s.id, s.agent), issues = [];
  const sh = scaled(parseShape((flat ? FLAT : SHAPES)[s.agent] || SHAPES.claude), g.ws, flat ? 1 : g.hs), W = sh.W + 2, H = sh.H + 2 + TOP;
  const T = tones(asleep ? 'dim' : g.coat, tint), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gx = cv.getContext('2d'), ox = 1, oy = TOP + 1;
  const px = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) issues.push('clipped'); gx.fillStyle = c; gx.fillRect(x, y, 1, 1); };
  const inb = sh.inside, B = bodyGrid(inb, sh.W, sh.H, s.agent, flat);
  const TONE = [null, T.out, T.sh, T.base, T.hl, T.spec, T.bounce, T.lout];
  for (const [x, y, dark] of B.AA) px(x + ox, y + oy, dark ? T.aaD : T.aaL);
  for (let y = 0; y < sh.H; y++) {
    const lit = tint && y > sh.H * 0.25 && y < sh.H - 1, hi = B.span[y][1];
    for (let x = 0; x < sh.W; x++) { const c = B.g[y][x]; if (!c) continue; let col = TONE[c]; if (lit && x === hi && c === T_OUT) col = T.edge; else if (lit && x === hi - 1 && c !== T_SPEC) col = T.tint; px(x + ox, y + oy, col); }
  }
  // face pixels must sit on the body with a body pixel on every side, or the face stops reading as a face
  const solid = (x, y) => inb(x - ox, y - oy) && inb(x - ox - 1, y - oy) && inb(x - ox + 1, y - oy) && inb(x - ox, y - oy - 1) && inb(x - ox, y - oy + 1);
  const fx = (x, y, c) => { if (!solid(x, y)) issues.push('face'); px(x, y, c); };
  // accessories in the body's own tones (no black ink), centred on the top
  if (!flat) {
    let topY = 0, topX = Math.round(sh.W / 2);
    for (let yy = 0; yy < sh.H; yy++) { const xs = []; for (let xx = 0; xx < sh.W; xx++) if (inb(xx, yy)) xs.push(xx); if (xs.length) { topY = yy; topX = Math.round((xs[0] + xs[xs.length - 1]) / 2); break; } }
    if (s.agent === 'gemini') { topX = Math.round(sh.W / 2); topY = 3; }
    const ax = topX + ox, ay = topY + oy - 1, D = T.out, L = T.hl, M = T.base;
    if (g.acc === 'sprout') { px(ax, ay, D); px(ax, ay - 1, D); px(ax - 1, ay - 2, L); px(ax - 2, ay - 2, M); px(ax - 1, ay - 3, M); px(ax + 1, ay - 2, L); px(ax + 2, ay - 2, M); px(ax + 1, ay - 3, M); }
    else if (g.acc === 'antenna') { px(ax, ay, D); px(ax, ay - 1, D); px(ax, ay - 2, D); px(ax - 1, ay - 4, T.spec); px(ax, ay - 4, L); px(ax - 1, ay - 3, L); px(ax, ay - 3, M); }
    else if (g.acc === 'cap') { for (let c2 = -2; c2 <= 2; c2++) { px(ax + c2, ay, T.sh); px(ax + c2, ay - 1, c2 < 0 ? L : M); } px(ax + 3, ay, T.sh); px(ax + 4, ay, D); }
    else if (g.acc === 'horns') { for (const sx of [-3, 3]) { px(ax + sx, ay, D); px(ax + sx, ay - 1, M); px(ax + sx, ay - 2, L); } }
    else if (g.acc === 'crest') { for (let c2 = -1; c2 <= 1; c2++) px(ax + c2, ay, D); px(ax - 1, ay - 1, M); px(ax, ay - 1, M); px(ax + 1, ay - 1, D); px(ax - 1, ay - 2, L); px(ax, ay - 2, L); px(ax, ay - 3, L); }
    else if (g.acc === 'leaf') { px(ax, ay, D); px(ax, ay - 1, D); px(ax + 1, ay - 2, M); px(ax + 2, ay - 2, L); px(ax + 1, ay - 3, L); px(ax + 2, ay - 3, M); }
    else if (g.acc === 'tuft') { px(ax - 1, ay, D); px(ax, ay - 1, M); px(ax + 1, ay, D); px(ax + 1, ay - 2, L); px(ax - 1, ay - 2, M); }
  }
  // eyes: two small vertical marks, Hangar's set of expressions; no mouth
  const F = FORM[s.agent] || FORM.claude, ey = Math.round(sh.H * (flat ? 0.42 : F.ey)) + oy, cx = Math.round(sh.W / 2) + ox, look = face === 'focus' ? 1 : 0;
  const sp = g.gap === 'close' ? 3 : g.gap === 'wide' ? 5 : 4, lx = cx - sp + look, rx = cx + sp - 1 + look, E = T.eye, mode = face === 'open' ? (g.eyes === 'wide' ? 'big' : g.eyes === 'sleepy' ? 'half' : 'open') : face;
  const stamp = (map, x, y) => { for (let r = 0; r < map.length; r++) for (let q = 0; q < map[r].length; q++) if (map[r][q] === 'X') fx(x + q, y + r, E); };
  if (mode === 'open' || mode === 'focus' || mode === 'worried') { fx(lx, ey, E); fx(lx, ey + 1, E); fx(rx, ey, E); fx(rx, ey + 1, E); }
  else if (mode === 'big' || mode === 'surprised') { for (const x of [lx, rx]) { fx(x, ey - 1, E); fx(x, ey, E); fx(x, ey + 1, E); } }
  else if (mode === 'half' || mode === 'blink') { fx(lx, ey + 1, E); fx(rx, ey + 1, E); }
  else if (mode === 'closed') { fx(lx - 1, ey + 1, E); fx(lx, ey + 1, E); fx(rx, ey + 1, E); fx(rx + 1, ey + 1, E); }
  else if (mode === 'happy') { stamp(HAPPY, lx - 1, ey); stamp(HAPPY, rx - 1, ey); }
  else if (mode === 'x') { stamp(XEYE, lx - 1, ey); stamp(XEYE, rx, ey); }
  if (mode === 'worried') { fx(lx - 1, ey - 2, E); fx(rx + 1, ey - 2, E); }
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
