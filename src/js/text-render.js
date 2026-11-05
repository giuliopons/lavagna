// Misura e disegno del testo sul canvas.

import { FONT } from './state.js';

const textFont = s => `500 ${s}px ${FONT}`;

export const lineH = s => s * 1.25;

const measure = document.createElement('canvas').getContext('2d');

function textMetrics(s) {
  measure.font = textFont(s);
  const m = measure.measureText('Hg');
  const A = m.fontBoundingBoxAscent ?? s * .8, D = m.fontBoundingBoxDescent ?? s * .2;
  return { base: (lineH(s) - (A + D)) / 2 + A };
}

export function textWidth(t, s) {
  measure.font = textFont(s);
  return t.split('\n').reduce((w, l) => Math.max(w, measure.measureText(l).width), 0);
}

export function textBB(op) {
  const pad = op.s * .3 + 2;
  return [op.x - pad, op.y - pad, op.x + textWidth(op.t, op.s) + pad, op.y + op.t.split('\n').length * lineH(op.s) + pad];
}

export function drawText(ctx, op) {
  ctx.font = textFont(op.s);
  ctx.fillStyle = op.c;
  ctx.textBaseline = 'alphabetic';
  const base = textMetrics(op.s).base;
  op.t.split('\n').forEach((l, i) => ctx.fillText(l, op.x, op.y + i * lineH(op.s) + base));
}
