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

const L = { top: '#5a5b60', left: '#3e3f43', right: '#2c2d30', roof: '#47484c', door: '#18191b', glass: '#20242a', grass: '#2a3a30', grassLight: '#36493c' };
const NEON = { cyan: '#71c9c8', cyanBright: '#95dddc', magenta: '#d59acf', magentaBright: '#e7b4e1' };
export function readLandmarkTokens(v) {
  for (const k in L) { const x = v('overview-landmark-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())); if (x) L[k] = x; }
  for (const k in NEON) { const x = v('overview-neon-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())); if (x) NEON[k] = x; }
}
export const neon = NEON;
const BODY = () => ({ top: L.top, left: L.left, right: L.right, edge: '#6a6b70' });
const dimmer = (hex, f) => { const k = rgba(hex), b = rgba(L.door); return 'rgb(' + [0, 1, 2].map((i) => Math.round(k[i] + (b[i] - k[i]) * f)).join(',') + ')'; };

/* ---------------- landmark designs ---------------- */
// Each returns { cv, ox, oy } where (ox, oy) is the pixel of the footprint's back corner.
function hub(night) {
  const s = new Sprite(40, 84, 20, 40), cyan = night ? NEON.cyanBright : dimmer(NEON.cyan, 0.35), mag = night ? NEON.magentaBright : dimmer(NEON.magenta, 0.3);
  s.box(0, 0, 2, 2, 0, 4, { top: L.roof, left: L.left, right: L.right, edge: '#6a6b70' });
  s.box(0.35, 0.35, 1.3, 1.3, 4, 16, BODY());
  s.box(0.6, 0.6, 0.8, 0.8, 16, 32, BODY());
  s.box(0.82, 0.82, 0.36, 0.36, 32, 40, BODY());
  for (const h of [22, 27]) { s.leftQuad(0.6, 0.6, 0.8, 0.05, 0.75, h, h + 1, cyan); s.rightQuad(0.6, 0.6, 0.8, 0.05, 0.75, h, h + 1, cyan); }
  s.leftQuad(0.35, 0.35, 1.3, 0.25, 1.05, 9, 10, cyan);
  const top = s.p(1, 1, 40); s.rect(top[0] - 1, top[1] - 7, 1, 7, L.top); s.rect(top[0] - 2, top[1] - 9, 3, 2, mag);
  s.outline('#0e0f10');
  return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function restaurant(night) {
  const s = new Sprite(96, 76, 32, 34), mag = night ? NEON.magentaBright : dimmer(NEON.magenta, 0.3), glass = night ? '#8e8774' : L.glass;
  s.box(0, 0, 3, 2, 0, 3, { top: '#4a4b50', left: L.left, right: L.right });                       // plinth
  s.box(0.1, 0.1, 2.8, 1.8, 3, 24, BODY());                                                        // hall
  s.box(0.35, 0.35, 2.3, 1.3, 24, 25, { top: L.roof, left: L.left, right: L.right });              // roof inset
  s.leftQuad(0.1, 0.1, 1.8, 1.15, 1.75, 3, 15, L.door);                                           // door
  s.leftQuad(0.1, 0.1, 1.8, 0.25, 0.95, 7, 16, glass); s.leftQuad(0.1, 0.1, 1.8, 1.95, 2.6, 7, 16, glass);
  s.rightQuad(0.1, 0.1, 2.8, 0.3, 1.5, 7, 16, glass);
  for (let i = 0; i < 9; i++) { const a0 = 0.1 + i * 0.3, col = i % 2 ? '#e9e9eb' : mag; s.poly([s.p(0.1 + a0, 1.9, 18), s.p(0.1 + a0 + 0.3, 1.9, 18), s.p(0.1 + a0 + 0.3, 2.25, 14), s.p(0.1 + a0, 2.25, 14)], col); }
  s.box(0.75, 0.75, 1.5, 0.18, 25, 35, { top: L.roof, left: '#1c1d20', right: L.right });          // sign board
  s.leftText(0.75, 0.75, 0.18, 0.28, 32, 'EAT', mag, night ? dimmer(NEON.magenta, 0.55) : null);
  s.box(2.2, 0.4, 0.45, 0.4, 25, 30, { top: '#6a6b70', left: L.left, right: L.right });            // rooftop unit
  s.outline('#0e0f10');
  return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function cafe(night) {
  const s = new Sprite(64, 64, 32, 26), cyan = night ? NEON.cyanBright : dimmer(NEON.cyan, 0.3), glass = night ? '#8e8774' : L.glass;
  s.box(0, 0, 2, 2, 0, 3, { top: '#4a4b50', left: L.left, right: L.right });
  s.box(0.15, 0.15, 1.7, 1.5, 3, 18, BODY());
  s.leftQuad(0.15, 0.15, 1.5, 0.2, 1.5, 6, 12, glass);                                             // serving hatch
  s.leftQuad(0.15, 0.15, 1.5, 0.2, 1.5, 6, 7, '#6a6b70');                                          // counter
  for (let i = 0; i < 6; i++) { const a0 = 0.15 + i * 0.283, col = i % 2 ? '#e9e9eb' : cyan; s.poly([s.p(a0, 1.65, 15), s.p(a0 + 0.283, 1.65, 15), s.p(a0 + 0.283, 1.95, 12), s.p(a0, 1.95, 12)], col); }
  s.box(0.35, 0.5, 1.3, 0.16, 18, 27, { top: L.roof, left: '#1c1d20', right: L.right });
  s.leftText(0.35, 0.5, 0.16, 0.12, 24, 'CAFE', cyan, night ? dimmer(NEON.cyan, 0.55) : null);
  s.outline('#0e0f10');
  return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function garden(night) {
  const s = new Sprite(124, 92, 52, 34), cyan = night ? NEON.cyanBright : dimmer(NEON.cyan, 0.45);
  s.box(0, 0, 4, 3, 0, 2, { top: L.grass, left: '#1f2a23', right: '#18201b' });
  for (let i = 0; i < 26; i++) { const u = ((i * 37) % 97) / 97 * 3.8 + 0.1, v = ((i * 53) % 89) / 89 * 2.8 + 0.1, q = s.p(u, v, 2); s.set(q[0], q[1], L.grassLight); }
  s.box(1.0, 1.55, 1.1, 0.3, 2, 5, { top: '#6a6b70', left: L.left, right: L.right });               // bench
  const tree = (u, v, r) => { const q = s.p(u, v, 2); s.rect(q[0] - 1, q[1] - 9, 2, 9, '#3a2f28'); s.disc(q[0], q[1] - 13, r, '#2f3d33'); s.disc(q[0] - 1, q[1] - 14, r - 2, '#455a49'); s.set(q[0] - 2, q[1] - 16, '#5b7461'); };
  tree(0.7, 0.6, 6); tree(3.2, 0.8, 7); tree(2.9, 2.3, 5);
  const lamp = s.p(2.4, 1.3, 2); s.rect(lamp[0], lamp[1] - 16, 1, 16, '#6a6b70'); s.rect(lamp[0] - 1, lamp[1] - 18, 3, 2, cyan);
  s.outline('#0e0f10');
  return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function table() {
  const s = new Sprite(20, 16, 10, 5);
  s.box(0.2, 0.2, 0.6, 0.6, 0, 6, { top: '#6a6b70', left: L.left, right: L.right });
  s.outline('#0e0f10');
  return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
function pad(night, lit) {
  const s = new Sprite(18, 10, 9, 1), c = lit ? (night ? NEON.cyanBright : dimmer(NEON.cyan, 0.4)) : '#4a4b50';
  s.poly([s.p(0.18, 0.18, 0), s.p(0.82, 0.18, 0), s.p(0.82, 0.82, 0), s.p(0.18, 0.82, 0)], '#2c2d30');
  const m = s.p(0.5, 0.5, 0); s.rect(m[0] - 1, m[1] - 1, 2, 1, c);
  return { cv: s.canvas(), ox: s.ox, oy: s.oy };
}
const MAKERS = { hub, restaurant, cafe, garden, table, pad };
const cache = {};
export function landmark(kind, night, extra) { const k = kind + (night ? 'n' : 'd') + (extra ? 'x' : ''); return cache[k] || (cache[k] = MAKERS[kind](night, extra)); }
