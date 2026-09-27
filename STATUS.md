# Stato del progetto

Aggiornato: 2026-09-27 — Free updates, task 1

## Ultimo checkpoint

- `main` @ `ec1c916` — Inertia cap, presentation stop, fan card fit, live header
- Branch `wip/perf`: modifiche interrotte a canvas e sfondo (`main.css` — prima della divisione in file, il merge andrà adattato —, `backdrop.ts`, `config.ts`, `timeline.ts`). **Non verificate**, parcheggiate finché il 4K non torna una priorità.

## Lavoro in corso

Nessuno.

## Da verificare nel browser (Architetto)

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
4. **Free updates in "What's new"** — le 17 voci risultano tutte "new" in `changes.json` (nessuno snapshot le contiene). Da decidere nel task 3 se va bene o se il primo lotto va escluso.

## Prossimi task (in ordine)

1. Verifica nel browser delle correzioni di `ec1c916` (Architetto).
2. Correzioni emerse dalla verifica, un task per sessione.

## Decisioni recenti

- Prestazioni 4K rimandate: si ottimizza per 1080p.

- Store Nintendo: regione Italia.
- Pagina Rankings: coda completata (`docs/tasks/rankings.md`), specifica in `docs/SPEC.md` §12. Pagina Studios: rimandata.