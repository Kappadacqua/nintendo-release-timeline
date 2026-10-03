# Handoff per l'Architetto: Nintendo Release Timeline (stato al 3 ottobre 2026)

## Il tuo ruolo
Ragioni su funzioni, priorità e decisioni. Scrivi le code di task per l'agente (Claude Code in VS Code, una sessione per task) e verifichi il risultato nel browser. L'utente fa da tramite, spesso dal telefono: lancia l'agente e ti incolla i report.

Il codice lo scrive l'agente. Tu tocchi solo documenti (code, brief, handoff) e fai piccole correzioni di documentazione.

## Da dove partire
1. `STATUS.md`: stato, problemi noti (numerati), voci "Da verificare nel browser".
2. `git log --oneline -15` e `git log origin/main..main` (commit non pushati).
3. `docs/tasks/`: le code. Il prossimo task è il primo `- [ ]`. Al 3 ottobre **tutte le code sono completate**.
4. `docs/SPEC.md`: leggine solo la sezione che serve (indice con `grep -n '^#'`). `docs/design-tokens.md` per il design system.
5. `docs/AGENT-BRIEF.md` (anche come skill `.claude/skills/agent-brief`): cosa sa l'agente. Tienilo allineato quando prendi decisioni.

## Workflow
- Code in `docs/tasks/<nome>.md`: regole in testa, "Decisioni dell'utente", poi task con **File / Contesto / Specifica / Atteso / Verifica**. Lancio: `Esegui il prossimo task di docs/tasks/<nome>.md`, con `/clear` tra un task e l'altro.
- Scrivi i valori in modo verificabile (soglie, misure, file). Se un valore è in conflitto col codice, l'agente si ferma e lo scrive in "Aperto": rispondi a quelle domande, sono spesso giuste.
- Regole per l'agente: niente `data:fetch` né `git push` salvo richiesta esplicita, un commit per task, report fisso (Fatto / File / Verifica / Da verificare nel browser / Aperto).
- Il `git push` lo fa l'utente.

## Verifica nel browser
- Il dev server (`http://localhost:5173`) lo tiene acceso l'utente. Se non risponde, chiedigli di avviarlo: non avviarlo tu.
- Senza Claude in Chrome usa `tools/browser-check/cdp.mjs`: Chrome headless via DevTools Protocol, senza dipendenze. Offre `launch({ dark, width, height, port })`, `goto`, `eval`, `wheel`, `key`, `click`, `size` e `shot` (screenshot in `tools/browser-check/shots/`, ignorata da git). Scrivi lo script di prova nella scratchpad e importa il driver con il percorso assoluto.
- Tecniche che hanno funzionato:
  - **Posizione della timeline**: `translate3d` del livello "world". La data sotto l'indicatore: `#timeline-date`.
  - **Selezionare un gioco**: `/`, poi `Input.insertText`, poi Enter.
  - **Stagione corrente**: colore medio dei pixel del `canvas.seasons`.
  - **fps**: intervalli di `requestAnimationFrame`.
  - **Focus e hover**: Tab o `mouseMoved` più `getComputedStyle`.
- Usa una porta di debug diversa per ogni istanza di Chrome.
- La **sensazione** di rotella e animazioni la giudica solo l'utente.

## Decisioni prese il 3 ottobre 2026 (già nel codice e nei documenti)
- **Rotella**: niente marce né rampa. Uno scatto isolato sposta di esattamente 1 giorno (o settimana, o mese). In rotazione continua ogni scatto sposta di `wheelSpinPx` (120 px) senza aggancio; dopo 150 ms di pausa un magnete porta sull'unità più vicina, o su un'uscita entro 2 unità. Velocità approvata dall'utente.
- **Spinta delle particelle** in rotazione: nello stesso verso del contenuto (`SEASONS.react.sign` −1).
- **Stagioni**: cambiano a equinozi e solstizi (tabella USNO 2025–2030 in `season.ts`, ora italiana).
- **Transizione tra stagioni**: dissolvenza incrociata. Il vuoto residuo è accettato.
- **Sfondo del gioco**: velo leggero (chiaro 0.45, scuro 0.2) più fasce locali `--backdrop-scrim` dietro header, linea e footer (chiaro 100 %, scuro 90 %). Il velo globale da solo non bastava: il rosso `--accent` non arriva a 4.5:1 con nessun velo.
- **Focus e hover uniformi**:
  - focus: anello 3 px `--accent`, distanza 2 (la card ha 3);
  - hover dei controlli con bordo: bordo `--accent`;
  - pulsanti pieni: `brightness(0.9)`; pulsanti tinti: tinta più forte;
  - controlli testuali: testo da `--text-muted` a `--text`;
  - transizioni di 0.2 s (`--hover-ms`), nessuna con reduced motion.
- **Date regionali** in un anno diverso: `May 28 ’26`, con l'anno intero nel `title`; la riga va a capo se non entra.
- **Chiuse senza modifiche**:
  - card coperte nelle pile: voluto, l'hover porta la card davanti;
  - "What's new" ridotto a "!" sotto 1500 px;
  - rametto di abete com'è.
- **`wip/perf`**: abbandonato. Il commit resta nel tag `archive/wip-perf`.
- `scripts/scraper.py` rimosso: Metacritic lo legge `data:fetch-metacritic`.

## Ancora aperto
- **Backloggd**: voti solo a mano dall'admin (il sito blocca gli script). L'elenco dei dati mancanti è in `data/manual-todo.md` (`npm run data:validate -- --todo`). `docs/admin-todo.md` è superato.
- **"What's new"**: mai verificato con due snapshot reali. Si può fare dopo il prossimo `data:fetch`, se l'utente lo lancia.
- **Studios** (STATUS 7–9): giochi senza studio, ordine sul gioco mostrato, gioco fissato alla build.
- **Altezze delle card nelle pile stimate** (STATUS 5): Riichi Mahjong, con la riga delle date a capo, è circa 19 px più alta della stima.
- **Trackpad**: riconoscimento euristico, da provare su un trackpad vero.
- **4K**: prestazioni in pausa (l'utente usa 1080p). A 2560×1440 lo sfondo stagionale costa qualche fps.
- **Gruppi "rimandare" di `docs/review/triage.md`**: 6, 8, 9, 11, 13.
- **`docs/design-tokens.md` §10**: altre incoerenze minori (miniature, raggi, larghezze dei pannelli), nessuna urgente.

## Compiti dell'utente
- `git push` periodico (al momento di questo handoff: 12+ commit locali).
- Sviluppatori mancanti dall'admin (campo "Developer") e voti Backloggd.
