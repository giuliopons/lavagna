// Cartella dei disegni sul computer dell'utente (File System Access, solo browser Chromium).
// Il riferimento alla cartella resta in IndexedDB: alla visita dopo basta, al massimo, riconfermare il permesso.

import { S } from './state.js';
import { idbDel, idbGet, idbPut } from './storage.js';

export const TRASH = 'Eliminati';

export const folderSupported = () => typeof window.showDirectoryPicker === 'function';

// Permesso di lettura e scrittura. Chiederlo (request) funziona solo dentro un gesto dell'utente
async function permission(handle, request) {
  if (!handle.queryPermission) return true;
  const opts = { mode: 'readwrite' };
  if (await handle.queryPermission(opts) === 'granted') return true;
  return request ? await handle.requestPermission(opts) === 'granted' : false;
}

export async function restoreFolder() {
  if (!folderSupported()) return;
  try {
    const handle = await idbGet('folder');
    if (handle) S.folder = { handle, ok: await permission(handle, false) };
  } catch {}
}

// Da chiamare dentro un gesto: se il permesso è scaduto il browser lo richiede
export async function ensureFolder() {
  if (!S.folder) return false;
  if (!S.folder.ok) {
    try { S.folder.ok = await permission(S.folder.handle, true); } catch { S.folder.ok = false; }
  }
  return S.folder.ok;
}

// Lancia AbortError se l'utente chiude la finestra senza scegliere
export async function chooseFolder() {
  const handle = await window.showDirectoryPicker({ id: 'lavagna', mode: 'readwrite' });
  S.folder = { handle, ok: true };
  S.folderFile = null;
  await idbPut('folder', handle);
}

export async function forgetFolder() {
  S.folder = null;
  S.folderFile = null;
  await idbDel('folder').catch(() => {});
}

const root = () => S.folder.handle;

async function trashDir(create) {
  try { return await root().getDirectoryHandle(TRASH, { create }); } catch { return null; }
}

async function exists(dir, name) {
  try { await dir.getFileHandle(name); return true; } catch { return false; }
}

export const fileExists = name => exists(root(), name);

// "nome.json", altrimenti "nome (2).json", "nome (3).json"...
export async function uniqueName(name, dir = root()) {
  const base = name.replace(/\.json$/i, '');
  let n = name;
  for (let i = 2; await exists(dir, n); i++) n = `${base} (${i}).json`;
  return n;
}

// I disegni della cartella (o del cestino), dal più recente
export async function listDrawings(trash = false) {
  const dir = trash ? await trashDir(false) : root();
  const out = [];
  if (!dir) return out;
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file' || !/\.json$/i.test(name)) continue;
    const file = await h.getFile();
    out.push({ name, file, lastModified: file.lastModified, size: file.size, trash });
  }
  return out.sort((a, b) => b.lastModified - a.lastModified);
}

export async function readDrawing(name) {
  return (await root().getFileHandle(name)).getFile();
}

export async function writeDrawing(name, blob) {
  const h = await root().getFileHandle(name, { create: true });
  const w = await h.createWritable();
  await w.write(blob);
  await w.close();
}

async function copy(fromDir, name, toDir, newName) {
  const file = await (await fromDir.getFileHandle(name)).getFile();
  const h = await toDir.getFileHandle(newName, { create: true });
  const w = await h.createWritable();
  await w.write(file);
  await w.close();
}

// Sposta o rinomina: move() conserva la data, se il browser non lo offre si copia e si cancella
async function move(fromDir, name, toDir, newName) {
  const h = await fromDir.getFileHandle(name);
  if (typeof h.move === 'function') {
    try { await (toDir === fromDir ? h.move(newName) : h.move(toDir, newName)); return; } catch {}
  }
  await copy(fromDir, name, toDir, newName);
  await fromDir.removeEntry(name);
}

export async function renameDrawing(name, newName) {
  if (await exists(root(), newName)) throw new Error('esiste');
  await move(root(), name, root(), newName);
}

export async function duplicateDrawing(name) {
  const n = await uniqueName(name.replace(/\.json$/i, '') + ' (copia).json');
  await copy(root(), name, root(), n);
  return n;
}

export async function trashDrawing(name) {
  const t = await trashDir(true);
  await move(root(), name, t, await uniqueName(name, t));
}

export async function restoreDrawing(name) {
  const t = await trashDir(false);
  const n = await uniqueName(name);
  await move(t, name, root(), n);
  return n;
}

export async function deleteForever(name) {
  const t = await trashDir(false);
  if (t) await t.removeEntry(name);
}

export async function emptyTrash() {
  try { await root().removeEntry(TRASH, { recursive: true }); } catch {}
}

/* Anteprima: docBlob la scrive per prima nel file, quindi bastano i primi KB.
   La cache in IndexedDB evita di rileggere i file non cambiati */
const PREVIEW_RE = /"preview":"(data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+)"/;

export async function previewOf(entry) {
  const key = 'pv:' + (entry.trash ? 't:' : '') + entry.name;
  try {
    const c = await idbGet(key);
    if (c && c.lm === entry.lastModified && c.size === entry.size) return c.url;
  } catch {}
  let url = null;
  try { url = PREVIEW_RE.exec(await entry.file.slice(0, 160000).text())?.[1] || null; } catch {}
  idbPut(key, { lm: entry.lastModified, size: entry.size, url }).catch(() => {});
  return url;
}
