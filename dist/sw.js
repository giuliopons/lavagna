// Generato da scripts/build.mjs: la versione cambia da sola quando cambiano i file.
const CACHE = 'lavagna-829849bb14ff';
const FILES = [
  "./",
  "assets/familjen-grotesk-latin-500-normal-BASv1Bog.woff2",
  "assets/familjen-grotesk-latin-600-normal-DR8FYmV8.woff2",
  "assets/familjen-grotesk-latin-ext-500-normal-C6C0U28C.woff2",
  "assets/familjen-grotesk-latin-ext-600-normal-K2kKrvU3.woff2",
  "assets/index-DH_y_m7C.js",
  "assets/style-DYkjn_dh.css",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Prima la rete, così gli aggiornamenti arrivano da soli; senza rete, la copia salvata.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
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
