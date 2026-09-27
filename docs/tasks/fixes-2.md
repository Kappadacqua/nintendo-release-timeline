# Coda task — Correzioni dalla verifica nel browser e dallo smistamento

Esegui un solo task per volta, il primo non spuntato. A fine task: typecheck, npm test, commit, aggiorna STATUS.md, spunta il task ([x]) nello stesso commit, report di CLAUDE.md.
Regole: correggi solo i problemi indicati; altri problemi vanno nel report alla voce "Aperto". Se la logica è testabile, aggiungi un test. Non eseguire data:fetch*, niente git push, non toccare wip/perf.

## [x] Task 1 — Gruppi dello stesso giorno
File: src/timeline/group.ts, src/timeline/timeline.ts (solo le parti dei gruppi, trovale con grep), src/styles/groups.css, src/styles/dots.css.
- PagGiù dall'ultimo elemento di un gruppo deve selezionare il PRIMO elemento del gruppo successivo nello stesso giorno (oggi arriva al 9° aggiornamento invece che al primo); PagSu simmetrico, sull'ultimo.
- La card selezionata in un ventaglio aperto deve sempre centrarsi sotto l'indicatore, anche per gli ultimi elementi (oggi con Shine Post, ultimo gioco del 5 giugno 2025, resta spostata a sinistra).
- Se nello stesso giorno ci sono un gruppo di giochi e uno di aggiornamenti, il pallino sulla linea e nella minimappa è diviso a metà: colore dei giochi e verde degli aggiornamenti.
- Card del gruppo: "12 free updates" e la data non devono andare a capo (allarga la card o riduci il formato della data).

## [x] Task 2 — Card degli aggiornamenti e filtro esclusive
File: src/cards/card.ts, src/styles/card.css, src/filters.ts.
- La riga "Worldwide · Jun 12, 2025" deve stare unita: oggi "Worldwide" è a sinistra e "· Jun 12, 2025" a destra.
- Nel menu filtri della timeline "Exclusives only" risulta attivo ma il contatore dice "84 games" come se nessun filtro fosse attivo. Verifica se il filtro funziona e se lo stato mostrato è coerente; correggi ciò che non lo è.

## [ ] Task 3 — Pagina Studios
File: src/studios/main.ts, src/styles/studios.css, data/studios-overrides.json.
- Studio con gioco Switch 2 senza data (es. FromSoftware / The Duskbloods): mostra copertina e titolo del gioco con "Release date TBA", non solo il testo.
- La riga "Latest: … · Switch 1" non deve tagliare " · Switch 1": se serve tronca il titolo, non la piattaforma.
- Nascondi "Nintendo Entertainment Planning & Development" (hidden: true, nota: "divisione che raggruppa i team EPD").

## [ ] Task 4 — Sviluppatore nelle correzioni dei giochi
File: scripts/lib/overrides-schema.ts, scripts/lib/overrides.ts, scripts/lib/build.ts (solo dove si applicano gli override), src/admin/main.ts, scripts/lib/studios.ts (commento alla riga ~86).
- Aggiungi il campo developer alle correzioni dei giochi IGDB (games.<id> in data/overrides.json): se presente, sostituisce lo sviluppatore IGDB.
- Aggiungi il campo "Developer" al pannello admin.
- Correggi il commento in studios.ts. Aggiorna docs/admin-todo.md: lo sviluppatore ora si corregge dal pannello.
Verifica anche: data:build (dati invariati finché non si inseriscono correzioni).

## [ ] Task 5 — Smistamento: gruppi 1, 2, 3
Problemi: gruppi 1 (bianco su fondo colorato), 2 (ombre e velo), 3 (reduced motion residui) di docs/review/triage.md.
Decisione per il gruppo 3: con prefers-reduced-motion la barra della presentazione non si anima; mostra solo il contatore (es. "3 / 20").
Nel report elenca cosa controllare nel browser.

## [ ] Task 6 — Smistamento: gruppi 7, 10, 12
Problemi: gruppi 7 (Rankings e filtri), 10 (file di dati scritti a mano), 12 (studi da Nintendo Wiki: regex e avvisi) di docs/review/triage.md.
Decisione per il gruppo 7: il testo "1 of 2 sources" nelle medie è visibile, in piccolo sotto il valore.
Verifica anche: data:build e data:validate.
