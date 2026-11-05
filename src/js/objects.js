// Operazioni sugli oggetti: spostamento, scala, rotazione e aggancio della gomma.

import { hits } from './layers.js';
import { boxBB, ptsBB, toLocal } from './stroke.js';
import { textBB, textBox } from './text-render.js';

export const shiftBB = (b, dx, dy) => [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy];

function shiftPts(p, dx, dy) {
  const a = new Float32Array(p);
  for (let i = 0; i < a.length; i += 3) { a[i] += dx; a[i + 1] += dy; }
  return a;
}

export function shiftOp(op, dx, dy) {
  const b = { ...op, hidden: false, bb: shiftBB(op.bb, dx, dy) };
  if (op.p) b.p = shiftPts(op.p, dx, dy);
  else { b.x = op.x + dx; b.y = op.y + dy; }
  if (op.masks) b.masks = op.masks.map(m => ({ ...m, p: shiftPts(m.p, dx, dy), bb: shiftBB(m.bb, dx, dy) }));
  return b;
}

/* Scala attorno al punto (ox, oy). Nei tratti e nelle gomme la terza cifra è lo spessore e si scala;
   nelle forme è un segno e resta com'è, mentre si scala lo spessore del bordo */
const scaleBB = (b, ox, oy, k) => [ox + (b[0] - ox) * k, oy + (b[1] - oy) * k, ox + (b[2] - ox) * k, oy + (b[3] - oy) * k];

function scalePts(p, ox, oy, k, width) {
  const a = new Float32Array(p);
  for (let i = 0; i < a.length; i += 3) {
    a[i] = ox + (a[i] - ox) * k;
    a[i + 1] = oy + (a[i + 1] - oy) * k;
    if (width) a[i + 2] *= k;
  }
  return a;
}

export function scaleOp(op, ox, oy, k) {
  const b = { ...op, hidden: false, bb: scaleBB(op.bb, ox, oy, k) };
  if (op.p) {
    b.p = scalePts(op.p, ox, oy, k, op.k !== 'sh');
    if (op.k === 'sh' && op.sc) b.sw = op.sw * k;
  } else {
    b.x = ox + (op.x - ox) * k;
    b.y = oy + (op.y - oy) * k;
    if (op.k === 'im') {
      b.w = op.w * k;
      b.h = op.h * k;
      b.bb = boxBB(b.x, b.y, b.w, b.h, b.r, 1);
    } else if (op.k === 'tx') {
      b.s = Math.round(op.s * k * 10) / 10;
      b.bb = textBB(b);
    }
  }
  if (op.masks) b.masks = op.masks.map(m => ({ ...m, p: scalePts(m.p, ox, oy, k, true), bb: scaleBB(m.bb, ox, oy, k) }));
  return b;
}

/* Ruota di a radianti attorno a (cx, cy). Tratti, gomme e forme ruotano nei punti;
   testi e immagini spostano l'angolo (x, y) e sommano a in r */
function rotatePts(p, cx, cy, c, s) {
  const a = new Float32Array(p);
  for (let i = 0; i < a.length; i += 3) {
    const dx = a[i] - cx, dy = a[i + 1] - cy;
    a[i] = cx + dx * c - dy * s;
    a[i + 1] = cy + dx * s + dy * c;
  }
  return a;
}

export function rotateOp(op, cx, cy, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const b = { ...op, hidden: false };
  if (op.p) {
    b.p = rotatePts(op.p, cx, cy, c, s);
    b.bb = ptsBB(b);
  } else {
    const dx = op.x - cx, dy = op.y - cy;
    b.x = cx + dx * c - dy * s;
    b.y = cy + dx * s + dy * c;
    let r = (op.r || 0) + a;
    r = Math.atan2(Math.sin(r), Math.cos(r));
    if (Math.abs(r) < 1e-4) delete b.r;
    else b.r = Math.round(r * 1e5) / 1e5;
    b.bb = op.k === 'tx' ? textBB(b) : boxBB(b.x, b.y, b.w, b.h, b.r, 1);
  }
  if (op.masks) b.masks = op.masks.map(m => {
    const n = { ...m, p: rotatePts(m.p, cx, cy, c, s) };
    n.bb = ptsBB(n);
    return n;
  });
  return b;
}

// Il punto (x, y) cade dentro un testo o un'immagine, anche ruotati? m è il margine
export function inBox(o, x, y, m) {
  if (!o.r) return x >= o.bb[0] && x <= o.bb[2] && y >= o.bb[1] && y <= o.bb[3];
  const [lx, ly] = toLocal(o, x, y), [w, h] = o.k === 'tx' ? textBox(o) : [o.w, o.h];
  return lx >= -m && ly >= -m && lx <= w + m && ly <= h + m;
}

export function normalizeOps(list) {
  const out = [];
  for (const o of list) {
    if (o.k !== 'er') { out.push(o); continue; }
    for (const x of out) if (hits(x.bb, o.bb)) (x.masks ||= []).push(o);
  }
  return out;
}
