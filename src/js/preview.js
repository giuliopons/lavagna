// Anteprima del foglio per la galleria: tutto il disegno in piccolo, su carta bianca.

import { paint } from './layers.js';
import { S } from './state.js';

export const PREVIEW_W = 360, PREVIEW_H = 225;

// Restituisce un data URL WebP (PNG se il browser non lo sa scrivere), oppure null se il foglio è vuoto
export function makePreview(ops = S.ops) {
  const list = ops.filter(o => !o.hidden);
  if (!list.length) return null;
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of list) {
    bb[0] = Math.min(bb[0], o.bb[0]); bb[1] = Math.min(bb[1], o.bb[1]);
    bb[2] = Math.max(bb[2], o.bb[2]); bb[3] = Math.max(bb[3], o.bb[3]);
  }
  // disegno con un margine, centrato; un disegno piccolo non si ingrandisce oltre il doppio
  const pad = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * .04 + 8;
  const scale = Math.min(PREVIEW_W / (bb[2] - bb[0] + pad * 2), PREVIEW_H / (bb[3] - bb[1] + pad * 2), 2);
  const w = PREVIEW_W / scale, h = PREVIEW_H / scale;
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  const area = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];

  const c = document.createElement('canvas');
  c.width = PREVIEW_W; c.height = PREVIEW_H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.setTransform(scale, 0, 0, scale, -area[0] * scale, -area[1] * scale);
  const tmp = document.createElement('canvas');
  tmp.width = c.width; tmp.height = c.height;
  const fake = { ctx, bb: area, tmp, scale };
  for (const o of list) paint(fake, o);
  return c.toDataURL('image/webp', .82);
}
