# Coda task — Sfondi stagionali animati

Esegui un solo task per volta, il primo non spuntato. A fine task: typecheck, npm test, build, commit, aggiorna STATUS.md, spunta il task ([x]) nello stesso commit, report di CLAUDE.md.
Regole: altri problemi vanno nel report alla voce "Aperto". Non eseguire data:fetch*, niente git push, non toccare wip/perf.

## Decisioni (valgono per tutta la coda)
- Stagione dal giorno sotto l'indicatore, a mesi interi: inverno dic–feb, primavera mar–mag, estate giu–ago, autunno set–nov. La stagione vale per tutto lo schermo.
- Particelle disegnate con forme semplici su un unico canvas, niente immagini: estate bolle che salgono; primavera petali in diagonale che ruotano; autunno foglie che cadono ondeggiando, toni caldi; inverno fiocchi lenti con leggera deriva.
- 20–40 particelle in base all'area della finestra, bassa opacità, dietro linea e card.
- Colori per tema: nel tema chiaro colori più scuri o saturi dove serve (es. neve azzurro-grigia), nel tema scuro più chiari. Token in tokens.css.
- Cambio stagione: le particelle esistenti finiscono il loro percorso senza nuove nascite, quelle nuove compaiono gradualmente (circa 2 s).
- Scorrimento veloce (rotella dalla marcia 2 in su, trascinamento rapido, salti lunghi): lo sfondo sfuma via in ~200 ms e ricompare ~500 ms dopo che la timeline si è fermata.
- Con un gioco selezionato lo sfondo stagionale è nascosto (c'è già lo sfondo del gioco).
- Prestazioni: densità del canvas al massimo 1.5, animazione ferma se la scheda non è visibile o lo sfondo è spento, nessun filtro blur.

## [ ] Task 1 — Motore dello sfondo stagionale
File: nuovi src/seasons/season.ts (logica pura: stagione da una data, stato di transizione), src/seasons/particles.ts (fisica e disegno delle particelle), src/seasons/background.ts (canvas e ciclo di animazione), i relativi test, src/styles/seasons.css; da collegare in src/main.ts e allo scroller (solo i punti per sapere velocità e arresto, trovali con grep).
Atteso: tutte le decisioni sopra.
Verifica: typecheck, npm test (stagione da data, transizioni, regole di comparsa/scomparsa), build. Misura anche gli fps: con lo sfondo attivo, a riposo e durante uno scorrimento, non devono scendere rispetto a quando è spento. Riporta i numeri nel report.

## [ ] Task 2 — Impostazioni e accessibilità
File: src/view.ts, src/seasons/background.ts, src/styles/view-menu.css, index.html (pannello di aiuto), docs/SPEC.md.
Atteso:
- Interruttore "Seasonal background" nel menu View, acceso di default, salvato nel browser.
- Con prefers-reduced-motion: spento di default; se l'utente lo accende, le particelle sono ferme (decorazione statica, nessuna animazione).
- Funziona in tutti i livelli di zoom (Day, Week, Month) e in modalità presentazione.
- Nuova sezione in docs/SPEC.md con le decisioni della coda.
