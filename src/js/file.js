// Salva e Apri su file locale.

import { $ } from './dom.js';
import { afterChange, record } from './history.js';
import { commitPlace, startPlace } from './images.js';
import { normalizeOps } from './objects.js';
import { importPdf } from './pdf-import.js';
import { clearSel } from './selection.js';
import { S, pan } from './state.js';
import { fileName, setName } from './sheet-info.js';
import { commitEdit } from './text-editor.js';
import { textBB } from './text-render.js';
import { toast } from './toast.js';
import { setView } from './view.js';

const FILE_APP = 'lavagna-a-mano-libera';

const FILE_TYPES = [{ description: 'Lavagna salvata', accept: { 'application/json': ['.json'] } }];

const OPEN_TYPES = [{
  description: 'Lavagna, PDF o immagine',
  accept: { 'application/json': ['.json'], 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
}];

let fileHandle = null;

// Dopo Pulisci il foglio è nuovo: Ctrl+S non deve sovrascrivere il file aperto prima
export function forgetFile() { fileHandle = null; }

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

// Un oggetto come va nel file, senza i dati dell'immagine
export function plainOp(o) {
  const { bmp, blob, hidden, masks, ...rest } = o;
  const out = { ...rest };
  if (o.p) out.p = round2(o.p);
  if (masks?.length) out.masks = masks.map(m => ({ k: 'er', bb: m.bb, p: round2(m.p) }));
  return out;
}

export async function docBlob() {
  const list = await Promise.all(S.ops.map(async o => {
    const out = plainOp(o);
    if (o.k === 'im') out.data = await blobToData(o.blob);
    return out;
  }));
  // forme importate da PDF e testi o immagini ruotati (campo r) arrivano con la versione 2
  const version = S.ops.some(o => o.k === 'sh' || o.r) ? 2 : 1;
  return new Blob([JSON.stringify({ app: FILE_APP, version, name: S.name, pan: { ...pan }, zoom: S.zoom, ops: list })], { type: 'application/json' });
}

const baseName = f => f.replace(/\.json$/i, '');

export async function doSave(saveAs) {
  commitEdit();
  commitPlace();
  // si sceglie il file una volta, poi Ctrl+S lo sovrascrive
  if (window.showSaveFilePicker) {
    try {
      // se il nome è cambiato si sceglie di nuovo il file
      if (!fileHandle || saveAs || fileHandle.name !== fileName()) {
        fileHandle = await window.showSaveFilePicker({ suggestedName: fileName(), types: FILE_TYPES });
        if (fileHandle.name !== fileName()) setName(baseName(fileHandle.name));
      }
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
  a.download = fileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast('Download avviato: ' + a.download);
}

export async function doOpen() {
  commitEdit();
  commitPlace();
  if (window.showOpenFilePicker) {
    try {
      const [h] = await window.showOpenFilePicker({ types: OPEN_TYPES });
      const f = await h.getFile();
      if (await openAny(f) === 'json') fileHandle = h;
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  $('fileInput').click();
}

const kindOf = f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? 'pdf'
  : f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name) ? 'image' : 'json';

// Un .json sostituisce il foglio, un PDF si aggiunge, un'immagine si posiziona come se fosse incollata.
// Restituisce 'json' solo se il foglio è stato aperto: Ctrl+S può sovrascrivere quel file
async function openAny(file) {
  const kind = kindOf(file);
  if (kind === 'pdf') { await importPdf(file); return 'pdf'; }
  if (kind === 'image') { commitEdit(); clearSel(); await startPlace(file); return 'image'; }
  return await loadFile(file) ? 'json' : null;
}

async function loadFile(file) {
  let list, savedPan, name;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== FILE_APP || !Array.isArray(data.ops)) throw new Error('formato');
    name = baseName(file.name) || data.name;
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
  record({ t: 'load', a: S.ops, b, pa: { ...pan, z: S.zoom }, pb: savedPan, na: S.name, nb: name });
  S.ops = b;
  setName(name);
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
    if (f && await openAny(f) === 'json') fileHandle = null;
  });
}
