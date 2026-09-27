# Nintendo Release Timeline — istruzioni per l'agente

Sito desktop personale: una timeline orizzontale dei giochi Nintendo usciti dal 5 giugno 2025 in poi, con voti di critica e pubblico. Dati raccolti da script Node e serviti come JSON statico. Uso solo locale per ora.

## Inizio di ogni sessione

1. Leggi `STATUS.md`: stato attuale, problemi noti, task in corso.
2. Leggi solo il task ricevuto nel prompt e i file che indica.
3. `docs/SPEC.md` è la specifica valida: leggine **solo la sezione pertinente** al task (cerca il titolo con grep), mai tutto il file.

## Stack e comandi

- Vite 7 + TypeScript (vanilla, niente framework UI), GSAP per le animazioni, Fuse.js per la ricerca.
- Script dati in Node + TypeScript eseguiti con `tsx`.

| Comando | Uso |
|---|---|
| `npm run typecheck` | Controllo dei tipi. Da eseguire a fine di ogni task. |
| `npm run build` | Typecheck + build di produzione. Da eseguire a fine task se hai toccato config, entry point o import. |
| `npm run data:build` | Rigenera `public/data/games.json` da cache + overrides. Nessuna rete. |
| `npm run data:validate` | Elenca dati mancanti e conflitti. |
| `npm run data:fetch` | Chiamate API reali con quota limitata. **Non eseguirlo mai se il task non lo chiede esplicitamente.** |
| `npm run dev` | Il dev server lo tiene acceso l'utente. **Non avviarlo.** La verifica nel browser la fa l'Architetto. |

## Mappa dei moduli

**`src/timeline/`** — la timeline
- `timeline.ts` (1082 righe) — orchestrazione della timeline: rendering, posizionamento card, selezione. **File grande.**
- `scroller.ts` (351) — scorrimento: rotella, trascinamento, inerzia, salti, animazioni di movimento.
- `group.ts` — gruppi di uscite nello stesso giorno e ventaglio.
- `minimap.ts` — minimappa, tooltip, riquadro trascinabile.
- `ticks.ts` — tacche e numeri dei giorni. `dates.ts` — utilità sulle date.
- `zoom.ts` — livelli Day/Week/Month. `header.ts` — data nell'header. `site-title.ts` — titolo/gioco selezionato in alto a sinistra.
- `backdrop.ts` — sfondo del gioco selezionato. `tba.ts` — zona TBA. `config.ts` — costanti (spaziature, soglie, durate).

**`src/cards/`** — le card
- `card.ts` — card completa. `compact.ts` — card compatta. `expand.ts` — contenuto della card selezionata.
- `score-ring.ts` — cerchietti dei voti. `flags.ts`, `developer.ts` — date regionali e nome sviluppatore.
- `layout.ts` — dimensioni/collisioni. `appear.ts` — animazione di comparsa. `confetti.ts` — "Out today".

**`src/`** (root)
- `main.ts` — avvio dell'app. `types.ts` — tipi condivisi (`Game`, `Score`…).
- `view.ts` — menu View. `filters.ts` — filtri. `search.ts` — ricerca. `presentation.ts` — modalità presentazione.
- `whats-new.ts`, `news.ts`, `history.ts` — novità, rinvii, storico voti. `zoom-control.ts` — selettore Day/Week/Month.
- `theme/theme.ts` — tema giorno/notte. `admin/` — pannello admin (solo sviluppo).
- `styles/main.css` (2548 righe) — **tutto il CSS**, token in `:root`. **File grande.**

**`scripts/`** — pipeline dati
- `fetch-data.ts` → rete → `data/cache/`. `build-data.ts` + `lib/build.ts` → `public/data/games.json`.
- `lib/`: `igdb.ts`, `opencritic.ts`, `wikipedia.ts`, `links.ts` (fonti), `transform.ts`, `exclusivity.ts`, `snapshots.ts`, `overrides.ts`, `overrides-schema.ts`, `cache.ts`, `http.ts`, `env.ts`, `report.ts`.
- `validate-data.ts`. `vite-admin.ts` — plugin Vite del pannello admin.

## Come leggere il codice

- Parti dai file indicati nel prompt. Se non ne indica, usa la mappa qui sopra.
- **File grandi** (`timeline.ts`, `main.css`, `scroller.ts`): mai leggerli interi. Cerca prima con grep il simbolo o il selettore, poi leggi solo l'intervallo di righe necessario.
- Per capire chi usa una funzione, cerca il nome con grep invece di aprire i file uno a uno.
- Se per completare il task devi toccare file o aree non indicati nel prompt, fermati e segnalalo nel report invece di esplorare.

## Da non leggere

Contengono dati generati, pesanti e inutili per lo sviluppo:

- `data/cache/`, `data/snapshots/`, `data/backups/`, `data/fetch-report.json`, `data/sample-games.json`
- `public/data/`, `public/covers/`, `dist/`
- `package-lock.json`
- `docs/archive/` (vecchi brief superati da `docs/SPEC.md`)

Se ti serve un'informazione sui dati (es. i campi di un gioco), estraila con un comando mirato (`grep`, `node -e`, `jq` se presente) che stampi poche righe.

## Convenzioni

- Colori, spaziature e durate come token CSS in `:root` di `main.css`, con varianti per tema scuro. Niente colori scritti direttamente nei componenti.
- Costanti di comportamento in `src/timeline/config.ts`.
- Rispettare `prefers-reduced-motion` per ogni nuova animazione.
- Testi dell'interfaccia in inglese.
- Non modificare `docs/SPEC.md` se il task non lo chiede.

## Fine di ogni task

1. `npm run typecheck` (e `npm run build` se serve) devono passare.
2. Commit con messaggio `Area: descrizione breve` (es. `Timeline: cap canvas DPR`). Un commit per task.
3. Aggiorna `STATUS.md`: sposta il task tra quelli "da verificare", aggiungi problemi noti emersi.
4. Rispondi **solo** con questo report:

```
Fatto: <1–3 righe>
File: <elenco dei file modificati>
Verifica: <comandi eseguiti ed esito>
Da verificare nel browser: <cosa deve controllare l'Architetto>
Aperto: <problemi o dubbi, oppure "niente">
```

## Se il contesto sta per finire

Non iniziare nuove modifiche. Scrivi in `STATUS.md`, sezione "Lavoro in corso", cosa è fatto, cosa manca e quali file hai toccato. Poi salva su un branch: `git switch -c wip/<nome-task>` e commit con prefisso `WIP:`. Mai commit con typecheck rotto su `main`.
