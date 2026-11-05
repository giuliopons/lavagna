import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ink, line, noErrors, openBoard } from './helpers.js';

test('copia locale aperta dal disco', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + resolve('dist/lavagna-a-mano-libera.html'));
  await page.waitForTimeout(200);
  expect(await page.title()).toBe('Lavagna a mano libera');
  expect(await page.evaluate(() => 'onpointerrawupdate' in window)).toBe(true);
  await line(page, 200, 200, 500, 200);
  expect(await ink(page, 200, 190, 300, 20)).toBeGreaterThan(200);
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('500 16px "Familjen Grotesk"'); })).toBe(true);
  await page.keyboard.press('d');
  await expect(page.locator('#debug')).toHaveCount(1);
  noErrors(errors);
});

test('pagina pubblicata: funziona dentro l\'intestazione del visualizzatore', async ({ page }) => {
  const source = readFileSync('dist/artifact.html', 'utf8');
  expect(source.startsWith('<title>Lavagna a mano libera</title>')).toBe(true);
  expect(source).not.toMatch(/<!doctype|<html|<head|<body/i);
  expect(source).not.toMatch(/\b(?:src|href)="(?!#)[^"]+"/);
  const errors = await openBoard(page, '/artifact');
  await line(page, 200, 200, 500, 200);
  expect(await ink(page, 200, 190, 300, 20)).toBeGreaterThan(200);
  noErrors(errors);
});

test('PWA: installabile, funziona senza rete, niente tasto D', async ({ page, context }) => {
  const errors = await openBoard(page, '/pwa/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.enable');
  // I test usano un profilo temporaneo, che il browser considera in incognito
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors.filter(e => e.errorId !== 'in-incognito')).toEqual([]);
  expect((await cdp.send('Page.getAppManifest')).errors).toEqual([]);
  expect(existsSync('dist/pwa/sw.js')).toBe(true);
  expect(readFileSync('dist/pwa/sw.js', 'utf8')).not.toContain('__CACHE__');

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

test('la pagina di copia contiene i file identici', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/copia-lavagna.html');
  await page.click('#copyHtml');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(readFileSync('dist/lavagna-a-mano-libera.html', 'utf8'));
  await page.click('#copyBat');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(readFileSync('tools/avvia-lavagna.bat', 'latin1'));
  noErrors(errors);
});
