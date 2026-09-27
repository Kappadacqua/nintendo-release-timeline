# Stato del progetto

Aggiornato: 2026-09-27 — riorganizzazione del workflow

## Ultimo checkpoint

- `main` @ `ec1c916` — Inertia cap, presentation stop, fan card fit, live header
- Branch `wip/perf`: modifiche interrotte a canvas e sfondo (`main.css`, `backdrop.ts`, `config.ts`, `timeline.ts`). **Non verificate**, non ancora unite.

## Lavoro in corso

Nessuno.

## Da verificare nel browser (Architetto)

- `ec1c916`: limite dell'inerzia, chiusura del ventaglio a fine presentazione, card estesa non tagliata nel ventaglio, header aggiornato durante il movimento.

## Problemi noti

1. **Prestazioni** — durante lo scorrimento 1–3 fps su schermo 4K (3840×1943, densità 2x); blocco di circa 9 s all'apertura. Il thread principale è libero: il problema è nel rendering. Comparso tra `26c8e4c` (fine iterazione 3) e `59452f2` (fine iterazione 4).
2. **Dati manuali mancanti** — Metacritic e Backloggd non compilati per la maggior parte dei giochi (si inseriscono dal pannello admin).
3. **"What's new"** — mai verificato con due snapshot reali.

## Prossimi task (in ordine)

1. Individuare il commit che ha causato il calo di prestazioni (misure fatte dall'Architetto, nessun task per l'agente).
2. Correggere la causa individuata.
3. Valutare `wip/perf`: unire, adattare o scartare.

## Decisioni recenti

- Store Nintendo: regione Italia.
- Pagine Studios e Rankings: rimandate, specifiche in `docs/SPEC.md` (backlog).
