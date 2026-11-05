// Strumento selezione: riquadro, clic, trascinamento, scala, rotazione ed eliminazione.

import { board, world } from './dom.js';
import { afterChange, record } from './history.js';
import { toWorld } from './input.js';
import { hits, paint, refresh } from './layers.js';
import { inBox, rotateOp, scaleOp, shiftOp } from './objects.js';
import { S } from './state.js';
import { shapePath } from './stroke.js';

const hitCtx = document.createElement('canvas').getContext('2d');

export function clearSel() {
  if (!S.sel) return;
  S.sel.box.remove();
  S.sel = null;
}

// Il puntatore sta sotto il tondo (e non alla sua destra)?
function isBelow(ring, e) {
  const r = ring.getBoundingClientRect();
  return e.clientY - r.top - r.height / 2 > e.clientX - r.left - r.width / 2;
}

export function setSel(list) {
  clearSel();
  if (!list.length) return;
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of list) {
    bb[0] = Math.min(bb[0], o.bb[0]); bb[1] = Math.min(bb[1], o.bb[1]);
    bb[2] = Math.max(bb[2], o.bb[2]); bb[3] = Math.max(bb[3], o.bb[3]);
  }
  const box = document.createElement('div');
  box.id = 'selBox';
  box.style.left = bb[0] + 'px';
  box.style.top = bb[1] + 'px';
  box.style.width = bb[2] - bb[0] + 'px';
  box.style.height = bb[3] - bb[1] + 'px';
  // nell'angolo in basso a destra: il tondo scala, l'anello attorno ruota
  const ring = document.createElement('div');
  ring.id = 'selRotate';
  ring.title = 'Trascina attorno al tondo per ruotare (Maiusc: a scatti di 15°)';
  // sotto il tondo la freccia scende verso sinistra, a destra sale
  ring.addEventListener('pointermove', e => ring.classList.toggle('below', isBelow(ring, e)));
  const handle = document.createElement('div');
  handle.id = 'selHandle';
  handle.title = 'Trascina per ingrandire o rimpicciolire';
  box.append(ring, handle);
  world.appendChild(box);
  S.sel = { ops: list, bb, box };
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function hitTest(x, y) {
  for (let i = S.ops.length - 1; i >= 0; i--) {
    const o = S.ops[i];
    if (o.hidden || x < o.bb[0] || x > o.bb[2] || y < o.bb[1] || y > o.bb[3]) continue;
    if (!o.p) { if (inBox(o, x, y, 5 / S.zoom)) return o; continue; }
    if (o.k === 'sh') {
      const path = shapePath(o);
      hitCtx.lineWidth = (o.sc ? o.sw : 0) + 10 / S.zoom;
      if ((o.c && hitCtx.isPointInPath(path, x, y, o.fr || 'nonzero')) || hitCtx.isPointInStroke(path, x, y)) return o;
      continue;
    }
    const a = o.p, n = a.length;
    if (n === 3 && Math.hypot(x - a[0], y - a[1]) <= a[2] / 2 + 5 / S.zoom) return o;
    for (let j = 3; j < n; j += 3) {
      if (segDist(x, y, a[j - 3], a[j - 2], a[j], a[j + 1]) <= a[j + 2] / 2 + 5 / S.zoom) return o;
    }
  }
  return null;
}

// Un tratto entra nella selezione se almeno tre quarti dei suoi punti sono nel riquadro; testo e immagini se ne sta dentro il centro
function inRect(o, r) {
  if (!o.p) {
    const cx = (o.bb[0] + o.bb[2]) / 2, cy = (o.bb[1] + o.bb[3]) / 2;
    return cx >= r[0] && cx <= r[2] && cy >= r[1] && cy <= r[3];
  }
  if (!hits(o.bb, r)) return false;
  const a = o.p, n = a.length / 3;
  let inside = 0;
  for (let j = 0; j < a.length; j += 3) if (a[j] >= r[0] && a[j] <= r[2] && a[j + 1] >= r[1] && a[j + 1] <= r[3]) inside++;
  return inside / n >= .75;
}

export function selDown(e) {
  try { board.setPointerCapture(e.pointerId); } catch {}
  if (S.sel && (e.target === S.sel.box || e.target.id === 'selHandle' || e.target.id === 'selRotate')) {
    const mode = e.target.id === 'selHandle' ? 'scale' : e.target.id === 'selRotate' ? 'rotate' : 'move';
    S.gest = { type: 'seldrag', mode, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, k: 1, a: 0, float: null };
    if (mode === 'rotate') {
      const bb = S.sel.bb, [x, y] = toWorld(e);
      S.gest.cx = (bb[0] + bb[2]) / 2;
      S.gest.cy = (bb[1] + bb[3]) / 2;
      S.gest.a0 = Math.atan2(y - S.gest.cy, x - S.gest.cx);
      board.classList.add('rotating');
      board.classList.toggle('below', isBelow(e.target, e));
    }
    return;
  }
  clearSel();
  const [x, y] = toWorld(e);
  S.gest = { type: 'marquee', id: e.pointerId, x0: x, y0: y, x1: x, y1: y, el: null };
}

export function marqueeDrag(e) {
  const g = S.gest;
  if (g.id !== e.pointerId) return;
  [g.x1, g.y1] = toWorld(e);
  if (!g.el) {
    if (Math.hypot(g.x1 - g.x0, g.y1 - g.y0) < 4) return;
    g.el = document.createElement('div');
    g.el.id = 'marquee';
    world.appendChild(g.el);
  }
  g.el.style.left = Math.min(g.x0, g.x1) + 'px';
  g.el.style.top = Math.min(g.y0, g.y1) + 'px';
  g.el.style.width = Math.abs(g.x1 - g.x0) + 'px';
  g.el.style.height = Math.abs(g.y1 - g.y0) + 'px';
}

export function marqueeEnd() {
  const g = S.gest;
  S.gest = null;
  if (!g.el) {
    const hit = hitTest(g.x0, g.y0);
    if (hit) setSel([hit]);
    return;
  }
  g.el.remove();
  const r = [Math.min(g.x0, g.x1), Math.min(g.y0, g.y1), Math.max(g.x0, g.x1), Math.max(g.y0, g.y1)];
  setSel(S.ops.filter(o => !o.hidden && inRect(o, r)));
}

// Durante il trascinamento gli oggetti stanno su una tela sola che si muove con un transform: nessun ridisegno
function startFloat() {
  const bb = S.sel.bb;
  const sc = Math.min(S.tileScale * S.zoom, 8192 / Math.max(bb[2] - bb[0], bb[3] - bb[1]));
  const w = Math.ceil((bb[2] - bb[0]) * sc), h = Math.ceil((bb[3] - bb[1]) * sc);
  const c = document.createElement('canvas');
  c.id = 'selFloat';
  c.width = w; c.height = h;
  c.style.left = bb[0] + 'px';
  c.style.top = bb[1] + 'px';
  c.style.width = w / sc + 'px';
  c.style.height = h / sc + 'px';
  const ctx = c.getContext('2d');
  ctx.setTransform(sc, 0, 0, sc, -bb[0] * sc, -bb[1] * sc);
  const scratch = document.createElement('canvas');
  scratch.width = w; scratch.height = h;
  const fake = { ctx, bb, tmp: scratch, scale: sc };
  for (const o of S.sel.ops) paint(fake, o);
  for (const o of S.sel.ops) o.hidden = true;
  refresh(bb);
  if (S.sel.ops.every(o => o.k === 'hl' || o.mul)) c.style.mixBlendMode = 'multiply';
  world.appendChild(c);
  return c;
}

export function selDrag(e) {
  const g = S.gest;
  if (g.id !== e.pointerId || !S.sel) return;
  g.dx = (e.clientX - g.sx) / S.zoom;
  g.dy = (e.clientY - g.sy) / S.zoom;
  if (!g.float) {
    if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 3) return;
    g.float = startFloat();
  }
  if (g.mode === 'rotate') {
    // angolo attorno al centro della selezione; con Maiusc a scatti di 15°
    const [x, y] = toWorld(e);
    let a = Math.atan2(y - g.cy, x - g.cx) - g.a0;
    if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
    g.a = a;
    const bb = S.sel.bb, origin = `${(bb[2] - bb[0]) / 2}px ${(bb[3] - bb[1]) / 2}px`, tf = `rotate(${a}rad)`;
    g.float.style.transformOrigin = S.sel.box.style.transformOrigin = origin;
    g.float.style.transform = S.sel.box.style.transform = tf;
    return;
  }
  if (g.mode === 'scale') {
    // l'angolo in alto a sinistra resta fermo; il fattore viene dalla diagonale, così le proporzioni restano
    const bb = S.sel.bb, w = bb[2] - bb[0], h = bb[3] - bb[1];
    const k = ((w + g.dx) * w + (h + g.dy) * h) / (w * w + h * h);
    g.k = Math.min(20, Math.max(8 / Math.max(w, h, 1), k));
    g.float.style.transformOrigin = '0 0';
    g.float.style.transform = `scale(${g.k})`;
    S.sel.box.style.width = w * g.k + 'px';
    S.sel.box.style.height = h * g.k + 'px';
    return;
  }
  const tf = `translate3d(${g.dx}px,${g.dy}px,0)`;
  g.float.style.transform = tf;
  S.sel.box.style.transform = tf;
}

export function selDragEnd() {
  const { float, mode, dx, dy, k, a: angle, cx, cy } = S.gest;
  S.gest = null;
  board.classList.remove('rotating', 'below');
  if (!float || !S.sel) return;
  const a = S.sel.ops, oldBB = S.sel.bb;
  const idx = a.map(o => S.ops.indexOf(o));
  const b = a.map(mode === 'scale' ? o => scaleOp(o, oldBB[0], oldBB[1], k)
    : mode === 'rotate' ? o => rotateOp(o, cx, cy, angle)
      : o => shiftOp(o, dx, dy));
  for (const o of a) o.hidden = false;
  idx.forEach((i, j) => { S.ops[i] = b[j]; });
  record({ t: 'selmove', idx, a, b });
  refresh(oldBB);
  for (const o of b) refresh(o.bb);
  float.remove();
  setSel(b);
  afterChange();
}

export function selDelete() {
  const items = S.sel.ops.map(op => ({ op, i: S.ops.indexOf(op) })).sort((p, q) => p.i - q.i);
  for (let k = items.length - 1; k >= 0; k--) S.ops.splice(items[k].i, 1);
  record({ t: 'delsel', items });
  for (const it of items) refresh(it.op.bb);
  clearSel();
  afterChange();
}
