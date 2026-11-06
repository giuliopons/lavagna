// Finestra di domanda: un testo, qualche pulsante e, se serve, un campo di testo.

import { S } from './state.js';

/* ask({ title, text, input, buttons: [{ id, label, primary }] }) → Promise con l'id scelto, oppure null
   se si chiude con Esc o fuori. Con input restituisce { id, value } */
export function ask({ title, text = '', input = null, buttons }) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'ask-back';
    const box = document.createElement('div');
    box.className = 'ask';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', title);
    const h = document.createElement('h2');
    h.textContent = title;
    box.appendChild(h);
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      box.appendChild(p);
    }
    let field = null;
    if (input !== null) {
      field = document.createElement('input');
      field.type = 'text';
      field.value = input;
      field.spellcheck = false;
      field.autocomplete = 'off';
      box.appendChild(field);
    }
    const row = document.createElement('div');
    row.className = 'ask-buttons';
    let primary = null;
    for (const b of buttons) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.label;
      el.dataset.id = b.id;
      if (b.primary) { el.className = 'primary'; primary = el; }
      row.appendChild(el);
    }
    box.appendChild(row);
    back.appendChild(box);
    document.body.appendChild(back);
    S.modal = true;

    const done = id => {
      back.remove();
      S.modal = false;
      document.removeEventListener('keydown', onKey, true);
      resolve(field && id ? { id, value: field.value } : id);
    };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); }
      else if (e.key === 'Enter' && primary && (e.target === field || e.target === document.body || e.target === back)) {
        e.preventDefault(); e.stopPropagation(); done(primary.dataset.id);
      } else e.stopPropagation();
    };
    document.addEventListener('keydown', onKey, true);
    row.addEventListener('click', e => { const b = e.target.closest('button'); if (b) done(b.dataset.id); });
    back.addEventListener('pointerdown', e => { if (e.target === back) done(null); });
    if (field) { field.focus(); field.select(); } else (primary || row.firstChild).focus();
  });
}
