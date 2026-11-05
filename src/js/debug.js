// Registro eventi (tasto D): mostra cosa manda davvero il driver della penna.

/* Registro eventi (tasto D): per capire cosa manda davvero il driver della penna */
let debugEl = null;

const debugLines = [];

function debugLog(e) {
  if (!debugEl) return;
  const line = `${e.type} ${e.pointerType ?? ''} id=${e.pointerId ?? '-'} btn=${e.button} btns=${e.buttons}`;
  const last = debugLines[debugLines.length - 1];
  if (last && last.line === line) last.n++;
  else debugLines.push({ line, n: 1 });
  if (debugLines.length > 24) debugLines.shift();
  debugEl.textContent = debugLines.map(l => l.line + (l.n > 1 ? ` ×${l.n}` : '')).join('\n');
}

export function toggleDebug() {
  if (debugEl) { debugEl.remove(); debugEl = null; debugLines.length = 0; return; }
  debugEl = document.createElement('pre');
  debugEl.id = 'debug';
  debugEl.textContent = 'Premi il tasto destro e trascina';
  document.body.appendChild(debugEl);
}

export function initDebug() {
  for (const t of ['pointerdown', 'pointermove', 'pointerrawupdate', 'pointerup', 'pointercancel', 'lostpointercapture', 'mousedown', 'mousemove', 'mouseup', 'contextmenu'])
    window.addEventListener(t, debugLog, true);
}
