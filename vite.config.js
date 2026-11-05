import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Modalità:
//   pwa          la cartella dist, da caricare sul sito: manifest, icone e service worker
//   bench        un solo HTML con tutto dentro e gli agganci per scripts/bench.mjs
//   development  npm run dev, con il tasto D del registro eventi
const PWA_HEAD = [
  ['link', { rel: 'manifest', href: 'manifest.webmanifest' }],
  ['meta', { name: 'theme-color', content: '#20252c' }],
  ['meta', { name: 'description', content: 'Lavagna per scrivere a mano libera con la penna.' }],
  ['link', { rel: 'icon', href: 'icons/favicon.ico', sizes: '48x48' }],
  ['link', { rel: 'icon', href: 'icons/favicon.svg', type: 'image/svg+xml' }],
  ['link', { rel: 'apple-touch-icon', href: 'icons/apple-touch-icon.png' }],
];

export default defineConfig(({ mode }) => {
  const pwa = mode === 'pwa', bench = mode === 'bench';
  return {
    root: 'src',
    base: './',
    publicDir: pwa ? '../public' : false,
    define: {
      __PWA__: pwa,
      __BENCH__: bench,
      __DEBUG_KEY__: !pwa,
    },
    plugins: pwa
      ? [{
          name: 'pwa-head',
          transformIndexHtml: () => PWA_HEAD.map(([tag, attrs]) => ({ tag, attrs, injectTo: 'head' })),
        }, {
          // Script classico e niente crossorigin: così la cartella si apre anche dal disco (file://),
          // dove i moduli e le richieste CORS sono bloccati
          name: 'classic-script',
          apply: 'build',
          transformIndexHtml: {
            order: 'post',
            handler: html => html
              .replace(/<script type="module" crossorigin/g, '<script defer')
              .replace(/(<link rel="stylesheet") crossorigin/g, '$1'),
          },
        }]
      : bench ? [viteSingleFile()] : [],
    build: {
      outDir: pwa ? '../dist' : `../dist/${mode}`,
      emptyOutDir: true,
      target: 'es2022',
      assetsInlineLimit: pwa ? 0 : 100_000_000,
      // Con lo script classico il CSS finirebbe dentro il JS: resta in un file a parte, caricato subito
      cssCodeSplit: !pwa,
      // Uno script classico in un solo file
      rollupOptions: { output: { format: 'iife' } },
    },
  };
});
