// Scorciatoie da tastiera.

import { toggleDebug } from './debug.js';
import { board } from './dom.js';
import { doOpen, doSave } from './file.js';
import { redo, undo } from './history.js';
import { cancelPlace, commitPlace } from './images.js';
import { clearSel, selDelete, setSel } from './selection.js';
import { isPanelOpen, togglePanel } from './sheet-info.js';
import { S } from './state.js';
import { setTool } from './tray.js';
import { setZoom } from './view.js';
import { setClean, toggleFull } from './view-modes.js';

export function initKeyboard() {
  /* Tastiera */
  window.addEventListener('keydown', e => {
    if (e.target.matches?.('textarea, input[type=text]')) return;
    if (S.place && ['Escape', 'Delete', 'Backspace'].includes(e.key)) { e.preventDefault(); cancelPlace(); return; }
    if (S.place && e.key === 'Enter') { commitPlace(); return; }
    if (S.sel && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); selDelete(); return; }
    if (S.sel && e.key === 'Escape') { clearSel(); return; }
    if (S.tool === 'se' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(S.ops.filter(o => !o.hidden)); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(1, S.vw / 2, S.vh / 2); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); setZoom(S.zoom * 1.25, S.vw / 2, S.vh / 2); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(S.zoom / 1.25, S.vw / 2, S.vh / 2); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(e.shiftKey); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); doOpen(); return; }
    if (e.key === 'Escape' && isPanelOpen() && !S.sel && !S.place) { togglePanel(false); return; }
    if (S.cleanMode) {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'o') setClean(false);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space' && !e.repeat) { S.spaceDown = true; board.classList.add('hand'); e.preventDefault(); return; }
    const map = { p: 'pen', e: 'hl', g: 'er', t: 'tx', v: 'se' };
    const k = e.key.toLowerCase();
    if (map[k]) setTool(map[k]);
    else if (k === 'f') toggleFull();
    else if (k === 'o') setClean(true);
    else if (k === 'i') togglePanel();
    else if (__DEBUG_KEY__ && k === 'd') toggleDebug();
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') { S.spaceDown = false; board.classList.remove('hand'); }
  });
}
