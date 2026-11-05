Quando Microsoft ha deciso di chiudere il tool Whiteboard ci sono rimasto molto male, come tanti avevo scritto i miei appunti lì dentro per anni: riunioni, progetti veri, idee, spiegazioni di scuola per i miei studenti... La dipendenza da un software quando si manifesta in questo modo è davvero pericolosa. 

**Chiuso.**

<img width="50%" alt="image" src="https://github.com/user-attachments/assets/c9f8b128-7574-481a-8152-76190c2b8d74" />

Dopo aver provato diversi tool per usare una Whiteboard per appunti, sketch, lezioni, ho seguito la strada autarchica: faccio il mio tool, tagliato su misura per quello che mi serve.

Eccolo qui. E' uno strumento "lavagna" che funziona nel browser, sia da locale perché la cartella 'dist' può essere anche usata in modo statico direttamente dal PC, sia su un server (non occorre Node). Oppure puoi usarlo dal mio sito https://www.barattalo.it/lavagna

Se hai esportato i tuoi lavori dalla lavagna di Microsoft in formato PDF puoi anche reimportarli qui e continuare a lavorarci.

# FUNZIONI

- **Penna** sensibile alla pressione, pensata per le tavolette Wacom, con tratto fluido e bassa latenza.
- **Evidenziatore** trasparente, che non copre la scrittura sotto.
- **Gomma**, anche con la punta gomma della penna.
- **Testo** scritto da tastiera, da spostare e modificare.
- **Immagini** incollate dagli appunti o aperte da file.
- **Selezione** per spostare, copiare, tagliare ed eliminare gruppi di oggetti.
- **Foglio infinito** con zoom, schermo intero e vista pulita per gli screenshot.
- **Salvataggio automatico** nel browser e **salvataggio su file** `.json`.
- **Import dei PDF** esportati dalla lavagna Microsoft: tratti, testi e immagini tornano modificabili.
- **Pannello delle impostazioni** con il nome del file, la bassa latenza e le statistiche.
- Funziona **senza internet** e si può installare come app (PWA).

# ISTRUZIONI

<img width="1242" height="61" alt="{04EAA16B-C34C-4A34-B4E6-71F153D35F5D}" src="https://github.com/user-attachments/assets/35c673d6-ca9d-42f3-ac24-1ec6f82839ed" />

### Avvio

- **Dal sito:** apri https://www.barattalo.it/lavagna. Dal menu del browser puoi installarla come app.
- **Dal PC:** scarica il repository (Code → Download ZIP), estrai la cartella `dist` e apri `index.html` con un doppio clic.

### Strumenti

| Tasto | Strumento |
|---|---|
| P | Penna |
| E | Evidenziatore |
| G | Gomma |
| T | Testo: clic sul foglio e scrivi |
| V | Selezione: trascina un riquadro o clicca un oggetto |

Colore e spessore si scelgono nel vassoio in basso.

### Muoversi sul foglio

- **Spostare il foglio:** trascina con il tasto destro, con il tasto centrale o tenendo premuta la barra spaziatrice. Su touch, trascina con due dita.
- **Zoom:** con lo slider, oppure Ctrl++ e Ctrl+-. Ctrl+0 torna al 100%. La rotella del mouse non fa nulla, di proposito.

### File

- Ctrl+S salva su file, Ctrl+Maiusc+S salva con un altro nome, Ctrl+O apre.
- Apri accetta anche un PDF della lavagna Microsoft, che si aggiunge al foglio, e le immagini PNG o JPG.
- Il lavoro si salva da solo nel browser: chiudendo e riaprendo la pagina lo ritrovi.

### Altre scorciatoie

| Tasto | Azione |
|---|---|
| Ctrl+Z / Ctrl+Y | Annulla / Ripeti |
| Ctrl+C / Ctrl+X / Ctrl+V | Copia / Taglia / Incolla, anche le immagini |
| Canc | Elimina la selezione |
| Ctrl+A | Seleziona tutto, con lo strumento selezione |
| I | Impostazioni: nome del foglio, bassa latenza, statistiche |
| F | Schermo intero |
| O | Vista pulita, Esc per uscire |
| Esc | Toglie la selezione o chiude il pannello |

# SVILUPPO

Il progetto usa Vite senza framework. Node serve solo per lavorarci, non per usare la lavagna.

```
npm install
npm run dev     # sviluppo
npm run build   # genera la cartella dist
npm test        # build e test Playwright
```
