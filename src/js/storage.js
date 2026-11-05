// Salvataggio automatico nel browser (IndexedDB).

import { updateHint } from './history.js';
import { repaintAll } from './layers.js';
import { normalizeOps } from './objects.js';
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

export function scheduleSave() {
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(save, 1200);
}

export async function save() {
  if (S.gest) { scheduleSave(); return; }
  try {
    const d = await db();
    d.transaction('doc', 'readwrite').objectStore('doc').put({ ops: S.ops.map(({ bmp, ...o }) => o), pan: { ...pan }, zoom: S.zoom }, 'main');
  } catch {}
}

export async function restore() {
  try {
    const d = await db();
    const data = await new Promise((res, rej) => {
      const r = d.transaction('doc').objectStore('doc').get('main');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
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
  } catch {}
}
