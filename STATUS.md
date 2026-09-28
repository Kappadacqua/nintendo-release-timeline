# Stato del progetto

Aggiornato: 2026-09-28 — Correzioni `docs/tasks/fixes-2.md`, task 5 (smistamento gruppi 1, 2, 3)

## Ultimo checkpoint

- `main` @ `58d0ac7` — Docs: README. Code `docs/tasks/*.md` tutte completate.
- Branch `wip/perf`: modifiche interrotte a canvas e sfondo (`main.css` — prima della divisione in file, il merge andrà adattato —, `backdrop.ts`, `config.ts`, `timeline.ts`). **Non verificate**, parcheggiate finché il 4K non torna una priorità.

## Storia recente

- Timeline: iterazione 4 (gruppi, zoom, presentazione) e correzioni fino a `ec1c916`; CSS diviso in `src/styles/` (build identica).
- Nuove pagine Rankings (SPEC §12) e Studios (SPEC §14); aggiornamenti gratuiti Switch 2 come voci `free-update` (SPEC §13): il primo import non genera novità in "What's new".
- Revisione di qualità in `docs/review/` (static, pages, data) con test Vitest; correzioni di media/alta gravità fatte (`docs/tasks/fixes.md`), le basse smistate in `docs/review/triage.md`.
- Documentazione: CLAUDE.md e SPEC allineati al codice, `README.md`, `docs/admin-todo.md` (dati da inserire dal pannello admin).
- Decisioni: store Nintendo regione Italia; prestazioni ottimizzate per 1080p, 4K rimandato.

## Lavoro in corso

Nessuno.

## Da verificare nel browser (Architetto)

Dettagli completi nelle versioni precedenti di questo file (`git show 58d0ac7:STATUS.md`).

- fixes-2 task 5 — Nessun cambio visivo atteso per il testo bianco (badge, nastri DLC, "Out today", tasti delle scorciatoie, pulsanti attivi, date sul canvas nei due temi). Ombre leggermente uniformate: pomello degli interruttori, segmento attivo del menu View, miniatura nell'header, copertine del gruppo chiuso. Velo dietro scorciatoie (?) e ricerca invariato. Admin: "Saved" verde (nel tema scuro ora verde chiaro). Con reduced motion attivo nel sistema: il pomello degli interruttori scatta senza scorrere; in presentazione (P) nessuna barra in basso, al suo posto "3 / 20" sopra la minimappa a destra, aggiornato a ogni gioco e fermo in pausa.
- fixes-2 task 4 — Admin: campo "Developer" nel riquadro di un gioco (segnaposto = sviluppatore IGDB); salvando "Nintendo EPD" su DK Challenge il gioco passa a quello studio in `/studios.html`; svuotare il campo torna allo sviluppatore IGDB.
- fixes-2 task 3 — Studios: FromSoftware mostra copertina e titolo di The Duskbloods con "Release date TBA" (anche Bloober Team, Nitrome; Bplus e GungHo con copertina segnaposto, visibili con le terze parti); "Latest: … · Switch 1" tronca il titolo e lascia " · Switch 1" (provare una card stretta); "Nintendo Entertainment Planning & Development" non compare più (39 studi con terze parti).
- fixes-2 task 2 — Card di un aggiornamento gratuito: "Worldwide · Jun 12, 2025" unito a sinistra. Filtri: con "Exclusives only" attivo il pulsante dice "84 of 84" (non "84 games") e ha il pallino; il filtro oggi non nasconde nulla perché nei dati nessun gioco è su altre console.
- fixes-2 task 1 — Gruppi del 5 giugno 2025: PagGiù da Shine Post → primo aggiornamento (ARMS…), PagSu simmetrico; card selezionata del ventaglio centrata sotto l'indicatore anche per gli ultimi giochi e dopo passaggi rapidi tra i due gruppi; pallino diviso a metà (colore giochi / verde) sulla linea e nella minimappa, anche "upcoming"; card "12 free updates · Jun 5, 2025" su una riga (gruppo largo 240 px, mese abbreviato).

- `90079bb` Stile: token `--news`/`--delayed` in entrambi i temi (badge "New", pallini e tipo "Delayed" di "What's new", badge dei rinvii); reduced motion su titolo in alto a sinistra e icona del tema; gruppo "12 free updates" del 5 giugno 2025 in verde.
- `4e1cc85` Rankings: lista vuota "No games to rank" con soglia alta (senza "Reset filters") vs "No games match these filters"; voti senza numero di recensioni esclusi con soglia > 0 ("—" nel cerchietto).
- `1887abe` Rankings (ordinamento, soglia, medie) e Studios (stato "Upcoming · in N days", ordine) invariati dopo lo spostamento della logica in `rank.ts` e `order.ts`.
- `431ef09` Contatore filtri "N of M" / "M games"; tempi relativi di card selezionata e Studios invariati.
- `b777b44` Pagina Studios: griglia, badge di categoria, "No Switch 2 game yet", "Release date TBA", interruttore terze parti (30 → 40 studi, ricordato), entrambi i temi.
- `d9a4923`, `f7fe841` Free updates: card e pallini verdi, due gruppi separati il 5 giugno 2025 (PagSu/PagGiù tra i ventagli), filtro "Free updates", ricerca ("ARMS"), assenti da Rankings e "What's new"; verde distinguibile da Joy-Con sinistro e tier "weak".
- `b241831`, `1fbc4f6`, `05057bc` Rankings: classifica, "Sort by", "Min. reviews", filtri DLC / Switch 2 Edition / Exclusives / anni, scelte ricordate.
- `6fef242` CSS diviso: nessun cambio visivo atteso.
- `ec1c916` Limite dell'inerzia, chiusura del ventaglio a fine presentazione, card estesa non tagliata nel ventaglio, header aggiornato durante il movimento.

## Problemi noti

1. **Prestazioni solo in 4K** — su 4K a densità 2x lo scorrimento scende a 1–3 fps; su 1080p è fluido (60 fps). **In pausa**: se servirà, partire da `wip/perf`.
2. **Dati manuali mancanti** — Metacritic e Backloggd da compilare dal pannello admin: elenco in `docs/admin-todo.md`.
3. **"What's new"** — mai verificato con due snapshot reali; un nuovo aggiornamento gratuito ("Free update · out <data>") non è verificabile finché non si aggiunge un titolo a `data/free-updates.json`.
4. **`data/free-updates-seen.json`** — va tenuto nel repo: se cancellato, la build tratta tutte le voci come già note (nessuna novità).
5. **Due gruppi nello stesso giorno** — stessa x, separati dalle corsie; ordine da tastiera corretto (fixes-2 task 1), passaggio tra ventagli da verificare nel browser.
6. **Studios: giochi senza studio** — 3 giochi first party senza sviluppatore IGDB, più "DK Challenge" e "Ocarina of Time" (sviluppatore "Nintendo", nascosto). Da correggere dal pannello admin (campo "Developer"), elenco in `docs/admin-todo.md`.
7. **Studios: ordine** — ricalcolato sul gioco *mostrato*: studi senza gioco Switch 2 o con gioco senza data finiscono nel gruppo finale alfabetico.
8. **Studios: gioco fissato alla build** — `studios.json` ha un solo gioco per studio: quando esce, la pagina lo mostra come uscito finché non si rifà `data:build`. Da valutare: scrivere tutti i giochi Switch 2 e scegliere nella pagina.
9. **"Exclusives only" senza effetto sui dati attuali** — tutti gli 84 elementi sono esclusivi o solo Switch + telefoni; 3 giochi (Putty World, Bit Boy!! Arcade 2, Chit Chat Party!) non hanno `onOtherConsoles`, passano perché `exclusive`.
10. **Problemi di gravità bassa** — 22 aperti, smistati in `docs/review/triage.md` (gruppi 1, 2, 3 fatti; restano da fare 7, 10, 12).

## Prossimi task (in ordine)

1. Verifica nel browser delle voci sopra (Architetto).
2. Approvare `docs/review/triage.md` e trasformare i gruppi "fare" in una coda di task.
3. Correzioni emerse dalla verifica, un task per sessione.
