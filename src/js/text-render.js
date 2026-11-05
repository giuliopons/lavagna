// Misura e disegno del testo sul canvas.

import { FONT } from './state.js';
import { boxBB } from './stroke.js';

const textFont = s => `500 ${s}px ${FONT}`;

export const lineH = s => s * 1.25;

const measure = document.createElement('canvas').getContext('2d');

function textMetrics(s) {
  measure.font = textFont(s);
  const m = measure.measureText('Hg');
  const A = m.fontBoundingBoxAscent ?? s * .8, D = m.fontBoundingBoxDescent ?? s * .2;
  return { base: (lineH(s) - (A + D)) / 2 + A };
}

export const textBase = s => textMetrics(s).base;

export function textWidth(t, s) {
  measure.font = textFont(s);
  return t.split('\n').reduce((w, l) => Math.max(w, measure.measureText(l).width), 0);
}

// Larghezza e altezza del testo non ruotato
export const textBox = op => [textWidth(op.t, op.s), op.t.split('\n').length * lineH(op.s)];

export function textBB(op) {
  const [w, h] = textBox(op);
  return boxBB(op.x, op.y, w, h, op.r, op.s * .3 + 2);
}

export function drawText(ctx, op) {
  ctx.font = textFont(op.s);
  ctx.fillStyle = op.c;
  ctx.textBaseline = 'alphabetic';
  const base = textMetrics(op.s).base;
  let x = op.x, y = op.y;
  if (op.r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(op.r);
    x = y = 0;
  }
  op.t.split('\n').forEach((l, i) => ctx.fillText(l, x, y + i * lineH(op.s) + base));
  if (op.r) ctx.restore();
}
