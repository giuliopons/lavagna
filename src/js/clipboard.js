// Copia e incolla degli oggetti selezionati.

import { afterChange, record } from './history.js';
import { commitPlace } from './images.js';
import { forTiles, hits, paint } from './layers.js';
import { shiftBB, shiftOp } from './objects.js';
import { selDelete, setSel } from './selection.js';
import { S, pan } from './state.js';
import { commitEdit } from './text-editor.js';
import { toast } from './toast.js';
import { setTool } from './tray.js';

// Negli appunti di sistema va solo un segno di riconoscimento: se poi si copia altro altrove, Ctrl+V incolla quello
export const CLIP_PREFIX = 'Oggetti della lavagna #';

function bbOf(list) {
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of list) {
    bb[0] = Math.min(bb[0], o.bb[0]); bb[1] = Math.min(bb[1], o.bb[1]);
    bb[2] = Math.max(bb[2], o.bb[2]); bb[3] = Math.max(bb[3], o.bb[3]);
  }
  return bb;
}

function copySel(e) {
  S.clip = { id: CLIP_PREFIX + Date.now(), ops: S.sel.ops.map(o => shiftOp(o, 0, 0)), n: 0 };
  e.clipboardData.setData('text/plain', S.clip.id);
  e.preventDefault();
}

export function pasteClip() {
  commitEdit();
  commitPlace();
  S.clip.n++;
  const bb = bbOf(S.clip.ops);
  let dx = S.clip.n * 24 / S.zoom, dy = dx;
  // se l'originale è fuori dallo schermo, la copia arriva al centro della vista
  const view = [-pan.x / S.zoom, -pan.y / S.zoom, (S.vw - pan.x) / S.zoom, (S.vh - pan.y) / S.zoom];
  if (!hits(view, shiftBB(bb, dx, dy))) {
    dx = (view[0] + view[2] - bb[0] - bb[2]) / 2;
    dy = (view[1] + view[3] - bb[1] - bb[3]) / 2;
  }
  const list = S.clip.ops.map(o => shiftOp(o, dx, dy));
  S.ops.push(...list);
  record({ t: 'addmany', ops: list });
  for (const o of list) forTiles(o.bb, true, t => paint(t, o));
  setTool('se');
  setSel(list);
  afterChange();
}

export function initClipboard() {
  window.addEventListener('copy', e => {
    if (!S.sel || S.edit || S.cleanMode || e.target.closest?.('#panel')) return;
    copySel(e);
    toast(S.sel.ops.length === 1 ? 'Oggetto copiato.' : S.sel.ops.length + ' oggetti copiati.', 1400);
  });
  window.addEventListener('cut', e => {
    if (!S.sel || S.edit || S.cleanMode || e.target.closest?.('#panel')) return;
    copySel(e);
    selDelete();
  });
}
