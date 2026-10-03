# Coda `states` — Focus e hover uniformi

Salvare in `docs/tasks/states.md`. Lancio dal telefono: `Esegui il prossimo task di docs/tasks/states.md`.

## Regole della coda

- Un task per sessione.
- A fine task: typecheck, `npm test`, commit, riga in `STATUS.md`, spunta `[x]` nello stesso commit del lavoro.
- Niente `data:fetch`, niente `git push`.
- Report fisso: **Fatto / File / Verifica / Da verificare nel browser / Aperto**.
- Se un valore di questa coda è in conflitto con il codice, l'agente si ferma e lo scrive in **Aperto**.

## Decisioni dell'utente (2026-10-03)

- **Focus e hover**: uniformare. Lo stesso gesto deve dare la stessa risposta su tutte le pagine.
- Chiusi senza modifiche:
  - **card coperte nelle pile**: voluto, l'hover porta la card davanti;
  - **"What's new" ridotto a "!"** sotto 1500 px: va bene così;
  - **rametto di abete**: va bene così;
  - **velocità della rotella** (`wheelSpinPx` 120): va bene così.
- Il pannello admin resta fuori dal design curato: **non toccarlo**.

## Riferimento

`docs/design-tokens.md` §9.1–9.4 (stato attuale, con file e righe) e §10 (incoerenze: "Outline di focus 3px vs 2px", "Hover dei bordi: tre regole", "Durata del cambio di bordo").

---

- [x] **Task 1 — Una regola di focus e una di hover**

**File**
- Partire da: `src/styles/header.css` (regola `:focus-visible`), `rankings.css`, `studios.css`, `view-menu.css`, `filters.css`, `whats-new.css`, `shortcuts.css`, `selection.css`, `timeline-items.css`, `tokens.css`, `tests/contrast.test.ts`, `docs/design-tokens.md`.
- Non toccare: `src/admin/`, la logica TS, le card della timeline in hover (bordo e ombra della card, §9.2, restano come sono).

**Specifica**
- **Focus** (solo `:focus-visible`):
  - Ovunque `outline: 3px solid var(--accent)`, `outline-offset: 2px`. Due nuovi token in `tokens.css`: `--focus-width` 3px, `--focus-offset` 2px.
  - Rankings e Studios passano da 2px a 3px.
  - Eccezioni ammesse solo se l'outline verrebbe tagliato o coperto (es. segmenti dentro una pillola con `overflow`): offset ridotto, elencate nel report. La card mantiene offset 3 (anello di selezione da 3px).
  - Restano le eccezioni attuali: `.timeline` (focus sulla card) e campo di ricerca (dialogo già evidente).
- **Hover dei controlli con bordo** (pulsanti tondi, pillole dell'header, "What's new", "Start presentation", campi e "Reset" di Rankings, link dello studio se ha bordo):
  - bordo → `var(--accent)`;
  - "What's new" lascia `--news` (il blu resta nell'icona e nel numero);
  - Rankings lascia `--text-muted`.
- **Hover dei pulsanti pieni o tinti** che oggi non hanno hover (Chiudi del dialogo scorciatoie, "Mark all as seen"): `filter: brightness(0.9)`, come i pulsanti della card. "Mark all as seen" disabilitato: niente hover.
- **Hover dei controlli testuali** (navigazione, zoom, anni di Rankings, segmenti del menu View): testo da `--text-muted` a `--text`. Ai segmenti del menu View, che oggi non hanno hover, va aggiunto.
- **Transizione**: `border-color`, `color`, `filter` in 0.2 s ease ovunque (Rankings oggi 0.15 s). Un token `--hover-ms` 0.2s. Con `prefers-reduced-motion`: nessuna transizione.
- `tests/contrast.test.ts`: aggiungere "Mark all as seen" in hover (`--news-text-soft` sulla tinta con `brightness(0.9)`) e Chiudi in hover, nei due temi, ≥ 4.5:1. Se una coppia non passa, fermarsi e riportarla in **Aperto**.
- `docs/design-tokens.md`:
  - §9.1 e §9.3 aggiornati;
  - in §10 togliere le tre righe risolte.
- `STATUS.md`: togliere dai problemi noti o segnare come chiuse le voci elencate in "Decisioni dell'utente", se presenti.

**Atteso**
- Da tastiera: lo stesso anello rosso da 3 px su tutte le pagine (timeline, Rankings, Studios, dialoghi, menu).
- Col mouse: ogni controllo con bordo diventa rosso; ogni pulsante pieno si scurisce; ogni controllo testuale passa al colore pieno del testo.

**Verifica**
- Typecheck, `npm test`.
- `grep` nel report: nessun `outline:` con valori diversi dai token fuori dalle eccezioni elencate.
- **Da verificare nel browser:**
  - Tab attraverso header, menu View, filtri, "What's new", Rankings e Studios, nei due temi;
  - hover sugli stessi controlli;
  - reduced motion.
