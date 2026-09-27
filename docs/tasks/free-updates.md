# Coda task — Aggiornamenti gratuiti Switch 2

Esegui **un solo task per volta**, il primo non spuntato. A fine task, oltre a quanto previsto da CLAUDE.md (typecheck, commit, STATUS.md, report), spunta il task qui sotto (`[x]`) nello stesso commit.

L'utente segue il lavoro dal telefono e non può rispondere subito:
- Se manca una decisione, scegli l'opzione più semplice coerente con `docs/SPEC.md` e scrivila nel report alla voce "Aperto". Non fermarti ad aspettare.
- Il dev server è già acceso dall'utente. Se non risponde su http://localhost:5173, riavvialo **in background** e scrivilo nel report.
- Non eseguire `data:fetch`, non fare `git push`, non toccare il branch `wip/perf`.
- **Eccezione:** in questa coda puoi eseguire `npm run data:fetch-free-updates` (creato nel task 1): interroga IGDB solo per i titoli di `data/free-updates.json` (una o due richieste in blocco) e le fonti pubbliche già usate per i link.

## Il file di partenza

`data/free-updates.json` è curato a mano dall'utente (fonte: pagina Nintendo "games with free updates"). Contiene `source`, `description`, `count` e `games`: 19 voci con `title`, `game_release_date` (uscita originale su Switch 1), `switch_2_update_date`, `type` (`free_update`), `store_url` (store USA). **Una sola data per aggiornamento**, senza date per regione.

## Decisioni già prese (valgono per tutti i task)

- **Nuovo tipo `free-update`** nei dati, accanto a `game`, `switch2-edition`, `dlc`. Posizionato sulla timeline alla `switch_2_update_date`.
- **Niente voti**: la card non ha la sezione Critics/Users. Esclusi da Rankings e Studios.
- **Una sola data**: al posto delle tre bandiere, una riga "Worldwide · Jun 5, 2025". In più, in piccolo, "Originally released 2017".
- **Doppioni**: se nel dataset esiste già una voce dello stesso gioco (stesso titolo normalizzato, es. *Animal Crossing: New Horizons* ha già una Switch 2 Edition, *Pokémon Champions* è già un gioco), l'aggiornamento gratuito **non** crea una card separata. Elencali nel report.
- **Gruppi**: il 5 giugno 2025 ha 10 aggiornamenti oltre agli 8 giochi. Gli aggiornamenti gratuiti dello stesso giorno formano un **gruppo separato** da quello dei giochi, con etichetta "N free updates".
- **Filtro "Free updates"**: acceso di default.
- **Store**: se la logica esistente trova il link allo store italiano, usa quello; altrimenti usa `store_url` del file.

---

## [x] Task 1 — Dati degli aggiornamenti gratuiti

**Task:** trasformare `data/free-updates.json` in voci di tipo `free-update` dentro `public/data/games.json`.

**File:** nuovo `scripts/fetch-free-updates.ts`; da modificare `package.json` (script `data:fetch-free-updates`), `scripts/lib/build.ts` (o un nuovo `scripts/lib/free-updates.ts` richiamato dalla build), `src/types.ts` (nuovo valore di `kind` e campi opzionali). Da riusare: `scripts/lib/igdb.ts`, `scripts/lib/links.ts`, `scripts/lib/cache.ts`. Non toccare: `scripts/fetch-data.ts`, `src/timeline/`, `src/cards/`.

**Atteso:**
- `npm run data:fetch-free-updates` salva in `data/cache/` per ogni titolo: id IGDB del gioco originale, copertina, riassunto, link Wikipedia e Nintendo Wiki. Output del comando: un riepilogo breve (trovati / non trovati).
- `npm run data:build` aggiunge le voci `free-update` a `games.json`, con: titolo, data dell'aggiornamento come `firstReleaseDate`, anno di uscita originale, copertina, riassunto, link (store secondo le decisioni). Nessun voto.
- Doppioni esclusi come da decisioni.
- `npm run data:validate` segnala le voci senza copertina.
- Nel report: quante voci create, quali escluse come doppioni, quali senza copertina.

**Verifica:** typecheck + `npm run data:fetch-free-updates` + `npm run data:build` + `npm run data:validate`.

---

## [x] Task 2 — Card e timeline

**Task:** mostrare gli aggiornamenti gratuiti sulla timeline con una card dedicata.

**File:** `src/cards/card.ts`, `src/cards/compact.ts`, `src/cards/expand.ts`, `src/timeline/group.ts`, i CSS pertinenti in `src/styles/` (es. `card.css`, `dots.css`, `groups.css`, `tokens.css`). Cerca con grep dove viene gestito `kind === 'dlc'` per trovare gli altri punti da estendere, senza leggere interi i file grandi.

**Atteso:**
- **Card completa e compatta**: copertina, titolo, badge "Free update", riga "Worldwide · data", "Originally released AAAA". Nessuna sezione voti.
- **Card selezionata**: riassunto, "Out today" / "Released X ago" / "Out in X days" come le altre, pulsanti Wikipedia, Nintendo Wiki, Store.
- **Colore dedicato** per bordo della card e pallino (linea e minimappa): un nuovo token in `tokens.css`, ben distinto da gioco, DLC e Switch 2 Edition in entrambi i temi.
- **Gruppi separati**: gli aggiornamenti dello stesso giorno formano un gruppo "N free updates", distinto da quello dei giochi (vedi decisioni).
- Legenda dei pallini nel pannello di aiuto "?" aggiornata.

**Verifica:** typecheck + build.

---

## [ ] Task 3 — Filtro e resto del sito

**Task:** integrare gli aggiornamenti gratuiti nei filtri e verificarne l'esclusione dalle altre pagine.

**File:** `src/filters.ts`, `src/rankings/main.ts`, `src/search.ts`, `src/whats-new.ts` (solo se serve). Non toccare: `src/timeline/`, `src/cards/`.

**Atteso:**
- Nuovo interruttore **"Free updates"** nel menu filtri della timeline, **acceso di default**, salvato come gli altri. Il contatore "N of M games" tiene conto degli aggiornamenti.
- **Rankings**: gli aggiornamenti gratuiti non compaiono mai e non entrano nel conteggio dei giochi nascosti.
- **Ricerca**: gli aggiornamenti si trovano e sono indicati come "Free update" nei risultati.
- **What's new**: un nuovo aggiornamento aggiunto al file compare come novità, con etichetta "New".
- `docs/SPEC.md`: nuova sezione "Free updates" con le decisioni di questa coda.

**Verifica:** typecheck + build.
