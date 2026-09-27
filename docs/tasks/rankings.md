# Coda task — Pagina Rankings

Esegui **un solo task per volta**, il primo non spuntato. A fine task, oltre a quanto previsto da CLAUDE.md (typecheck, commit, STATUS.md, report), spunta il task qui sotto (`[x]`) nello stesso commit.

L'utente segue il lavoro dal telefono e non può rispondere subito:
- Se manca una decisione, scegli l'opzione più semplice coerente con `docs/SPEC.md` e scrivila nel report alla voce "Aperto". Non fermarti ad aspettare.
- Il dev server è già acceso dall'utente (Vite ricarica da solo). Se non risponde su http://localhost:5173, riavvialo **in background** (non in primo piano, altrimenti blocca la sessione) e scrivilo nel report.
- Non eseguire `data:fetch`, non fare `git push`, non toccare il branch `wip/perf`.

---

## [x] Task 1 — Pagina e classifica OpenCritic

**Task:** creare la pagina Rankings con una classifica dei giochi usciti ordinata per voto OpenCritic.

**File:** nuovi `rankings.html`, `src/rankings/main.ts`, `src/styles/rankings.css`. Da modificare: `vite.config.ts` (aggiungere la pagina come `admin.html`), `index.html` (link nell'header). Da riusare: `src/types.ts`, `src/cards/score-ring.ts`, `src/theme/theme.ts`, il caricamento di `games.json` in `src/main.ts`. Non toccare: `src/timeline/`.

**Contesto:** `docs/SPEC.md`, sezione backlog "Rankings". Decisioni già prese:
- Header con navigazione "Timeline · Rankings" su entrambe le pagine, pagina attiva evidenziata; stesso tema giorno/notte.
- Solo giochi usciti. Soglia fissa a 20 recensioni OpenCritic (diventa modificabile nel task 2).
- Giochi sotto soglia o senza voto: esclusi, con riga finale "N games hidden (fewer than 20 reviews)".
- A parità di voto: più recensioni, poi titolo.

**Atteso:**
- Ogni riga: posizione, copertina piccola, titolo, badge del tipo (DLC / Switch 2 Edition), data di uscita, cerchietto OpenCritic con numero di recensioni.
- Stile coerente con il sito (token di `tokens.css`).
- Sezione Rankings di `docs/SPEC.md` aggiornata: da backlog a "in sviluppo", con le decisioni sopra.

**Verifica:** typecheck + build.

---

## [x] Task 2 — Ordinamento e soglia

**Task:** permettere di scegliere la fonte di ordinamento e la soglia minima di recensioni.

**File:** `src/rankings/main.ts`, `src/styles/rankings.css`, `rankings.html` se serve. Non toccare: `src/timeline/`.

**Contesto:** decisioni già prese:
- Opzioni di ordinamento: OpenCritic, Metacritic, Metacritic User, Backloggd, Critics average, Users average.
- Critics average = media dei voti normalizzati di OpenCritic e Metacritic; Users average = Metacritic User e Backloggd.
- Soglia: campo numerico, predefinito 20. Per una singola fonte si applica al numero di recensioni di quella fonte. Per le medie conta solo ogni fonte che supera la soglia; il gioco entra se almeno una fonte la supera.
- La riga finale dei giochi esclusi si aggiorna: "N games hidden (no score or fewer than X reviews)".
- Scelte salvate nel browser (localStorage, con try/catch).
- Molti voti Metacritic e Backloggd non sono ancora compilati: una classifica corta per quelle fonti è il comportamento atteso, non un bug.

**Atteso:**
- Ogni riga mostra tutti e quattro i cerchietti (OpenCritic, Metacritic, Metacritic User, Backloggd), N/D dove manca il voto; il valore usato per ordinare è evidenziato. Per le medie, mostrare anche il valore della media.
- Cambiare ordinamento o soglia aggiorna la lista subito, con una transizione breve.

**Verifica:** typecheck + build.

---

## [ ] Task 3 — Filtri

**Task:** aggiungere i filtri alla pagina Rankings.

**File:** `src/rankings/main.ts`, `src/styles/rankings.css`. Guarda `src/filters.ts` solo per riusare logica o stile, **senza cambiarne il comportamento** sulla timeline.

**Contesto:** decisioni già prese:
- Filtri: includi DLC (on/off), includi Switch 2 Edition (on/off), solo esclusive (on/off), anno (All / 2025 / 2026, generato dagli anni presenti nei dati).
- Predefiniti: DLC off, Switch 2 Edition on, solo esclusive off, anno All.
- Filtri indipendenti da quelli della timeline, salvati nel browser.
- Posizioni ricalcolate dopo i filtri (1, 2, 3… senza buchi).

**Atteso:**
- Contatore "N games ranked".
- Se nessun gioco soddisfa i filtri: messaggio "No games match these filters" con un pulsante per azzerarli.
- Sezione Rankings di `docs/SPEC.md` aggiornata con ordinamento, soglia e filtri; stato "fatto".

**Verifica:** typecheck + build.
