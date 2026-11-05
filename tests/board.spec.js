import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { FIXTURE, drag, ink, line, noErrors, openBoard, pasteImage, pixel, pngBuffer, rect, samplePdf, setZoomSlider } from './helpers.js';

test('penna, evidenziatore in multiply e gomma', async ({ page }) => {
  const errors = await openBoard(page);
  await expect(page.locator('#hint')).toBeVisible();
  await line(page, 200, 200, 600, 200);
  await expect(page.locator('#hint')).toBeHidden();
  expect(await ink(page, 200, 190, 400, 20)).toBeGreaterThan(300);

  await page.keyboard.press('e');
  await line(page, 200, 200, 600, 200);
  expect(await ink(page, 200, 190, 400, 20)).toBeGreaterThan(300); // l'inchiostro resta visibile sotto
  const [r, g, b] = await pixel(page, 400, 210);                   // carta evidenziata: gialla
  expect(r).toBeGreaterThan(220);
  expect(g).toBeGreaterThan(200);
  expect(b).toBeLessThan(140);

  await page.keyboard.press('g');
  await line(page, 400, 160, 400, 240);
  expect(await ink(page, 390, 190, 20, 20)).toBe(0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(60);
  expect(await ink(page, 390, 190, 20, 20)).toBeGreaterThan(0);
  noErrors(errors);
});

test('il tasto destro sposta il foglio e mostra la mano', async ({ page }) => {
  const errors = await openBoard(page);
  await line(page, 200, 200, 400, 200);
  await page.mouse.move(600, 400);
  await page.mouse.down({ button: 'right' });
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('board')).cursor)).toBe('grabbing');
  await page.mouse.move(700, 500, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('board')).cursor)).not.toBe('grabbing');
  expect(await ink(page, 300, 290, 200, 20)).toBeGreaterThan(100);
  expect(await ink(page, 200, 190, 200, 20)).toBe(0);
  noErrors(errors);
});

test('la rotella non fa nulla, lo slider fa lo zoom', async ({ page }) => {
  const errors = await openBoard(page);
  await line(page, 600, 380, 680, 380);
  const before = await page.evaluate(() => document.getElementById('world').style.transform);
  await page.mouse.move(640, 380);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(300);
  await expect(page.locator('#zoomVal')).toHaveText('100%');
  expect(await page.evaluate(() => document.getElementById('world').style.transform)).toBe(before);

  await setZoomSlider(page, 1);
  await expect(page.locator('#zoomVal')).toHaveText('200%');
  // a zoom fermo i tasselli sono ridisegnati: nessun ingrandimento residuo
  expect(await page.evaluate(() => document.querySelector('.layer:last-child').style.transform)).toContain('scale(1)');
  // un tratto da ingrandito finisce sotto il puntatore
  await line(page, 300, 150, 500, 150);
  await page.waitForTimeout(300);
  expect(await ink(page, 300, 140, 200, 20)).toBeGreaterThan(300);
  expect(await ink(page, 300, 200, 200, 20)).toBe(0);

  await page.click('#zoomVal');
  await page.waitForTimeout(300);
  await expect(page.locator('#zoomVal')).toHaveText('100%');
  await page.keyboard.press('Control+=');
  await page.waitForTimeout(300);
  await expect(page.locator('#zoomVal')).toHaveText('125%');
  noErrors(errors);
});

test('testo: scrivere, trascinare, modificare, linguetta', async ({ page }) => {
  const errors = await openBoard(page);
  await page.keyboard.press('t');
  await page.mouse.click(200, 200);
  await page.keyboard.type('Muovimi');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(50);
  expect(await ink(page, 180, 170, 200, 60)).toBeGreaterThan(100);

  await page.mouse.move(230, 200);
  await page.waitForTimeout(30);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('board')).cursor)).toBe('move');
  await page.mouse.down();
  await page.mouse.move(530, 420, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(50);
  expect(await ink(page, 180, 170, 200, 60)).toBe(0);
  expect(await ink(page, 480, 390, 200, 60)).toBeGreaterThan(100);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(50);
  expect(await ink(page, 180, 170, 200, 60)).toBeGreaterThan(100);
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(50);

  await page.mouse.click(530, 420);
  await expect(page.locator('#editor')).toHaveValue('Muovimi');
  const grip = await rect(page, 'editGrip');
  await drag(page, 'left', grip.x + 8, grip.y + 8, grip.x + 208, grip.y - 142);
  await page.keyboard.type(' ora');
  await expect(page.locator('#editor')).toHaveValue('Muovimi ora');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(50);
  expect(await ink(page, 680, 240, 260, 60)).toBeGreaterThan(100);
  noErrors(errors);
});

test('immagine: incollare, spostare, ridimensionare, Canc', async ({ page }) => {
  const errors = await openBoard(page);
  await pasteImage(page, 400, 240);
  const a = await rect(page, 'placing');
  expect(a.w).toBe(400);
  await drag(page, 'left', a.x + 50, a.y + 50, a.x - 50, a.y - 20);
  const b = await rect(page, 'placing');
  expect(b.x).toBe(a.x - 100);
  await drag(page, 'left', b.x + b.w + 3, b.y + b.h + 3, b.x + b.w + 153, b.y + b.h + 3);
  const c = await rect(page, 'placing');
  expect(c.w).toBe(550);
  expect(c.h).toBe(330);
  await page.keyboard.press('Delete');
  await expect(page.locator('#placing')).toHaveCount(0);

  await pasteImage(page, 200, 120);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
  expect(await ink(page, 560, 340, 160, 80)).toBeGreaterThan(5000);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(60);
  expect(await ink(page, 560, 340, 160, 80)).toBe(0);
  noErrors(errors);
});

test('selezione: il gruppo si sposta con la gomma, Canc elimina', async ({ page }) => {
  const errors = await openBoard(page);
  await line(page, 100, 150, 400, 150);
  await page.keyboard.press('g');
  await line(page, 250, 130, 250, 170);
  await page.keyboard.press('t');
  await page.mouse.click(120, 220);
  await page.keyboard.type('Gruppo');
  await page.keyboard.press('Control+Enter');
  await page.keyboard.press('p');
  await line(page, 800, 150, 1100, 150);

  await page.keyboard.press('v');
  await line(page, 70, 100, 500, 280);
  const box = await rect(page, 'selBox');
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 200, { steps: 4 });
  await expect(page.locator('#selFloat')).toHaveCount(1);
  await page.mouse.move(box.x + 20, box.y + 320, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  await expect(page.locator('#selFloat')).toHaveCount(0);
  expect(await ink(page, 100, 140, 120, 20)).toBe(0);
  expect(await ink(page, 100, 440, 120, 20)).toBeGreaterThan(100);
  expect(await ink(page, 245, 440, 10, 20)).toBe(0);               // il buco si sposta col tratto
  expect(await ink(page, 800, 140, 300, 20)).toBeGreaterThan(300); // l'altro tratto resta dov'era

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(60);
  expect(await ink(page, 100, 140, 120, 20)).toBeGreaterThan(100);

  await page.mouse.click(950, 150);
  await page.waitForTimeout(30);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(40);
  expect(await ink(page, 800, 140, 300, 20)).toBe(0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(40);
  expect(await ink(page, 800, 140, 300, 20)).toBeGreaterThan(300);
  noErrors(errors);
});

test('selezione: la maniglia ingrandisce e rimpicciolisce, Annulla torna indietro', async ({ page }) => {
  const errors = await openBoard(page);
  await line(page, 100, 150, 300, 150);
  await page.keyboard.press('g');
  await line(page, 200, 130, 200, 170);
  await page.keyboard.press('t');
  await page.mouse.click(120, 260);
  await page.keyboard.type('Scala');
  await page.keyboard.press('Control+Enter');

  await page.keyboard.press('v');
  await line(page, 70, 100, 400, 330);
  const box = await rect(page, 'selBox');
  const hd = await rect(page, 'selHandle');
  expect(hd).not.toBeNull();
  // trascinando la maniglia di una larghezza intera la selezione raddoppia
  const cx = hd.x + hd.w / 2, cy = hd.y + hd.h / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.w, cy + box.h, { steps: 6 });
  await expect(page.locator('#selFloat')).toHaveCount(1);
  await page.mouse.up();
  await page.waitForTimeout(80);
  await expect(page.locator('#selFloat')).toHaveCount(0);
  const big = await rect(page, 'selBox');
  expect(big.x).toBeCloseTo(box.x, 0);
  expect(big.w / box.w).toBeGreaterThan(1.9);
  expect(big.w / box.w).toBeLessThan(2.1);
  // il tratto si allunga, il buco della gomma resta al suo posto relativo
  const ox = box.x, oy = box.y, at = (x, y) => [ox + (x - ox) * 2, oy + (y - oy) * 2];
  const [x1, y1] = at(260, 150);
  expect(await ink(page, x1 - 10, y1 - 8, 20, 16)).toBeGreaterThan(60);
  const [xh, yh] = at(200, 150);
  expect(await ink(page, xh - 3, yh - 6, 6, 12)).toBe(0);

  // la maniglia rimpicciolisce
  const h2 = await rect(page, 'selHandle');
  await page.mouse.move(h2.x + h2.w / 2, h2.y + h2.h / 2);
  await page.mouse.down();
  await page.mouse.move(h2.x + h2.w / 2 - big.w * .75, h2.y + h2.h / 2 - big.h * .75, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  const small = await rect(page, 'selBox');
  expect(small.w / big.w).toBeLessThan(.3);

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(80);
  await page.keyboard.press('Escape');
  expect(await ink(page, 220, 140, 70, 20)).toBeGreaterThan(100);
  expect(await ink(page, x1 - 10, y1 - 8, 20, 16)).toBe(0);
  noErrors(errors);
});

test('selezione: l\'anello attorno alla maniglia ruota, anche i testi', async ({ page }, info) => {
  const errors = await openBoard(page);
  await line(page, 300, 300, 500, 300);
  await page.keyboard.press('t');
  await page.mouse.click(330, 340);
  await page.keyboard.type('Ruota');
  await page.keyboard.press('Control+Enter');
  await page.keyboard.press('v');
  await line(page, 270, 270, 560, 390);
  const box = await rect(page, 'selBox');
  expect(await page.locator('#selRotate').evaluate(e => getComputedStyle(e).cursor)).toContain('url(');

  // la freccia del cursore dipende dal lato: a destra del tondo sale, sotto scende
  const hd = await rect(page, 'selHandle');
  const ring = page.locator('#selRotate');
  await page.mouse.move(hd.x + hd.w / 2, hd.y + hd.h / 2 + 17);
  await expect(ring).toHaveClass(/below/);
  await page.mouse.move(hd.x + hd.w / 2 + 17, hd.y + hd.h / 2);
  await expect(ring).not.toHaveClass(/below/);

  // si preme sull'anello, fuori dal tondo, e si gira di 90° in senso orario attorno al centro
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const px = hd.x + hd.w / 2 + 17, py = hd.y + hd.h / 2;
  const vx = px - cx, vy = py - cy;
  await page.mouse.move(px, py);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const a = Math.PI / 2 * i / 12, c = Math.cos(a), s = Math.sin(a);
    await page.mouse.move(cx + vx * c - vy * s, cy + vx * s + vy * c);
  }
  await expect(page.locator('#selFloat')).toHaveCount(1);
  await expect(page.locator('#board')).toHaveClass(/rotating/);
  await page.mouse.up();
  await page.waitForTimeout(80);
  await expect(page.locator('#selFloat')).toHaveCount(0);
  await expect(page.locator('#board')).not.toHaveClass(/rotating/);

  // la linea orizzontale ora è verticale, con lo stesso centro
  const lx = cx - (300 - cy), ly0 = cy + (300 - cx), ly1 = cy + (500 - cx);
  expect(await ink(page, lx - 6, Math.min(ly0, ly1) + 20, 12, Math.abs(ly1 - ly0) - 40)).toBeGreaterThan(200);
  expect(await ink(page, 440, 294, 50, 12)).toBe(0);
  const turned = await rect(page, 'selBox');
  expect(Math.abs(turned.w - box.h)).toBeLessThan(12);
  expect(Math.abs(turned.h - box.w)).toBeLessThan(12);

  // il testo conserva l'angolo nel file salvato
  await page.keyboard.press('Escape');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
  const file = info.outputPath('ruotato.json');
  await download.saveAs(file);
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  expect(doc.version).toBe(2);
  const tx = doc.ops.find(o => o.k === 'tx');
  expect(tx.r).toBeCloseTo(Math.PI / 2, 1);

  // un clic sul testo ruotato lo seleziona: il riquadro è più alto che largo
  const rot = (x, y) => [cx - (y - cy), cy + (x - cx)];
  const [qx, qy] = rot(350, 340);
  await page.mouse.click(qx, qy);
  await page.waitForTimeout(40);
  const sel = await rect(page, 'selBox');
  expect(sel).not.toBeNull();
  expect(sel.h).toBeGreaterThan(sel.w);

  // Annulla raddrizza tutto
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(80);
  expect(await ink(page, 440, 294, 50, 12)).toBeGreaterThan(60);
  noErrors(errors);
});

test('selezione: porta davanti e manda dietro, con pulsanti e PagSu/PagGiù', async ({ page }) => {
  const errors = await openBoard(page);
  await page.locator('#colors .swatch').nth(2).click();          // rosso
  await line(page, 400, 150, 400, 350);
  await page.locator('#colors .swatch').nth(0).click();          // nero, disegnato sopra
  await line(page, 250, 250, 550, 250);
  const top = async () => { const [r, g] = await pixel(page, 400, 250); return r > 150 && g < 100 ? 'rosso' : r < 90 ? 'nero' : 'altro'; };
  expect(await top()).toBe('nero');

  await page.keyboard.press('v');
  await page.mouse.click(300, 250);                              // seleziona la linea nera
  await expect(page.locator('#selOrder button')).toHaveCount(2);
  await page.click('#selOrder [data-order=back]');
  await page.waitForTimeout(60);
  expect(await top()).toBe('rosso');
  await expect(page.locator('#selBox')).toHaveCount(1);          // la selezione resta

  await page.keyboard.press('PageUp');
  await page.waitForTimeout(60);
  expect(await top()).toBe('nero');
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(60);
  expect(await top()).toBe('rosso');

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(60);
  expect(await top()).toBe('nero');
  noErrors(errors);
});

test('copia, incolla e taglia con la tastiera', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = await openBoard(page);
  await line(page, 100, 100, 300, 100);
  await page.keyboard.press('v');
  await page.mouse.click(200, 100);
  await page.waitForTimeout(30);
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(60);
  await expect(page.locator('#toast')).toHaveText('Oggetto copiato.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Oggetti della lavagna #');

  await page.keyboard.press('Control+v');
  await page.waitForTimeout(80);
  expect(await ink(page, 134, 116, 120, 16)).toBeGreaterThan(100);
  expect(await ink(page, 110, 92, 120, 16)).toBeGreaterThan(100);

  await page.keyboard.press('Control+x');
  await page.waitForTimeout(60);
  expect(await ink(page, 134, 116, 120, 16)).toBe(0);
  await expect(page.locator('#selBox')).toHaveCount(0);

  await page.keyboard.press('p');
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(60);
  await expect(page.locator('#t-se')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Escape');
  await pasteImage(page);
  await expect(page.locator('#placing')).toHaveCount(1); // un'immagine copiata altrove ha la precedenza
  await page.keyboard.press('Escape');

  await page.keyboard.press('t');
  await page.mouse.click(400, 500);
  await page.keyboard.type('abc');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('End');
  await page.keyboard.press('Control+v');
  await expect(page.locator('#editor')).toHaveValue('abcabc');
  noErrors(errors);
});

test('salva e apri: il file conserva tutto, anche lo zoom', async ({ page }, info) => {
  const errors = await openBoard(page);
  await line(page, 100, 150, 400, 150);
  await page.keyboard.press('g');
  await line(page, 250, 130, 250, 170);
  await page.keyboard.press('p');
  await pasteImage(page);
  await page.keyboard.press('Enter');
  await setZoomSlider(page, 1);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
  const file = info.outputPath('foglio.json');
  await download.saveAs(file);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  expect(saved.app).toBe('lavagna-a-mano-libera');
  expect(saved.zoom).toBe(2);
  expect(saved.ops.map(o => o.k).sort()).toEqual(['im', 'pen']);
  expect(saved.ops.find(o => o.k === 'im').data).toContain('data:image/png;base64,');
  expect(saved.ops.find(o => o.k === 'pen').masks).toHaveLength(1);

  await page.click('#clear');
  await page.waitForTimeout(40);
  await page.setInputFiles('#fileInput', file);
  await page.waitForTimeout(350);
  await expect(page.locator('#zoomVal')).toHaveText('200%');
  const shown = await ink(page, 0, 60, 1280, 620);
  expect(shown).toBeGreaterThan(5000);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(250);
  await expect(page.locator('#hint')).toBeVisible(); // il foglio di prima era vuoto
  await expect(page.locator('.layer canvas')).toHaveCount(0);

  const bad = info.outputPath('sbagliato.json');
  writeFileSync(bad, '{"a":1}');
  await page.setInputFiles('#fileInput', bad);
  await page.waitForTimeout(100);
  await expect(page.locator('#toast')).toHaveText('Questo file non è una lavagna salvata.');
  noErrors(errors);
});

test('apre un foglio vero e i file con la gomma come tratto a parte', async ({ page }, info) => {
  const errors = await openBoard(page);
  await page.setInputFiles('#fileInput', FIXTURE);
  await page.waitForTimeout(800);
  await expect(page.locator('#zoomVal')).toHaveText('61%');
  expect(await ink(page, 0, 60, 1280, 620)).toBeGreaterThan(1000);

  const old = info.outputPath('vecchio.json');
  writeFileSync(old, JSON.stringify({
    app: 'lavagna-a-mano-libera', version: 1, pan: { x: 0, y: 0 },
    ops: [
      { k: 'pen', c: '#000000', bb: [98, 96, 402, 104], p: [100, 100, 4, 400, 100, 4] },
      { k: 'er', bb: [230, 80, 270, 120], p: [250, 85, 32, 250, 115, 32] },
    ],
  }));
  await page.setInputFiles('#fileInput', old);
  await page.waitForTimeout(300);
  await expect(page.locator('#zoomVal')).toHaveText('100%');
  expect(await ink(page, 100, 96, 100, 8)).toBeGreaterThan(200);
  expect(await ink(page, 245, 96, 10, 8)).toBe(0);
  noErrors(errors);
});

test('ricaricando la pagina tornano foglio e zoom', async ({ page }) => {
  const errors = await openBoard(page);
  await line(page, 200, 200, 500, 200);
  await setZoomSlider(page, -1);
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#zoomVal')).toHaveText('50%');
  expect(await ink(page, 0, 60, 1280, 620)).toBeGreaterThan(100);
  noErrors(errors);
});

test('vista pulita: niente griglia né vassoio, la penna non scrive', async ({ page }) => {
  const errors = await openBoard(page);
  await line(page, 200, 200, 500, 200);
  const before = await ink(page, 0, 0, 1280, 760);
  await page.click('#clean');
  await page.waitForTimeout(150);
  await expect(page.locator('#tray')).toBeHidden();
  await expect(page.locator('#dots')).toBeHidden();
  await line(page, 300, 400, 600, 400);
  expect(await ink(page, 300, 390, 300, 20)).toBe(0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await expect(page.locator('#tray')).toBeVisible();
  expect(before).toBeGreaterThan(100);
  noErrors(errors);
});

test('pannello del foglio: nome nel titolo e nel file, statistiche', async ({ page }, info) => {
  const errors = await openBoard(page);
  await expect(page.locator('#panel')).toBeHidden();
  await expect(page).toHaveTitle(/^Disegno \d\d\/\d\d\/\d{4} \d\d:\d\d – Lavagna a mano libera$/);
  await line(page, 200, 200, 500, 200);
  await page.keyboard.press('e');
  await line(page, 200, 260, 500, 260);
  await page.keyboard.press('i');
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#sheetName')).toHaveValue(/^Disegno /);
  const rows = page.locator('#statsBody tr');
  await expect(rows.nth(0).locator('td').first()).toHaveText('1');
  await expect(rows.nth(1).locator('td').first()).toHaveText('1');
  await expect(page.locator('#statsTotN')).toHaveText('2');

  // le lettere nel campo non cambiano strumento
  await page.fill('#sheetName', '');
  await page.locator('#sheetName').pressSequentially('Riunione: piano');
  await page.keyboard.press('Enter');
  await expect(page).toHaveTitle('Riunione: piano – Lavagna a mano libera');
  await expect(page.locator('#t-hl')).toHaveAttribute('aria-pressed', 'true');

  // vuoto torna al nome automatico
  await page.fill('#sheetName', '');
  await page.locator('#sheetName').blur();
  await expect(page.locator('#sheetName')).toHaveValue(/^Disegno /);
  await page.fill('#sheetName', 'Riunione: piano');
  await page.locator('#sheetName').blur();

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
  expect(download.suggestedFilename()).toBe('Riunione. piano.json');
  const file = info.outputPath('Lezione 3.json');
  await download.saveAs(file);
  expect(JSON.parse(readFileSync(file, 'utf8')).name).toBe('Riunione: piano');

  // aprendo un file il nome viene dal file; Annulla lo ripristina
  await page.setInputFiles('#fileInput', file);
  await page.waitForTimeout(300);
  await expect(page.locator('#sheetName')).toHaveValue('Lezione 3');
  await expect(page).toHaveTitle('Lezione 3 – Lavagna a mano libera');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  await expect(page.locator('#sheetName')).toHaveValue('Riunione: piano');

  // il nome torna dopo una ricarica
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page).toHaveTitle('Riunione: piano – Lavagna a mano libera');

  // aperto, si aggiorna da solo ogni secondo
  await page.keyboard.press('i');
  await page.evaluate(() => { document.getElementById('statsTotN').textContent = 'x'; });
  await expect(page.locator('#statsTotN')).toHaveText('2', { timeout: 2500 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#panel')).toBeHidden();
  noErrors(errors);
});

test('impostazioni: la bassa latenza si cambia dal pannello e resta salvata', async ({ page }) => {
  const errors = await openBoard(page);
  await expect(page.locator('#tray #lowLat')).toHaveCount(0);
  await page.click('#info');
  const sw = page.locator('#panel #lowLat');
  await expect(sw).toBeChecked();
  await page.click('label[for=lowLat]');
  await expect(sw).not.toBeChecked();
  await expect(page.locator('#lowLatNote')).toContainText('Accendila');
  // la barra spaziatrice sull'interruttore lo cambia, senza spostare il foglio
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toBeChecked();
  await expect(page.locator('#board')).not.toHaveClass(/hand/);
  await page.keyboard.press('Space');
  await expect(sw).not.toBeChecked();
  await page.reload();
  await page.waitForTimeout(300);
  await page.keyboard.press('i');
  await expect(page.locator('#lowLat')).not.toBeChecked();
  // si disegna ancora
  await page.keyboard.press('Escape');
  await line(page, 200, 300, 500, 300);
  expect(await ink(page, 200, 290, 300, 20)).toBeGreaterThan(200);
  noErrors(errors);
});

test('importa un PDF della lavagna Microsoft e un PNG da Apri', async ({ page }, info) => {
  const errors = await openBoard(page);
  await page.setInputFiles('#fileInput', { name: 'schema cavi.pdf', mimeType: 'application/pdf', buffer: samplePdf() });
  await expect(page.locator('#toast')).toContainText('Importati 2 tratti e forme, 1 testi, 1 immagini');
  await expect(page).toHaveTitle('schema cavi – Lavagna a mano libera');
  await expect(page.locator('#selBox')).toHaveCount(1);
  // il rettangolo nero (200 × 100 pt) è al centro dello schermo, a zoom 100%
  const cx = 640, cy = 380;
  expect(await ink(page, cx - 120, cy - 6, 60, 12)).toBeGreaterThan(500);
  const [r, g, b] = await pixel(page, cx, cy - 13);   // linea rossa trasparente sul nero
  expect(r).toBeGreaterThan(90);
  expect(g + b).toBeLessThan(40);

  // Annulla toglie tutto, Ripeti lo rimette
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  await expect(page.locator('#hint')).toBeVisible();
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(100);
  expect(await ink(page, cx - 120, cy - 6, 60, 12)).toBeGreaterThan(500);

  // un clic sulla forma la seleziona da sola
  await page.mouse.click(cx + 300, cy + 200);
  await page.mouse.click(cx - 90, cy);
  const box = await rect(page, 'selBox');
  expect(box.w).toBeGreaterThan(250);
  expect(box.w).toBeLessThan(290);

  // la gomma cancella la forma
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await line(page, cx - 200, cy, cx + 200, cy);
  expect(await ink(page, cx - 120, cy - 6, 60, 12)).toBe(0);

  // salvata e riaperta resta una forma
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
  const file = info.outputPath('schema.json');
  await download.saveAs(file);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  expect(saved.version).toBe(2);
  expect(saved.ops.map(o => o.k).sort()).toEqual(['im', 'sh', 'sh', 'tx']);
  expect(saved.ops.find(o => o.k === 'tx').t).toBe('Ciao');
  expect(saved.ops.find(o => o.k === 'sh' && o.c === '#000000').masks).toHaveLength(1);
  await page.click('#clear');
  await page.setInputFiles('#fileInput', file);
  await page.waitForTimeout(300);
  expect(await ink(page, cx - 120, cy - 30, 60, 12)).toBeGreaterThan(300);
  expect(await ink(page, cx - 120, cy - 6, 60, 12)).toBe(0);

  // un PNG da Apri si posiziona come un'immagine incollata
  await page.setInputFiles('#fileInput', { name: 'foto.png', mimeType: 'image/png', buffer: await pngBuffer(page) });
  await expect(page.locator('#placing')).toHaveCount(1);
  await page.keyboard.press('Escape');

  // un PDF che non so leggere dà un messaggio
  await page.setInputFiles('#fileInput', { name: 'rotto.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 niente') });
  await expect(page.locator('#toast')).toContainText('PDF');
  noErrors(errors);
});
