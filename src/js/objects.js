// Operazioni sugli oggetti: spostamento e aggancio della gomma.

import { hits } from './layers.js';

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

export function normalizeOps(list) {
  const out = [];
  for (const o of list) {
    if (o.k !== 'er') { out.push(o); continue; }
    for (const x of out) if (hits(x.bb, o.bb)) (x.masks ||= []).push(o);
  }
  return out;
}
