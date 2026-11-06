// Costanti, preferenze e stato condiviso. S contiene ogni variabile usata da più moduli.

export const S = {};

export const T = 512;  // lato di un tassello del foglio, in px CSS

export const DOT = 28;  // passo della griglia

export const INK = ['#16191d', '#1f5fd6', '#d62f2f', '#14853f', '#e8730c', '#7a3fc4'];

export const MARK = ['#ffe94d', '#a5f06a', '#ffa3d1', '#7fe3f5', '#ffc266'];

export const FONT = '"Familjen Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif';

const prefs = load('lavagna-prefs') || {};

export const tools = {
  pen: { c: INK[0], s: 3, min: 1, max: 24, step: .5 },
  hl:  { c: MARK[0], s: 24, min: 8, max: 64, step: 1 },
  er:  { s: 32, min: 8, max: 140, step: 1 },
  se:  { s: 1, min: 1, max: 1, step: 1 },
  tx:  { c: INK[0], s: 28, min: 12, max: 96, step: 1 },
};

for (const k in tools) if (prefs[k]) Object.assign(tools[k], { c: prefs[k].c || tools[k].c, s: prefs[k].s || tools[k].s });

S.tool = tools[prefs.tool] ? prefs.tool : 'pen';

S.lowLatency = prefs.lowLatency !== false;

S.showDots = prefs.dots !== false;  // griglia di puntini sullo sfondo

S.ops = [];  // tutto ciò che è sul foglio, in ordine

S.undoStack = [];

S.redoStack = [];

export const pan = { x: 0, y: 0 };

S.zoom = 1;  // 1 = 100%. Il foglio si legge come schermo = foglio * zoom + pan

S.dpr = window.devicePixelRatio || 1;

S.tileScale = Math.round(T * S.dpr) / T;

S.vw = 0;

S.vh = 0;

S.gest = null;  // gesto in corso

S.edit = null;  // testo in modifica

S.place = null;  // immagine incollata, non ancora fissata

S.penSeen = false;

S.spaceDown = false;

export const touches = new Map();

function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }

export function savePrefs() {
  try {
    const o = { tool: S.tool, lowLatency: S.lowLatency, dots: S.showDots };
    for (const k in tools) o[k] = { c: tools[k].c, s: tools[k].s };
    localStorage.setItem('lavagna-prefs', JSON.stringify(o));
  } catch {}
}

S.L = null;
S.backdrop = null;  // lo strato vecchio, visibile finché il nuovo non è pronto
S.inkCtx = null;
S.hlCtx = null;
S.sel = null;
S.clip = null;
S.cleanMode = false;
S.saveTimer = 0;
S.name = '';  // nome del foglio, usato per il file e il titolo della pagina
S.lastRedraw = null;  // ultimo ridisegno completo dello schermo: { ms, tiles }
