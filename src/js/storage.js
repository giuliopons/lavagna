// Salvataggio automatico nel browser (IndexedDB).

import { updateHint } from './history.js';
import { repaintAll } from './layers.js';
import { normalizeOps } from './objects.js';
import { setName, updatePanelSoon } from './sheet-info.js';
import { S, pan } from './state.js';
import { syncButtons } from './tray.js';
import { setView } from './view.js';

let dbP = null;

function db() {
  if (!dbP) dbP = new Promise((res, rej) => {
    const r = indexedDB.open('lavagna', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('doc');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbP;
}

/* Altre chiavi nello stesso archivio 'doc': la cartella dei disegni e la cache delle anteprime.
   Il database resta alla versione 1 */
export async function idbGet(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction('doc').objectStore('doc').get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function idbPut(key, value) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('doc', 'readwrite');
    tx.objectStore('doc').put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function idbDel(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('doc', 'readwrite');
    tx.objectStore('doc').delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export function scheduleSave() {
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(save, 1200);
}

export async function save() {
  if (S.gest) { scheduleSave(); return; }
  try {
    const d = await db();
    d.transaction('doc', 'readwrite').objectStore('doc').put({
      ops: S.ops.map(({ bmp, ...o }) => o), pan: { ...pan }, zoom: S.zoom, name: S.name,
      folderFile: S.folderFile, dirty: S.dirty,
    }, 'main');
  } catch {}
}

export async function restore() {
  try {
    const data = await idbGet('main');
    if (data?.name && !S.ops.length) setName(data.name);
    if (data && !S.ops.length) { S.folderFile = data.folderFile || null; S.dirty = !!data.dirty; }
    if (!data || !data.ops || S.ops.length) return;
    const loaded = data.ops.map(o => ({ ...o, hidden: false }));
    await Promise.all(loaded.map(async o => {
      if (o.k !== 'im') return;
      try { o.bmp = await createImageBitmap(o.blob); } catch { o.bad = true; }
    }));
    if (S.ops.length) return;
    S.ops = normalizeOps(loaded.filter(o => !o.bad));
    if (data.pan) setView(data.pan.x, data.pan.y, data.zoom);
    repaintAll();
    updateHint();
    syncButtons();
    updatePanelSoon();
  } catch {}
}
