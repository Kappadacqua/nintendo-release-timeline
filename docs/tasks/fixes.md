# Coda task — Correzioni dalla revisione

Esegui un solo task per volta, il primo non spuntato. A fine task: typecheck, npm test, commit, aggiorna STATUS.md, spunta il task ([x]) nello stesso commit, report di CLAUDE.md.

Regole:
- Correggi solo i problemi indicati nel task. Se ne noti altri, elencali nel report alla voce "Aperto" senza correggerli.
- Quando correggi un bug con un it.todo corrispondente, trasformalo in test attivo: deve passare.
- Segna i problemi corretti in docs/review/*.md aggiungendo "✔ corretto in <commit>" accanto al titolo.
- Non eseguire i comandi data:fetch*, non fare git push, non toccare wip/perf.

## [x] Task 1 — Studi: gioco mostrato e data della build
Problemi: in docs/review/pages.md, [alta] studio con gioco Switch 2 che mostra un gioco Switch 1; [media] gioco che esce il giorno della build "uscito" per la build ma "in uscita" per la pagina.
Regola: la scelta del gioco da mostrare deve dare la precedenza ai giochi Switch 2, e build e pagina devono usare la stessa regola di data, basata sul fuso locale (come la timeline).
File: scripts/lib/studios.ts, scripts/lib/build.ts (solo le parti pertinenti), src/studios/order.ts e i relativi test.
Verifica: typecheck, npm test (i due it.todo corrispondenti diventano attivi e passano), data:build.

## [x] Task 2 — Pipeline dati: problemi di gravità media
Problemi: tutti quelli di gravità media in docs/review/data.md, esclusi quelli rimandati a pages.md.
File: quelli indicati in data.md per ciascun problema.
Verifica: typecheck, npm test (l'it.todo "giochi di studi nascosti o chiusi tra i non abbinati" diventa attivo e passa), data:build, data:validate. games.json e studios.json non devono cambiare salvo dove la correzione lo richiede: spiega nel report ogni differenza.

## [x] Task 3 — Rankings: voti senza numero di recensioni e altri problemi medi
Regola decisa: se la soglia è maggiore di 0, un voto con numero di recensioni sconosciuto non entra in classifica per quella fonte (né nelle medie). Nella riga mostra "—" al posto del conteggio.
Problemi: la regola sopra, più gli altri problemi di gravità media di docs/review/pages.md non già corretti nel task 1.
File: src/rankings/rank.ts, src/rankings/main.ts, i relativi test; aggiorna SPEC §12 con la regola.
Verifica: typecheck, npm test (l'it.todo senza corpo sui voti senza recensioni diventa un test completo e passa), build.

## [x] Task 4 — Stile: token, riduci movimento, gruppo aggiornamenti
Problemi: i 5 di gravità media in docs/review/static.md (colori --news, palette dei rinvii e #d98200 da spostare in src/styles/tokens.css con varianti per il tema scuro; animazione del titolo nell'header e dell'icona del tema da disattivare con prefers-reduced-motion). In più: la classe card--group-free-update non ha regole CSS; dai al gruppo "N free updates" l'accento verde degli aggiornamenti gratuiti (bordo ed etichetta), coerente con le card e i pallini.
File: src/styles/tokens.css e i CSS indicati in static.md, src/styles/groups.css.
Verifica: typecheck, build. Nel report elenca cosa controllare nel browser.
