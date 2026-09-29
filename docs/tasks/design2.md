# Coda design 2 — rifiniture dopo la verifica della coda design

Fonte: verifica nel browser del Web Designer (2026-09-29) sui risultati di `docs/tasks/design.md`.

## Regole della coda

- Un task per sessione, nell'ordine. Esegui il primo task non spuntato.
- A fine task: typecheck, `npm test`, commit, riga in `STATUS.md`, poi **spunta la casella del task in questo file** (`- [ ]` → `- [x]`) nello stesso commit.
- Niente `data:fetch`, niente `git push`, non toccare il branch `wip/perf`, non modificare `src/styles/backdrop.css`.
- Report fisso: Fatto / File / Verifica / Da verificare nel browser / Aperto.

---

- [x] **Task 1 — Tre rifiniture visive: icona del tema, indicatore sopra la pillola, hover dei pulsanti della card**

**File**
- Da cui partire: `src/styles/header.css` (regole `.theme-toggle__sun` / `.theme-toggle__moon`), `src/styles/timeline.css:90-96` (`.timeline__playhead`), `src/timeline/ticks.ts` (posizione e misure della pillola), `src/styles/selection.css` (`.card-button:hover`).
- Da non toccare: `src/theme/theme.ts`, lo script inline dei temi negli HTML, i token.

**Contesto / decisioni**

1. **Icona del tema all'avvio.** Verificato: con il sistema in tema scuro e nessuna scelta salvata, senza `data-theme` si vede il sole invece della luna. Oggi la visibilità dipende solo dall'attributo.
   - Aggiungi la stessa regola della luna dentro `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }`: luna visibile, sole nascosto. È lo stesso schema a doppia regola già usato in `tokens.css`.
   - Resta valida la regola ad attributo esistente per `:root[data-theme="dark"]`.

2. **Linea dell'indicatore sopra la pillola del giorno** (effetto del Task 4). Nel tema scuro la pillola ora è `--accent-fill` `#cc2433`. La linea verticale dell'indicatore (`--accent` `#ff4d5a` al 45 %) le passa sopra e attraversa il numero. Nel chiaro non si vede solo perché i due rossi coincidono.
   - Interrompi la linea dell'indicatore in corrispondenza della pillola con una `mask-image` su `.timeline__playhead`: trasparente da (bordo superiore della pillola − 3 px) a (bordo inferiore della pillola + 3 px), opaca altrove.
   - Ricava la posizione della pillola dalle stesse costanti di `ticks.ts` (niente numeri duplicati a mano: esporta la costante o calcolala in un punto solo e passala come custom property, es. `--pill-top` / `--pill-bottom`).
   - La sfumatura attuale della linea (gradiente tra 12 % e 88 %) resta invariata.

3. **Hover dei pulsanti della card.** `brightness(1.1)` sul rosso chiaro porta il contrasto a 4.05:1 (sotto AA).
   - Sostituisci con `filter: brightness(0.9)` in entrambi i temi. Contrasto con `#fff`: chiaro 5.74, scuro 6.39.
   - Transizione invariata.

**Atteso**
- Luna visibile dal primo paint con sistema scuro e nessuna scelta salvata.
- Numero della pillola mai attraversato dalla linea, in entrambi i temi, in Day, Week e Month.
- Pulsanti della card che si scuriscono in hover invece di schiarirsi.

**Verifica**
- Estendi `tests/contrast.test.ts` con la coppia `#fff` su `--accent-fill` × 0.9 in entrambi i temi (≥ 4.5).
- Typecheck e `npm test`.
- Da verificare nel browser: tema scuro con un gioco selezionato, pillola del giorno ingrandita; `localStorage.removeItem('theme')` + ricarica con il sistema scuro, icona del tema.

---

- [ ] **Task 2 — Aggiornare `docs/design-tokens.md` dopo le code design e design-2**

**File**
- Da cui partire: `docs/design-tokens.md`, `src/styles/tokens.css`, il diff delle code `design` e `design-2`.
- Da non toccare: codice.

**Contesto / decisioni**
- Il documento è la base di tutte le specifiche successive e oggi è superato.

**Atteso**
- §2.1: nuovi token `--accent-fill`, `--dlc-fill`, `--news-fill`, `--free-update-fill`, `--accent-text`, `--page-max`; `--delayed-text` chiaro `#8a5200`; `--news-text` rimosso; nuovi valori delle stagioni (`--season-*` chiari, `--season-alpha` 0.40 / 0.28).
- §3.1 e §9: attenuazione delle card con il velo (`opacity 0.5` di `--bg`, card opaca, `isolation: isolate`); nastro DLC con `overflow: clip` e `overflow-clip-margin: 2px`; hover dei pulsanti della card `brightness(0.9)`.
- §7: canvas stagionale aggiunto con `append`, sempre sopra `.backdrop` e sotto il contenuto; interruzione della linea dell'indicatore sulla pillola.
- §10: rimuovi le incoerenze risolte (ordine sfondo/stagioni, larghezze Rankings/Studios, icona del tema) e aggiungi una nuova voce: "Header sopra lo sfondo del gioco nel tema scuro: con `--backdrop-veil` 0.06 il mese in `--accent` e i testi dell'header hanno poco contrasto su sfondi chiari (es. Pokémon Pokopia: Bubbly Basin). Dipende dal gruppo 4."

**Verifica**
- Nessun test da cambiare. Typecheck e `npm test` per conferma. Commit del solo documento e di questo file.