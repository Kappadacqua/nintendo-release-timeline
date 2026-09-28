# Revisione — Pagine Rankings e Studios (Task 2)

Data: 2026-09-27 · commit di partenza `11fb742` · sola lettura, nessuna correzione applicata.

File letti: `src/rankings/main.ts`, `src/studios/main.ts`, `src/games.ts`, `src/timeline/dates.ts`, `src/filters.ts`; `docs/SPEC.md` §12 e §14. Per capire da dove arriva `studio.game` letti anche `scripts/lib/studios.ts:44-140` e `scripts/lib/build.ts:169,280-293`; per il numero di recensioni `src/admin/main.ts` e `scripts/lib/overrides-schema.ts` (solo grep). Dati controllati con `node -e` su `public/data/games.json` e `studios.json` (solo conteggi).

## Riepilogo

| Area | Esito |
|---|---|
| Differenze da SPEC | 1 alta, 2 media |
| Casi limite | 1 media, 2 bassa |
| Date e fusi orari | 2 bassa (più il fuso della build dentro il problema media sul gioco mostrato) |
| Logica duplicata | 4 bassa |

**Totale: 12 problemi — 1 alta, 3 media, 8 bassa.**

Controllati senza problemi: soglia a 0 o non numerica (`validMin` scarta NaN, negativi e campo vuoto, arrotonda i decimali, al blur il campo torna al valore in uso); `localStorage` non disponibile o con JSON non valido (tutti gli accessi in try/catch, valori salvati validati; un anno salvato non più presente torna ad "All"); posizioni ricalcolate dopo i filtri; free update mai contati tra i nascosti; lista studi vuota ("No studios to show"); "uscito" e tempi relativi calcolati nel fuso locale con le stesse funzioni della timeline (`parseDay`, `todayEpochDay`, `daySpan`).

## Problemi

### Differenze da SPEC

**[alta] `scripts/lib/studios.ts:88,120` + `src/studios/main.ts:67` — uno studio con un gioco Switch 2 può mostrare un gioco Switch 1** ✔ corretto in `Studios: Switch 2 game first, local build day`
`shownGame(list, today)` sceglie tra *tutti* i giochi dello studio, anche quelli solo Switch 1; la pagina mostra `studio.game` quando `hasSwitch2Game` è vero. Uno studio con un gioco Switch 2 senza data e un gioco Switch 1 datato mostra il gioco Switch 1 al posto di "Release date TBA"; con un gioco Switch 1 più recente o in uscita dopo, mostra quello al posto del gioco Switch 2 (SPEC §14: "prossimo in uscita… altrimenti l'ultimo uscito" tra i giochi Switch 2). Nei dati attuali i 26 giochi mostrati per studi con gioco Switch 2 sono giochi Switch 2 o Switch 2 Edition (controllo su `games.json`, piattaforme IGDB non verificate), ma basta un nuovo gioco Switch 1 nel dataset.
Correzione: in `toStudio` calcolare `game` su `list.filter(info.onSwitch2)` quando `hasSwitch2Game`, sul resto solo per `latestSwitch1Game`.

**[media] `scripts/lib/studios.ts:120-123` + `scripts/lib/build.ts:169` — il gioco mostrato è fissato al momento della build, in UTC** ✔ corretto in `Studios: Switch 2 game first, local build day`
`studios.json` contiene un solo gioco per studio, scelto con la data della build. Quando quel gioco esce, la pagina ricalcola lo stato ("Released 2 days ago") ma continua a mostrarlo anche se lo studio ha già un altro gioco datato in uscita, finché non si rifà `data:build`. In più `today` della build è la data UTC (`toISOString`) e il confronto è `>`: tra mezzanotte e le 2 in Italia la scelta usa il giorno precedente, e un gioco che esce oggi conta come "uscito" per la build ma come "in uscita" per la pagina (`src/studios/main.ts:75`).
Correzione: scrivere in `studios.json` tutti i giochi Switch 2 datati dello studio (id, titolo, copertina, data) e scegliere il gioco nella pagina con `todayEpochDay()`.

**[media] `src/rankings/main.ts:371-374` — "No games match these filters" anche quando la colpa è la soglia** ✔ corretto in `Rankings: unknown review counts, empty list cause`
Il messaggio e il pulsante "Reset filters" compaiono ogni volta che i filtri non sono quelli predefiniti, anche se la lista è vuota per il valore di "Min. reviews" (es. soglia 500 con DLC acceso): il reset non cambia niente e la lista resta vuota. SPEC §12 lo prevede solo per risultati mancanti "per colpa dei filtri".
Correzione: mostrare il messaggio sui filtri solo se `rank(released, …)` con i filtri predefiniti dà almeno un risultato; altrimenti "No games to rank" + riga dei nascosti.

### Casi limite

**[media] `src/rankings/main.ts:165` — voti senza numero di recensioni esclusi con qualsiasi soglia > 0** ✔ corretto in `Rankings: unknown review counts, empty list cause`
`(score.count ?? 0) >= minReviews`: un voto senza `count` vale 0 recensioni. Nel pannello admin il numero di recensioni di Metacritic e Backloggd è facoltativo (`src/admin/main.ts:193-204`, `overrides-schema.ts:59-71`), quindi un voto inserito senza conteggio non entra mai in classifica con la soglia predefinita, e la riga dei nascosti dice "fewer than 20 reviews" per un gioco di cui il numero non si conosce. Oggi solo OpenCritic ha dati, tutti con `count`.
Correzione: decidere la regola (conteggio obbligatorio nell'admin, oppure `count: null` sempre sopra soglia) e, se esclusi, contarli come "no review count" nella riga dei nascosti.

**[bassa] `src/rankings/main.ts:199-205,171` — la pillola "Critics avg" / "Users avg" non dice quando la media è di una sola fonte** ✔ corretto in `Rankings, Data: single-source average, filter validation, hand-written files, wiki studios`
Con una sola fonte sopra soglia la "media" è il voto di quella fonte, e il gioco concorre con quelli che hanno entrambe (conforme a SPEC). Si capisce solo guardando quale cerchietto è evidenziato.
Correzione: aggiungere alla pillola (o all'`aria-label`) l'indicazione "1 of 2 sources" quando `entry.used.length === 1`.

**[bassa] `src/rankings/main.ts:338-339`, `src/studios/main.ts:141` — pagina aperta a cavallo della mezzanotte** ✔ corretto in `Rankings, Data: single-source average, filter validation, hand-written files, wiki studios`
Rankings calcola `released` e gli anni una volta sola al caricamento, mentre `rank()` usa un `todayEpochDay()` nuovo a ogni cambio: un gioco che esce a mezzanotte non compare finché non si ricarica. Studios fissa `today` al caricamento. Stesso comportamento della timeline (`timeline.ts:137`), quindi coerente, ma i due tempi di Rankings non lo sono tra loro.
Correzione: in Rankings calcolare `released` dentro `fillList()` con lo stesso `today`, oppure fissare `today` una volta in `render()` e passarlo a `rank()`.

### Date e fusi orari / logica duplicata

**[bassa] `src/studios/main.ts:59-64` e `src/cards/expand.ts:18-25` — due funzioni di tempo relativo**
Stesse soglie (0, ±1, `daySpan`) con testi diversi ("Upcoming · tomorrow" / "Out tomorrow", "Upcoming · in N" / "Out in N"). I testi diversi sono voluti (SPEC §14), ma se cambia la regola (es. "tomorrow" anche per la timeline, fuso) va cambiata in due posti.
Correzione: funzione condivisa in `src/timeline/dates.ts` che restituisce `{ days, span }` o accetta le etichette, usata da entrambe.

**[bassa] `scripts/lib/studios.ts:132-138` e `src/studios/main.ts:70-82` — ordine degli studi calcolato due volte con regole diverse**
La build ordina con `status` (UTC, oggi = "released"), la pagina riordina con il giorno locale (oggi = "upcoming"). L'ordine in `studios.json` e il campo `status` non sono usati dalla pagina.
Correzione: tenere solo l'ordine della pagina (e togliere `status` dal JSON) oppure documentare che quello della build è solo indicativo.

**[bassa] `src/rankings/main.ts:78-82` e `src/filters.ts:15-21` — etichette e suggerimenti dei filtri copiati** ✔ corretto in `Rankings, Data: single-source average, filter validation, hand-written files, wiki studios`
DLC, Switch 2 Edition ed Exclusives only hanno label e hint riscritti uguali nei due file: una modifica in uno non arriva all'altro.
Correzione: esportare `OPTIONS` da `filters.ts` e prendere in Rankings le voci che servono.

**[bassa] `src/filters.ts:23-30` — i filtri della timeline non validano i valori salvati** ✔ corretto in `Rankings, Data: single-source average, filter validation, hand-written files, wiki studios`
`{ ...DEFAULTS, ...saved }` accetta qualsiasi tipo (es. `"dlc": "false"` stringa è vero); Rankings invece controlla che ogni valore sia booleano (`rankings/main.ts:88`). Stessa esigenza, due livelli di robustezza.
Correzione: stesso controllo `typeof === "boolean"` per ogni chiave anche in `loadFilters`.

**[bassa] Helper duplicati tra le pagine**
`el()` identica in `rankings/main.ts:115`, `studios/main.ts:45` (variante in `cards/card.ts:31`); `formatDate` "Jun 5, 2025" in `rankings/main.ts:127`, `studios/main.ts:53`, `search.ts:11`, `whats-new.ts:9`, `cards/card.ts:57`; `loadStudios` (`studios/main.ts:198`) copia `loadGames` (`games.ts:4`); avvio con messaggio d'errore uguale in fondo a entrambe le pagine.
Correzione: `el` e `formatDate` in un modulo condiviso (es. `src/dom.ts`, `dates.ts`), `loadJson<T>(file)` in `games.ts`.

**[bassa] `docs/SPEC.md` §12 — navigazione ancora "Timeline · Rankings"** ✔ corretto in `Docs: CLAUDE.md and SPEC aligned with code`
§14 dice "Timeline · Rankings · Studios" su tutte e tre le pagine (ed è così nel codice); §12 non è stato aggiornato.
Correzione: allineare la riga di §12 a §14 (task che tocca la SPEC).
