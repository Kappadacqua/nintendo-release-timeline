# Smistamento — problemi di gravità bassa

Data: 2026-09-27 · commit di partenza `234a445` · solo documento.

Fonti: i problemi **[bassa]** non ancora segnati ✔ in `static.md` (11 su 12), `pages.md` (7 su 8) e `data.md` (10 su 10): 28 in tutto. Presenza nel codice ricontrollata con grep prima di smistarli; nessuno risulta già corretto.

## Riepilogo

| # | Gruppo | Problemi | Impegno | Raccomandazione |
|---|---|---|---|---|
| 1 | Stile: bianco su fondo colorato | 3 | piccolo | fare |
| 2 | Stile: ombre e velo | 1 | piccolo | fare |
| 3 | Reduced motion residui | 2 | piccolo | fare |
| 4 | Token dello sfondo | 1 | piccolo | rimandare |
| 5 | Colori dei coriandoli | 1 | piccolo | ignorare |
| 6 | Classi senza CSS e strumentazione di debug | 3 | piccolo | rimandare |
| 7 | Rankings e filtri | 4 | piccolo | fare |
| 8 | Helper condivisi tra le pagine | 2 | medio | rimandare |
| 9 | Ordine degli studi calcolato due volte | 1 | piccolo | rimandare |
| 10 | File di dati scritti a mano | 2 | piccolo | fare |
| 11 | Identità degli aggiornamenti gratuiti | 3 | medio | rimandare |
| 12 | Studi da Nintendo Wiki: riconoscimento e avvisi | 4 | piccolo | fare |
| 13 | Sviluppatore scelto da IGDB | 1 | medio | rimandare |

**13 gruppi: 6 fare, 6 rimandare, 1 ignorare.** Ordine consigliato per i "fare": 3 → 1 → 2 (stessi file CSS e `tokens.css`, 3 e 1 toccano entrambi il pomello di `filters.css`), poi 7, 10, 12.

## Gruppi

### 1. Stile: bianco su fondo colorato — fare, piccolo ✔
- Problemi (`static.md` §2): `#fff` scritto a mano in 12 punti; pomello degli interruttori `#fff` (`filters.css:91`); `#fff` e `#1a8f3c` nel pannello admin.
- File: `tokens.css` (nuovo `--on-accent`), `timeline.ts:932` (`readPalette`), `admin.css`, più una riga in ciascuno di `dlc-card`, `timeline`, `shortcuts`, `header`, `out-today`, `studios`, `card`, `rankings`, `zoom`, `selection`, `filters.css`.
- Motivo: sostituzione meccanica senza cambi visivi che chiude la convenzione "niente colori nei componenti"; supera il limite di file ma è una riga per file.

### 2. Stile: ombre e velo — fare, piccolo ✔
- Problemi (`static.md` §2): 4 ombre `rgb(0 0 0 / …)` e il velo 0.35 identico in due file.
- File: `tokens.css` (`--shadow-sm`, `--overlay`), `header.css`, `filters.css`, `view-menu.css`, `groups.css`, `shortcuts.css`, `search.css`.
- Motivo: il velo duplicato deve restare uguale nei due pannelli; conviene farlo subito dopo il gruppo 1, che tocca già `tokens.css`.

### 3. Reduced motion residui — fare, piccolo ✔
- Problemi (`static.md` §6): pomello degli interruttori con `transition: transform` (`filters.css:93`); barra `presentation-fill` sempre animata (`presentation.ts:96`).
- File: `filters.css`, `presentation.ts`, `presentation.css`.
- Motivo: chiude il problema noto 8 di `STATUS.md`; per la barra va solo deciso "barra statica" o "solo contatore".

### 4. Token dello sfondo — rimandare, piccolo ✔
- Problemi (`static.md` §2): `--backdrop-blur`, `--backdrop-opacity`, `--backdrop-veil` definiti in `backdrop.css:37-53`.
- File: `backdrop.css`, `tokens.css`.
- Motivo: `backdrop.css` è toccato anche da `wip/perf`: spostarli ora complica il merge di quel branch.
- Fatto (polish task 2, 2026-10-03): token in `tokens.css`; velo del tema scuro da 0.06 a 0.5.

### 5. Colori dei coriandoli — ignorare
- Problemi (`static.md` §2): `#ff8a95`, `#b3000e`, `#fff` in `confetti.ts:3`.
- File: `src/cards/confetti.ts`.
- Motivo: effetto decorativo di un istante, uguale in entrambi i temi e già accanto a `var(--red)`; un token in più non porta niente.

### 6. Classi senza CSS e strumentazione di debug — rimandare, piccolo
- Problemi (`static.md` §3, §4): `is-presenting` sul body; modificatori `zoom-day|week|month` e `studio-card--<category>`; `console.log("[wheel]")` sotto `?debug=wheel`.
- File: `presentation.ts`, `timeline.ts:186`, `studios/main.ts:94`, `scroller.ts:238`.
- Motivo: nessun effetto per l'utente (il log parte solo con `?debug=wheel`); da fare solo quando si toccano già questi file, limitando il log a `import.meta.env.DEV`.

### 7. Rankings e filtri — fare, piccolo ✔
- Problemi (`pages.md`): pillola "Critics/Users avg" che non dice quando la media è di una sola fonte; `released` e `today` calcolati in momenti diversi; etichette dei filtri copiate da `filters.ts`; `loadFilters` della timeline non valida i valori salvati.
- File: `src/rankings/main.ts`, `src/filters.ts` (esportare `OPTIONS`, controllo `typeof === "boolean"`), eventualmente `src/rankings/rank.ts` e il suo test.
- Motivo: stessa area e pochi file; la validazione evita un filtro rovinato da un valore salvato non valido. Per la pillola serve decidere il testo ("1 of 2 sources" visibile o solo nell'`aria-label`).

### 8. Helper condivisi tra le pagine — rimandare, medio
- Problemi (`pages.md`): due funzioni di tempo relativo (`studios/main.ts`, `expand.ts`); `el`, `formatDate`, `loadStudios` e avvio della pagina duplicati.
- File: `src/timeline/dates.ts`, `src/cards/expand.ts`, `src/studios/main.ts`, `src/rankings/main.ts`, `src/games.ts` (poi `search.ts`, `whats-new.ts`, `cards/card.ts` per `formatDate`).
- Motivo: solo rifattorizzazione, nessun beneficio visibile e più di 5 file; il tempo relativo ha già i test in `expand` e `order`, quindi si potrà fare in sicurezza quando cambierà la regola.

### 9. Ordine degli studi calcolato due volte — rimandare, piccolo
- Problemi (`pages.md`): la build ordina gli studi e scrive `status`, la pagina riordina e non li usa.
- File: `scripts/lib/studios.ts`, `src/studios/main.ts`, `src/types.ts`.
- Motivo: dopo le correzioni (task 1) le due regole coincidono; resta la duplicazione, da togliere insieme alla decisione sul problema noto 9 (tutti i giochi Switch 2 nel JSON, scelta nella pagina), che riscrive lo stesso codice.

### 10. File di dati scritti a mano — fare, piccolo ✔
- Problemi (`data.md`): un JSON non valido ferma la build senza il nome del file (`cache.ts:56`); le voci di `data/free-updates.json` non sono validate (data mancante o scritta male).
- File: `scripts/lib/cache.ts`, `scripts/lib/free-updates.ts`, `scripts/lib/free-updates.test.ts`.
- Motivo: sono i file che si modificano a mano più spesso e oggi un errore di battitura dà un messaggio incomprensibile o una data sbagliata in `games.json`.

### 11. Identità degli aggiornamenti gratuiti — rimandare, medio
- Problemi (`data.md`): `freeUpdatesFirstSeen` scrive `free-updates-seen.json` a metà build; l'id dipende dal titolo scritto a mano; i doppioni si riconoscono solo dal titolo.
- File: `scripts/lib/free-updates.ts`, `scripts/lib/build.ts`, `scripts/lib/free-updates.test.ts`.
- Motivo: oggi i 17 aggiornamenti sono corretti e l'effetto peggiore è un giorno di differenza nella data "New"; va fatto prima di rinominare una voce o aggiungere titoli ambigui. Attenzione: tocca `free-updates-seen.json`, che non va mai cancellato.

### 12. Studi da Nintendo Wiki: riconoscimento e avvisi — fare, piccolo ✔
- Problemi (`data.md`): `CLOSED` riconosce "former" dentro altre parole; `defunct` letto solo a inizio riga; collisioni tra nomi normalizzati senza avviso; pagina rinominata sulla wiki che trasforma l'override in un alias.
- File: `scripts/lib/fandom.ts`, `scripts/lib/studios.ts`, `scripts/fetch-studios.ts`, `scripts/lib/studios.test.ts`.
- Motivo: le due regex sono correzioni di una riga; gli avvisi rendono visibili errori che oggi passano in silenzio. Le regex agiscono solo al prossimo `data:fetch-studios` (da non eseguire nel task).

### 13. Sviluppatore scelto da IGDB — rimandare, medio
- Problemi (`data.md`): lo sviluppatore è la prima azienda "developer" di `involved_companies`, il cui ordine IGDB non garantisce.
- File: `scripts/lib/transform.ts`, `scripts/lib/studios.ts`.
- Motivo: nessun cambio di studio osservato finora; preferire lo studio mostrato richiede di passare la lista degli studi a `transform`. Da fare se un gioco cambia studio tra due fetch, oppure con un semplice ordinamento per id.
