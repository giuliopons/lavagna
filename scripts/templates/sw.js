// Generato da scripts/build.mjs: la versione cambia da sola quando cambiano i file.
const CACHE = '__CACHE__';
const FILES = __FILES__;

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
