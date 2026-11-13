// Linee tratteggiate in movimento: un solo tasto per tutto il foglio.
// Da ferme stanno nei tasselli come gli altri tratti. In movimento escono dai tasselli (paint le salta)
// e si disegnano a ogni fotogramma su una tela sopra il foglio, solo quelle visibili.

import { $, liveHl } from './dom.js';
import { hits, refreshMany } from './layers.js';
import { S, pan, savePrefs } from './state.js';
import { dashPattern, drawDashed, drawStroke } from './stroke.js';

const SPEED = 1.2;  // periodi del tratteggio al secondo a velocità 1×, nel verso del disegno

// phase: quanti periodi sono già scorsi. Si accumula fotogramma per fotogramma, così cambiando velocità
// i trattini ripartono da dove sono invece di saltare
let canvas = null, ctx = null, tmp = null, tctx = null, raf = 0, last = 0, phase = 0;

const PLAY = 'M8 5.5v13l10-6.5z', PAUSE = 'M8.5 5.5v13M15.5 5.5v13';

export function syncDashBtn() {
  const any = S.ops.some(o => o.k === 'da');
  if (!any && S.dashPlay) setDashPlay(false);
  const b = $('dashPlay'), sp = $('dashSpeed');
  b.hidden = !any;
  sp.hidden = !S.dashPlay;
  sp.value = S.dashSpeed;
  sp.title = 'Velocità dei trattini: ' + speedText();
  sp.setAttribute('aria-valuetext', speedText());
  b.setAttribute('aria-pressed', S.dashPlay);
  const label = S.dashPlay ? 'Ferma le linee tratteggiate' : 'Anima le linee tratteggiate';
  b.title = label + ' (A)';
  b.setAttribute('aria-label', label);
  $('dashPlayIcon').setAttribute('d', S.dashPlay ? PAUSE : PLAY);
}

export function setDashPlay(on) {
  if (on === S.dashPlay || (on && !S.ops.some(o => o.k === 'da'))) return;
  S.dashPlay = on;
  // le linee tratteggiate escono dai tasselli o ci rientrano
  refreshMany(S.ops.filter(o => o.k === 'da').map(o => o.bb));
  cancelAnimationFrame(raf);
  if (on) { last = performance.now(); phase = 0; raf = requestAnimationFrame(frame); }
  else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  syncDashBtn();
}

const speedText = () => {
  const k = 2 ** S.dashSpeed;
  return (k < 1 ? k.toFixed(2).replace(/0$/, '') : String(Math.round(k * 100) / 100)).replace('.', ',') + '×';
};

export const toggleDashPlay = () => setDashPlay(!S.dashPlay);

function frame(now) {
  if (!S.dashPlay) return;
  raf = requestAnimationFrame(frame);
  const w = Math.round(S.vw * S.dpr), h = Math.round(S.vh * S.dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (S.gallery) { last = now; return; }
  phase = (phase + Math.max(0, now - last) / 1000 * SPEED * 2 ** S.dashSpeed) % 1;
  last = now;
  const z = S.zoom;
  const view = [-pan.x / z, -pan.y / z, (S.vw - pan.x) / z, (S.vh - pan.y) / z];
  const m = [S.dpr * z, 0, 0, S.dpr * z, pan.x * S.dpr, pan.y * S.dpr];
  for (const op of S.ops) {
    if (op.k !== 'da' || op.hidden || !hits(view, op.bb)) continue;
    const [d, g] = dashPattern(op.p[2]), period = d + g;
    // l'offset che cala fa correre i trattini dall'inizio verso la fine della linea
    const off = -phase * period;
    const masks = op.masks?.filter(k => hits(view, k.bb));
    if (!masks?.length) {
      ctx.setTransform(...m);
      drawDashed(ctx, op, off);
      continue;
    }
    // con la gomma: su un foglio d'appoggio, così la maschera tocca solo questa linea
    if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h; }
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, w, h);
    tctx.setTransform(...m);
    drawDashed(tctx, op, off);
    tctx.globalCompositeOperation = 'destination-out';
    for (const k of masks) drawStroke(tctx, k);
    tctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0);
  }
}

export function initDashAnim() {
  canvas = document.createElement('canvas');
  canvas.className = 'live';
  canvas.id = 'dashLive';
  liveHl.before(canvas);
  ctx = canvas.getContext('2d');
  tmp = document.createElement('canvas');
  tctx = tmp.getContext('2d');
  $('dashPlay').addEventListener('click', toggleDashPlay);
  const sp = $('dashSpeed');
  sp.addEventListener('input', () => {
    S.dashSpeed = parseFloat(sp.value);
    sp.title = 'Velocità dei trattini: ' + speedText();
    sp.setAttribute('aria-valuetext', speedText());
  });
  sp.addEventListener('change', savePrefs);
}
