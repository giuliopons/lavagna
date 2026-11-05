# Handoff

## Stato attuale

Il progetto nasce dalla divisione in moduli di un unico file HTML. La divisione non doveva cambiare il comportamento, con due differenze volute: il font è incluso in tutte le versioni invece di arrivare da Google Fonts, e la versione del service worker si calcola da sola.

Funziona: penna con pressione, evidenziatore, gomma, testo, immagini incollate, selezione, copia e incolla, zoom con slider, vista pulita, salvataggio automatico, Salva e Apri, PWA.

## Misure sul foglio reale

File: `tests/fixtures/foglio-reale.json`, salvato dall'utente. Contiene 822 oggetti (788 penna, 24 evidenziatore, 8 testi, 2 immagini) e 30.753 punti, per 3,09 MB, di cui il 74% sono immagini.

Misure su 1920×1080, senza scheda grafica. Contano le proporzioni, non i valori assoluti.

| Tipo | Disegni | Tempo | Per disegno |
|---|---:|---:|---:|
| Penna normale | 836 | 75 ms | 0,09 ms |
| Penna con gomma | 33 | 75 ms | 2,28 ms |
| Evidenziatore | 25 | 44 ms | 1,74 ms |
| Immagini e testi | 21 | 9 ms | meno di 1 ms, salvo i testi con gomma |

Il ridisegno dello schermo costa 220-320 ms. Il salvataggio automatico circa 7 ms: non è un problema.

L'utente percepisce la lavagna come lenta con un numero di oggetti modesto: il collo di bottiglia è nel codice, non nella quantità.

## Prossime attività

Rilancia `npm run bench` prima e dopo ogni correzione delle prestazioni. Le prime tre sono state spiegate all'utente, che non le ha ancora approvate una per una: chiedi conferma se cambiano l'aspetto o il formato del file.

### 1. Foglio d'appoggio ridotto (priorità alta)

In `paint` (`layers.js`), evidenziatore e oggetti con gomma passano da un foglio temporaneo grande come il tassello. Va usato solo il rettangolo dell'oggetto intersecato col tassello. È il guadagno maggiore: quasi il 60% del tempo va in questo 6% dei disegni. Da verificare: stesso risultato a schermo, anche ai bordi, a zoom e scala di schermo diversi.

### 2. Gomma più precisa (priorità alta)

In `endStroke` (`input.js`) la gomma si lega a tutto ciò il cui rettangolo tocca il suo. Va legata solo se il percorso passa davvero sull'oggetto, tenendo conto dei due spessori. Sul foglio reale 3 legami su 29 sono inutili, ma con gomme larghe su zone piene aumentano e rallentano il punto 1.

### 3. File più leggero (priorità media)

La stessa gomma è ripetuta in ogni oggetto toccato: nel foglio reale 11.070 punti invece di 732, circa 0,23 MB. Va scritta una sola volta in un elenco a parte. I file vecchi devono continuare ad aprirsi e serve aumentare `version`. Non migliora la fluidità.

### 4. Nome del file e statistiche (fatto)

Pannello in alto a destra, dal pulsante con le barre nel vassoio o dal tasto I; Esc lo chiude. In cima c'è il nome del file, poi le statistiche: quantità e peso per tipo, punti, passate di gomma, area usata, tempo dell'ultimo ridisegno completo dello schermo (misurato in `ensureStep`).

- Un nome vuoto diventa `Disegno gg/mm/aaaa hh:mm`. Il titolo della pagina è `<nome> – Lavagna a mano libera`.
- Nel nome del file `:` diventa `.` e `/ \ * ? " < > |` diventano `-`: Windows non li accetta.
- Il nome è salvato nel file (campo `name`, `version` resta 1) e in IndexedDB. Apri prende il nome dal file aperto; Annulla lo ripristina.
- Con la finestra di scelta, cambiare nome fa scegliere di nuovo il file al Salva successivo; un nome diverso scelto nella finestra diventa il nome del foglio.
- Pulisci non cambia il nome.
- Da verificare a mano: il `title` nel visualizzatore di Claude e la finestra di scelta del file in Vivaldi.

### 5. Indicatore di lentezza (dopo i punti 1 e 2)

Non deve contare gli oggetti: a 822 oggetti scatterebbe un avviso sbagliato. Deve misurare il tempo reale di ridisegno e comparire solo se resta alto. La soglia va scelta dopo le correzioni, misurando sulla macchina dell'utente.

### 6. Meno punti per tratto (da valutare)

Un terzo dei punti dista meno di 1 px dal precedente. Con Douglas-Peucker a 0,25 px resterebbe circa il 35% dei punti, considerando solo la posizione. Il risparmio reale è minore perché vanno conservate le variazioni di pressione. Va applicato solo a tratto concluso e controllato a occhio sulla scrittura dell'utente.

### 7. Immagini ridotte quando si incollano (opzionale)

Il foglio reale ha un'immagine da 714×1298 mostrata a 210×382, che pesa 1,8 MB. Ridurla alleggerisce file e memoria, non il disegno, e toglie dettaglio a zoom alti. Solo come opzione.

### 8. Pulsante della bassa latenza

Proposta fatta all'utente, senza risposta: togliere il lampo dal vassoio e lasciarlo su un tasto, indicato nelle istruzioni. La bassa latenza resta attiva di default.

## Non provato

- `tests/builds.spec.js` › pagina di copia: fallisce su questa macchina anche senza modifiche, perché gli appunti di Chromium aggiungono spazi a fine riga.

- Penna Wacom reale: pressione, tasto laterale, punta gomma, fluidità dopo la divisione in moduli.
- Vivaldi e Windows, compreso `avvia-lavagna.bat`.
- Installazione reale della PWA da HTTPS, e il suo comportamento in Vivaldi.
- La finestra di scelta del file per Salva e Apri: i test usano download e campo file.
- Il salvataggio nella pagina pubblicata con la capability `downloads`.
- Il pizzico con due dita non fa zoom: su touch le due dita spostano il foglio.

## Decisioni aperte

- **Repository:** remoto `origin` su https://github.com/giuliopons/lavagna.git, non ancora inviato.
- **Licenza:** da scegliere prima di distribuire. Il font è SIL OFL e la licenza resta in `src/fonts/LICENSE.txt`.
- **Foglio di prova:** `tests/fixtures/foglio-reale.json` è un foglio vero dell'utente, immagini comprese. Va controllato o sostituito prima di rendere pubblico il repository.
- **Distribuzione:** PWA dal sito, oppure exe con Electron o Tauri. Per l'exe serve provare la penna e considerare la firma del codice.
- **Dipendenze:** `npm audit` segnala 4 problemi moderati negli strumenti di sviluppo legati a eslint. Vanno ricontrollati aggiornando eslint.
