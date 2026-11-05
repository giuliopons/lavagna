// Misura il costo di disegno su un foglio salvato: node scripts/bench.mjs [file.json]
// I tempi dipendono dal computer: confronta solo misure fatte sulla stessa macchina.
import { build } from 'vite';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, rmSync } from 'node:fs';

const FILE = process.argv[2] || 'tests/fixtures/foglio-reale.json';
await build({ mode: 'bench', logLevel: 'warn' });
const html = readFileSync('dist/bench/index.html');
const server = createServer((req, res) => { res.setHeader('content-type', 'text/html;charset=utf-8'); res.end(html); }).listen(4174);

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:4174/');
await page.waitForFunction(() => window.__bench);
await page.setInputFiles('#fileInput', FILE);
await page.waitForFunction(() => window.__bench.S.ops.length > 0, null, { timeout: 30000 });
await page.waitForTimeout(1000);

const result = await page.evaluate(async () => {
  const B = window.__bench, S = B.S, now = () => performance.now();
  const flush = c => c.getImageData(0, 0, 1, 1);
  const paintAll = () => {
    for (let g = 0; g < 3000; g++) {
      const before = S.L.known.size;
      B.ensureStep();
      if (S.L.known.size === before) break;
    }
    S.L.tiles.forEach(t => flush(t.ctx));
  };
  const out = {};
  out.oggetti = S.ops.length;
  out.punti = S.ops.reduce((n, o) => n + (o.p ? o.p.length / 3 : 0), 0);
  let t = now();
  B.repaintAll();
  paintAll();
  out.ridisegnoSchermo_ms = Math.round(now() - t);
  out.tasselli = S.L.tiles.size;

  const cost = {}, count = {};
  S.L.tiles.forEach(tile => {
    for (const op of S.ops) {
      if (!B.hits(tile.bb, op.bb)) continue;
      const k = op.k + (op.masks?.length ? '+gomma' : '');
      const a = now();
      B.paint(tile, op);
      flush(tile.ctx);
      cost[k] = (cost[k] || 0) + now() - a;
      count[k] = (count[k] || 0) + 1;
    }
  });
  out.perTipo = Object.fromEntries(Object.keys(cost).map(k => [k, { disegni: count[k], ms: Math.round(cost[k]), msPerDisegno: +(cost[k] / count[k]).toFixed(2) }]));

  B.repaintAll();
  paintAll();
  t = now();
  structuredClone({ ops: S.ops.map(({ bmp, ...o }) => o) });
  out.salvataggioBrowser_ms = +(now() - t).toFixed(1);
  t = now();
  const blob = await B.docBlob();
  out.salvataggioFile_ms = Math.round(now() - t);
  out.fileMB = +(blob.size / 1e6).toFixed(2);

  out.ridisegnoZoom = [];
  for (const z of [.5, 1, 2]) {
    B.setZoom(z, 960, 540);
    B.settleZoom();
    t = now();
    paintAll();
    out.ridisegnoZoom.push({ zoom: z, ms: Math.round(now() - t), tasselli: S.L.tiles.size });
  }
  return out;
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
server.close();
rmSync('dist/bench', { recursive: true, force: true });
