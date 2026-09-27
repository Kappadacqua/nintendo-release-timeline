# Coda task — Controlli di qualità

Esegui un solo task per volta, il primo non spuntato. A fine task: commit, aggiorna STATUS.md, spunta il task ([x]) nello stesso commit, e rispondi con il report di CLAUDE.md.

## Regole di questa coda
- Task 1–3 sono in sola lettura sul codice: non correggere nulla, anche se la correzione è banale. Scrivi i risultati nel file indicato; le correzioni verranno decise dopo, come task separati.
- Ogni problema nel file dei risultati ha: gravità (alta = bug o comportamento diverso da SPEC; media = rischio concreto o debito tecnico; bassa = stile, ordine), file e riga, descrizione in 1–2 righe, correzione suggerita in una riga.
- Niente elenchi di buone pratiche generiche: solo problemi trovati in questo codice.
- Nel report finale in chat: solo il numero di problemi per gravità e i titoli di quelli ad alta gravità. Il dettaglio sta nel file.
- Non eseguire data:fetch, data:fetch-studios, data:fetch-free-updates; non fare git push; non toccare wip/perf.

## [ ] Task 1 — Controlli automatici
Task: controlli oggettivi su src/ e scripts/ con comandi, senza leggere i file per intero.
Risultati in: docs/review/static.md
Controlli:
1. Variabili, import e parametri inutilizzati: npx tsc --noEmit --noUnusedLocals --noUnusedParameters (senza modificare tsconfig).
2. Colori scritti direttamente nei CSS fuori da src/styles/tokens.css (grep di #hex, rgb(, hsl() e nei file .ts (stili inline con colori).
3. Classi CSS definite in src/styles/ ma mai usate in .ts o .html, e classi usate nel codice senza regole CSS. Usa uno script temporaneo per il confronto, non lasciarlo nel repository.
4. console.log, debugger, TODO, FIXME rimasti.
5. Accessi a localStorage non protetti da try/catch.
6. Animazioni (GSAP o CSS) che non rispettano prefers-reduced-motion: cerca dove sono definite e verifica il controllo, senza leggere i file interi.
Verifica: elenca in cima al file dei risultati i comandi usati, così i controlli si possono ripetere.

## [ ] Task 2 — Revisione delle pagine nuove
Task: rivedere la logica delle pagine Rankings e Studios rispetto alla specifica.
File da leggere: src/rankings/main.ts, src/studios/main.ts, src/games.ts, src/timeline/dates.ts; docs/SPEC.md solo §12 (Rankings) e §14 (Studios).
Risultati in: docs/review/pages.md
Cosa cercare:
- Comportamenti diversi da SPEC.
- Casi limite: dati mancanti o vuoti, voti senza numero di recensioni, date TBA, soglia a 0 o non numerica, localStorage non disponibile.
- Date e fusi orari: "uscito oggi" e tempi relativi coerenti con la timeline, nel fuso locale.
- Logica duplicata tra le due pagine o con src/filters.ts che potrebbe divergere nel tempo.

## [ ] Task 3 — Revisione della pipeline dati nuova
Task: rivedere gli script di dati per aggiornamenti gratuiti e studi.
File da leggere: scripts/lib/free-updates.ts, scripts/lib/studios.ts, scripts/lib/fandom.ts, scripts/fetch-free-updates.ts, scripts/fetch-studios.ts; in scripts/lib/build.ts solo le parti che li richiamano (trovale con grep).
Risultati in: docs/review/data.md
Cosa cercare:
- data:build deve funzionare senza rete e senza errori anche se mancano le cache di studi o aggiornamenti (clone pulito): verificalo leggendo il codice, non cancellando i file.
- Idempotenza: due data:build di fila devono dare lo stesso risultato, a parte generatedAt.
- Gestione degli errori di rete negli script di fetch (timeout, risposte non valide, limiti di frequenza).
- Regole di abbinamento dei nomi degli studi e dei doppioni degli aggiornamenti: casi che potrebbero abbinare in modo sbagliato.

## [ ] Task 4 — Test automatici della logica pura
Task: introdurre Vitest e scrivere test per le funzioni di logica pura più delicate. Questo task modifica il repository.
File: package.json (devDependency vitest, script test), nuovi file *.test.ts accanto ai moduli testati. Se una funzione da testare non è esportata, esportala senza cambiarne il comportamento.
Cosa testare:
- Date: parsing, daySpan, tempi relativi ("in N days", "N months ago"), passaggio d'anno.
- Rankings: ordinamento per ogni fonte, parità (recensioni poi titolo), soglia, medie con fonti parziali.
- Studi: categoria (first party, partner, terze parti), alias, scelta del gioco da mostrare.
- Aggiornamenti gratuiti: esclusione dei doppioni.
Atteso:
- npm test passa. Test brevi, con dati minimi scritti nel test, senza leggere public/data/.
- CLAUDE.md: aggiungi npm test alla tabella dei comandi, da eseguire a fine task quando si tocca logica coperta dai test.
- Se un test rivela un bug, non correggerlo: segna il test come it.todo o it.skip con un commento e riportalo nel report alla voce "Aperto".
Verifica: typecheck + npm test.
