// Server statico per i test: serve dist
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = normalize(join('dist', url));
  if (!file.startsWith('dist')) { res.statusCode = 403; res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(4173);
