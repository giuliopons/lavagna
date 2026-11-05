import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Tre uscite dallo stesso sorgente:
//   single  un solo HTML con tutto dentro, base della copia locale e della pagina pubblicata
//   pwa     cartella da caricare sul sito, con manifest, icone e service worker
//   bench   come single, con gli agganci per scripts/bench.mjs
const PWA_HEAD = [
  ['link', { rel: 'manifest', href: 'manifest.webmanifest' }],
  ['meta', { name: 'theme-color', content: '#20252c' }],
  ['meta', { name: 'description', content: 'Lavagna per scrivere a mano libera con la penna.' }],
  ['link', { rel: 'icon', href: 'icons/icon-192.png' }],
  ['link', { rel: 'apple-touch-icon', href: 'icons/icon-192.png' }],
];

export default defineConfig(({ mode }) => {
  const pwa = mode === 'pwa';
  return {
    root: 'src',
    base: './',
    publicDir: pwa ? '../public' : false,
    define: {
      __PWA__: pwa,
      __BENCH__: mode === 'bench',
      __DEBUG_KEY__: !pwa,
    },
    plugins: pwa
      ? [{
          name: 'pwa-head',
          transformIndexHtml: () => PWA_HEAD.map(([tag, attrs]) => ({ tag, attrs, injectTo: 'head' })),
        }]
      : [viteSingleFile()],
    build: {
      outDir: `../dist/${mode}`,
      emptyOutDir: true,
      target: 'es2022',
      assetsInlineLimit: pwa ? 0 : 100_000_000,
      rollupOptions: pwa ? {} : { output: { format: 'iife' } },
    },
  };
});
