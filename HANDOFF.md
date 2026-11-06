# Handoff

## Stato attuale

Funziona: penna con pressione, evidenziatore, gomma, testo, immagini, selezione con spostamento, scala, rotazione e ordine (davanti/dietro), copia e incolla, zoom, vista pulita, salvataggio automatico, Salva e Apri, import dei PDF della lavagna Microsoft, pannello delle impostazioni (nome del file, bassa latenza, statistiche, versione), PWA che si apre anche dal disco.

Il repository è su https://github.com/giuliopons/lavagna, con `dist` inclusa: dopo ogni modifica al codice va rigenerata e messa nel commit.

### Note sulle funzioni già fatte

- **Formato:** un file con forme importate (`sh`) o con testi e immagini ruotati (`r`) ha `version: 2`. Le versioni vecchie della lavagna non disegnano le forme e mostrano testi e immagini dritti.
- **Import PDF:** gestisce i PDF stampati da Chromium come quelli della lavagna Microsoft. Object stream, cifratura e font senza `/ToUnicode` non sono gestiti: arriva un messaggio. I 5 PDF veri dell'utente (`Desktop\Microsoft Whiteboard`) restano fuori dal repository; il test usa un PDF sintetico.
- **Scala:** un tratto molto ingrandito mostra piccoli rigonfiamenti alle giunture dei segmenti (disegno a pezzi con estremità tonde, su coordinate a metà pixel). Se con la penna vera si nota, il tratto a spessore costante va disegnato come un solo percorso.
- **Ordine:** porta davanti e manda dietro spostano la selezione in cima o in fondo. Non c'è il passo singolo, un livello alla volta.
- **Rotella:** la rotella e lo scorrimento della Wacom fanno di nuovo lo zoom attorno al puntatore, con il ridisegno nitido 350 ms dopo l'ultimo evento. Da provare con la Wacom vera: se è ancora lenta, alzare l'attesa in `wheelZoom` (`view.js`).
- **Pannello:** con il pannello aperto le statistiche si aggiornano ogni secondo (circa 17 ms sul foglio reale), saltando i gesti in corso.

## Misure sul foglio reale

File: `tests/fixtures/foglio-reale.json`, salvato dall'utente. Contiene 822 oggetti (788 penna, 24 evidenziatore, 8 testi, 2 immagini) e 30.753 punti, per 3,09 MB, di cui il 74% sono immagini.

Misure su 1920×1080, senza scheda grafica. Contano le proporzioni, non i valori assoluti.

| Tipo | Disegni | Tempo | Per disegno |
|---|---:|---:|---:|
| Penna normale | 836 | 75 ms | 0,09 ms |
| Penna con gomma | 33 | 75 ms | 2,28 ms |
| Evidenziatore | 25 | 44 ms | 1,74 ms |
| Immagini e testi | 21 | 9 ms | meno di 1 ms, salvo i testi con gomma |

Con `npm run bench` il ridisegno dello schermo misurava 495-523 ms su questa macchina; dopo il foglio d'appoggio ridotto (6 novembre 2026) misura 286-310 ms. Evidenziatore da 4,7-4,9 a 1,9-2,3 ms per disegno, penna con gomma da 6,1-6,8 a 1,5-1,9 ms. Il salvataggio automatico costa circa 7 ms: non è un problema.

Il foglio d'appoggio di `paint` (`layers.js`) ora si limita al rettangolo dell'oggetto dentro il tassello, in pixel interi presi per eccesso. Verificato con screenshot del foglio reale a zoom 0,5, 1 e 2 e scala di schermo 1 e 1,5: zero pixel diversi rispetto a prima.

L'utente percepisce la lavagna come lenta con un numero di oggetti modesto: il collo di bottiglia è nel codice, non nella quantità.

## Prossime attività

Rilancia `npm run bench` prima e dopo ogni correzione delle prestazioni. Le prime due sono state spiegate all'utente, che non le ha ancora approvate una per una: chiedi conferma se cambiano l'aspetto o il formato del file.

### 1. Gomma più precisa (priorità alta)

In `endStroke` (`input.js`) la gomma si lega a tutto ciò il cui rettangolo tocca il suo. Va legata solo se il percorso passa davvero sull'oggetto, tenendo conto dei due spessori. Sul foglio reale 3 legami su 29 sono inutili, ma con gomme larghe su zone piene aumentano e ogni legame costa un passaggio dal foglio d'appoggio.

### 2. File più leggero (priorità media)

La stessa gomma è ripetuta in ogni oggetto toccato: nel foglio reale 11.070 punti invece di 732, circa 0,23 MB. Va scritta una sola volta in un elenco a parte. I file vecchi devono continuare ad aprirsi e serve aumentare `version`. Non migliora la fluidità.

### 3. Indicatore di lentezza (dopo il punto 1)

Non deve contare gli oggetti: a 822 oggetti scatterebbe un avviso sbagliato. Deve misurare il tempo reale di ridisegno e comparire solo se resta alto. La soglia va scelta dopo le correzioni, misurando sulla macchina dell'utente. Il tempo dell'ultimo ridisegno è già misurato (`S.lastRedraw`) e mostrato nel pannello.

### 4. Meno punti per tratto (da valutare)

Un terzo dei punti dista meno di 1 px dal precedente. Con Douglas-Peucker a 0,25 px resterebbe circa il 35% dei punti, considerando solo la posizione. Il risparmio reale è minore perché vanno conservate le variazioni di pressione. Va applicato solo a tratto concluso e controllato a occhio sulla scrittura dell'utente.

### 5. Immagini ridotte quando si incollano (opzionale)

Il foglio reale ha un'immagine da 714×1298 mostrata a 210×382, che pesa 1,8 MB. Ridurla alleggerisce file e memoria, non il disegno, e toglie dettaglio a zoom alti. Solo come opzione.

### 6. Multilingua (priorità bassa)

Richiesta dell'utente. Oggi testi dell'interfaccia, title, aria-label e messaggi sono in italiano, sparsi in `index.html` e nei moduli. Servirebbe un modulo con le stringhe per lingua e la scelta dalla lingua del browser. Da decidere con l'utente: quali lingue e se serve un selettore. La regola "Lingua: italiano" in `CLAUDE.md` resta valida per commenti e codice.

## Non provato

I test usano il mouse simulato in Chromium. Da provare a mano:

- Penna Wacom reale: pressione, tasto laterale, punta gomma, fluidità; scala, rotazione e pulsanti dell'ordine usati con la penna.
- Vivaldi e Windows, compresa la lavagna aperta dal disco (`dist/index.html`).
- La finestra di scelta del file per Salva e Apri, anche dopo Pulisci: i test usano download e campo file.
- I cursori di rotazione sullo schermo vero: negli screenshot automatici il cursore non compare.
- Installazione reale della PWA da HTTPS, l'icona nuova dopo l'aggiornamento e la favicon da disco.
- PDF di programmi diversi dalla lavagna Microsoft.
- Touch: rotazione e scala con il dito; il pizzico con due dita non fa zoom, le due dita spostano il foglio.

## Decisioni aperte

- **Licenza:** da scegliere prima di distribuire. Il font è SIL OFL e la licenza resta in `src/fonts/LICENSE.txt`.
- **Foglio di prova:** `tests/fixtures/foglio-reale.json` è un foglio vero dell'utente, immagini comprese, ed è nel repository pubblico. Va controllato o sostituito.
- **Colore del tema:** la barra della PWA usa il grigio del vassoio (`#20252c`); le icone nuove sono blu (`#3563C9`). L'utente non ha ancora scelto.
- **Distribuzione:** PWA dal sito, oppure exe con Electron o Tauri. Per l'exe serve provare la penna e considerare la firma del codice.
- **Dipendenze:** `npm audit` segnala 4 problemi moderati negli strumenti di sviluppo legati a eslint. Vanno ricontrollati aggiornando eslint.
