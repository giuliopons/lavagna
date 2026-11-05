import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ink, line, noErrors, openBoard } from './helpers.js';

test('lavagna aperta dal disco', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const html = readFileSync('dist/index.html', 'utf8');
  expect(html).not.toMatch(/type="module"|crossorigin/);
  await page.goto('file://' + resolve('dist/index.html'));
  await page.waitForTimeout(200);
  expect(await page.title()).toMatch(/^Disegno .+ – Lavagna a mano libera$/);
  await line(page, 200, 200, 500, 200);
  expect(await ink(page, 200, 190, 300, 20)).toBeGreaterThan(200);
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('500 16px "Familjen Grotesk"'); })).toBe(true);
  noErrors(errors);
});

test('PWA: installabile, funziona senza rete, niente tasto D', async ({ page, context }) => {
  const errors = await openBoard(page, '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.enable');
  // I test usano un profilo temporaneo, che il browser considera in incognito
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors.filter(e => e.errorId !== 'in-incognito')).toEqual([]);
  expect((await cdp.send('Page.getAppManifest')).errors).toEqual([]);
  expect(existsSync('dist/sw.js')).toBe(true);
  expect(readFileSync('dist/sw.js', 'utf8')).not.toContain('__CACHE__');

  await line(page, 200, 200, 500, 260);
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('#tray')).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('500 16px "Familjen Grotesk"'); })).toBe(true);
  expect(await ink(page, 190, 190, 330, 90)).toBeGreaterThan(100);
  await page.keyboard.press('d');
  await expect(page.locator('#debug')).toHaveCount(0);
  await context.setOffline(false);
  noErrors(errors);
});

