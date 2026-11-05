// Operazioni sugli oggetti: spostamento e aggancio della gomma.

import { hits } from './layers.js';
import { textBB } from './text-render.js';

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
      b.bb = [b.x - 1, b.y - 1, b.x + b.w + 1, b.y + b.h + 1];
    } else if (op.k === 'tx') {
      b.s = Math.round(op.s * k * 10) / 10;
      b.bb = textBB(b);
    }
  }
  if (op.masks) b.masks = op.masks.map(m => ({ ...m, p: scalePts(m.p, ox, oy, k, true), bb: scaleBB(m.bb, ox, oy, k) }));
  return b;
}

export function normalizeOps(list) {
  const out = [];
  for (const o of list) {
    if (o.k !== 'er') { out.push(o); continue; }
    for (const x of out) if (hits(x.bb, o.bb)) (x.masks ||= []).push(o);
  }
  return out;
}
