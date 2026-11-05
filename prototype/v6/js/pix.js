// True pixel art for landmarks: every sprite is rasterised at 1x into a pixel buffer (no anti-aliasing),
// using the world's 2:1 projection (1 tile = 16 x 8 px), then drawn scaled by an integer factor like the creatures.
import { C } from './core.js';

function rgba(c) {
  if (c[0] === '#') { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; }
  const m = c.match(/[\d.]+/g); return [+m[0], +m[1], +m[2], m[3] != null ? Math.round(+m[3] * 255) : 255];
}

class Sprite {
  // ox, oy: pixel position of the footprint's back corner (u=0, v=0, h=0)
  constructor(w, h, ox, oy) { this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.buf = new Uint8ClampedArray(w * h * 4); }
  p(u, v, hh) { return [this.ox + (u - v) * 16, this.oy + (u + v) * 8 - hh]; }
  set(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4, k = rgba(c); this.buf[i] = k[0]; this.buf[i + 1] = k[1]; this.buf[i + 2] = k[2]; this.buf[i + 3] = k[3]; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.buf[(y * this.w + x) * 4 + 3]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  // fill a polygon by testing pixel centres: crisp 2:1 stair-step edges, no blending
  poly(pts, c) {
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const px = x + 0.5, py = y + 0.5; let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; }
      if (inside) this.set(x, y, c);
    }
  }
  // an upright box: footprint (u, v, w, d) in tiles, from height h0 to h1 in pixels
  box(u, v, w, d, h0, h1, col) {
    const P = (a, b, h) => this.p(a, b, h);
    this.poly([P(u, v + d, h0), P(u + w, v + d, h0), P(u + w, v + d, h1), P(u, v + d, h1)], col.left);
    this.poly([P(u + w, v + d, h0), P(u + w, v, h0), P(u + w, v, h1), P(u + w, v + d, h1)], col.right);
    this.poly([P(u, v, h1), P(u + w, v, h1), P(u + w, v + d, h1), P(u, v + d, h1)], col.top);
    if (col.edge) { // a 1px highlight along the front edges of the top face
      const a = P(u, v + d, h1), b = P(u + w, v + d, h1), c2 = P(u + w, v, h1);
      this.line(a, b, col.edge); this.line(b, c2, col.edge);
    }
  }
  line(a, b, c) { const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); for (let i = 0; i <= n; i++) this.set(Math.round(a[0] + (b[0] - a[0]) * i / n - 0.5), Math.round(a[1] + (b[1] - a[1]) * i / n - 0.5), c); }
  // a quad on the left (+v) face: along u from a0..a1 tiles, heights h0..h1
  leftQuad(u, v, d, a0, a1, h0, h1, c) { const P = (a, h) => this.p(u + a, v + d, h); this.poly([P(a0, h0), P(a1, h0), P(a1, h1), P(a0, h1)], c); }
  rightQuad(u, v, w, a0, a1, h0, h1, c) { const P = (a, h) => this.p(u + w, v + a, h); this.poly([P(a0, h0), P(a1, h0), P(a1, h1), P(a0, h1)], c); }
  // pixel text running along the left face (it slants 1px down every 2px across, like the face)
  leftText(u, v, d, a0, hTop, text, c, halo) {
    const start = this.p(u + a0, v + d, hTop); let x = Math.round(start[0]), cursor = 0;
    for (const ch of text) {
      const g = FONT[ch] || FONT[' '];
      for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) if (g[r][col] === 'x') {
        const gx = x + cursor + col, gy = Math.round(start[1] + (cursor + col) / 2) + r;
        if (halo) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.isText(gx + dx, gy + dy)) this.set(gx + dx, gy + dy, halo);
        this.set(gx, gy, c); this.mark(gx, gy);
      }
      cursor += 4;
    }
  }
  mark(x, y) { (this.textPx = this.textPx || new Set()).add(x + ',' + y); }
  isText(x, y) { return this.textPx && this.textPx.has(x + ',' + y); }
  // a 1px outline around the whole silhouette
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.get(x, y) && (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1))) add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, c);
  }
  disc(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, c); }
  canvas() { const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h; cv.getContext('2d').putImageData(new ImageData(this.buf, this.w, this.h), 0, 0); return cv; }
}

// 3x5 pixel font for signs
const FONT = {
  ' ': ['...', '...', '...', '...', '...'],
  A: ['.x.', 'x.x', 'xxx', 'x.x', 'x.x'], B: ['xx.', 'x.x', 'xx.', 'x.x', 'xx.'], C: ['.xx', 'x..', 'x..', 'x..', '.xx'], E: ['xxx', 'x..', 'xx.', 'x..', 'xxx'],
  F: ['xxx', 'x..', 'xx.', 'x..', 'x..'], H: ['x.x', 'x.x', 'xxx', 'x.x', 'x.x'], T: ['xxx', '.x.', '.x.', '.x.', '.x.'], U: ['x.x', 'x.x', 'x.x', 'x.x', 'xxx'],
  O: ['.x.', 'x.x', 'x.x', 'x.x', '.x.'], P: ['xx.', 'x.x', 'xx.', 'x..', 'x..'], N: ['x.x', 'xxx', 'xxx', 'x.x', 'x.x'], R: ['xx.', 'x.x', 'xx.', 'x.x', 'x.x'], S: ['.xx', 'x..', '.x.', '..x', 'xx.']
};

const L = { top: '#5a5b60', left: '#3e3f43', right: '#2c2d30', roof: '#47484c', door: '#18191b', glass: '#20242a' };
const F = { leafDark: '#2f4034', leaf: '#43594a', leafLight: '#5c7663', stem: '#3a463d', soil: '#2a2421', soilLight: '#3a322d', wilt: '#4a4642', bark: '#3b302a', barkLight: '#4d3f36', water: '#1f3a44', moss: '#3d5242', cap: '#4b4256', glassTint: '#2a3a40' };
const NEON = { cyan: '#71c9c8', cyanBright: '#95dddc', magenta: '#d59acf', magentaBright: '#e7b4e1' };
const ST = { run: '#cad0d7', wait: '#fec04a', done: '#86c2a2', err: '#f26b59' };
const kebab = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
export function readLandmarkTokens(v) {
  for (const k in L) { const x = v('overview-landmark-' + kebab(k)); if (x) L[k] = x; }
  for (const k in NEON) { const x = v('overview-neon-' + kebab(k)); if (x) NEON[k] = x; }
  for (const k in F) { const x = v('overview-flora-' + kebab(k === 'glassTint' ? 'glass' : k)); if (x) F[k] = x; }
  for (const k in ST) { const x = v('status-' + k + '-fg'); if (x) ST[k] = x; }
}
export const neon = NEON;
const INK = '#0e0f10';
const dim = (hex, f) => { const k = rgba(hex), b = rgba(L.door); return 'rgb(' + [0, 1, 2].map((i) => Math.round(k[i] + (b[i] - k[i]) * f)).join(',') + ')'; };
const glow = (night, c, cb) => (night ? cb : dim(c, 0.35));
const STONE = () => ({ top: L.top, left: L.left, right: L.right, edge: '#6a6b70' });
// a leafy canopy: three-tone disc with a few highlight pixels
function canopy(s, cx, cy, r, seed) {
  s.disc(cx, cy, r, F.leafDark); s.disc(cx - 1, cy - 1, r - 1, F.leaf); s.disc(cx - Math.ceil(r / 3), cy - Math.ceil(r / 3), Math.max(1, Math.floor(r / 2)), F.leafLight);
  for (let i = 0; i < r; i++) { const a = (seed * 7 + i * 2.3), x = Math.round(cx + Math.cos(a) * (r - 1)), y = Math.round(cy + Math.sin(a) * (r - 1) * 0.8); s.set(x, y, F.leafDark); }
}

/* ---------------- signature landmarks (3x3 footprint) ---------------- */
function tree(night) {
  const s = new Sprite(100, 110, 50, 52), fruit = glow(night, NEON.magenta, NEON.magentaBright);
  s.box(0.2, 0.2, 2.6, 2.6, 0, 2, { top: F.moss, left: '#26342a', right: '#1f2a23' });
  const b = s.p(1.5, 1.5, 2);
  for (const [dx, w] of [[-6, 3], [4, 3]]) s.rect(b[0] + dx, b[1] - 2, w, 3, F.bark);              // roots
  s.rect(b[0] - 3, b[1] - 26, 7, 26, F.bark); s.rect(b[0] - 3, b[1] - 26, 2, 26, F.barkLight);    // trunk
  s.rect(b[0] - 9, b[1] - 30, 6, 2, F.bark); s.rect(b[0] + 4, b[1] - 34, 6, 2, F.bark);          // branches
  canopy(s, b[0] - 10, b[1] - 38, 11, 1); canopy(s, b[0] + 10, b[1] - 40, 12, 2); canopy(s, b[0], b[1] - 50, 14, 3);
  for (const [dx, dy] of [[-12, -34], [7, -36], [13, -44], [-4, -54], [2, -42]]) { s.rect(b[0] + dx, b[1] + dy, 2, 2, fruit); }
  s.outline(INK); return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function spring(night) {
  const s = new Sprite(100, 70, 50, 20), water = night ? dim(NEON.cyan, 0.5) : F.water, light = glow(night, NEON.cyan, NEON.cyanBright);
  s.box(0.1, 0.1, 2.8, 2.8, 0, 4, STONE());                                                      // stone rim
  s.poly([s.p(0.5, 0.5, 4), s.p(2.5, 0.5, 4), s.p(2.5, 2.5, 4), s.p(0.5, 2.5, 4)], water);       // pool
  for (const [u, v] of [[1, 1.2], [1.8, 1.6], [1.3, 2.1], [2.1, 0.9]]) { const q = s.p(u, v, 4); s.rect(q[0], q[1], 2, 1, light); }
  for (const [u, v, h] of [[0.4, 2.7, 10], [2.7, 0.4, 13], [2.7, 2.7, 8]]) { const q = s.p(u, v, 4); s.rect(q[0], q[1] - h, 1, h, F.stem); s.rect(q[0] - 1, q[1] - h - 2, 3, 2, light); } // glow reeds
  s.outline(INK); return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function greenhouse(night) {
  const s = new Sprite(104, 90, 52, 42), glass = night ? dim(NEON.cyan, 0.55) : F.glassTint, fruit = glow(night, NEON.magenta, NEON.magentaBright);
  s.box(0.1, 0.1, 2.8, 2.8, 0, 3, STONE());
  s.box(0.3, 0.3, 2.4, 2.4, 3, 20, { top: glass, left: glass, right: dim(F.glassTint, 0.3) });
  for (let a = 0.3; a <= 2.7; a += 0.6) { s.leftQuad(0.3, 0.3, 2.4, a - 0.3, a - 0.26, 3, 20, L.left); s.rightQuad(0.3, 0.3, 2.4, a - 0.3, a - 0.26, 3, 20, L.right); } // frames
  s.box(0.6, 0.6, 1.8, 1.8, 20, 28, { top: glass, left: glass, right: dim(F.glassTint, 0.3) });  // roof light
  const c = s.p(1.5, 1.5, 3); canopy(s, c[0] - 8, c[1] - 9, 5, 4); canopy(s, c[0] + 8, c[1] - 8, 5, 5);
  for (const [dx, dy] of [[-9, -11], [7, -10], [9, -6]]) s.rect(c[0] + dx, c[1] + dy, 2, 2, fruit);
  s.outline(INK); return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function grove(night) {
  const s = new Sprite(100, 76, 50, 34), spot = glow(night, NEON.cyan, NEON.cyanBright), spot2 = glow(night, NEON.magenta, NEON.magentaBright);
  s.box(0.2, 0.2, 2.6, 2.6, 0, 2, { top: F.moss, left: '#26342a', right: '#1f2a23' });
  const shroom = (u, v, h, r, c2) => { const q = s.p(u, v, 2); s.rect(q[0] - 1, q[1] - h, 3, h, '#8a8578'); s.disc(q[0], q[1] - h - 1, r, F.cap); s.rect(q[0] - r + 1, q[1] - h, 2 * r - 1, 1, dim(F.cap, 0.3)); s.set(q[0] - 2, q[1] - h - 2, c2); s.set(q[0] + 2, q[1] - h - 1, c2); s.set(q[0], q[1] - h - 3, c2); };
  shroom(1.0, 1.0, 16, 7, spot); shroom(2.2, 1.4, 10, 5, spot2); shroom(1.3, 2.3, 7, 4, spot); shroom(2.4, 2.5, 5, 3, spot2);
  s.outline(INK); return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function stone(night) {
  const s = new Sprite(100, 100, 50, 64), line = glow(night, NEON.cyan, NEON.cyanBright);
  s.box(0.2, 0.2, 2.6, 2.6, 0, 2, { top: F.moss, left: '#26342a', right: '#1f2a23' });
  s.box(1.0, 1.0, 1.0, 0.7, 2, 44, STONE());                                                    // the monolith
  for (let h = 10; h < 40; h += 6) s.leftQuad(1.0, 1.0, 0.7, 0.2, 0.2 + ((h * 7) % 5) / 10 + 0.3, h, h + 1, line);   // data lines
  s.rightQuad(1.0, 1.0, 1.0, 0.1, 0.6, 30, 31, line);
  for (const [u, v, w] of [[1.0, 1.7, 8], [1.6, 1.7, 5], [2.0, 1.2, 4]]) { const q = s.p(u, v, 2); s.rect(q[0], q[1] - 6, w, 6, F.moss); s.rect(q[0] + 1, q[1] - 7, w - 2, 1, F.leafLight); } // moss
  s.outline(INK); return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function bench() {
  const s = new Sprite(40, 22, 18, 6);
  s.box(0.1, 0.25, 1.8, 0.5, 0, 5, { top: '#6a6b70', left: L.left, right: L.right });
  s.outline(INK); return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
/* ---------------- plants: the work, growing ----------------
   run: a sprout with a blue-grey bud that grows taller with time; wait: a yellow bud; done: a green bloom that bears fruit;
   err: wilted with a red mark; idle: a dormant mound */
function plant(night, spec) {
  const [state, stage, fruit] = spec.split(':'), st = +stage, fr = +fruit;
  const s = new Sprite(26, 34, 13, 26);
  s.poly([s.p(0.1, 0.1, 0), s.p(0.9, 0.1, 0), s.p(0.9, 0.9, 0), s.p(0.1, 0.9, 0)], F.soil);
  const b = s.p(0.5, 0.5, 0); s.rect(b[0] - 2, b[1] - 1, 4, 1, F.soilLight);
  if (state === 'idle') { s.rect(b[0] - 2, b[1] - 2, 4, 1, F.soilLight); s.outline(INK); return { cv: s.canvas(), ox: s.ox, oy: s.oy }; }
  const h = state === 'err' ? 6 : 4 + st * 3;
  if (state === 'err') {
    s.rect(b[0], b[1] - h, 1, h, F.wilt); s.rect(b[0] + 1, b[1] - h, 3, 1, F.wilt); s.rect(b[0] + 3, b[1] - h + 1, 1, 2, F.wilt); s.rect(b[0] - 3, b[1] - 3, 3, 1, F.wilt);
    s.rect(b[0] + 3, b[1] - h + 3, 2, 2, ST.err);
  } else {
    s.rect(b[0], b[1] - h, 1, h, F.stem);
    for (let i = 1; i <= Math.min(3, st + 1); i++) { const y = b[1] - i * 3; s.rect(b[0] - 3, y, 3, 2, F.leaf); s.set(b[0] - 3, y, F.leafLight); s.rect(b[0] + 1, y - 1, 3, 2, F.leafDark); }
    const top = b[1] - h - 2;
    if (state === 'done') { s.rect(b[0] - 2, top, 5, 3, ST.done); s.rect(b[0] - 1, top - 1, 3, 1, ST.done); s.set(b[0], top + 1, '#e9e9eb'); for (let i = 0; i < fr; i++) s.rect(b[0] - 5 + i * 4, b[1] - 5 - (i % 2) * 3, 2, 2, glow(night, NEON.magenta, NEON.magentaBright)); }
    else s.rect(b[0] - 1, top + 1, 3, 2, state === 'wait' ? ST.wait : ST.run);
  }
  s.outline(INK); return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
const MAKERS = { tree, spring, greenhouse, grove, stone, bench, plant };
const cache = {};
export function landmark(kind, night, extra) { const k = kind + (night ? 'n' : 'd') + (extra || ''); return cache[k] || (cache[k] = MAKERS[kind](night, extra)); }
