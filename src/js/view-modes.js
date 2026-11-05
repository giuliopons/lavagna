// Schermo intero e vista pulita per gli screenshot.

import { $, board } from './dom.js';
import { commitPlace } from './images.js';
import { clearSel } from './selection.js';
import { S } from './state.js';
import { commitEdit } from './text-editor.js';
import { toast } from './toast.js';

/* Schermo intero */
export const fullBtn = $('full');

const ICON_IN = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';

const ICON_OUT = 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5';

export function toggleFull() {
  if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
  const r = document.documentElement.requestFullscreen?.();
  if (!r) { toast('Questo browser non offre lo schermo intero.'); return; }
  r.catch(() => toast('Il browser ha negato lo schermo intero. Apri la lavagna nella sua pagina e riprova.'));
}

let cleanOwnsFull = false;

export function setClean(on) {
  if (on === S.cleanMode) return;
  if (on) { commitEdit(); commitPlace(); clearSel(); }
  S.cleanMode = on;
  document.body.classList.toggle('clean', on);
  if (on) {
    cleanOwnsFull = false;
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      cleanOwnsFull = true;
      document.documentElement.requestFullscreen().catch(() => { cleanOwnsFull = false; });
    }
    toast('Esc o doppio clic per tornare', 1800);
  } else {
    $('toast').hidden = true;
    if (cleanOwnsFull && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    cleanOwnsFull = false;
  }
}

export function initViewModes() {
  fullBtn.addEventListener('click', toggleFull);
  $('clean').addEventListener('click', () => setClean(true));
  board.addEventListener('dblclick', () => setClean(false));
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    $('fullPath').setAttribute('d', on ? ICON_OUT : ICON_IN);
    fullBtn.setAttribute('aria-pressed', on);
    fullBtn.title = on ? 'Esci dallo schermo intero (F)' : 'Schermo intero (F)';
    if (!on) setClean(false);
  });
}
