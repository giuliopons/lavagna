// Immagini incollate: prima si posizionano, poi diventano parte del foglio.

import { CLIP_PREFIX, pasteClip } from './clipboard.js';
import { world } from './dom.js';
import { afterChange, record, updateHint } from './history.js';
import { forTiles, paint } from './layers.js';
import { S, pan } from './state.js';
import { commitEdit } from './text-editor.js';
import { toast } from './toast.js';

async function startPlace(blob) {
  let bmp;
  try { bmp = await createImageBitmap(blob); }
  catch { toast('Non riesco a leggere questa immagine. Prova a copiarla di nuovo.'); return; }
  commitPlace();
  let w = bmp.width / S.dpr, h = bmp.height / S.dpr;
  const k = Math.min(1, S.vw * .8 / S.zoom / w, S.vh * .7 / S.zoom / h);
  w *= k; h *= k;
  const el = document.createElement('div');
  el.id = 'placing';
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  const handle = document.createElement('div');
  handle.id = 'placeHandle';
  el.append(c, handle);
  world.appendChild(el);
  S.place = { el, bmp, blob, x: Math.round((S.vw / 2 - pan.x) / S.zoom - w / 2), y: Math.round((S.vh / 2 - pan.y) / S.zoom - h / 2), w, h, ratio: h / w };
  stylePlace();
  updateHint();
  toast('Trascina per spostarla, usa l\'angolo per ridimensionarla. Clic fuori o Invio per fissarla.');
}

function stylePlace() {
  const s = S.place.el.style;
  s.left = S.place.x + 'px'; s.top = S.place.y + 'px';
  s.width = S.place.w + 'px'; s.height = S.place.h + 'px';
}

export function placeMove(e) {
  if (!S.place || S.gest.id !== e.pointerId) return;
  const dx = (e.clientX - S.gest.sx) / S.zoom, dy = (e.clientY - S.gest.sy) / S.zoom;
  if (S.gest.mode === 'size') {
    S.place.w = Math.max(24, S.gest.ow + dx);
    S.place.h = S.place.w * S.place.ratio;
  } else {
    S.place.x = S.gest.ox + dx;
    S.place.y = S.gest.oy + dy;
  }
  stylePlace();
}

export function commitPlace() {
  if (!S.place) return;
  const { el, bmp, blob, x, y, w, h } = S.place;
  el.remove();
  S.place = null;
  const op = { k: 'im', x, y, w, h, bmp, blob, bb: [x - 1, y - 1, x + w + 1, y + h + 1] };
  S.ops.push(op);
  record({ t: 'add', op });
  forTiles(op.bb, true, t => paint(t, op));
  afterChange();
}

export function cancelPlace() {
  if (!S.place) return;
  S.place.el.remove();
  S.place = null;
  updateHint();
}

export function initImages() {
  window.addEventListener('paste', e => {
    if (S.cleanMode || e.target.closest?.('#panel')) return;
    const pastedText = e.clipboardData?.getData('text/plain') || '';
    if (pastedText.startsWith(CLIP_PREFIX)) {
      e.preventDefault();
      if (S.clip && pastedText === S.clip.id) pasteClip();
      else toast('Gli oggetti copiati non ci sono più: la pagina è stata ricaricata. Copiali di nuovo.');
      return;
    }
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) {
      if (!S.edit) toast('Negli appunti non c\'è un\'immagine.');
      return;
    }
    e.preventDefault();
    commitEdit();
    startPlace(file);
  });
}
