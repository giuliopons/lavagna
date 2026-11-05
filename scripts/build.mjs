// Genera tutto cio' che si distribuisce, nella cartella dist:
//   lavagna-a-mano-libera.html   copia locale in un solo file
//   avvia-lavagna.bat            avvio della copia locale su Windows
//   artifact.html                pagina da pubblicare su Claude, senza intestazione HTML
//   copia-lavagna.html           pagina per copiare i file quando il download non funziona
//   pwa/                         cartella da caricare sul sito
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const mode of ['single', 'pwa']) await build({ mode, logLevel: 'warn' });

// ---------- File unico ----------
const single = readFileSync(join(DIST, 'single/index.html'), 'utf8');
const scriptMatch = /<script\b[^>]*>([\s\S]*?)<\/script>/.exec(single);
if (!scriptMatch) throw new Error('script non trovato nel file unico');
const script = scriptMatch[1];
const style = [...single.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const title = /<title>[\s\S]*?<\/title>/.exec(single)[0];
const noScript = single.replace(scriptMatch[0], '');
const markup = /<body>([\s\S]*)<\/body>/.exec(noScript)[1].trim();
if (!style || !markup) throw new Error('stile o markup non trovati nel file unico');

const standalone = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${title}
<style>${style}</style>
</head>
<body>
${markup}
<script>${script}</script>
</body>
</html>
`;
writeFileSync(join(DIST, 'lavagna-a-mano-libera.html'), standalone);

// ---------- Pagina pubblicata: il visualizzatore aggiunge da solo l'intestazione ----------
writeFileSync(join(DIST, 'artifact.html'), `${title}\n<style>${style}</style>\n${markup}\n<script>${script}</script>\n`);

// ---------- Avvio su Windows e pagina di copia ----------
copyFileSync('tools/avvia-lavagna.bat', join(DIST, 'avvia-lavagna.bat'));
const bat = readFileSync('tools/avvia-lavagna.bat', 'latin1');
const data = JSON.stringify({ html: standalone, bat }).replace(/</g, '\\u003c');
const copyPage = readFileSync('scripts/templates/copia-lavagna.html', 'utf8').replace('__DATA__', () => data);
writeFileSync(join(DIST, 'copia-lavagna.html'), copyPage);

// ---------- Service worker: elenco dei file e versione calcolati dai file stessi ----------
const PWA = join(DIST, 'pwa');
const walk = dir => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(PWA).map(p => relative(PWA, p).split(sep).join('/')).sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(PWA, f)));
const sw = readFileSync('scripts/templates/sw.js', 'utf8')
  .replace('__CACHE__', 'lavagna-' + hash.digest('hex').slice(0, 12))
  .replace('__FILES__', JSON.stringify(['./', ...files], null, 2));
writeFileSync(join(PWA, 'sw.js'), sw);

rmSync(join(DIST, 'single'), { recursive: true, force: true });
const kb = f => Math.round(statSync(join(DIST, f)).size / 1024) + ' KB';
console.log(`Fatto: lavagna-a-mano-libera.html ${kb('lavagna-a-mano-libera.html')}, artifact.html ${kb('artifact.html')}, copia-lavagna.html ${kb('copia-lavagna.html')}, pwa/ ${files.length + 1} file`);
