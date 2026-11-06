// Avvio dell'applicazione.

import { initClipboard } from './clipboard.js';
import { initDebug } from './debug.js';
import { docBlob, initFile } from './file.js';
import { restoreFolder } from './folder.js';
import { initGallery, syncFolderUI } from './gallery.js';
import { initImages } from './images.js';
import { initInput } from './input.js';
import { initKeyboard } from './keyboard.js';
import { ensureStep, hits, initLayers, paint, repaintAll, scheduleEnsure, sizeTmp } from './layers.js';
import { makeInk, sizeLive } from './live.js';
import { S, T, pan } from './state.js';
import { initSheetInfo, setName } from './sheet-info.js';
import { restore, save } from './storage.js';
import { styleEditor } from './text-editor.js';
import { textBB } from './text-render.js';
import { initTray, syncButtons, syncLow, syncTool } from './tray.js';
import { applyPan, initView, setPan, setZoom, settleZoom } from './view.js';
import { fullBtn, initViewModes } from './view-modes.js';

function onResize() {
  const nd = window.devicePixelRatio || 1;
  S.vw = window.innerWidth; S.vh = window.innerHeight;
  if (nd !== S.dpr) {
    S.dpr = nd;
    S.tileScale = Math.round(T * S.dpr) / T;
    sizeTmp();
    setPan(pan.x, pan.y);
    if (!S.gest) repaintAll();
  }
  scheduleEnsure();
  if (S.gest?.type === 'stroke') return;
  sizeLive();
}

// Registra i listener di ogni modulo, poi avvia
initLayers();
initView();
initInput();
initDebug();
initImages();
initClipboard();
initFile();
initTray();
initViewModes();
initKeyboard();
initSheetInfo();
initGallery();

window.addEventListener('resize', onResize);

S.vw = window.innerWidth;

S.vh = window.innerHeight;

sizeTmp();

makeInk();

syncLow();

applyPan();

syncTool();

syncButtons();

setName('');

if (!document.fullscreenEnabled) fullBtn.hidden = true;

restore();

restoreFolder().then(syncFolderUI);

// quando il font arriva, i testi riprendono misure e forma giuste
document.fonts?.ready.then(() => {
  let any = false;
  for (const op of S.ops) if (op.k === 'tx') { op.bb = textBB(op); any = true; }
  if (any) repaintAll();
  styleEditor();
});

window.addEventListener('pagehide', () => { clearTimeout(S.saveTimer); save(); });

if (__PWA__ && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Solo per npm run bench
if (__BENCH__) window.__bench = { S, paint, repaintAll, ensureStep, docBlob, setZoom, settleZoom, hits };
