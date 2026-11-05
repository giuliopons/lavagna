// Pannello del foglio: nome del file e statistiche sul contenuto.

import { $, board } from './dom.js';
import { plainOp } from './file.js';
import { S } from './state.js';
import { scheduleSave } from './storage.js';

const APP_TITLE = 'Lavagna a mano libera';

const KINDS = [['pen', 'Tratti di penna'], ['hl', 'Evidenziature'], ['tx', 'Testi'], ['im', 'Immagini'], ['sh', 'Forme importate']];

let updateTimer = 0;

const z2 = n => String(n).padStart(2, '0');

export function defaultName(d = new Date()) {
  return `Disegno ${z2(d.getDate())}/${z2(d.getMonth() + 1)}/${d.getFullYear()} ${z2(d.getHours())}:${z2(d.getMinutes())}`;
}

// Un nome vuoto diventa "Disegno" con data e ora di adesso
export function setName(n) {
  S.name = String(n ?? '').trim() || defaultName();
  $('sheetName').value = S.name;
  document.title = S.name + ' – ' + APP_TITLE;
}

// Il nome come file: Windows non accetta / e : nei nomi
export function fileName() {
  const base = S.name.replace(/:/g, '.').replace(/[\\/*?"<>|]+/g, '-').replace(/[. ]+$/, '');
  return (base || 'Disegno') + '.json';
}

export const isPanelOpen = () => !$('panel').hidden;

export function togglePanel(on = !isPanelOpen()) {
  $('panel').hidden = !on;
  $('info').setAttribute('aria-pressed', on);
  if (on) updatePanel();
}

export function updatePanelSoon() {
  if (!isPanelOpen()) return;
  clearTimeout(updateTimer);
  updateTimer = setTimeout(updatePanel, 250);
}

/* Statistiche */
const fmtN = n => Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' });

// Unità decimali: 1 MB = 1.000.000 byte
function fmtBytes(b) {
  if (b < 10000) return fmtN(b / 1000) + ' KB';
  return (b / 1e6).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MB';
}

// Peso di un oggetto nel file salvato, come lo scrive docBlob
function weight(o) {
  let n = JSON.stringify(plainOp(o)).length + 1;
  if (o.k === 'im') n += ',"data":"data:;base64,"'.length + (o.blob?.type.length || 0) + 4 * Math.ceil((o.blob?.size || 0) / 3);
  return n;
}

export function computeStats() {
  const rows = Object.fromEntries(KINDS.map(([k]) => [k, { n: 0, bytes: 0 }]));
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  const masks = new Set();
  let points = 0;
  for (const o of S.ops) {
    const r = rows[o.k];
    if (!r) continue;
    r.n++;
    r.bytes += weight(o);
    if (o.p) points += o.p.length / 3;
    if (o.masks) for (const m of o.masks) masks.add(m);
    bb[0] = Math.min(bb[0], o.bb[0]); bb[1] = Math.min(bb[1], o.bb[1]);
    bb[2] = Math.max(bb[2], o.bb[2]); bb[3] = Math.max(bb[3], o.bb[3]);
  }
  const n = KINDS.reduce((s, [k]) => s + rows[k].n, 0);
  const bytes = KINDS.reduce((s, [k]) => s + rows[k].bytes, 0) + 120;
  return {
    rows, n, bytes, points, erasers: masks.size,
    width: n ? bb[2] - bb[0] : 0, height: n ? bb[3] - bb[1] : 0,
  };
}

function cell(tag, text, cls) {
  const e = document.createElement(tag);
  e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

export function updatePanel() {
  clearTimeout(updateTimer);
  const st = computeStats();
  const body = $('statsBody');
  body.textContent = '';
  const pct = b => { const p = b / st.bytes * 100; return p < 1 ? '<1%' : Math.round(p) + '%'; };
  for (const [k, label] of KINDS) {
    const r = st.rows[k];
    const tr = document.createElement('tr');
    tr.append(cell('th', label), cell('td', fmtN(r.n), 'num'), cell('td', r.n ? fmtBytes(r.bytes) : '–', 'num'), cell('td', r.n ? pct(r.bytes) : '', 'num pct'));
    body.appendChild(tr);
  }
  $('statsTotN').textContent = fmtN(st.n);
  $('statsTotB').textContent = fmtBytes(st.bytes);
  const facts = [
    ['Punti nei tratti', fmtN(st.points)],
    ['Passate di gomma', fmtN(st.erasers)],
    ['Area usata', st.n ? `${fmtN(st.width)} × ${fmtN(st.height)} px` : '–'],
    ['Ultimo ridisegno dello schermo', S.lastRedraw ? `${fmtN(S.lastRedraw.ms)} ms, ${fmtN(S.lastRedraw.tiles)} tasselli` : '–'],
  ];
  const dl = $('statsFacts');
  dl.textContent = '';
  for (const [k, v] of facts) {
    const row = document.createElement('div');
    row.append(cell('dt', k), cell('dd', v));
    dl.appendChild(row);
  }
}

export function initSheetInfo() {
  const inp = $('sheetName');
  inp.addEventListener('input', () => {
    const v = inp.value.trim();
    if (!v) return;
    S.name = v;
    document.title = v + ' – ' + APP_TITLE;
    scheduleSave();
  });
  inp.addEventListener('change', () => { setName(inp.value); scheduleSave(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); inp.blur(); }
  });
  // tornando a disegnare il campo lascia la tastiera alle scorciatoie
  board.addEventListener('pointerdown', () => { if (document.activeElement === inp) inp.blur(); }, true);
  $('info').addEventListener('click', () => togglePanel());
  $('panelClose').addEventListener('click', () => togglePanel(false));
}
