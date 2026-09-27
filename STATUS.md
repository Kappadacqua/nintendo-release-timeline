# Stato del progetto

Aggiornato: 2026-09-27 — Correzioni, task 2 (pipeline dati, problemi medi)

## Ultimo checkpoint

- `main` @ `ec1c916` — Inertia cap, presentation stop, fan card fit, live header
- Branch `wip/perf`: modifiche interrotte a canvas e sfondo (`main.css` — prima della divisione in file, il merge andrà adattato —, `backdrop.ts`, `config.ts`, `timeline.ts`). **Non verificate**, parcheggiate finché il 4K non torna una priorità.

## Lavoro in corso

Nessuno.

## Da verificare nel browser (Architetto)

- Correzioni, task 2 (niente da vedere nel browser: `games.json`, `studios.json` e `changes.json` identici a parte `generatedAt`). Pipeline: `fetchJson` con timeout di 30 s, ritenta anche gli errori di rete, errore con nome della fonte per JSON non valido, `Retry-After` limitato a 60 s. `data:fetch-studios` si ferma sugli errori MediaWiki e su pagine mancanti, e non sovrascrive una cache con meno studi senza `-- --force`. `data:fetch-free-updates` tiene i link della cache precedente se una fonte fallisce, segna gli abbinamenti "solo per anno" e accetta `igdbId` nelle voci di `data/free-updates.json`. `data:validate` ora elenca "Nintendo (hidden studio) — DK Challenge, The Legend of Zelda: Ocarina of Time" e segnala la cache studi vuota. La build usa il giorno locale anche per "released", storico voti e "What's new". Gli script di fetch non sono stati eseguiti: le nuove strade di errore sono provate solo con un server locale.

- Correzioni, task 1 (`docs/tasks/fixes.md`): in `studios.json` il gioco di uno studio è scelto solo tra i giochi Switch 2 (quelli senza gioco Switch 2 hanno `game: null`, prima avevano il gioco Switch 1); la build usa il giorno locale e conta come "upcoming" un gioco che esce oggi, come la pagina. Nella pagina Studios non è atteso nessun cambio visivo con i dati attuali: EPD No. 4, TNX, Wonderfy, Artdink restano "No Switch 2 game yet" + "Latest: … · Switch 1".

- Revisione, task 4: Vitest (`npm test`, 51 test + 6 `it.todo`). Logica pura spostata senza cambiarla in `src/rankings/rank.ts` e `src/studios/order.ts`: controllare che Rankings (ordinamento, soglia, medie) e Studios (stato "Upcoming · in N days", ordine) funzionino come prima. I 6 `todo` sono i bug noti di `docs/review/pages.md` e `data.md`: quando si correggono, `it.todo` → `it`.

- Revisione, task 3 (solo documento, niente da vedere nel browser): `docs/review/data.md` — 16 problemi (0 alta, 6 media, 10 bassa) da smistare in task di correzione. `data:build` funziona senza rete e senza cache ed è idempotente; i rischi principali sono negli script di fetch (niente timeout, errori MediaWiki non riconosciuti, link degli aggiornamenti gratuiti persi se una fonte fallisce).

- Revisione, task 2 (solo documento, niente da vedere nel browser): `docs/review/pages.md` — 12 problemi (1 alta, 3 media, 8 bassa) da smistare in task di correzione. Alta: uno studio con gioco Switch 2 può mostrare un gioco Switch 1 (`scripts/lib/studios.ts`).

- Revisione, task 1 (solo documento, niente da vedere nel browser): `docs/review/static.md` — 17 problemi (0 alta, 5 media, 12 bassa) da smistare in task di correzione. Coda in `docs/tasks/review.md`.

- Pulizia: contatore dei filtri della timeline "N of M" (senza "games") quando un filtro nasconde qualcosa; senza filtri resta "M games". In "What's new" un nuovo aggiornamento gratuito mostra "Free update · out <data>" (non verificabile finché non si aggiunge un titolo a `data/free-updates.json`). Tempi relativi di card selezionata e pagina Studios invariati (helper `daySpan` ora in `src/timeline/dates.ts`).

- Studios, task 3: pagina `/studios.html`, navigazione "Timeline · Rankings · Studios" su tutte e tre le pagine. Griglia di card: nome (link a Nintendo Wiki in nuova scheda solo per i first party), badge First party (rosso) / Partner (rosso tenue) / Third party (grigio), copertina, titolo, data, stato "Upcoming · in N days" (in rosso) o "Released N months ago". Senza gioco Switch 2: riquadro tratteggiato "No Switch 2 game yet" + "Latest: <titolo> · Switch 1" (EPD No. 4, TNX, Wonderfy, Artdink); con gioco Switch 2 senza data: "Release date TBA" (FromSoftware, Bloober Team…). Interruttore "Show third-party studios" spento di default (30 studi → 40 acceso), ricordato al ricaricamento; dissolvenza al cambio. Entrambi i temi.

- Studios, task 2b (solo dati, niente da vedere nel browser): `studios.json` ha `category` al posto di `firstParty`: 15 first-party, 15 partner (HAL, Game Freak, Intelligent Systems, FromSoftware…), 10 third-party. Alias in `studios-overrides.json`: "Konami Digital Entertainment" → "Konami". `latestSwitch1Game` per 4 studi (EPD No. 4, TNX, Wonderfy, Artdink). `data:validate` riporta solo 3 giochi first party senza sviluppatore IGDB (Nintendo Switch Sports Resort, Pikmin 4 S2 Edition, Hyrule Warriors: Age of Calamity DE).

- Studios, task 2 (solo dati, niente da vedere nel browser): `npm run data:build` scrive anche `public/data/studios.json` (15 studi first party attivi, 10 con un gioco; 24 di terze parti con esclusive). `data:validate` elenca 15 sviluppatori first party non abbinati (HAL, Game Freak, Intelligent Systems…: non sono nella categoria di Nintendo Wiki, quindi finiscono tra le terze parti). Nascosti: "Nintendo" (casa madre, i suoi giochi non vanno a nessuno studio) e "Nintendo Studios Singapore" (possibile controllata Bandai Namco, da verificare). "Nintendo Cube" ↔ IGDB "NDCube".

- Studios, task 1 (solo dati, niente da vedere nel browser): `npm run data:fetch-studios` → `data/cache/studios.json` (29 pagine della categoria, 17 attive dopo le correzioni). `data/studios-overrides.json`: 11 studi segnati chiusi perché l'infobox ha una data `defunct` ma nessuna categoria "Defunct"/"Former". Da rivedere: "Nintendo" (casa madre, non uno studio), "Nintendo Studios Singapore" (categoria "Bandai Namco subsidiaries").

- Free updates, task 3: interruttore "Free updates" nel menu filtri (acceso di default, ricordato al ricaricamento; spento nasconde card, pallini e gruppo del 5 giugno; il contatore "N of M games" cambia); nessun aggiornamento in Rankings né nella riga dei nascosti; ricerca (es. "ARMS") li trova con "Free update · data"; "What's new" non mostra i 17 aggiornamenti attuali.

- Free updates, task 2: card verde (bordo, badge "Free update", riga "Worldwide · Jun 5, 2025", "Originally released AAAA" sotto il titolo, niente voti); selezionata con tempo relativo, riassunto e pulsanti Wikipedia / Nintendo Wiki / Store; pallini verdi su linea e minimappa, anche il pallino grande del gruppo di soli aggiornamenti; il 5 giugno 2025 due gruppi separati ("8 games" e "12 free updates") nello stesso giorno, PagSu/PagGiù passano da un ventaglio all'altro; legenda "?" con la nuova voce. Controllare che il verde (`--free-update`) si distingua da Joy-Con sinistro e dal tier "weak" dei voti in entrambi i temi.

- Free updates, task 1 (solo dati): 17 voci `kind: "free-update"` in `games.json` (id `free-update:<titolo>`), cache in `data/cache/free-updates.json`. Finché non c'è il task 2 appaiono sulla timeline come card normali senza voti. Esclusi come doppioni: Animal Crossing: New Horizons (ha la Switch 2 Edition), Pokémon Champions.

- Rankings, task 3: barra filtri sotto il titolo (interruttori DLC off / Switch 2 Edition on / Exclusives only off, anni All·2025·2026) con contatore "N games ranked" a destra; posizioni ricalcolate; con filtri che non danno risultati, riquadro "No games match these filters" + "Reset filters"; filtri ricordati al ricaricamento e indipendenti da quelli della timeline.

- Rankings, task 2: selettore "Sort by" (6 fonti) e campo "Min. reviews" (predefinito 20) sopra la lista; quattro cerchietti per riga con quello usato evidenziato (bordo colorato), pillola con la media per Critics/Users average; riga dei nascosti aggiornata; scelte ricordate al ricaricamento; breve dissolvenza al cambio.

- Rankings, task 1: pagina `/rankings.html` con classifica OpenCritic (soglia 20 recensioni, 21 giochi oggi), riga dei giochi nascosti, navigazione "Timeline · Rankings" nell'header di entrambe le pagine (prima dei pulsanti), tema condiviso, animazione di comparsa e riempimento dei cerchietti.

- CSS diviso in file per componente (`src/styles/`): build CSS identica byte per byte, nessun cambio visivo atteso.
- `ec1c916`: limite dell'inerzia, chiusura del ventaglio a fine presentazione, card estesa non tagliata nel ventaglio, header aggiornato durante il movimento.

## Problemi noti

1. **Prestazioni solo in 4K** — su schermo 4K a densità 2x (3840×1943) lo scorrimento scende a 1–3 fps. Su 1080p (1880×903, densità 1x) il sito è fluido: 60 fps a riposo e in scorrimento. **In pausa**: l'utente usa uno schermo 1080p. Se servirà, partire da `wip/perf` (limite di risoluzione del canvas, sfondo sfocato più leggero).
2. **Dati manuali mancanti** — Metacritic e Backloggd non compilati per la maggior parte dei giochi (si inseriscono dal pannello admin).
3. **"What's new"** — mai verificato con due snapshot reali.
4. **Free updates in "What's new"** — `data/free-updates-seen.json` è stato generato dalla build e va tenuto nel repo: se viene cancellato, la build successiva tratta di nuovo tutte le voci come già note (nessuna novità).
5. **Due gruppi nello stesso giorno** — il gruppo dei giochi e quello degli aggiornamenti hanno la stessa x: la disposizione in corsie li separa, ma il passaggio da un ventaglio aperto all'altro non è mai stato provato.
6. **Studios: giochi senza sviluppatore** — 3 giochi first party non hanno sviluppatore su IGDB e non vanno a nessuno studio (si sistemano con `developer` negli override dei giochi).
7. **Studios: ordine** — l'ordine è ricalcolato nella pagina sul gioco *mostrato*: gli studi senza gioco Switch 2 e quelli con gioco Switch 2 senza data finiscono nel gruppo finale alfabetico.
8. **Reduced motion incompleto** — titolo in alto a sinistra (`header.css:43`) e icona del tema (`theme.ts:44`) si muovono anche con `prefers-reduced-motion` (dettagli in `docs/review/static.md`).
9. **Studios: gioco mostrato fissato alla build** — `studios.json` contiene un solo gioco per studio, scelto con il giorno locale della build: quando esce, la pagina lo mostra come uscito anche se lo studio ha già il gioco successivo, finché non si rifà `data:build`. Il fuso UTC è corretto (fixes, task 1); resta da valutare se scrivere tutti i giochi Switch 2 e scegliere nella pagina.
10. **Studios: giochi di studi nascosti** — "DK Challenge" e "The Legend of Zelda: Ocarina of Time" (sviluppatore IGDB "Nintendo", nascosto) non vanno a nessuno studio; ora `data:validate` li elenca, si sistemano con `developer` negli override dei giochi.
11. **`data:validate` in UTC** — `scripts/validate-data.ts:13` calcola ancora `today` in UTC, mentre la build usa il giorno locale: tra mezzanotte e le 2 i controlli sui voti manuali possono usare il giorno prima.

## Prossimi task (in ordine)

0. Smistare i problemi di `docs/review/` in task di correzione (coda `docs/tasks/review.md` completata).
1. Verifica nel browser delle correzioni di `ec1c916` (Architetto).
2. Correzioni emerse dalla verifica, un task per sessione.

## Decisioni recenti

- Free updates: il primo import (17 voci) non genera novità in "What's new"; solo i titoli aggiunti al file da qui in avanti compaiono come "New" (SPEC §13).
- Prestazioni 4K rimandate: si ottimizza per 1080p.

- Store Nintendo: regione Italia.
- Pagina Rankings: coda completata (`docs/tasks/rankings.md`), specifica in `docs/SPEC.md` §12. Pagina Studios: coda completata (`docs/tasks/studios.md`), specifica in `docs/SPEC.md` §14.