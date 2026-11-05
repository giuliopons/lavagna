// Genera la cartella dist: la lavagna da caricare sul sito, che si apre anche dal disco.
// Contiene index.html, assets, icone, manifest e service worker.
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';

rmSync(DIST, { recursive: true, force: true });
await build({ mode: 'pwa', logLevel: 'warn' });

// ---------- Service worker: elenco dei file e versione calcolati dai file stessi ----------
const walk = dir => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(DIST).map(p => relative(DIST, p).split(sep).join('/')).sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(DIST, f)));
const sw = readFileSync('scripts/templates/sw.js', 'utf8')
  .replace('__CACHE__', 'lavagna-' + hash.digest('hex').slice(0, 12))
  .replace('__FILES__', JSON.stringify(['./', ...files], null, 2));
writeFileSync(join(DIST, 'sw.js'), sw);

const kb = Math.round(files.reduce((t, f) => t + statSync(join(DIST, f)).size, 0) / 1024);
console.log(`Fatto: dist/ ${files.length + 1} file, ${kb} KB`);
