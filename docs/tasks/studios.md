# Coda task — Pagina Studios

Da iniziare **solo dopo aver completato `docs/tasks/rankings.md`**.

Esegui **un solo task per volta**, il primo non spuntato. A fine task, oltre a quanto previsto da CLAUDE.md (typecheck, commit, STATUS.md, report), spunta il task qui sotto (`[x]`) nello stesso commit.

L'utente segue il lavoro dal telefono e non può rispondere subito:
- Se manca una decisione, scegli l'opzione più semplice coerente con `docs/SPEC.md` e scrivila nel report alla voce "Aperto". Non fermarti ad aspettare.
- Il dev server è già acceso dall'utente. Se non risponde su http://localhost:5173, riavvialo **in background** e scrivilo nel report.
- Non eseguire `data:fetch` (quote IGDB/OpenCritic), non fare `git push`, non toccare il branch `wip/perf`.
- **Eccezione:** in questa coda puoi eseguire `npm run data:fetch-studios` (creato nel task 1), perché interroga solo l'API pubblica di Nintendo Wiki, senza quote.

## Decisioni già prese (valgono per tutti i task)

- **Fonte degli studi first party:** categoria `Category:First_party_developers` di `nintendo.fandom.com`, letta con l'API MediaWiki di Fandom (`/api.php`, `list=categorymembers`), con uno User-Agent descrittivo. Niente scraping dell'HTML.
- **Studi chiusi o accorpati:** esclusi. Si riconoscono dalle categorie della loro pagina (es. categorie che contengono "Defunct" o "Former"), lette in blocco con `prop=categories` (fino a 50 titoli per chiamata). I casi incerti restano attivi e vanno elencati nel report.
- **Studi di terze parti:** gli sviluppatori di giochi esclusivi presenti in `games.json` che non sono nella lista first party. Nascosti di default, visibili con un interruttore.
- **Gioco mostrato per ogni studio:** il **prossimo in uscita** con data precisa, se esiste; altrimenti **l'ultimo uscito**. Contano giochi e Switch 2 Edition, **non i DLC**.
- **"No Switch 2 game yet":** per gli studi senza nessun gioco disponibile su Switch 2 (nativo o Switch 2 Edition) nel dataset.
- **Ordine:** prima gli studi con un gioco in uscita (data più vicina prima), poi quelli con un gioco uscito (più recente prima), infine quelli senza giochi (alfabetico).
- **Corrispondenza nomi:** i nomi degli studi su Nintendo Wiki e su IGDB possono differire (es. "Nintendo EPD Production Group No. 5"). Corrispondenza automatica con nomi normalizzati, più un file curato per i casi che non combaciano.

---

## [x] Task 1 — Raccolta degli studi da Nintendo Wiki

**Task:** creare lo script che scarica la lista degli studi first party e il file curato per le correzioni manuali.

**File:** nuovi `scripts/fetch-studios.ts`, `scripts/lib/fandom.ts`, `data/studios-overrides.json`. Da modificare: `package.json` (script `data:fetch-studios`). Da riusare: `scripts/lib/http.ts`, `scripts/lib/cache.ts`. Non toccare: `scripts/fetch-data.ts`, `src/`.

**Atteso:**
- `npm run data:fetch-studios` salva in `data/cache/` la lista degli studi con: titolo della pagina, URL, categorie, stato `active` calcolato (vedi decisioni).
- `data/studios-overrides.json` con uno schema semplice per ogni studio: `active` (forza attivo/inattivo), `igdbNames` (nomi alternativi su IGDB), `hidden` (nasconde lo studio). Inizialmente vuoto o con i soli casi evidenti.
- L'output del comando è un riepilogo breve (quanti studi, quanti attivi, quanti incerti), non l'elenco completo.
- Esegui lo script una volta e riporta nel report i numeri e l'elenco dei soli casi incerti.

**Verifica:** typecheck + esecuzione di `npm run data:fetch-studios`.

---

## [x] Task 2 — Dati degli studi per il sito

**Task:** generare `public/data/studios.json` abbinando gli studi ai giochi del dataset.

**File:** `scripts/lib/build.ts` (o un nuovo `scripts/lib/studios.ts` richiamato da `build-data.ts`), `scripts/validate-data.ts`, `src/types.ts` (nuovo tipo `Studio`). Non toccare: `src/timeline/`, `src/cards/`.

**Contesto:** se `games.json` non indica già se un gioco è disponibile su Switch 2, ricavalo dai dati IGDB in `data/cache/` durante la build, senza nuove chiamate di rete.

**Atteso:**
- `npm run data:build` produce anche `public/data/studios.json`. Per ogni studio: nome, URL Nintendo Wiki, `firstParty`, gioco da mostrare (id, titolo, copertina, data, stato Upcoming/Released) oppure nessuno, e `hasSwitch2Game`.
- Include gli studi di terze parti con esclusive (`firstParty: false`).
- `npm run data:validate` elenca gli sviluppatori IGDB dei giochi first party che non corrispondono a nessuno studio: sono i casi da sistemare in `studios-overrides.json`.
- Nel report: numero di studi first party attivi, quanti con un gioco abbinato, e i nomi non abbinati.

**Verifica:** typecheck + `npm run data:build` + `npm run data:validate`.

---

## [x] Task 2b — Categoria "partner"

**Task:** distinguere tra gli studi i partner di Nintendo.

**File:** `scripts/lib/studios.ts`, `scripts/lib/build.ts`, `scripts/lib/fandom.ts`, `scripts/fetch-studios.ts`, `scripts/validate-data.ts`, `src/types.ts`, `data/studios-overrides.json`.

**Atteso:**
- `category` al posto di `firstParty` in `studios.json` e nei tipi: `"first-party"` (categoria Nintendo Wiki), `"partner"` (sviluppa almeno un gioco del dataset pubblicato da Nintendo o The Pokémon Company, dai publisher IGDB in cache), `"third-party"` (solo esclusive di altri editori).
- Gli sviluppatori "Nintendo" (società madre) restano esclusi.
- Alias per partner e terze parti in `data/studios-overrides.json`: una chiave che non è una pagina della wiki è il nome dello studio, i suoi `igdbNames` vengono accorpati (es. "Konami Digital Entertainment" → "Konami").
- Studi senza gioco Switch 2 ma con un gioco Switch 1 nel dataset: anche `latestSwitch1Game`.
- `data:validate`: la sezione dei non abbinati resta vuota o quasi.

**Verifica:** typecheck + `npm run data:build` + `npm run data:validate`.

---

## [x] Task 3 — Pagina Studios

**Task:** creare la pagina Studios.

**File:** nuovi `studios.html`, `src/studios/main.ts`, `src/styles/studios.css`. Da modificare: `vite.config.ts`, l'header di `index.html` e `rankings.html` (navigazione). Da riusare: `src/theme/theme.ts`, il caricamento dati di `src/rankings/main.ts`. Non toccare: `src/timeline/`.

**Atteso:**
- Navigazione "Timeline · Rankings · Studios" su tutte e tre le pagine, pagina attiva evidenziata.
- Una card per studio: nome dello studio (link a Nintendo Wiki, in una nuova scheda), badge "First party" o "Third party", e il gioco mostrato con copertina, titolo, data e stato ("Upcoming · in 26 days" / "Released 3 months ago"). Oppure la scritta "No Switch 2 game yet".
- Interruttore "Show third-party studios", spento di default, salvato nel browser.
- Contatore "N studios".
- Ordine come nelle decisioni. Stile coerente con il sito (token di `tokens.css`).
- Sezione Studios di `docs/SPEC.md` aggiornata: stato "fatto", con le decisioni di questa coda.

**Verifica:** typecheck + build.
