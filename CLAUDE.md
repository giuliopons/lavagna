# Lavagna a mano libera

Lavagna web per scrivere con la penna, pensata per tavolette Wacom: tratto fluido, evidenziatore in multiply, gomma, testo, immagini incollate, selezione, copia e incolla, zoom, salvataggio su file.

Prima di lavorare leggi `HANDOFF.md`: contiene lo stato del progetto e le prossime attività.

## Comandi

```
npm install
npm run dev        # sviluppo con Vite
npm run build      # genera dist
npm run lint
npm test           # build e test Playwright
npm run bench      # misura i tempi di disegno su tests/fixtures/foglio-reale.json
```

Se il browser di Playwright è già installato altrove: `PW_CHROMIUM=/percorso/chrome npm test`. Altrimenti `npx playwright install chromium`.

## Cosa genera la build

| File in `dist` | Uso |
|---|---|
| `lavagna-a-mano-libera.html` | Copia locale, tutto in un file, font compresi |
| `artifact.html` | Pagina da pubblicare su Claude: senza doctype, `head` e `body`, che aggiunge il visualizzatore |
| `pwa/` | Cartella da caricare sul sito; si apre anche dal disco (script classico, senza `crossorigin`). La versione del service worker si calcola dai file |

Pagine pubblicate: lavagna `https://claude.ai/artifact/8BaEEUjh9kPeduqHzHkdXT` (dichiara la capability `downloads`).

## Struttura di `src/js`

| Modulo | Compito |
|---|---|
| `main.js` | Avvio: chiama gli `init*` e prepara la prima schermata |
| `dom.js` | Elementi della pagina. Non importa nulla |
| `state.js` | Costanti, strumenti, preferenze e `S`, lo stato condiviso |
| `layers.js` | Tasselli e strati, `paint`, `refresh`, disegno a piccole dosi con `ensureStep` |
| `stroke.js` | Geometria del tratto |
| `text-render.js` | Misura e disegno del testo |
| `live.js` | Tele del tratto in corso, con bassa latenza |
| `view.js` | Spostamento e zoom |
| `input.js` | Gesti di penna, mouse e dita, anello della gomma |
| `text-editor.js` | Editor di testo e trascinamento dei testi |
| `images.js` | Immagini incollate |
| `objects.js` | Spostamento degli oggetti e aggancio della gomma |
| `selection.js` | Strumento selezione |
| `clipboard.js` | Copia, taglia, incolla |
| `history.js` | Annulla e ripeti |
| `file.js` | Salva e Apri su file. Apri accetta anche PDF (importati) e immagini (da posizionare) |
| `pdf-read.js` | Lettore PDF minimo: oggetti, flussi FlateDecode, pagine |
| `pdf-import.js` | Import dei PDF della lavagna Microsoft: forme `sh`, testi, immagini |
| `storage.js` | Salvataggio automatico in IndexedDB |
| `tray.js` | Vassoio: strumenti, colori, spessore, bassa latenza |
| `view-modes.js` | Schermo intero e vista pulita |
| `sheet-info.js` | Pannello del foglio (tasto I): nome del file, titolo della pagina, statistiche |
| `keyboard.js` | Scorciatoie |
| `toast.js` | Messaggi brevi |
| `debug.js` | Registro eventi sul tasto D, assente nella PWA |

## Regole del codice

- **Stato condiviso:** una variabile usata da più moduli sta in `S`, in `state.js`. Le variabili private restano nel loro modulo.
- **Nessun effetto all'importazione:** i moduli si importano a vicenda. I listener vanno in una funzione `init*`, chiamata da `main.js`. Le costanti di modulo non devono dipendere da costanti di altri moduli, salvo `dom.js` e `state.js`.
- **Coordinate:** schermo = foglio × `S.zoom` + `pan`. Gli oggetti stanno in coordinate del foglio. I delta dei gesti vanno divisi per `S.zoom`, salvo lo spostamento del foglio.
- **Un solo disegno:** `paint` serve sia al ridisegno sia alla tela del gruppo trascinato. Il tratto dal vivo e quello ridisegnato usano le stesse funzioni di `stroke.js`.
- **Tasselli:** `L.known` indica quelli aggiornati. Modificando `S.ops` chiama `refresh` sulla zona toccata o `repaintAll`. Quelli fuori schermo si disegnano quando servono.
- **Gomma:** è una maschera dentro `op.masks`, non un oggetto. I file vecchi con `k: 'er'` passano da `normalizeOps`.
- **Forme importate (`k: 'sh'`):** contorni esatti dai PDF. `p` resta a terne, ma la terza cifra è un segno (1 inizio sottopercorso, 2 chiusura), non uno spessore. Si disegnano con `drawShape` (`stroke.js`); un file che ne contiene ha `version: 2`.
- **Fluidità del tratto:** nessun calcolo in più nel percorso di `addPoint`. Usa `getCoalescedEvents` e disegna solo il pezzo nuovo.
- **Formato file e dati salvati:** i file `.json` già salvati devono continuare ad aprirsi. Non cambiare `app`, `lavagna-prefs` o il database IndexedDB `lavagna` senza una conversione.
- **Lingua:** interfaccia, messaggi e commenti in italiano.

## Limiti da ricordare

- La pagina pubblicata non può scaricare file direttamente: `doSave` passa dalla capability `downloads`. Non usa neanche le finestre di scelta del file.
- Il multiply funziona solo su carta bianca: la lavagna ha un solo aspetto, chiaro.
- I gesti del mouse di Vivaldi intercettano il tasto destro. La pagina non può impedirlo: si risolve nelle impostazioni del browser o con la barra spaziatrice.
- La rotella non deve fare nulla: lo zoom con lo scorrimento della Wacom era lento ed è stato tolto su richiesta. Lo zoom passa da slider e Ctrl++ / Ctrl+-.

## Prima di dire che una cosa funziona

Esegui `npm run lint` e `npm test`. Per le prestazioni confronta `npm run bench` prima e dopo, sulla stessa macchina. I test usano il mouse simulato in Chromium: penna reale, Vivaldi, Windows e installazione PWA da HTTPS vanno provati a mano, e va detto quando non è stato fatto.
