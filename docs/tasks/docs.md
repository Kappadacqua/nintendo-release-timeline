# Coda task — Documentazione (nessuna modifica al codice)

Esegui un solo task per volta, il primo non spuntato. A fine task: commit, spunta il task ([x]) nello stesso commit, report di CLAUDE.md.

Regole:
- Si modificano solo file Markdown: CLAUDE.md, STATUS.md, README.md, docs/**. Nessun file .ts, .css, .html, .json.
- Per verificare le informazioni usa comandi mirati (find, wc, grep, git log), non leggere interi file di codice.
- Non eseguire i comandi data:fetch*, non fare git push, non toccare wip/perf.

## [x] Task 1 — CLAUDE.md e SPEC allineati al codice
- Confronta la mappa dei moduli di CLAUDE.md con i file reali (find src scripts -type f | xargs wc -l): file mancanti, file che non esistono più, righe e descrizioni sbagliate. Correggi.
- Controlla la tabella dei comandi con gli script di package.json.
- In docs/SPEC.md cerca affermazioni superate dal codice (es. §12 con "Timeline · Rankings" invece di tre voci). Verifica con grep, correggi il testo e segna in docs/review/*.md i problemi di documentazione risolti.
- Nel report: l'elenco delle correzioni fatte.

## [x] Task 2 — Smistamento dei problemi di gravità bassa
- Leggi i problemi di gravità bassa non ancora corretti in docs/review/static.md, pages.md, data.md.
- Scrivi docs/review/triage.md: raggruppali in task proposti (stessa area del codice, max 3–5 file ciascuno), con per ogni gruppo: problemi inclusi, file, impegno stimato (piccolo/medio), raccomandazione (fare / rimandare / ignorare) e motivo in una riga.
- Nel report: solo numero di gruppi e raccomandazioni.

## [ ] Task 3 — Lista di lavoro per il pannello admin
- Usa npm run data:validate e comandi mirati su public/data/games.json (node -e) per elencare i giochi usciti senza Metacritic, senza Backloggd, e quelli senza sviluppatore o con sviluppatore "Nintendo".
- Scrivi docs/admin-todo.md: una tabella per tipo di dato mancante, con titolo, data di uscita, e link di ricerca pronti (https://www.metacritic.com/search/<titolo>/ e https://backloggd.com/search/games/<titolo>/, con il titolo codificato per URL). Ordina per data di uscita, i più recenti prima.
- Nel report: i conteggi per tipo.

## [ ] Task 4 — README.md
- Scrivi README.md in inglese: cos'è il progetto, requisiti (Node), installazione, comandi principali, come funziona la pipeline dati (fetch → cache → build → public/data), pagine del sito, pannello admin, dove sono la specifica (docs/SPEC.md) e lo stato (STATUS.md).
- Breve: al massimo 120 righe. Nessuna chiave API, solo il nome delle variabili richieste in .env (ricavalo da scripts/lib/env.ts con grep).

## [ ] Task 5 — STATUS.md sfoltito
- Togli le voci chiuse e riassumi la storia recente in al massimo 5 righe (i dettagli restano nella storia di Git e nei file di revisione).
- Obiettivo: STATUS.md sotto le 60 righe, con ultimo checkpoint, problemi noti aperti, verifiche nel browser in sospeso, prossimi passi.
