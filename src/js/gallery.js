// "I miei disegni": la galleria dei fogli salvati nella cartella, il cestino e la scelta della cartella
// nel pannello delle impostazioni.

import { ask } from './dialog.js';
import { $ } from './dom.js';
import { baseName, forgetFile, loadFile, openOther, saveToFolder } from './file.js';
import {
  chooseFolder, deleteForever, duplicateDrawing, emptyTrash, ensureFolder, folderSupported, forgetFolder,
  listDrawings, previewOf, readDrawing, renameDrawing, restoreDrawing, trashDrawing,
} from './folder.js';
import { clearBoard } from './history.js';
import { fileNameOf, setName } from './sheet-info.js';
import { S } from './state.js';
import { scheduleSave } from './storage.js';
import { toast } from './toast.js';

let showTrash = false;
let renderToken = 0;

const ICONS = {
  rename: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14 8l2 2"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l.9 12.5h9.2L17.5 7"/>',
  restore: '<path d="M8.5 5L4 9.5 8.5 14"/><path d="M4 9.5h10.5a5 5 0 0 1 0 10H9"/>',
};

const fmtDate = t => new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* Pannello delle impostazioni: voce "Cartella dei disegni" */
export function syncFolderUI() {
  const box = $('folderOpt');
  box.hidden = !folderSupported();
  $('folderNote').hidden = box.hidden;
  if (box.hidden) return;
  $('folderPick').textContent = S.folder ? 'Cambia…' : 'Scegli…';
  $('folderForget').hidden = !S.folder;
  $('folderNote').textContent = !S.folder
    ? 'Scegli una cartella del computer: Ctrl+S salva lì e Apri mostra tutti i disegni.'
    : `Cartella: ${S.folder.handle.name}.` + (S.folder.ok ? ' Ctrl+S salva lì, Apri mostra i disegni.' : ' Da riconnettere: il browser chiederà di nuovo il permesso.');
}

/* Prima di sostituire il foglio: se ci sono modifiche non salvate si chiede cosa fare */
async function confirmLeave() {
  if (!S.dirty || !S.ops.length) return true;
  const r = await ask({
    title: 'Il foglio ha modifiche non salvate',
    text: S.folderFile ? `Salvarle in "${baseName(S.folderFile)}" prima di continuare?` : 'Salvarlo nella cartella dei disegni prima di continuare?',
    buttons: [
      { id: 'cancel', label: 'Annulla' },
      { id: 'discard', label: 'Non salvare' },
      { id: 'save', label: 'Salva', primary: true },
    ],
  });
  if (r === 'save') return await saveToFolder() === 'saved';
  return r === 'discard';
}

export async function openGallery() {
  showTrash = false;
  S.gallery = true;
  $('gallery').hidden = false;
  $('galSearch').value = '';
  await render();
  $('galSearch').focus({ preventScroll: true });
}

export function closeGallery() {
  // il focus non deve restare nel campo di ricerca nascosto: le scorciatoie lo ignorerebbero
  if ($('gallery').contains(document.activeElement)) document.activeElement.blur();
  S.gallery = false;
  $('gallery').hidden = true;
  renderToken++;
}

function iconButton(act, title) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.act = act;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[act]}</svg>`;
  return b;
}

function card(entry) {
  const li = document.createElement('li');
  li.className = 'gal-card';
  if (!entry.trash && entry.name === S.folderFile) li.classList.add('current');
  li.dataset.name = entry.name;
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'gal-open';
  open.dataset.act = entry.trash ? 'restore' : 'open';
  open.title = entry.trash ? 'Ripristina' : 'Apri ' + baseName(entry.name);
  const thumb = document.createElement('span');
  thumb.className = 'gal-thumb';
  const name = document.createElement('span');
  name.className = 'gal-name';
  name.textContent = baseName(entry.name);
  const date = document.createElement('span');
  date.className = 'gal-date';
  date.textContent = fmtDate(entry.lastModified);
  open.append(thumb, name, date);
  const acts = document.createElement('div');
  acts.className = 'gal-actions';
  if (entry.trash) acts.append(iconButton('restore', 'Ripristina'), iconButton('trash', 'Elimina per sempre'));
  else acts.append(iconButton('rename', 'Rinomina'), iconButton('duplicate', 'Duplica'), iconButton('trash', 'Sposta nel cestino'));
  li.append(open, acts);
  return { li, thumb };
}

async function render() {
  const token = ++renderToken;
  const body = $('galBody');
  $('galTitle').textContent = showTrash ? 'Cestino' : 'I miei disegni';
  $('galFolder').textContent = S.folder ? S.folder.handle.name : '';
  $('galTrash').textContent = showTrash ? 'Torna ai disegni' : 'Cestino';
  $('galEmptyTrash').hidden = !showTrash;
  $('galSearch').hidden = $('galOther').hidden = showTrash;

  if (!S.folder?.ok) {
    body.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'gal-msg';
    msg.innerHTML = '<p>Il browser chiede di nuovo il permesso per la cartella dei disegni.</p>';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary';
    b.textContent = 'Riconnetti la cartella';
    b.addEventListener('click', async () => {
      if (await ensureFolder()) { syncFolderUI(); render(); }
      else toast('Senza permesso la galleria non può leggere la cartella.');
    });
    msg.appendChild(b);
    body.appendChild(msg);
    return;
  }

  let list;
  try { list = await listDrawings(showTrash); }
  catch {
    if (token !== renderToken) return;
    body.innerHTML = '<div class="gal-msg"><p>Non riesco a leggere la cartella. Forse è stata spostata o cancellata: scegline un\'altra dal pannello delle impostazioni.</p></div>';
    return;
  }
  if (token !== renderToken) return;
  const q = $('galSearch').value.trim().toLowerCase();
  if (q) list = list.filter(e => e.name.toLowerCase().includes(q));
  $('galEmptyTrash').disabled = !list.length;

  const grid = document.createElement('ul');
  grid.className = 'gal-grid';
  if (!showTrash && !q) {
    const li = document.createElement('li');
    li.className = 'gal-card gal-new';
    li.innerHTML = '<button type="button" class="gal-open" data-act="new"><span class="gal-thumb"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span class="gal-name">Nuovo foglio</span><span class="gal-date">&nbsp;</span></button>';
    grid.appendChild(li);
  }
  const thumbs = [];
  for (const e of list) {
    const { li, thumb } = card(e);
    grid.appendChild(li);
    thumbs.push([e, thumb]);
  }
  body.innerHTML = '';
  body.appendChild(grid);
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'gal-empty';
    p.textContent = showTrash ? 'Il cestino è vuoto.' : q ? 'Nessun disegno con questo nome.' : 'La cartella non contiene ancora disegni: Ctrl+S salva qui il foglio.';
    body.appendChild(p);
  }
  // anteprime una alla volta, senza bloccare la schermata
  for (const [e, thumb] of thumbs) {
    const url = await previewOf(e);
    if (token !== renderToken) return;
    if (url) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = url;
      thumb.appendChild(img);
    } else thumb.classList.add('none');
  }
}

async function act(action, name) {
  try {
    if (action === 'open') {
      if (!await confirmLeave()) return;
      if (await loadFile(await readDrawing(name), true)) { forgetFileHandle(); closeGallery(); }
    } else if (action === 'new') {
      if (!await confirmLeave()) return;
      if (S.ops.length) clearBoard();
      else setName('');
      forgetFile();
      S.dirty = false;
      scheduleSave();
      closeGallery();
    } else if (action === 'rename') {
      const r = await ask({
        title: 'Rinomina il disegno', input: baseName(name),
        buttons: [{ id: 'cancel', label: 'Annulla' }, { id: 'ok', label: 'Rinomina', primary: true }],
      });
      if (r?.id !== 'ok' || !r.value.trim()) return;
      const n = fileNameOf(r.value.trim());
      if (n === name) return;
      try { await renameDrawing(name, n); }
      catch { toast(`Esiste già un disegno chiamato "${baseName(n)}".`); return; }
      if (S.folderFile === name) { S.folderFile = n; setName(baseName(n)); scheduleSave(); }
      render();
    } else if (action === 'duplicate') {
      const n = await duplicateDrawing(name);
      toast(`Creato "${baseName(n)}".`);
      render();
    } else if (action === 'trash' && !showTrash) {
      await trashDrawing(name);
      if (S.folderFile === name) { S.folderFile = null; S.dirty = true; scheduleSave(); }
      toast(`"${baseName(name)}" spostato nel cestino.`);
      render();
    } else if (action === 'restore') {
      const n = await restoreDrawing(name);
      toast(`"${baseName(n)}" ripristinato.`);
      render();
    } else if (action === 'trash' && showTrash) {
      const r = await ask({
        title: 'Eliminare per sempre?', text: `"${baseName(name)}" verrà cancellato dal computer. Non si può annullare.`,
        buttons: [{ id: 'cancel', label: 'Annulla', primary: true }, { id: 'del', label: 'Elimina per sempre' }],
      });
      if (r !== 'del') return;
      await deleteForever(name);
      render();
    }
  } catch {
    toast('Operazione non riuscita: la cartella forse è cambiata. Riprova.');
    render();
  }
}

// aprendo dalla galleria, la finestra "salva con nome" non deve riusare un file scelto prima
function forgetFileHandle() { const f = S.folderFile; forgetFile(); S.folderFile = f; }

export function initGallery() {
  $('gallery').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    act(b.dataset.act, b.closest('.gal-card')?.dataset.name);
  });
  $('galClose').addEventListener('click', closeGallery);
  $('galSearch').addEventListener('input', () => render());
  $('galOther').addEventListener('click', async () => {
    if (!await confirmLeave()) return;
    closeGallery();
    openOther();
  });
  $('galTrash').addEventListener('click', () => { showTrash = !showTrash; render(); });
  $('galEmptyTrash').addEventListener('click', async () => {
    const r = await ask({
      title: 'Svuotare il cestino?', text: 'I disegni nel cestino verranno cancellati dal computer. Non si può annullare.',
      buttons: [{ id: 'cancel', label: 'Annulla', primary: true }, { id: 'empty', label: 'Svuota il cestino' }],
    });
    if (r !== 'empty') return;
    await emptyTrash();
    render();
  });
  window.addEventListener('keydown', e => {
    if (S.gallery && !S.modal && e.key === 'Escape') { e.preventDefault(); closeGallery(); }
  });

  // pannello delle impostazioni
  $('folderPick').addEventListener('click', async () => {
    try {
      await chooseFolder();
      syncFolderUI();
      toast(`Cartella dei disegni: ${S.folder.handle.name}. Ctrl+S salva lì.`);
    } catch (err) {
      if (err?.name !== 'AbortError') toast('Non riesco ad aprire questa cartella.');
    }
  });
  $('folderForget').addEventListener('click', async () => {
    await forgetFolder();
    syncFolderUI();
    toast('Cartella scollegata. I file restano sul computer.');
  });
}
