# Coda task — Correzioni dalla verifica di fixes-2

Esegui un solo task per volta, il primo non spuntato. A fine task: typecheck, npm test, commit, aggiorna STATUS.md, spunta il task ([x]) nello stesso commit, report di CLAUDE.md.
Regole: correggi solo i problemi indicati; altri problemi vanno nel report alla voce "Aperto". Se la logica è testabile, aggiungi un test. Non eseguire data:fetch*, niente git push, non toccare wip/perf.

## [x] Task 1 — Collisioni delle card degli aggiornamenti
In modalità Compact, la card di Pikmin 3 Deluxe (aggiornamento gratuito, 31 agosto 2026) copre quella di Orbitals (gioco, 3 settembre 2026). Le card compatte degli aggiornamenti hanno righe in più ("Originally released", "Worldwide") ma il calcolo delle collisioni usa le misure standard.
File: src/cards/layout.ts, src/timeline/timeline.ts (solo il calcolo delle collisioni, trovalo con grep), src/styles/compact.css se serve.
Atteso: il calcolo usa le dimensioni reali di ogni tipo di card, in modalità Full e Compact. Nessuna sovrapposizione.

## [ ] Task 2 — Bordo degli aggiornamenti selezionati e header stretto
- Un aggiornamento gratuito selezionato mostra il bordo rosso della selezione al posto di quello verde. Come per le Switch 2 Edition, la selezione deve aggiungere il bagliore senza coprire il bordo del tipo.
- Con la finestra larga meno di circa 1400 px l'header è affollato e "Nintendo Release Timeline" va su due righe. Il titolo deve restare su una riga fino a 1280 px (la larghezza minima del sito): accorcialo sotto una certa larghezza (es. solo il pallino rosso e "NRT", o nascondi il testo lasciando il pallino) oppure compatta i pulsanti.
File: src/styles/selection.css (o il file che gestisce il bagliore di selezione), src/styles/header.css.
Nel report elenca cosa controllare nel browser.

## [ ] Task 3 — Aggiornamenti gratuiti nel pannello admin
Il filtro "Metacritic / Backloggd" del pannello admin elenca 64 elementi invece di 47: include i 17 aggiornamenti gratuiti come se dovessero avere dei voti. Gli aggiornamenti vanno esclusi da tutti i controlli sui voti (OpenCritic, Metacritic, Backloggd), ma restano nei controlli sui link.
File: src/admin/main.ts.
