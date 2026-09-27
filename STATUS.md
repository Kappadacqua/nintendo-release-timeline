# Stato del progetto

Aggiornato: 2026-09-27 — Studios, task 2

## Ultimo checkpoint

- `main` @ `ec1c916` — Inertia cap, presentation stop, fan card fit, live header
- Branch `wip/perf`: modifiche interrotte a canvas e sfondo (`main.css` — prima della divisione in file, il merge andrà adattato —, `backdrop.ts`, `config.ts`, `timeline.ts`). **Non verificate**, parcheggiate finché il 4K non torna una priorità.

## Lavoro in corso

Nessuno.

## Da verificare nel browser (Architetto)

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
6. **Studios: nomi IGDB doppi** — "Konami" e "Konami Digital Entertainment" sono due studi di terze parti distinti in `studios.json` (nessun accorpamento per le terze parti).

## Prossimi task (in ordine)

1. Verifica nel browser delle correzioni di `ec1c916` (Architetto).
2. Correzioni emerse dalla verifica, un task per sessione.

## Decisioni recenti

- Free updates: il primo import (17 voci) non genera novità in "What's new"; solo i titoli aggiunti al file da qui in avanti compaiono come "New" (SPEC §13).
- Prestazioni 4K rimandate: si ottimizza per 1080p.

- Store Nintendo: regione Italia.
- Pagina Rankings: coda completata (`docs/tasks/rankings.md`), specifica in `docs/SPEC.md` §12. Pagina Studios: coda in corso (`docs/tasks/studios.md`), task 1–2 fatti.