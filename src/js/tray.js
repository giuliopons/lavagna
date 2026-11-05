// Vassoio degli strumenti: strumento attivo, colori, spessore, bassa latenza.

import { $, board } from './dom.js';
import { clearBoard, redo, undo } from './history.js';
import { commitPlace } from './images.js';
import { styleRing } from './input.js';
import { makeInk } from './live.js';
import { clearSel } from './selection.js';
import { INK, MARK, S, savePrefs, tools } from './state.js';
import { commitEdit, styleEditor } from './text-editor.js';
import { toast } from './toast.js';

const colorsEl = $('colors');

const sizeRange = $('sizeRange');

const sizeVal = $('sizeVal');

const sizeDot = $('sizeDot');

export function setTool(t) {
  if (S.edit && t !== 'tx') commitEdit();
  clearSel();
  commitPlace();
  S.tool = t;
  syncTool();
  savePrefs();
}

export function syncTool() {
  board.classList.toggle('tool-er', S.tool === 'er');
  board.classList.toggle('tool-tx', S.tool === 'tx');
  board.classList.toggle('tool-se', S.tool === 'se');
  $('sizeBox').hidden = S.tool === 'se';
  $('sizeRule').hidden = S.tool === 'se';
  document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === S.tool));
  const set = tools[S.tool];
  sizeRange.min = set.min; sizeRange.max = set.max; sizeRange.step = set.step; sizeRange.value = set.s;
  sizeRange.setAttribute('aria-label', S.tool === 'tx' ? 'Grandezza del testo' : 'Spessore');
  buildSwatches();
  syncSize();
  styleRing();
  styleEditor();
}

function buildSwatches() {
  const set = tools[S.tool];
  const hide = S.tool === 'er' || S.tool === 'se';
  colorsEl.hidden = hide;
  $('colorRule').hidden = hide;
  if (hide) return;
  const list = S.tool === 'hl' ? MARK : INK;
  colorsEl.textContent = '';
  list.forEach(c => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', c === set.c);
    b.setAttribute('aria-label', 'Colore ' + c);
    b.style.backgroundColor = c;
    b.addEventListener('click', () => setColor(c));
    colorsEl.appendChild(b);
  });
  const wrap = document.createElement('label');
  wrap.id = 'customWrap';
  wrap.title = 'Altro colore';
  wrap.classList.toggle('active', !list.includes(set.c));
  if (!list.includes(set.c)) wrap.style.background = set.c;
  const inp = document.createElement('input');
  inp.type = 'color';
  inp.id = 'customColor';
  inp.value = set.c;
  inp.setAttribute('aria-label', 'Altro colore');
  inp.addEventListener('input', () => {
    tools[S.tool].c = inp.value;
    wrap.style.background = inp.value;
    syncSize();
    styleEditor();
  });
  inp.addEventListener('change', () => { setColor(inp.value); S.edit?.el.focus({ preventScroll: true }); });
  wrap.appendChild(inp);
  colorsEl.appendChild(wrap);
}

function setColor(c) {
  tools[S.tool].c = c;
  buildSwatches();
  syncSize();
  styleEditor();
  savePrefs();
}

function syncSize() {
  const set = tools[S.tool];
  sizeVal.textContent = set.s + ' px';
  const d = Math.min(30, S.tool === 'tx' ? set.s * .5 : set.s);
  sizeDot.style.width = sizeDot.style.height = Math.max(2, d) + 'px';
  sizeDot.style.backgroundColor = S.tool === 'er' ? 'transparent' : set.c;
  sizeDot.style.boxShadow = S.tool === 'er' ? 'inset 0 0 0 1.5px #e8ecf1' : '';
}

export function syncButtons() {
  $('undo').disabled = !S.undoStack.length;
  $('redo').disabled = !S.redoStack.length;
  $('clear').disabled = !S.ops.length;
}

/* Bassa latenza */
const lowBtn = $('lowLat');

export function syncLow() {
  const on = !!S.inkCtx.getContextAttributes?.().desynchronized;
  lowBtn.setAttribute('aria-pressed', on);
  lowBtn.title = on ? 'Bassa latenza attiva. Spegnila se vedi sfarfallii.' : 'Bassa latenza spenta. Accendila per un tratto più reattivo.';
}

export function initTray() {
  sizeRange.addEventListener('input', () => {
    tools[S.tool].s = parseFloat(sizeRange.value);
    syncSize();
    styleRing();
    styleEditor();
  });
  sizeRange.addEventListener('change', () => { savePrefs(); S.edit?.el.focus({ preventScroll: true }); });
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('tray').addEventListener('mousedown', e => { if (!e.target.closest('input, label')) e.preventDefault(); });
  $('tray').addEventListener('contextmenu', e => e.preventDefault());
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('clear').addEventListener('click', clearBoard);
  lowBtn.addEventListener('click', () => {
    S.lowLatency = !S.lowLatency;
    makeInk();
    syncLow();
    savePrefs();
    const on = !!S.inkCtx.getContextAttributes?.().desynchronized;
    if (S.lowLatency && !on) toast('Questo browser non offre la bassa latenza.');
    else toast(on ? 'Bassa latenza attiva.' : 'Bassa latenza spenta.');
  });
}
