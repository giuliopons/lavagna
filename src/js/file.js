// Salva e Apri su file locale.

import { $ } from './dom.js';
import { afterChange, record } from './history.js';
import { commitPlace } from './images.js';
import { normalizeOps } from './objects.js';
import { clearSel } from './selection.js';
import { S, pan } from './state.js';
import { commitEdit } from './text-editor.js';
import { textBB } from './text-render.js';
import { toast } from './toast.js';
import { setView } from './view.js';

const FILE_APP = 'lavagna-a-mano-libera';

const FILE_TYPES = [{ description: 'Lavagna salvata', accept: { 'application/json': ['.json'] } }];

let fileHandle = null;

const round2 = a => Array.from(a, v => Math.round(v * 100) / 100);

const blobToData = b => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

function dataToBlob(url) {
  const m = /^data:([^;,]*);base64,(.*)$/s.exec(url);
  if (!m) throw new Error('immagine non valida');
  const bin = atob(m[2]), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: m[1] });
}

export async function docBlob() {
  const list = await Promise.all(S.ops.map(async o => {
    const { bmp, blob, hidden, masks, ...rest } = o;
    const out = { ...rest };
    if (o.p) out.p = round2(o.p);
    if (masks?.length) out.masks = masks.map(m => ({ k: 'er', bb: m.bb, p: round2(m.p) }));
    if (o.k === 'im') out.data = await blobToData(blob);
    return out;
  }));
  return new Blob([JSON.stringify({ app: FILE_APP, version: 1, pan: { ...pan }, zoom: S.zoom, ops: list })], { type: 'application/json' });
}

function suggestedName() {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return `lavagna-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.json`;
}

export async function doSave(saveAs) {
  commitEdit();
  commitPlace();
  // pagina pubblicata: il salvataggio passa dal visualizzatore
  const dl = window.claude?.use ? await window.claude.use('downloads') : null;
  if (dl) {
    try {
      await dl.save({ filename: suggestedName(), data: await docBlob() });
      toast('File consegnato al browser. Controlla i download.');
    } catch (err) {
      if (err?.code !== 'declined') toast('Il salvataggio non è riuscito qui. Usa la copia locale della lavagna.');
    }
    return;
  }
  // copia locale: si sceglie il file una volta, poi Ctrl+S lo sovrascrive
  if (window.showSaveFilePicker && !window.claude) {
    try {
      if (!fileHandle || saveAs) fileHandle = await window.showSaveFilePicker({ suggestedName: suggestedName(), types: FILE_TYPES });
      const w = await fileHandle.createWritable();
      await w.write(await docBlob());
      await w.close();
      toast('Salvato in ' + fileHandle.name);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      fileHandle = null;
    }
  }
  const url = URL.createObjectURL(await docBlob());
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast('Download avviato: ' + a.download);
}

export async function doOpen() {
  commitEdit();
  commitPlace();
  if (window.showOpenFilePicker && !window.claude) {
    try {
      const [h] = await window.showOpenFilePicker({ types: FILE_TYPES });
      if (await loadFile(await h.getFile())) fileHandle = h;
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  $('fileInput').click();
}

async function loadFile(file) {
  let list, savedPan;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== FILE_APP || !Array.isArray(data.ops)) throw new Error('formato');
    savedPan = { x: +data.pan?.x || 0, y: +data.pan?.y || 0, z: +data.zoom || 1 };
    list = await Promise.all(data.ops.map(async o => {
      const op = { ...o, hidden: false };
      if (o.p) op.p = new Float32Array(o.p);
      if (o.masks) op.masks = o.masks.map(m => ({ ...m, p: new Float32Array(m.p) }));
      if (o.k === 'im') {
        op.blob = dataToBlob(o.data);
        op.bmp = await createImageBitmap(op.blob);
        delete op.data;
      }
      if (o.k === 'tx') op.bb = textBB(op);
      return op;
    }));
  } catch {
    toast('Questo file non è una lavagna salvata.');
    return false;
  }
  clearSel();
  const b = normalizeOps(list);
  record({ t: 'load', a: S.ops, b, pa: { ...pan, z: S.zoom }, pb: savedPan });
  S.ops = b;
  setView(savedPan.x, savedPan.y, savedPan.z);
  afterChange();
  toast('Aperto ' + file.name + '. Annulla per tornare al foglio di prima.');
  return true;
}

export function initFile() {
  $('save').addEventListener('click', () => doSave(false));
  $('open').addEventListener('click', doOpen);
  $('fileInput').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) { fileHandle = null; await loadFile(f); }
  });
}
