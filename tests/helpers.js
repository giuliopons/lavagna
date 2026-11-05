import { expect } from '@playwright/test';
import { deflateSync } from 'node:zlib';

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

// Un PDF piccolo come quelli della lavagna Microsoft: forma riempita con una curva, linea trasparente,
// immagine compressa e testo con ToUnicode. Il rettangolo nero è centrato sul contenuto.
export function samplePdf() {
  const img = deflateSync(Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]));
  const content = [
    'q 0 0 0 rg 100 100 m 300 100 l 300 200 l 250 180 150 180 100 200 c h f Q',
    'q /GS1 gs 1 0 0 RG 4 w 120 160 m 280 160 l S Q',
    'q 30 0 0 30 112 102 cm /Im1 Do Q',
    'BT /F1 18 Tf 1 1 1 rg 200 110 Td (Ciao) Tj ET',
  ].join('\n');
  const cmap = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n1 begincodespacerange <20> <7E> endcodespacerange\n1 beginbfrange <20> <7E> <0020> endbfrange\nendcmap end end';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Contents 4 0 R /Resources << /ExtGState << /GS1 << /CA .5 >> >> /XObject << /Im1 5 0 R >> /Font << /F1 7 0 R >> >> >>',
    [`<< /Length ${content.length} >>`, Buffer.from(content)],
    [`<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.length} >>`, img],
    [`<< /Length ${cmap.length} >>`, Buffer.from(cmap)],
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 32 /LastChar 126 /Widths [${Array(95).fill(600).join(' ')}] /ToUnicode 6 0 R >>`,
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [];
  let len = parts[0].length;
  objs.forEach((o, i) => {
    offsets.push(len);
    const b = Array.isArray(o)
      ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n${o[0]}\nstream\n`), o[1], Buffer.from('\nendstream\nendobj\n')])
      : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`);
    parts.push(b);
    len += b.length;
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${len}\n%%EOF\n`;
  parts.push(Buffer.from(xref));
  return Buffer.concat(parts);
}

export async function pngBuffer(page, w = 60, h = 40) {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#1b3d2c';
    x.fillRect(0, 0, w, h);
    return c.toDataURL('image/png').split(',')[1];
  }, [w, h]);
  return Buffer.from(b64, 'base64');
}
