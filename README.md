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
- **Selezione** di uno o più oggetti, da spostare, ingrandire o rimpicciolire, ruotare, portare davanti o dietro, copiare, tagliare ed eliminare.
- **Foglio infinito** con zoom, schermo intero e vista pulita per gli screenshot.
- **Salvataggio automatico** nel browser e **salvataggio su file** `.json`, con il nome che scegli tu.
- **Import dei PDF** esportati dalla lavagna Microsoft: tratti, testi e immagini tornano modificabili.
- **Pannello delle impostazioni** con nome del file, bassa latenza e statistiche del foglio.
- Funziona **senza internet**, anche aperta dal PC, e si può installare come app (PWA).

# ISTRUZIONI

<img width="1242" height="61" alt="{04EAA16B-C34C-4A34-B4E6-71F153D35F5D}" src="https://github.com/user-attachments/assets/35c673d6-ca9d-42f3-ac24-1ec6f82839ed" />

### Avvio

- **Dal sito:** apri https://www.barattalo.it/lavagna. Dal menu del browser puoi installarla come app.
- **Dal PC:** scarica il repository (Code → Download ZIP), estrai la cartella `dist` e apri `index.html` con un doppio clic. Non serve installare nulla.

### Strumenti

| Tasto | Strumento |
|---|---|
| P | Penna |
| E | Evidenziatore |
| G | Gomma. Con la penna puoi anche girarla e usare la punta gomma |
| T | Testo: clic sul foglio e scrivi. Clic su un testo per modificarlo, trascinalo per spostarlo |
| V | Selezione |

Colore e spessore si scelgono nel vassoio in basso.

### Selezione

Con lo strumento selezione (V) trascina un riquadro attorno agli oggetti oppure clicca su un oggetto.

- **Spostare:** trascina dentro il riquadro.
- **Ingrandire o rimpicciolire:** trascina il tondo nell'angolo in basso a destra.
- **Ruotare:** premi appena attorno al tondo, dove il cursore diventa una freccia curva, e gira. Con Maiusc ruota a scatti di 15°.
- **Davanti o dietro:** usa i due pulsanti sopra il riquadro, oppure PagSu e PagGiù.
- **Eliminare:** Canc.

### Muoversi sul foglio

- **Spostare il foglio:** trascina con il tasto destro, con il tasto centrale, con il tasto laterale della penna o tenendo premuta la barra spaziatrice. Su touch, trascina con due dita.
- **Zoom:** con lo slider, oppure Ctrl++ e Ctrl+-. Ctrl+0 torna al 100%. La rotella del mouse non fa nulla, di proposito.

### File

- **Salvare:** Ctrl+S salva su file, Ctrl+Maiusc+S salva con un altro nome.
- **Nome del file:** si cambia nel pannello delle impostazioni (tasto I o ingranaggio). Se lo lasci vuoto diventa "Disegno" con data e ora.
- **Aprire:** Ctrl+O apre un foglio salvato. Apri accetta anche un PDF della lavagna Microsoft, che si aggiunge al foglio, e le immagini PNG o JPG.
- **Pulire il foglio:** il cestino cancella tutto e riporta il nome automatico, così non sovrascrivi per sbaglio il file di prima. Ctrl+Z lo riporta indietro.
- **Salvataggio automatico:** il lavoro si salva da solo nel browser, quindi chiudendo e riaprendo la pagina lo ritrovi.

### Impostazioni

Il pannello si apre con l'ingranaggio nel vassoio o con il tasto I, e si chiude con Esc. Contiene:

- il nome del file;
- l'interruttore della **bassa latenza**: il tratto segue la penna più da vicino; spegnila se vedi sfarfallii;
- le statistiche del foglio: oggetti, peso, punti, area usata, tempo di ridisegno.

### Altre scorciatoie

| Tasto | Azione |
|---|---|
| Ctrl+Z / Ctrl+Y | Annulla / Ripeti |
| Ctrl+C / Ctrl+X / Ctrl+V | Copia / Taglia / Incolla, anche le immagini |
| Canc | Elimina la selezione |
| PagSu / PagGiù | Porta la selezione davanti / dietro agli altri oggetti |
| Ctrl+A | Seleziona tutto, con lo strumento selezione |
| I | Impostazioni |
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
