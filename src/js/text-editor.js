// Editor di testo sul foglio e trascinamento dei testi.

import { board, hint, world } from './dom.js';
import { afterChange, record, updateHint } from './history.js';
import { toWorld } from './input.js';
import { forTiles, paint, refresh } from './layers.js';
import { shiftOp } from './objects.js';
import { S, tools } from './state.js';
import { scheduleSave } from './storage.js';
import { lineH, textBB, textWidth } from './text-render.js';
import { syncButtons, syncTool } from './tray.js';

function textAt(x, y) {
  for (let i = S.ops.length - 1; i >= 0; i--) {
    const op = S.ops[i];
    if (op.k === 'tx' && !op.hidden && x >= op.bb[0] && x <= op.bb[2] && y >= op.bb[1] && y <= op.bb[3]) return op;
  }
  return null;
}

export function hoverText(e) {
  if (S.tool !== 'tx' || S.edit) { board.classList.remove('moving'); return; }
  const [x, y] = toWorld(e);
  board.classList.toggle('moving', !!textAt(x, y));
}

function startGrip(e) {
  try { board.setPointerCapture(e.pointerId); } catch {}
  S.gest = { type: 'grip', id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: S.edit.x, oy: S.edit.y };
}

export function gripDrag(e) {
  if (!S.edit || S.gest.id !== e.pointerId) return;
  S.edit.x = S.gest.ox + (e.clientX - S.gest.sx) / S.zoom;
  S.edit.y = S.gest.oy + (e.clientY - S.gest.sy) / S.zoom;
  S.edit.el.style.left = S.edit.x + 'px';
  S.edit.el.style.top = S.edit.y + 'px';
  styleGrip();
}

export function styleGrip() {
  S.edit.grip.style.left = S.edit.x - 5 / S.zoom + 'px';
  S.edit.grip.style.top = S.edit.y - 24 / S.zoom + 'px';
}

/* Testo già sul foglio: premere e trascinare lo sposta, un clic fermo lo apre per modificarlo */
export function textDrag(e) {
  const g = S.gest;
  if (g.id !== e.pointerId) return;
  const dx = (e.clientX - g.sx) / S.zoom, dy = (e.clientY - g.sy) / S.zoom;
  if (!g.ghost) {
    if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 4) return;
    const op = g.op;
    op.hidden = true;
    refresh(op.bb);
    const d = document.createElement('div');
    d.id = 'textGhost';
    d.textContent = op.t;
    d.style.color = op.c;
    d.style.fontSize = op.s + 'px';
    d.style.lineHeight = lineH(op.s) + 'px';
    world.appendChild(d);
    g.ghost = d;
  }
  g.x = g.op.x + dx;
  g.y = g.op.y + dy;
  g.ghost.style.left = g.x + 'px';
  g.ghost.style.top = g.y + 'px';
}

export function textRelease(cancelled) {
  const { op, ghost, x, y } = S.gest;
  S.gest = null;
  if (!ghost) {
    if (cancelled) return;
    op.hidden = true;
    refresh(op.bb);
    tools.tx.c = op.c; tools.tx.s = op.s;
    syncTool();
    openEditor(op.x, op.y, op.t, op);
    return;
  }
  ghost.remove();
  op.hidden = false;
  const b = shiftOp(op, x - op.x, y - op.y);
  const i = S.ops.indexOf(op);
  S.ops.splice(i, 1);
  S.ops.push(b);                           // il testo spostato va in cima
  record({ t: 'mov', i, a: op, b });
  refresh(op.bb);
  refresh(b.bb);
  afterChange();
}

export function textClick(e) {
  if (S.edit) {
    if (e.button === 0 && e.target.id === 'editGrip') startGrip(e);
    else commitEdit();
    return;
  }
  const [x, y] = toWorld(e);
  const hit = textAt(x, y);
  if (hit) {
    try { board.setPointerCapture(e.pointerId); } catch {}
    S.gest = { type: 'txpress', id: e.pointerId, op: hit, sx: e.clientX, sy: e.clientY, ghost: null };
    return;
  }
  const s = tools.tx.s;
  openEditor(x, y - lineH(s) / 2, '', null);
}

function openEditor(x, y, text, source) {
  const el = document.createElement('textarea');
  el.id = 'editor';
  el.spellcheck = false;
  el.wrap = 'off';
  el.value = text;
  el.setAttribute('aria-label', 'Testo sul foglio');
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  world.appendChild(el);
  const grip = document.createElement('div');
  grip.id = 'editGrip';
  grip.title = 'Trascina per spostare il testo';
  world.appendChild(grip);
  S.edit = { el, grip, x, y, source };
  styleGrip();
  board.classList.remove('moving');
  hint.hidden = true;
  styleEditor();
  el.addEventListener('input', sizeEditor);
  el.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); commitEdit(); }
  });
  el.focus({ preventScroll: true });
  el.setSelectionRange(text.length, text.length);
}

export function styleEditor() {
  if (!S.edit) return;
  const { c, s } = tools.tx;
  const st = S.edit.el.style;
  st.color = c; st.caretColor = c;
  st.fontSize = s + 'px';
  st.lineHeight = lineH(s) + 'px';
  sizeEditor();
}

function sizeEditor() {
  if (!S.edit) return;
  const s = tools.tx.s, el = S.edit.el;
  el.style.width = Math.ceil(textWidth(el.value, s) + s) + 'px';
  el.style.height = Math.ceil(el.value.split('\n').length * lineH(s)) + 'px';
}

export function commitEdit() {
  if (!S.edit) return;
  const { el, grip, x, y, source } = S.edit;
  grip.remove();
  const text = el.value.replace(/\s+$/, '');
  const { c, s } = tools.tx;
  el.remove();
  S.edit = null;
  if (source) {
    source.hidden = false;
    const i = S.ops.indexOf(source);
    if (!text) {
      S.ops.splice(i, 1);
      record({ t: 'del', op: source, i });
      refresh(source.bb);
    } else if (text === source.t && c === source.c && s === source.s && x === source.x && y === source.y) {
      refresh(source.bb);
    } else {
      const op = { k: 'tx', x, y, c, s, t: text };
      op.bb = textBB(op);
      if (source.masks) op.masks = shiftOp(source, x - source.x, y - source.y).masks;
      S.ops[i] = op;
      record({ t: 'rep', i, a: source, b: op });
      refresh(source.bb);
      refresh(op.bb);
    }
  } else if (text) {
    const op = { k: 'tx', x, y, c, s, t: text };
    op.bb = textBB(op);
    S.ops.push(op);
    record({ t: 'add', op });
    forTiles(op.bb, true, t => paint(t, op));
  }
  updateHint();
  scheduleSave();
  syncButtons();
}
