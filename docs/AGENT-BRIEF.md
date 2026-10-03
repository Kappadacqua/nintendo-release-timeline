# Brief per l'agente — Nintendo Release Timeline

Salvare in `docs/AGENT-BRIEF.md`. Da leggere all'inizio di ogni sessione, prima del task.

Questo brief è un riassunto, non la fonte di verità. **Il codice vince su questo documento.** Se trovi una differenza tra quello che leggi qui e quello che vedi nel codice, non adeguarti in silenzio: scrivila in "Aperto" nel report.

## Come si lavora

- Tu (Claude Code in VS Code) scrivi il codice. Chi ti dà i task è l'utente, spesso dal telefono; i task possono arrivargli da altre IA (un Architetto che decide funzioni e priorità, un Web Designer che decide aspetto e movimento) o da lui direttamente.
- Un task per sessione. Se il task chiede più cose indipendenti, fai la prima e segnala il resto in "Aperto".
- Se un valore del task è in conflitto con il codice, **fermati** e scrivilo in "Aperto". Non interpretare.
- Se per fare ciò che chiede il task serve una funzione nuova, un cambio di dati o di logica non previsto, fermati e scrivilo in "Aperto".
- Rispondi in italiano, in modo concreto e sintetico.

### Regole fisse

- A fine task: typecheck, `npm test`, commit, riga in `STATUS.md`, spunta `[x]` sul task nello stesso commit del lavoro (se il task viene da una coda in `docs/tasks/`).
- Niente `data:fetch`, niente `git push`, salvo che il task lo chieda in modo esplicito.
- Non cancellare `data/free-updates-seen.json`: se manca, la build tratta tutte le voci come già note e "What's new" non mostra nulla.

### Report finale (formato fisso)

1. **Fatto** — cosa è cambiato, in poche righe.
2. **File** — file toccati.
3. **Verifica** — typecheck, test e altri controlli eseguiti, con l'esito.
4. **Da verificare nel browser** — cosa deve controllare a occhio chi guarda il risultato (tu non vedi lo schermo).
5. **Aperto** — conflitti, dubbi, cose fuori perimetro. Se non c'è nulla, scrivi "Nessuno".

### Code di task

- Le code stanno in `docs/tasks/<nome>.md`: regole in testa, poi un task per sezione con la casella `- [ ] **Task N — titolo**`.
- Ogni task ha: **File** (da dove partire e cosa non toccare), **Contesto / decisioni**, **Specifica**, **Atteso**, **Verifica**.
- L'utente ti lancia con: `Esegui il prossimo task di docs/tasks/<coda>.md`. Il prossimo task è il primo non spuntato. Se è marcato **bloccato**, non eseguirlo: scrivilo in "Aperto".
- Se l'utente ti dà un task fuori da una coda, vale lo stesso formato di report, senza spunta.

## Il sito in breve

Sito **personale**: una timeline orizzontale dei giochi Nintendo dal **5 giugno 2025** (lancio di Switch 2) in avanti, con voti della critica e del pubblico. Versione mobile (SPEC §16): timeline verticale sotto 820 px di larghezza o 500 di altezza, header con menu a comparsa sotto 1280 px. Il target è **1080p**; l'header si adatta a 1440 e 1280 px.

### Stack e comandi

- Vite + TypeScript vanilla (nessun framework), GSAP per le animazioni, Fuse.js per la ricerca, Vitest per i test, script dei dati in Node con `tsx`.
- Cartella del progetto: `~/Documents/VisualStudio/nintendo`.
- Dev server Vite su `http://localhost:5173`, **già acceso dall'utente**: non avviarne un altro.
- Comandi usati nel flusso: typecheck, `npm test`, script `data:*` (build e validate dei dati; `data:fetch`, `data:fetch-metacritic`, `data:fetch-free-updates` e `data:fetch-studios` scaricano da fonti esterne, quindi solo su richiesta esplicita).

### Pagine

| Pagina | Cosa è |
|---|---|
| `index.html` | La timeline (pagina principale) |
| `rankings.html` | Classifica dei giochi per media dei voti |
| `studios.html` | Griglia degli studi di sviluppo |
| `admin.html` | Pannello per correggere i dati a mano. **Solo sviluppo**, fuori dal design curato |

### Tipi di elemento sulla timeline

Ogni tipo deve essere riconoscibile a colpo d'occhio (colori e forme diverse):

- **game** — gioco.
- **switch2-edition** — edizione Switch 2 di un gioco esistente.
- **dlc** — contenuto aggiuntivo (nastro "DLC", bordo viola).
- **free-update** — aggiornamento gratuito Switch 2 (verde). Non ha voti, non compare in Rankings né in "What's new". Il 5 giugno 2025 sono raggruppati in un gruppo "N free updates".

Stati di un gioco: in uscita (bordo tratteggiato, fascia "Upcoming"), "Out today", rinviato ("Delayed"), data da annunciare (zona **TBA** a fondo timeline).

### Funzioni della timeline

- **Zoom** Day / Week / Month con bottoni; **minimappa** cliccabile (la parte tratteggiata porta alla zona TBA).
- **Indicatore del giorno:** linea verticale fissa con una pillola che mostra il giorno corrente; la timeline scorre sotto di lui.
- **Card** dei giochi, impilate quando più uscite cadono vicine (le altezze delle pile sono stimate per tipo, `CARD_HEIGHT` in `src/cards/layout.ts`). Una card **selezionata** si espande con il contenuto extra e scala; le altre restano opache con un velo del colore della pagina al 50 %.
- **Gruppi di uscite nello stesso giorno:** si aprono "a ventaglio"; interruttore "Group same-day releases" nel menu View; PagSu / PagGiù saltano tra i gruppi.
- **Rotella** (`wheel-fling.ts`, parametri `wheel*` in `config.ts`): uno scatto isolato = un giorno (una settimana / un mese). Il comportamento in rotazione continua lo ridefinisce il task 2 di `docs/tasks/wheel-seasons.md`: vale quello che c'è nel codice. Trackpad e Shift + rotella sono separati. La **sensazione** della rotella la regola l'utente: non intervenire salvo richiesta.
- **Tastiera:** frecce, PagSu / PagGiù, Home / End, `P` (modalità presentazione), `?` (scorciatoie).
- **Ricerca** (Fuse.js), **filtri** (tra cui "Free updates" ed "Exclusives only", con contatore "N of M" / "M games"), pannello **What's new** (novità tra due snapshot dei dati).
- **Presentazione (P):** scorre i giochi uno alla volta con un gioco sempre selezionato; contatore "3 / 20" al posto della barra, rispetta reduced motion.
- **Sfondo del gioco:** il gioco selezionato mostra la sua immagine dietro la timeline (`.backdrop`, con un velo `--backdrop-veil`).
- **Sfondo stagionale** (`src/seasons/`, SPEC §15): canvas fisso con particelle (foglie, neve, petali, bolle) in base alla stagione del giorno sotto l'indicatore. Al cambio di stagione dissolvenza incrociata tra le due. Resta visibile in scorrimento veloce (con la rotella le particelle ricevono una spinta laterale); scompare con un gioco selezionato; con reduced motion particelle ferme; si accende e spegne dal menu View. Sta sempre sopra `.backdrop` e sotto tutto il contenuto (z-index −1, aggiunto con `append`).
- **Header:** titolo (sotto 1660 px diventa pallino + "NRT"), data, pulsanti (zoom, View, "What's new", tema, scorciatoie).
- **Menu View:** interruttori e segmenti delle impostazioni, salvati nel browser.

### Rankings

Classifica per "Critics average" o "Users average", soglia minima di recensioni ("Min. reviews"), filtri per DLC, Switch 2 Edition, Exclusives e anni. Le scelte sono ricordate. Un voto senza numero di recensioni è escluso con soglia > 0. Con una sola fonte sopra soglia la pillola dice "1 of 2 sources". La logica di ordinamento sta in `rank.ts`.

### Studios

Griglia degli studi con badge di categoria: **first-party**, **partner**, **third-party** (solo esclusive, nascoste di default, con interruttore ricordato). Ogni studio mostra un solo gioco (copertina e titolo), con stati "Upcoming · in N days", "Release date TBA" o "No Switch 2 game yet". L'ordine sta in `order.ts`. Il gioco di ogni studio è fissato in `studios.json`: quando esce, la pagina lo mostra come uscito finché non si rifà `data:build`.

### Admin (solo sviluppo)

Pannello per inserire e correggere dati a mano: link e voti Metacritic e Backloggd, link Wikipedia / Nintendo Wiki / Nintendo Store, campo "Developer" (se vuoto vale lo sviluppatore IGDB). Gli aggiornamenti gratuiti non hanno sezioni OpenCritic, Metacritic e Backloggd. Elenco dei link mancanti in `data/manual-todo.md` (`npm run data:validate -- --todo`; `docs/admin-todo.md` è superato). Riquadro **Data sources**: data dell'ultimo aggiornamento di ogni fonte e, nel gioco, prossimo controllo di OpenCritic e Metacritic (soglie in `scripts/lib/refresh-policy.ts`).

### Pubblicazione

Workflow `.github/workflows/update-and-deploy.yml` (fetch notturno, commit dei dati, deploy su GitHub Pages) **sospeso**: workflow disattivato, Pages spento, repository privato. Non riattivarlo senza richiesta esplicita (SPEC §10).

### Dati

- Fonti: IGDB (sviluppatori), OpenCritic, Metacritic (automatico dalle pagine pubbliche, `data:fetch` o `data:fetch-metacritic`), Backloggd (solo a mano dall'admin, opzionale: il sito risponde agli script con una verifica anti-bot), Nintendo Store regione **Italia**.
- File principali: `data/free-updates.json` (aggiornamenti gratuiti), `data/free-updates-seen.json` (snapshot delle novità, da tenere nel repo), `studios.json`.
- `data:validate` segnala gli avvisi sulla qualità dei dati.

## Design system (cosa rispettare in ogni modifica visiva)

Riferimento completo: **`docs/design-tokens.md`**. Leggilo prima di toccare CSS o colori.

- **Due temi, chiaro e scuro.** I colori di tema stanno in `src/styles/tokens.css` su **tre blocchi**: `:root`, `@media (prefers-color-scheme: dark)` e `:root[data-theme="dark"]`. Ogni nuovo colore va scritto in **tutti e tre**. Stessa doppia regola per il tema scuro in `groups.css` e `header.css` (icona del tema); i token dello sfondo del gioco (`--backdrop-*`) stanno in `tokens.css`.
- **Niente valori sparsi:** usa token e variabili CSS, non hex o px scritti nel componente.
- **Testo su riempimento colorato:** sempre `--on-accent` sui token `*-fill` (`--accent-fill`, `--dlc-fill`, `--news-fill`, `--free-update-fill`). I token di base (`--accent`, `--dlc`…) valgono per linee, pallini, bordi e bagliori. `--accent-text` per il testo accent sulle tinte al 16 %.
- **Contrasti:** WCAG AA, 4.5:1 per il testo, in entrambi i temi. `tests/contrast.test.ts` controlla ogni coppia testo/fondo e che i due blocchi scuri coincidano. **Ogni nuova coppia testo/fondo va aggiunta lì.**
- **Mai solo il colore** per trasmettere un'informazione. Focus sempre visibile.
- **Movimento:** rispetta `prefers-reduced-motion` (CSS e JS). Gli effetti decorativi sono spenti di default e statici se riaccesi.
- **Prestazioni:** ogni effetto animato va misurato in fps a 1080p (60 fps a riposo e in scorrimento). Meglio rinunciare a un effetto che far scattare la timeline. Il 4K è rimandato (a densità 2x lo scorrimento scende a 1–3 fps).
- **Densità:** molti elementi vicini, niente sovrapposizioni illeggibili, niente testo tagliato.
- **Evoluzioni, non riscritture,** salvo richiesta esplicita.

## Dove guardare (documenti del flusso)

| File | Contenuto |
|---|---|
| `CLAUDE.md` | Regole e convenzioni del progetto per l'agente |
| `STATUS.md` | Stato corrente, checkpoint, problemi noti, voci "Da verificare nel browser" |
| `docs/SPEC.md` | Specifica funzionale (sezioni numerate: §12 Rankings, §13 aggiornamenti gratuiti, §14 Studios, §15 sfondo stagionale) |
| `docs/design-tokens.md` | Design system attuale |
| `docs/tasks/*.md` | Code di task (le completate restano come storico) |
| `docs/review/*.md` | Revisioni di qualità e `triage.md` (problemi di gravità bassa smistati per gruppo) |
| `data/manual-todo.md` | Link mancanti da inserire a mano (`data:validate -- --todo`; sostituisce `docs/admin-todo.md`) |
| `README.md` | Presentazione del progetto |

In caso di dubbio su una funzione: prima `docs/SPEC.md`, poi il codice.

## Problemi noti da non "scoprire" di nuovo

Se un task li incrocia, citali in "Aperto" invece di risolverli per conto tuo.

- Prestazioni 4K (in pausa; le vecchie modifiche sono archiviate nel tag `archive/wip-perf`, da usare solo su richiesta).
- Card coperte nelle pile (es. Orbitals dietro Pikmin 3 Deluxe): **voluto**, si vede la striscia del titolo e l'hover porta la card davanti (decisione dell'utente, 2026-10-03). Non è un bug.
- Altezze delle card nelle pile stimate, non misurate.
- Riconoscimento del trackpad euristico (da provare su trackpad reali).
- "What's new" mai verificato con due snapshot reali.
- Sfondo stagionale: fps misurati solo in headless (da confermare su monitor reale e in 4K).
- Backloggd quasi tutto N/D (solo a mano); alcuni giochi senza studio in Studios.
