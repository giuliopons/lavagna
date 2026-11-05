import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { FIXTURE, drag, ink, line, noErrors, openBoard, pasteImage, pixel, rect, setZoomSlider } from './helpers.js';

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
