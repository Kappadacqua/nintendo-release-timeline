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
| `npm test` | Test Vitest (`*.test.ts` accanto ai moduli). Da eseguire a fine task se hai toccato logica coperta dai test (date, tempo relativo della card in `expand.ts`, Rankings, ordine Studios, filtri, gruppi dello stesso giorno, `scripts/lib/studios.ts`, `scripts/lib/free-updates.ts`, `scripts/lib/metacritic.ts`). I bug noti sono `it.todo` con il riferimento a `docs/review/`: quando li correggi, trasformali in `it`. |
| `npm run build` | Typecheck + build di produzione. Da eseguire a fine task se hai toccato config, entry point o import. |
| `npm run data:build` | Rigenera `public/data/games.json` da cache + overrides. Nessuna rete. |
| `npm run data:validate` | Elenca dati mancanti e conflitti. |
| `npm run data:fetch` | Chiamate API reali con quota limitata. **Non eseguirlo mai se il task non lo chiede esplicitamente.** |
| `npm run data:fetch-metacritic` | Rete (pagine pubbliche di Metacritic, 3–6 s tra una e l'altra) per i giochi usciti già nel perimetro → `data/cache/metacritic.json`, poi build e snapshot del giorno. Lo fa anche `data:fetch`. **Solo se il task lo chiede esplicitamente.** |
| `npm run data:fetch-free-updates` | Rete (IGDB, Wikipedia, Nintendo Wiki) per i titoli di `data/free-updates.json` → `data/cache/free-updates.json`. **Solo se il task lo chiede esplicitamente.** |
| `npm run data:fetch-studios` | Rete (Nintendo Wiki) per gli studi first party → `data/cache/studios.json`. Non sovrascrive una cache con più studi: `npm run data:fetch-studios -- --force` per accettare la lista più corta. **Solo se il task lo chiede esplicitamente.** |
| `npm run dev` | Il dev server lo tiene acceso l'utente. **Non avviarlo.** La verifica nel browser la fa l'Architetto. |
| `npm run preview` | Serve la build di `dist/`. Come `dev`, **non avviarlo.** |

## Mappa dei moduli

**`src/timeline/`** — la timeline
- `timeline.ts` (~1250 righe) — orchestrazione della timeline: rendering, posizionamento card, selezione; opzione `vertical` per il mobile (SPEC §16). **File grande.**
- `scroller.ts` (351) — scorrimento: rotella, trascinamento, inerzia, salti, animazioni di movimento.
- `group.ts` — gruppi di uscite nello stesso giorno e ventaglio. `same-day.ts` — ordine da tastiera e colori del pallino per i gruppi dello stesso giorno (senza DOM).
- `minimap.ts` — minimappa, tooltip, riquadro trascinabile.
- `ticks.ts` — tacche e numeri dei giorni. `dates.ts` — utilità sulle date.
- `pinch.ts` — pizzico a due dita per lo zoom (SPEC §16).
- `zoom.ts` — livelli Day/Week/Month. `header.ts` — data nell'header. `site-title.ts` — titolo/gioco selezionato in alto a sinistra.
- `backdrop.ts` — sfondo del gioco selezionato. `tba.ts` — zona TBA. `config.ts` — costanti (spaziature, soglie, durate).

**`src/cards/`** — le card
- `card.ts` — card completa. `compact.ts` — card compatta. `expand.ts` — contenuto della card selezionata.
- `score-ring.ts` — cerchietti dei voti. `flags.ts`, `developer.ts` — date regionali e nome sviluppatore.
- `layout.ts` — dimensioni/collisioni. `appear.ts` — animazione di comparsa. `confetti.ts` — "Out today".

**`src/`** (root)
- `main.ts` — avvio dell'app. `layout.ts` — criterio mobile (timeline verticale, header compatto; media query uguali nel CSS). `mobile.ts` — menu a comparsa e barra in basso (‹ Today ›). `test-utils.ts` — dati minimi per i test. `types.ts` — tipi condivisi (`Game`, `Score`, `Studio`…). `games.ts` — caricamento di `games.json`, condiviso da timeline e Rankings.
- `view.ts` — menu View. `filters.ts` — filtri. `search.ts` — ricerca. `presentation.ts` — modalità presentazione.
- `whats-new.ts`, `news.ts`, `history.ts` — novità, rinvii, storico voti. `zoom-control.ts` — selettore Day/Week/Month.
- `theme/theme.ts` — tema giorno/notte. `admin/` — pannello admin (`main.ts`, `admin.css`; solo sviluppo).
- `styles/main.css` — solo `@import` delle parti, nell'ordine della cascata (non riordinare). Parti in `styles/`: `tokens.css` (`:root` e temi), `base.css`, `header.css`, `timeline.css`, `timeline-items.css`, `card.css`, `dlc-card.css`, `tba.css`, `minimap.css`, `loading.css`, `shortcuts.css`, `selection.css`, `backdrop.css`, `switch2-edition.css`, `out-today.css`, `selection-extras.css` (override su sfondo/selezione, link admin), `filters.css`, `search.css`, `delays.css`, `whats-new.css`, `compact.css`, `view-menu.css`, `dots.css`, `minimap-preview.css`, `groups.css`, `zoom.css`, `presentation.css`, `groups-fan.css` (ventaglio aperto, rivisto), `vertical.css` (timeline verticale), `mobile.css` (header compatto, menu, barra in basso; SPEC §16). `page-mobile.css` (header e pagina su telefono) lo importano Rankings e Studios. `rankings.css` e `studios.css` non sono in `main.css`: li importano le rispettive pagine.

**Pagine** (root): `index.html` (timeline), `rankings.html`, `studios.html`, `admin.html` (solo sviluppo).

**`src/rankings/`** — pagina `/rankings.html`: `main.ts` (pagina, filtri), `rank.ts` (ordinamento e soglia, senza DOM).

**`src/studios/`** — pagina `/studios.html`: `main.ts` (card degli studi, interruttore terze parti), `order.ts` (tempo relativo e ordine, senza DOM).

**`scripts/`** — pipeline dati
- `fetch-data.ts` → rete → `data/cache/`. `build-data.ts` + `lib/build.ts` → `public/data/games.json`, `changes.json` e `studios.json`.
- `fetch-free-updates.ts` → `data/cache/free-updates.json`. `fetch-studios.ts` → `data/cache/studios.json`.
- `fetch-metacritic.ts` → `data/cache/metacritic.json` (solo Metacritic, sui giochi della cache IGDB/Wikipedia).
- `lib/`: `igdb.ts`, `opencritic.ts`, `metacritic.ts` (lettura delle pagine, slug, ricerca), `wikipedia.ts`, `links.ts` (fonti), `transform.ts`, `exclusivity.ts`, `snapshots.ts`, `overrides.ts`, `overrides-schema.ts`, `cache.ts`, `http.ts`, `env.ts` (tutti i percorsi, `PATHS`), `report.ts`.
- `lib/free-updates.ts` — aggiornamenti gratuiti Switch 2 → voci `free-update`. `lib/fandom.ts` — studi da Nintendo Wiki (API MediaWiki). `lib/studios.ts` — costruzione di `studios.json`.
- `validate-data.ts`. `vite-admin.ts` — plugin Vite del pannello admin.

## Come leggere il codice

- Parti dai file indicati nel prompt. Se non ne indica, usa la mappa qui sopra.
- **File grandi** (`timeline.ts`, `scroller.ts`): mai leggerli interi. Cerca prima con grep il simbolo o il selettore, poi leggi solo l'intervallo di righe necessario.
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

- Colori, spaziature e durate come token CSS in `:root` di `styles/tokens.css`, con varianti per tema scuro. Niente colori scritti direttamente nei componenti.
- Costanti di comportamento in `src/timeline/config.ts`.
- Rispettare `prefers-reduced-motion` per ogni nuova animazione.
- Testi dell'interfaccia in inglese.
- Non modificare `docs/SPEC.md` se il task non lo chiede.
- `data/free-updates-seen.json` va versionato e **non va mai cancellato**: senza, la build successiva tratta tutti gli aggiornamenti gratuiti come già noti e "What's new" non ne mostra nessuno.

## Fine di ogni task

1. `npm run typecheck` (e `npm run build` / `npm test` se serve) devono passare.
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
