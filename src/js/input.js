// Gesti di penna, mouse e dita, e anello che segue la gomma e l'evidenziatore.

import { board, hint, liveHl, ring } from './dom.js';
import { record, updateHint } from './history.js';
import { commitPlace, placeMove } from './images.js';
import { forTiles, hits, paint, refresh } from './layers.js';
import { liveTransform, wipe, wipeInkNow, wipeInkSoon } from './live.js';
import { clearSel, marqueeDrag, marqueeEnd, selDown, selDrag, selDragEnd } from './selection.js';
import { S, pan, tools, touches } from './state.js';
import { scheduleSave } from './storage.js';
import { drawDot, drawSeg, drawStroke, drawTail, styleCtx } from './stroke.js';
import { commitEdit, gripDrag, hoverText, textClick, textDrag, textRelease } from './text-editor.js';
import { syncButtons } from './tray.js';
import { setPan, snapGrid, wheelZoom } from './view.js';

const rawMove = 'onpointerrawupdate' in window;

export const toWorld = e => [(e.clientX - pan.x) / S.zoom, (e.clientY - pan.y) / S.zoom];

function widthFor(g, e) {
  if (g.pressure) return g.size * (.25 + 1.25 * Math.pow(Math.max(e.pressure, .02), .8));
  return g.size;
}

function liveDraw(g, fn, bb) {
  if (g.k === 'er') {
    forTiles(bb, false, t => {
      t.ctx.globalCompositeOperation = 'destination-out';
      styleCtx(t.ctx, g);
      fn(t.ctx);
      t.ctx.globalCompositeOperation = 'source-over';
    });
  } else fn(g.ctx);
}

function growBB(g, x, y, w) {
  const r = w / 2 + 2, b = g.bb;
  if (x - r < b[0]) b[0] = x - r;
  if (y - r < b[1]) b[1] = y - r;
  if (x + r > b[2]) b[2] = x + r;
  if (y + r > b[3]) b[3] = y + r;
}

function startStroke(e, kind) {
  const set = tools[kind];
  const [x, y] = toWorld(e);
  const g = {
    type: 'stroke', id: e.pointerId, k: kind, c: set.c, size: set.s,
    pressure: kind === 'pen' && e.pointerType === 'pen',
    smooth: e.pointerType === 'pen' ? .72 : .55,
    fx: x, fy: y, p: [], bb: [x, y, x, y], ctx: null,
  };
  g.w = widthFor(g, e);
  g.p.push(x, y, g.w);
  growBB(g, x, y, g.w);
  if (kind === 'pen') { wipeInkNow(); g.ctx = S.inkCtx; }
  else if (kind === 'hl') g.ctx = S.hlCtx;
  if (g.ctx) { liveTransform(g.ctx); styleCtx(g.ctx, g); }
  S.gest = g;
  hint.hidden = true;
  liveDraw(g, ctx => drawDot(ctx, g.p), [...g.bb]);
}

function addPoint(e) {
  const g = S.gest;
  const [x, y] = toWorld(e);
  g.fx += (x - g.fx) * g.smooth;
  g.fy += (y - g.fy) * g.smooth;
  const a = g.p, n = a.length;
  if (Math.hypot(g.fx - a[n - 3], g.fy - a[n - 2]) < .4) return;
  g.w += (widthFor(g, e) - g.w) * .4;
  a.push(g.fx, g.fy, g.w);
  growBB(g, g.fx, g.fy, g.w);
  const i = a.length / 3 - 1;
  const r = g.w / 2 + 4;
  liveDraw(g, ctx => drawSeg(ctx, a, i), [
    Math.min(a[n - 3], g.fx, i > 1 ? a[n - 6] : g.fx) - r, Math.min(a[n - 2], g.fy, i > 1 ? a[n - 5] : g.fy) - r,
    Math.max(a[n - 3], g.fx, i > 1 ? a[n - 6] : g.fx) + r, Math.max(a[n - 2], g.fy, i > 1 ? a[n - 5] : g.fy) + r,
  ]);
}

/* Righe sulla griglia: con Maiusc premuto e i puntini accesi il tratto diventa una riga dritta
   dal puntino più vicino alla partenza a quello più vicino alla penna. Resta riga fino al sollevamento */
function lineMove(g, e) {
  if (!g.line) g.line = [snapGrid(g.p[0]), snapGrid(g.p[1])];
  const [x, y] = toWorld(e), w = g.size;
  const ax = g.line[0], ay = g.line[1], bx = snapGrid(x), by = snapGrid(y), r = w / 2 + 2;
  g.p = [ax, ay, w, bx, by, w];
  g.bb = [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r];
  if (g.k === 'pen') wipeInkNow();
  else wipe(S.hlCtx, liveHl);
  liveTransform(g.ctx);
  drawStroke(g.ctx, { k: g.k, c: g.c, p: g.p });
}

function endStroke(e, keep) {
  const g = S.gest;
  S.gest = null;
  if (keep && e && !g.line) {
    const [x, y] = toWorld(e);
    const a = g.p, n = a.length;
    if (Math.hypot(x - a[n - 3], y - a[n - 2]) > .1) {
      a.push(x, y, g.w);
      growBB(g, x, y, g.w);
      const i = a.length / 3 - 1;
      liveDraw(g, ctx => drawSeg(ctx, a, i), g.bb);
    }
    liveDraw(g, ctx => drawTail(ctx, a), g.bb);
  }
  if (!keep) {
    if (g.k === 'pen') wipeInkNow();
    else if (g.k === 'hl') wipe(S.hlCtx, liveHl);
    else refresh(g.bb);
    updateHint();
    return;
  }
  if (g.k === 'er') {
    const mask = { k: 'er', p: new Float32Array(g.p), bb: g.bb };
    const targets = S.ops.filter(o => !o.hidden && hits(o.bb, mask.bb));
    for (const o of targets) (o.masks ||= []).push(mask);
    if (targets.length) record({ t: 'erase', mask, targets });
    return;
  }
  const op = { k: g.k, p: new Float32Array(g.p), bb: g.bb, c: g.c };
  S.ops.push(op);
  record({ t: 'add', op });
  forTiles(op.bb, true, t => paint(t, op));
  if (g.k === 'pen') wipeInkSoon();
  else if (g.k === 'hl') wipe(S.hlCtx, liveHl);
}

function startPan(id, x, y) {
  S.gest = { type: 'pan', id, sx: x, sy: y, px: pan.x, py: pan.y };
  board.classList.add('panning');
  ring.hidden = true;
}

function endPan() {
  S.gest = null;
  board.classList.remove('panning');
  scheduleSave();
}

function touchMid() {
  let x = 0, y = 0;
  touches.forEach(p => { x += p[0]; y += p[1]; });
  return [x / touches.size, y / touches.size];
}

/* Spostamento con tasto destro: i driver delle penne possono mandare la pressione da un puntatore
   e i movimenti da un altro, o perdere il rilascio. Quindi vale qualsiasi movimento, e qualsiasi rilascio chiude. */
function panMove(e) {
  if (S.gest?.type !== 'pan' || S.gest.id === 'touch' || e.pointerType === 'touch') return;
  if (e.type === 'mousemove' && !e.buttons) return;
  if (e.pointerType === 'mouse' && !e.buttons) { endPan(); return; }
  setPan(S.gest.px + e.clientX - S.gest.sx, S.gest.py + e.clientY - S.gest.sy);
}

function panRelease(e) {
  if (S.gest?.type === 'pan' && S.gest.id !== 'touch' && e.pointerType !== 'touch') endPan();
}

function pointerEnd(e, cancelled) {
  if (e.pointerType === 'touch' && touches.delete(e.pointerId)) {
    if (S.gest?.id === 'touch') {
      if (touches.size === 1) {          // resta un dito: riparte da lì senza scatti
        const [x, y] = touchMid();
        S.gest.sx = x; S.gest.sy = y; S.gest.px = pan.x; S.gest.py = pan.y;
      } else if (touches.size === 0) endPan();
      return;
    }
  }
  if (!S.gest || S.gest.id !== e.pointerId) return;
  if (S.gest.type === 'pan') endPan();
  else if (S.gest.type === 'place') S.gest = null;
  else if (S.gest.type === 'grip') { S.gest = null; S.edit?.el.focus({ preventScroll: true }); }
  else if (S.gest.type === 'txpress') textRelease(cancelled);
  else if (S.gest.type === 'seldrag') selDragEnd();
  else if (S.gest.type === 'marquee') marqueeEnd();
  else {
    endStroke(e, !cancelled || S.gest.p.length > 3);
    scheduleSave();
    syncButtons();
  }
}

function moveRing(e) {
  if (S.tool !== 'er' && S.tool !== 'hl') return;
  const s = tools[S.tool].s * S.zoom;
  if (ring.hidden) ring.hidden = false;
  ring.style.transform = `translate3d(${e.clientX - s / 2}px,${e.clientY - s / 2}px,0)`;
}

export function styleRing() {
  const s = tools[S.tool].s * S.zoom;
  ring.style.width = ring.style.height = s + 'px';
  if (S.tool !== 'er' && S.tool !== 'hl') ring.hidden = true;
}

export function initInput() {
  window.addEventListener('pointermove', panMove, true);
  if (rawMove) window.addEventListener('pointerrawupdate', panMove, true);
  window.addEventListener('mousemove', panMove, true);
  for (const t of ['pointerup', 'pointercancel', 'mouseup']) window.addEventListener(t, panRelease, true);
  window.addEventListener('blur', () => { if (S.gest?.type === 'pan') endPan(); });
  board.addEventListener('mousedown', e => { if (e.target !== S.edit?.el) e.preventDefault(); });
  board.addEventListener('contextmenu', e => e.preventDefault());
  board.addEventListener('dragstart', e => e.preventDefault());
  board.addEventListener('pointerdown', e => {
    if (S.edit && e.target === S.edit.el) return;
    window.focus();
    if (e.pointerType === 'pen') S.penSeen = true;

    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size === 2 && S.gest?.type === 'stroke') endStroke(null, false);
      if (touches.size === 2) {
        if (S.gest) endPan();
        const [mx, my] = touchMid();
        startPan('touch', mx, my);
        return;
      }
      if (touches.size > 2) return;
      if (S.penSeen) {            // con una penna in uso le dita spostano il foglio e non scrivono
        startPan('touch', e.clientX, e.clientY);
        return;
      }
    }
    if (S.gest) return;

    const eraserTip = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32));
    if (e.button === 2 || e.button === 1 || (S.spaceDown && e.button === 0)) {
      try { board.setPointerCapture(e.pointerId); } catch {}
      startPan(e.pointerId, e.clientX, e.clientY);
      return;
    }
    if (S.place) {
      if (e.button === 0 && e.target.closest?.('#placing')) {
        try { board.setPointerCapture(e.pointerId); } catch {}
        S.gest = { type: 'place', id: e.pointerId, mode: e.target.id === 'placeHandle' ? 'size' : 'move', sx: e.clientX, sy: e.clientY, ox: S.place.x, oy: S.place.y, ow: S.place.w };
      } else commitPlace();
      return;
    }
    if (S.cleanMode) return;                 // in vista pulita si può solo spostare il foglio
    if (e.button !== 0 && !eraserTip) return;

    if (eraserTip) clearSel();
    if (!eraserTip && S.tool === 'se') { selDown(e); return; }
    if (!eraserTip && S.tool === 'tx') { textClick(e); return; }
    if (S.edit) { commitEdit(); return; }

    board.setPointerCapture(e.pointerId);
    startStroke(e, eraserTip ? 'er' : S.tool);
  });
  board.addEventListener(rawMove ? 'pointerrawupdate' : 'pointermove', e => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (S.gest?.type === 'pan' && S.gest.id === 'touch') {
        const [x, y] = touches.size > 1 ? touchMid() : [e.clientX, e.clientY];
        setPan(S.gest.px + x - S.gest.sx, S.gest.py + y - S.gest.sy);
        return;
      }
    }
    if (!S.gest) { moveRing(e); hoverText(e); return; }
    if (S.gest.type === 'pan') return;       // lo spostamento è gestito da panMove
    if (S.gest.type === 'place') { placeMove(e); return; }
    if (S.gest.type === 'txpress') { textDrag(e); return; }
    if (S.gest.type === 'grip') { gripDrag(e); return; }
    if (S.gest.type === 'seldrag') { selDrag(e); return; }
    if (S.gest.type === 'marquee') { marqueeDrag(e); return; }
    if (S.gest.id !== e.pointerId) return;
    moveRing(e);
    const g = S.gest;
    if (g.k !== 'er' && (g.line || (e.shiftKey && S.showDots))) { lineMove(g, e); return; }
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (list && list.length) for (const c of list) addPoint(c);
    else addPoint(e);
  });
  board.addEventListener('pointerup', e => pointerEnd(e, false));
  board.addEventListener('pointercancel', e => pointerEnd(e, true));
  board.addEventListener('pointerleave', () => { if (!S.gest) ring.hidden = true; });
  // La rotella e lo scorrimento della penna fanno lo zoom attorno al puntatore, non durante un gesto
  board.addEventListener('wheel', e => {
    e.preventDefault();
    if (S.gest) return;
    wheelZoom(e);
  }, { passive: false });
}
