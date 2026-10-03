---
name: agent-brief
description: Brief di lavoro del progetto Nintendo Release Timeline — come si lavora, regole fisse, code di task in docs/tasks/, formato del report, panoramica del sito, design system e problemi noti. Da caricare all'inizio di ogni sessione prima di un task, o quando l'utente chiede di eseguire il prossimo task di una coda.
---

# Brief dell'agente

Leggi per intero `docs/AGENT-BRIEF.md` (è la fonte di questo skill: non duplicarla qui) e applicalo per tutta la sessione, insieme a `CLAUDE.md` e `STATUS.md`.

Promemoria dei punti che contano di più:

- **Il codice vince sul brief.** Ogni differenza tra brief e codice va in "Aperto", non si adegua in silenzio.
- Un task per sessione. Conflitti con il codice, funzioni o dati nuovi non previsti → fermati e scrivilo in "Aperto".
- Coda di task: `Esegui il prossimo task di docs/tasks/<coda>.md` = primo `- [ ] **Task N …**` non spuntato; se è **bloccato**, non eseguirlo. Spunta `[x]` nello stesso commit del lavoro.
- Fine task: typecheck, `npm test`, commit, riga in `STATUS.md`.
- Mai `data:fetch*` (anche `data:fetch-metacritic`, `data:fetch-studios`) / `git push` senza richiesta esplicita. Non cancellare `data/free-updates-seen.json`.
- Modifiche visive: leggi prima `docs/design-tokens.md`; colori nei tre blocchi di `tokens.css`; nuove coppie testo/fondo in `tests/contrast.test.ts`.
- Report finale in italiano: **Fatto**, **File**, **Verifica**, **Da verificare nel browser**, **Aperto** (o "Nessuno").
