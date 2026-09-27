# Revisione — Pipeline dati: aggiornamenti gratuiti e studi (Task 3)

Data: 2026-09-27 · commit di partenza `0680942` · sola lettura, nessuna correzione applicata.

File letti: `scripts/lib/free-updates.ts`, `scripts/lib/studios.ts`, `scripts/lib/fandom.ts`, `scripts/fetch-free-updates.ts`, `scripts/fetch-studios.ts`, `scripts/lib/http.ts`; in `scripts/lib/build.ts` le righe 150–175 e 262–300 (chiamate a `freeUpdateGames`, `freeUpdatesFirstSeen`, `buildStudios`). Solo con grep: `readJson`/`writeJson` in `scripts/lib/cache.ts`, `sameTitle` e `developer` in `scripts/lib/transform.ts`, `baseTitleOfEdition` in `scripts/lib/links.ts`, `Igdb.query` in `scripts/lib/igdb.ts`, i controlli in `scripts/validate-data.ts`.

Dati controllati con comandi mirati (solo conteggi e nomi): `git ls-files data/cache data/free-updates-seen.json`; con `node -e` le categorie "defunct/former" in `data/cache/studios.json`, i titoli in `data/free-updates.json`, `freeUpdates` e `studiosUnmatched` in `data/fetch-report.json`, i nomi IGDB abbinati in `data/cache/free-updates.json`; con uno script `tsx` temporaneo (fuori dal repo) i giochi il cui sviluppatore corrisponde a uno studio nascosto o chiuso e le collisioni tra nomi normalizzati.

Già noti e non rianalizzati (vedi `docs/review/pages.md`): gioco Switch 1 mostrato per uno studio con gioco Switch 2; gioco mostrato scelto con la data UTC della build (`today` di `build.ts:169`, usato anche da `buildStudios`).

## Riepilogo

| Area | Esito |
|---|---|
| Build senza rete / senza cache | 1 media, 2 bassa |
| Idempotenza | nessun problema (1 bassa sull'effetto collaterale di `freeUpdatesFirstSeen`) |
| Errori di rete negli script di fetch | 3 media |
| Abbinamento studi e doppioni degli aggiornamenti | 2 media, 6 bassa |

**Totale: 16 problemi — 0 alta, 6 media, 10 bassa.**

Controllati senza problemi:
- **Clone pulito**: `data/cache/studios.json`, `data/cache/free-updates.json`, `data/free-updates-seen.json`, `data/free-updates.json` e `data/studios-overrides.json` sono versionati. Anche se mancassero, `data:build` non fa chiamate di rete e non va in errore: `readJson` restituisce il valore di ripiego per ogni file assente (`free-updates.ts:55,64,111`, `studios.ts:45`, `fandom.ts:50`). Unica eccezione voluta: senza `data/cache/igdb.json` la build si ferma con un messaggio chiaro (`build.ts:160`). Gli effetti della cache studi mancante sono descritti sotto.
- **Idempotenza**: gli unici input che la build stessa scrive e rilegge sono `public/data/games.json` (voti e link precedenti) e `data/free-updates-seen.json`; dopo la prima build entrambi si stabilizzano, quindi due build di fila nello stesso giorno danno lo stesso risultato a parte `generatedAt`. Ordinamenti deterministici (`byShownGame` chiude con il nome, `games` con il titolo); nessun uso di `Math.random` o di ordine di iterazione instabile.
- **Limiti di frequenza**: `Throttle` su IGDB (280 ms) e Nintendo Wiki (250 ms); 429 e 5xx ritentati con attesa esponenziale o `Retry-After`. Gli errori IGDB in `fetch-free-updates` fermano lo script prima di scrivere la cache, quindi la cache precedente resta intatta.
- **Dati attuali**: 17 aggiornamenti creati, 2 doppioni corretti (Animal Crossing: New Horizons → Switch 2 Edition, Pokémon Champions), tutti abbinati a IGDB con lo stesso titolo (solo "ARMS" → "Arms"); nessuna collisione tra nomi di studi normalizzati; nessuna categoria "Platformer…" nella cache studi.

## Problemi

### Build senza rete / senza cache

**[media] `scripts/lib/studios.ts:45,57-62` — senza cache degli studi la build riesce ma trasforma gli studi first party in partner, senza avvisi** ✔ corretto in `Data: fetch timeouts, kept links, hidden studios, local build day`
Se `data/cache/studios.json` manca o è vuoto, `byName` è vuota e ogni chiave di `studios-overrides.json` diventa un alias: gli studi Nintendo (EPD, NST, Nintendo Cube…) finiscono tra gli "altri" e, essendo pubblicati da Nintendo, compaiono come "Partner" senza link a Nintendo Wiki. Né il report né `data:validate` segnalano la cache mancante. Oggi non succede perché la cache è versionata.
Correzione: con `cache.studios` vuoto aggiungere un avviso al report (mostrato da `data:validate`), oppure non scrivere `studios.json` in quel caso.

**[bassa] `scripts/lib/cache.ts:56` — un JSON scritto a mano non valido ferma la build con un errore senza nome del file**
`data/free-updates.json` e `data/studios-overrides.json` si modificano a mano; una virgola in più fa fallire `JSON.parse` con un `SyntaxError` che non dice quale file.
Correzione: in `readJson` catturare l'errore e rilanciarlo con il percorso.

**[bassa] `scripts/lib/free-updates.ts:122,154` — le voci di `data/free-updates.json` non sono validate**
Una voce senza `game_release_date` fa fallire la build (`.slice` su `undefined`); una data scritta male (es. `2025-6-5`) passa e finisce in `games.json` come `firstReleaseDate`, ordinata e confrontata come stringa. `overrides.json` ha uno schema (`overrides-schema.ts`), questo file no.
Correzione: controllare in `loadFreeUpdates` titolo non vuoto e date `AAAA-MM-GG`, scartando la voce con un avviso nel report.

### Idempotenza

**[bassa] `scripts/lib/free-updates.ts:63-71` + `scripts/lib/build.ts:277` — `freeUpdatesFirstSeen` scrive un file a metà build**
La funzione, chiamata mentre si costruisce `changes`, scrive `data/free-updates-seen.json` prima di `games.json`: se la build fallisce dopo (es. in `buildStudios`), il file registra come "visto oggi" un aggiornamento che non è mai arrivato nei dati pubblicati. Il risultato resta comunque stabile tra due build, quindi l'effetto è al più un giorno di differenza nella data "New".
Correzione: far restituire alla funzione la mappa aggiornata e scriverla insieme agli altri file a fine build.

### Errori di rete negli script di fetch

**[media] `scripts/lib/http.ts:26-46` — niente timeout, errori di rete non ritentati, JSON non valido senza contesto** ✔ corretto in `Data: fetch timeouts, kept links, hidden studios, local build day`
`fetch` non ha `signal`: una connessione che resta aperta blocca lo script per sempre. Gli errori di rete (DNS, `ECONNRESET`, lanciati da `fetch` come `TypeError`) non passano dal ciclo di tentativi e fanno fallire tutto al primo errore. Una risposta 200 non JSON (pagina HTML di un proxy o di manutenzione) produce un `SyntaxError` senza `label`. Un `Retry-After` molto grande viene atteso senza limite. Vale per entrambi gli script di fetch (e per `data:fetch`).
Correzione: `signal: AbortSignal.timeout(30_000)`, ritentare anche gli errori di `fetch`, avvolgere `res.json()` per aggiungere `label`, limitare l'attesa (es. 60 s).

**[media] `scripts/lib/fandom.ts:92,114,126` + `scripts/fetch-studios.ts:15-22` — gli errori dell'API MediaWiki passano inosservati e una risposta parziale sovrascrive la cache** ✔ corretto in `Data: fetch timeouts, kept links, hidden studios, local build day`
MediaWiki segnala molti errori (parametri, `maxlag`, limiti) con HTTP 200 e un corpo `{ "error": … }`: `res.query` è assente e il codice lo tratta come "nessun risultato". Sulla categoria lo script si ferma ("No pages…"), ma se fallisce una delle richieste delle pagine, quegli studi spariscono in silenzio (`titles.filter((t) => pages.has(t))`) e `fetch-studios` scrive comunque la cache ridotta: alla build successiva gli studi mancanti non compaiono più.
Correzione: in `fetchFirstPartyStudios` lanciare un errore se la risposta ha `error` o se un titolo della categoria non ha pagina; in `fetch-studios` non sovrascrivere se il numero di studi cala rispetto alla cache precedente senza conferma.

**[media] `scripts/fetch-free-updates.ts:20,54-81` + `scripts/lib/free-updates.ts:157-161` — un errore su Wikidata / Wikipedia / Nintendo Wiki cancella i link salvati** ✔ corretto in `Data: fetch timeouts, kept links, hidden studios, local build day`
La cache viene ricostruita da zero (`emptyFreeUpdatesCache()`): se una delle tre fonti di link fallisce, l'errore viene solo stampato e la cache si scrive senza quei link, perdendo quelli del giro precedente. In build gli aggiornamenti gratuiti, a differenza dei giochi normali (`before?.links[key]`, `build.ts:251`), non ripiegano sui link di `games.json`, quindi i pulsanti Wikipedia / Nintendo Wiki / Store spariscono dalle card.
Correzione: in caso di errore di una fonte, copiare nella nuova cache le voci di quella fonte dalla cache precedente.

### Abbinamento degli studi

**[media] `scripts/lib/studios.ts:73-76` — i giochi di uno studio nascosto o chiuso spariscono senza comparire tra i non abbinati** ✔ corretto in `Data: fetch timeouts, kept links, hidden studios, local build day`
Un gioco il cui sviluppatore corrisponde a uno studio della wiki non mostrato (chiuso o `hidden`) non va a nessuno studio e non finisce in `unmatched`, quindi `data:validate` non lo segnala. Oggi: "DK Challenge" e "The Legend of Zelda: Ocarina of Time" (sviluppatore IGDB "Nintendo", nascosto come casa madre). Lo stesso accadrebbe a un gioco nuovo attribuito a uno studio segnato chiuso a mano (es. "Nintendo EPD Smart Device Production Group", chiuso nel 2026).
Correzione: aggiungere questi giochi a `unmatched` (con il nome dello studio non mostrato), così `data:validate` li elenca e si sistemano con `developer` negli override.

**[bassa] `scripts/lib/fandom.ts:55` — `CLOSED` riconosce "former" anche dentro altre parole**
`/defunct|former/i` segna come chiuso uno studio con una categoria come "Platformer developers" o "Performer…". Oggi l'unica categoria che corrisponde è "Defunct companies".
Correzione: `/\b(?:defunct|former)\b/i`.

**[bassa] `scripts/lib/fandom.ts:130` — il campo `defunct` dell'infobox si trova solo a inizio riga**
La regex cerca `| defunct =` all'inizio di una riga: un infobox scritto con più parametri sulla stessa riga non viene letto e lo studio non è segnato come dubbio (`uncertain`).
Correzione: `/\|\s*defunct\s*=([^|}\n]*)/`.

**[bassa] `scripts/lib/studios.ts:51-56` — due studi della wiki con lo stesso nome normalizzato si sovrascrivono**
`byName.set` tiene l'ultimo: se un alias (`igdbNames`) di uno studio chiuso coincide con il nome di uno attivo, o due titoli differiscono solo per punteggiatura o suffisso societario ("Co., Ltd."), i giochi vanno allo studio sbagliato o a nessuno, a seconda dell'ordine alfabetico della cache. Oggi nessuna collisione.
Correzione: preferire lo studio mostrato in caso di collisione e registrarla nel report.

**[bassa] `scripts/fetch-studios.ts:26` + `scripts/lib/studios.ts:58-62` — una pagina rinominata sulla wiki trasforma il suo override in un alias**
`fetch-studios` avvisa solo per le chiavi con `active` assenti dalla categoria. Se la wiki rinomina "Nintendo Cube" o "Nintendo Studios Singapore", l'override (`igdbNames`, `hidden`) diventa in silenzio un alias partner/terze parti: "Nintendo Cube" comparirebbe come Partner senza link.
Correzione: avvisare per ogni chiave degli override che non è una pagina della cache e non ha giochi di partner o terze parti con quel nome.

**[bassa] `scripts/lib/transform.ts:160` — lo sviluppatore è la prima azienda "developer" di IGDB**
Nei giochi sviluppati insieme (es. EPD + Monolith Soft, o uno studio + NST) lo studio assegnato dipende dall'ordine di `involved_companies`, che IGDB non garantisce: tra un fetch e l'altro un gioco può passare da uno studio all'altro.
Correzione: preferire il primo sviluppatore che corrisponde a uno studio mostrato, oppure ordinare le aziende per id prima di scegliere.

### Doppioni e abbinamento degli aggiornamenti gratuiti

**[media] `scripts/fetch-free-updates.ts:41-46` — la ricerca di riserva accetta un gioco diverso con lo stesso anno** ✔ corretto in `Data: fetch timeouts, kept links, hidden studios, local build day`
Se nessun risultato ha lo stesso titolo, viene preso il primo dei 5 risultati della ricerca uscito nello stesso anno del gioco originale, qualunque sia il titolo (IGDB restituisce spesso DLC, raccolte o giochi omonimi). La card riceve copertina, riassunto, sviluppatore e link di un altro gioco, e né il log né `data:validate` lo segnalano (conta solo come "trovato"). Oggi tutti i 19 titoli sono abbinati per titolo.
Correzione: registrare in cache gli abbinamenti per anno come "approssimati" e mostrarli in `data:validate`; in più permettere un `igdbId` esplicito nella voce di `data/free-updates.json`.

**[bassa] `scripts/lib/free-updates.ts:91-93` — i doppioni si riconoscono solo dal titolo**
Falsi positivi: un remake o una nuova uscita con lo stesso titolo del gioco originale (es. "The Legend of Zelda: Ocarina of Time" è già in `games.json`) nasconderebbe l'aggiornamento gratuito del gioco vecchio. Falsi negativi: titoli scritti diversamente ("Pokémon Scarlet and Violet", "Super Mario Galaxy 1 + 2") producono due card per lo stesso gioco. Il confronto avviene anche con i DLC.
Correzione: confrontare prima l'id IGDB abbinato (`cache.matches`) con l'id delle card esistenti e con il gioco base delle Switch 2 Edition, usare il titolo solo come ripiego e ignorare i DLC.

**[bassa] `scripts/lib/free-updates.ts:63-76` — l'id dipende dal titolo scritto a mano**
Correggere un refuso nel titolo in `data/free-updates.json` cambia l'id: gli override di `overrides.json` per quella voce si perdono e "What's new" la mostra come nuova. Le voci rimosse restano per sempre in `free-updates-seen.json`.
Correzione: campo `id` facoltativo nella voce (o alias del vecchio id) e, in build, avviso per gli override `free-update:*` che non corrispondono a nessuna voce.
