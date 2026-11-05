// Messaggi brevi a schermo.

import { $ } from './dom.js';

let toastTimer = 0;

export function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
