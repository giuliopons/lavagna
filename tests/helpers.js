import { expect } from '@playwright/test';

export const PAGE = '/lavagna-a-mano-libera.html';
export const FIXTURE = 'tests/fixtures/foglio-reale.json';

// Apre la lavagna senza le finestre di scelta del file, che in un test resterebbero aperte
export async function openBoard(page, url = PAGE) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined; });
  await page.goto(url);
  await page.waitForTimeout(200);
  return errors;
}

// Conta i pixel scuri come si vedono davvero sullo schermo
export async function ink(page, x, y, width, height) {
  const buf = await page.screenshot({ clip: { x, y, width, height } });
  return page.evaluate(async b64 => {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const img = await createImageBitmap(new Blob([u], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let k = 0; k < d.length; k += 4) if (d[k] < 90 && d[k + 1] < 90 && d[k + 2] < 90) n++;
    return n;
  }, buf.toString('base64'));
}

// Il colore di un pixel a schermo
export async function pixel(page, x, y) {
  const buf = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return page.evaluate(async b64 => {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const img = await createImageBitmap(new Blob([u], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, buf.toString('base64'));
}

export async function line(page, x0, y0, x1, y1) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(60);
}

export async function drag(page, button, x0, y0, x1, y1) {
  await page.mouse.move(x0, y0);
  await page.mouse.down({ button });
  await page.mouse.move(x1, y1, { steps: 5 });
  await page.mouse.up({ button });
  await page.waitForTimeout(80);
}

export async function setZoomSlider(page, value) {
  await page.evaluate(v => {
    const r = document.getElementById('zoomRange');
    r.value = v;
    r.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await page.waitForTimeout(350);
}

export async function pasteImage(page, w = 120, h = 80) {
  await page.evaluate(async ([w, h]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#1b3d2c';
    x.fillRect(0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'a.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, [w, h]);
  await page.waitForTimeout(150);
}

export const rect = (page, id) => page.evaluate(i => {
  const e = document.getElementById(i);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}, id);

export const noErrors = errors => expect(errors, 'errori nella pagina').toEqual([]);
