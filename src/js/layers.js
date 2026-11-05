// Foglio a tasselli: un tassello è un canvas già disegnato, spostarlo cambia solo un transform.
// Disegno delle operazioni sui tasselli e creazione a piccole dosi di quelli vicini allo schermo.

import { $ } from './dom.js';
import { updatePanelSoon } from './sheet-info.js';
import { S, T, pan } from './state.js';
import { drawStroke } from './stroke.js';
import { drawText } from './text-render.js';

const tmp = document.createElement('canvas');

export function sizeTmp() { tmp.width = tmp.height = Math.round(T * S.dpr); }

export function makeLayer(rz) {
  const el = document.createElement('div');
  el.className = 'layer';
  $('layers').appendChild(el);
  redraw = { ms: 0, tiles: 0 };
  return { el, rz, tiles: new Map(), known: new Set() };
}

// Misura di un ridisegno completo dello schermo, per il pannello del foglio
let redraw = null;

function tileAt(ix, iy, create) {
  const key = ix + ',' + iy;
  let t = S.L.tiles.get(key);
  if (!t && create) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(T * S.dpr);
    c.style.left = ix * T + 'px';
    c.style.top = iy * T + 'px';
    const ctx = c.getContext('2d');
    const sc = S.tileScale * S.L.rz, w = T / S.L.rz;
    ctx.setTransform(sc, 0, 0, sc, -ix * T * S.tileScale, -iy * T * S.tileScale);
    t = { c, ctx, ix, iy, scale: sc, bb: [ix * w, iy * w, (ix + 1) * w, (iy + 1) * w] };
    S.L.tiles.set(key, t);
    S.L.el.appendChild(c);
  }
  return t;
}

function forCells(bb, fn) {
  const w = T / S.L.rz;
  const x0 = Math.floor(bb[0] / w), x1 = Math.floor(bb[2] / w);
  const y0 = Math.floor(bb[1] / w), y1 = Math.floor(bb[3] / w);
  for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) {
    if (S.L.known.has(ix + ',' + iy)) fn(ix, iy);
  }
}

export function forTiles(bb, create, fn) {
  forCells(bb, (ix, iy) => {
    const t = tileAt(ix, iy, create);
    if (t) fn(t);
  });
}

export const hits = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

function drawRaw(ctx, op, clipBB) {
  if (op.k === 'tx') drawText(ctx, op);
  else if (op.k === 'im') {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(op.bmp, op.x, op.y, op.w, op.h);
  } else drawStroke(ctx, op, clipBB);
}

export function paint(t, op) {
  const ctx = t.ctx;
  const masks = op.masks?.filter(m => hits(t.bb, m.bb));
  if (op.k !== 'hl' && !masks?.length) { drawRaw(ctx, op, t.bb); return; }
  // su un foglio d'appoggio: l'evidenziatore non si scurisce da solo, e la gomma tocca solo questo oggetto
  const c = t.tmp || tmp, x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  x.setTransform(t.scale, 0, 0, t.scale, -t.bb[0] * t.scale, -t.bb[1] * t.scale);
  drawRaw(x, op, t.bb);
  if (masks?.length) {
    x.globalCompositeOperation = 'destination-out';
    for (const m of masks) drawStroke(x, m, t.bb);
    x.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = op.k === 'hl' ? 'multiply' : 'source-over';
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

export function refresh(bb) {
  const w = T / S.L.rz;
  forCells(bb, (ix, iy) => {
    const cell = [ix * w, iy * w, (ix + 1) * w, (iy + 1) * w];
    const list = S.ops.filter(op => !op.hidden && hits(cell, op.bb));
    const t = tileAt(ix, iy, list.length > 0);
    if (!t) return;
    t.ctx.save();
    t.ctx.setTransform(1, 0, 0, 1, 0, 0);
    t.ctx.clearRect(0, 0, t.c.width, t.c.height);
    t.ctx.restore();
    for (const op of list) paint(t, op);
  });
}

export function dropTiles() {
  S.L.tiles.forEach(t => t.c.remove());
  S.L.tiles.clear();
}

export function repaintAll() {
  dropTiles();
  S.L.known.clear();
  redraw = { ms: 0, tiles: 0 };
  if (S.backdrop) { S.backdrop.el.remove(); S.backdrop = null; }
  scheduleEnsure();
}

/* I tasselli nuovi si disegnano a piccole dosi, un po' per fotogramma, a partire dal centro dello schermo */
let ensureQueued = false;

export function scheduleEnsure() {
  if (ensureQueued) return;
  ensureQueued = true;
  requestAnimationFrame(ensureStep);
}

export function ensureStep() {
  ensureQueued = false;
  const start = performance.now();
  const w = T / S.L.rz;
  const left = -pan.x / S.zoom, top = -pan.y / S.zoom, right = (S.vw - pan.x) / S.zoom, bottom = (S.vh - pan.y) / S.zoom;
  const x0 = Math.floor(left / w) - 1, x1 = Math.floor(right / w) + 1;
  const y0 = Math.floor(top / w) - 1, y1 = Math.floor(bottom / w) + 1;
  const cx = (left + right) / 2 / w, cy = (top + bottom) / 2 / w;
  const missing = [];
  for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) {
    if (!S.L.known.has(ix + ',' + iy)) missing.push([ix, iy, (ix + .5 - cx) ** 2 + (iy + .5 - cy) ** 2]);
  }
  missing.sort((a, b) => a[2] - b[2]);
  for (const [ix, iy] of missing) {
    S.L.known.add(ix + ',' + iy);
    const cell = [ix * w, iy * w, (ix + 1) * w, (iy + 1) * w];
    const list = S.ops.filter(op => !op.hidden && hits(cell, op.bb));
    if (list.length) {
      const t = tileAt(ix, iy, true);
      for (const op of list) paint(t, op);
      if (redraw) redraw.tiles++;
    }
    if (performance.now() - start > 6) {
      if (redraw) redraw.ms += performance.now() - start;
      scheduleEnsure();
      return;
    }
  }
  if (redraw) {
    redraw.ms += performance.now() - start;
    if (redraw.tiles) { S.lastRedraw = redraw; updatePanelSoon(); }
    redraw = null;
  }
  if (S.backdrop) { S.backdrop.el.remove(); S.backdrop = null; }
  // limite di memoria: via i tasselli più lontani dallo schermo
  const MAX = S.dpr > 1.25 ? 120 : 260;
  if (S.L.tiles.size > MAX) {
    const far = [...S.L.tiles.entries()]
      .filter(([, t]) => t.ix < x0 || t.ix > x1 || t.iy < y0 || t.iy > y1)
      .sort((a, b) => ((b[1].ix - cx) ** 2 + (b[1].iy - cy) ** 2) - ((a[1].ix - cx) ** 2 + (a[1].iy - cy) ** 2));
    for (const [key, t] of far.slice(0, S.L.tiles.size - MAX)) {
      t.c.remove();
      S.L.tiles.delete(key);
      S.L.known.delete(key);
    }
  }
}

export function initLayers() {
  // Uno strato tiene i tasselli disegnati a un certo zoom. Durante lo zoom si ingrandisce con un transform,
  // poi viene ridisegnato nitido. Solo i tasselli vicini allo schermo esistono: known dice quali sono aggiornati.
  S.L = makeLayer(1);
}
