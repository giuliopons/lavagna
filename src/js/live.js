// Tela del tratto in corso: niente sincronizzazione col compositore, se il browser la concede.

import { liveHl } from './dom.js';
import { S, pan } from './state.js';

let inkC = null;

export function makeInk() {
  if (inkC) inkC.remove();
  inkC = document.createElement('canvas');
  inkC.className = 'live';
  liveHl.after(inkC);
  S.inkCtx = inkC.getContext('2d', S.lowLatency ? { desynchronized: true } : undefined);
  sizeLive();
}

export function sizeLive() {
  const w = Math.round(S.vw * S.dpr), h = Math.round(S.vh * S.dpr);
  inkC.width = w; inkC.height = h;
  liveHl.width = w; liveHl.height = h;
  S.hlCtx = liveHl.getContext('2d');
}

export function liveTransform(ctx) { ctx.setTransform(S.dpr * S.zoom, 0, 0, S.dpr * S.zoom, pan.x * S.dpr, pan.y * S.dpr); }

export function wipe(ctx, c) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
}

let wipeToken = 0;

export function wipeInkSoon() {
  const tok = ++wipeToken;
  requestAnimationFrame(() => requestAnimationFrame(() => { if (tok === wipeToken) wipe(S.inkCtx, inkC); }));
}

export function wipeInkNow() { wipeToken++; wipe(S.inkCtx, inkC); }
