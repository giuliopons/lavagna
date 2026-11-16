// Generato da scripts/build.mjs: la versione cambia da sola quando cambiano i file.
const CACHE = 'lavagna-90f1fb8c5b24';
const FILES = [
  "./",
  "assets/familjen-grotesk-latin-500-normal-BASv1Bog.woff2",
  "assets/familjen-grotesk-latin-600-normal-DR8FYmV8.woff2",
  "assets/familjen-grotesk-latin-ext-500-normal-C6C0U28C.woff2",
  "assets/familjen-grotesk-latin-ext-600-normal-K2kKrvU3.woff2",
  "assets/index-B-Ob0AmF.js",
  "assets/style-CDLABy_x.css",
  "icons/apple-touch-icon.png",
  "icons/favicon.ico",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest"
];

self.addEventListener('install', e => {
  // cache: 'reload' scavalca la cache HTTP: la copia salvata è quella appena caricata sul sito
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Prima la rete, così gli aggiornamenti arrivano da soli; senza rete, la copia salvata.
// I file in assets/ hanno l'impronta nel nome e possono venire dalla cache HTTP; gli altri (index.html,
// manifest, icone) si chiedono sempre al server con cache: 'no-cache', che costa poco se non sono cambiati.
// Una richiesta di navigazione non accetta opzioni: si rifà dall'indirizzo
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const fresh = url.pathname.includes('/assets/') ? e.request : new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' });
  e.respondWith(
    fetch(fresh)
      .then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('index.html')))
  );
});
