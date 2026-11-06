// Vista del foglio: spostamento e zoom. Schermo = foglio * zoom + pan.

import { $, dots, ring, world } from './dom.js';
import { styleRing } from './input.js';
import { makeLayer, scheduleEnsure } from './layers.js';
import { DOT, S, pan } from './state.js';
import { scheduleSave } from './storage.js';
import { styleGrip } from './text-editor.js';

let panQueued = false;

export function setPan(x, y) {
  pan.x = Math.round(x * S.dpr) / S.dpr;
  pan.y = Math.round(y * S.dpr) / S.dpr;
  if (panQueued) return;
  panQueued = true;
  requestAnimationFrame(() => { panQueued = false; applyPan(); });
}

let dotStep = 0;

let inverseZoom = 0;

export function applyPan() {
  const place3 = l => `translate3d(${pan.x}px,${pan.y}px,0) scale(${S.zoom / l.rz})`;
  S.L.el.style.transform = place3(S.L);
  if (S.backdrop) S.backdrop.el.style.transform = place3(S.backdrop);
  world.style.transform = `translate3d(${pan.x}px,${pan.y}px,0) scale(${S.zoom})`;
  if (inverseZoom !== 1 / S.zoom) {
    inverseZoom = 1 / S.zoom;
    world.style.setProperty('--iz', inverseZoom);
    if (S.edit) styleGrip();
  }
  let step = DOT * S.zoom;
  while (step < 14) step *= 2;
  if (step !== dotStep) {
    dotStep = step;
    dots.style.backgroundSize = `${step}px ${step}px`;
  }
  const mx = (((pan.x + 240) % step) + step) % step, my = (((pan.y + 240) % step) + step) % step;
  dots.style.transform = `translate3d(${mx}px,${my}px,0)`;
  scheduleEnsure();
}

const zoomRange = $('zoomRange');

const zoomVal = $('zoomVal');

let settleTimer = 0;

function syncZoomUI() {
  zoomRange.value = Math.log2(S.zoom);
  zoomVal.textContent = Math.round(S.zoom * 100) + '%';
}

// settle: quanto aspettare, a zoom fermo, prima di ridisegnare nitido
export function setZoom(z, cx, cy, settle = 160) {
  z = Math.min(4, Math.max(.25, z));
  if (z === S.zoom) return;
  const k = z / S.zoom;
  S.zoom = z;
  setPan(cx - (cx - pan.x) * k, cy - (cy - pan.y) * k);
  syncZoomUI();
  if (ring && !ring.hidden) styleRing();
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settleZoom, settle);
  scheduleSave();
}

/* Rotella del mouse e scorrimento della penna Wacom: zoom attorno al puntatore.
   Gli eventi arrivano a raffiche: il ridisegno nitido parte solo a raffica finita */
export function wheelZoom(e) {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? S.vh : 1;
  const dy = Math.max(-200, Math.min(200, e.deltaY * unit));
  if (!dy) return;
  setZoom(S.zoom * Math.exp(-dy * .0015), e.clientX, e.clientY, 350);
}

export function settleZoom() {
  if (S.gest) { settleTimer = setTimeout(settleZoom, 160); return; }
  if (S.zoom === S.L.rz) return;
  if (S.backdrop) S.L.el.remove();
  else S.backdrop = S.L;
  S.L = makeLayer(S.zoom);
  applyPan();
}

export function setView(x, y, z) {
  clearTimeout(settleTimer);
  pan.x = x; pan.y = y;
  S.zoom = Math.min(4, Math.max(.25, z || 1));
  if (S.backdrop) { S.backdrop.el.remove(); S.backdrop = null; }
  S.L.el.remove();
  S.L = makeLayer(S.zoom);
  syncZoomUI();
  applyPan();
}

export function initView() {
  zoomRange.addEventListener('input', () => {
    const v = parseFloat(zoomRange.value);
    setZoom(Math.abs(v) < .04 ? 1 : 2 ** v, S.vw / 2, S.vh / 2);
  });
  zoomVal.addEventListener('click', () => setZoom(1, S.vw / 2, S.vh / 2));
}
