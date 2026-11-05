// Annulla e ripeti.

import { hint } from './dom.js';
import { forgetFile } from './file.js';
import { commitPlace } from './images.js';
import { dropTiles, refresh, repaintAll } from './layers.js';
import { clearSel } from './selection.js';
import { setName, updatePanelSoon } from './sheet-info.js';
import { S } from './state.js';
import { scheduleSave } from './storage.js';
import { commitEdit } from './text-editor.js';
import { toast } from './toast.js';
import { syncButtons } from './tray.js';
import { setView } from './view.js';

export function record(h) { S.undoStack.push(h); S.redoStack.length = 0; if (S.undoStack.length > 500) S.undoStack.shift(); }

function apply(h, undoing) {
  switch (h.t) {
    case 'add':
      if (undoing) S.ops.splice(S.ops.lastIndexOf(h.op), 1); else S.ops.push(h.op);
      refresh(h.op.bb);
      break;
    case 'del':
      if (undoing) S.ops.splice(h.i, 0, h.op); else S.ops.splice(h.i, 1);
      refresh(h.op.bb);
      break;
    case 'rep':
      S.ops[h.i] = undoing ? h.a : h.b;
      refresh(h.a.bb); refresh(h.b.bb);
      break;
    case 'mov':
      if (undoing) { S.ops.splice(S.ops.lastIndexOf(h.b), 1); S.ops.splice(h.i, 0, h.a); }
      else { S.ops.splice(h.i, 1); S.ops.push(h.b); }
      refresh(h.a.bb); refresh(h.b.bb);
      break;
    case 'order':
      S.ops = undoing ? h.a : h.b;
      refresh(h.bb);
      break;
    case 'addmany':
      if (undoing) S.ops.splice(S.ops.length - h.ops.length, h.ops.length);
      else S.ops.push(...h.ops);
      for (const o of h.ops) refresh(o.bb);
      break;
    case 'erase':
      for (const o of h.targets) {
        if (undoing) o.masks.splice(o.masks.lastIndexOf(h.mask), 1);
        else (o.masks ||= []).push(h.mask);
      }
      refresh(h.mask.bb);
      break;
    case 'selmove':
      h.idx.forEach((i, k) => { S.ops[i] = undoing ? h.a[k] : h.b[k]; });
      for (const o of [...h.a, ...h.b]) refresh(o.bb);
      break;
    case 'delsel':
      if (undoing) for (const it of h.items) S.ops.splice(it.i, 0, it.op);
      else for (let k = h.items.length - 1; k >= 0; k--) S.ops.splice(h.items[k].i, 1);
      for (const it of h.items) refresh(it.op.bb);
      break;
    case 'load':
      S.ops = undoing ? h.a : h.b;
      { const v = undoing ? h.pa : h.pb; setView(v.x, v.y, v.z); }
      if (h.nb) setName(undoing ? h.na : h.nb);
      break;
    case 'clear':
      S.ops = undoing ? h.ops : [];
      setName(undoing ? h.name : '');
      repaintAll();
      break;
  }
}

export function undo() {
  commitEdit();
  commitPlace();
  clearSel();
  const h = S.undoStack.pop();
  if (!h) return;
  apply(h, true); S.redoStack.push(h);
  afterChange();
}

export function redo() {
  commitEdit();
  commitPlace();
  clearSel();
  const h = S.redoStack.pop();
  if (!h) return;
  apply(h, false); S.undoStack.push(h);
  afterChange();
}

export function clearBoard() {
  commitEdit();
  commitPlace();
  clearSel();
  if (!S.ops.length) return;
  record({ t: 'clear', ops: S.ops, name: S.name });
  S.ops = [];
  // foglio nuovo: nome automatico e nessun file collegato, per non sovrascrivere quello di prima
  setName('');
  forgetFile();
  dropTiles();
  afterChange();
  toast('Foglio pulito. Annulla per riprenderlo.');
}

export function afterChange() { updateHint(); syncButtons(); scheduleSave(); updatePanelSoon(); }

export function updateHint() { hint.hidden = S.ops.length > 0 || !!S.edit || !!S.gest || !!S.place; }
