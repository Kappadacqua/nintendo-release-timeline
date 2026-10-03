# Stato del progetto

Aggiornato: 2026-10-03 — Sito pubblicato di nuovo su GitHub Pages, aggiornamento giornaliero attivo

## Ultimo checkpoint

- `main` (allineato a `origin/main`) — versione mobile, freschezza dei dati nell'admin e documenti allineati. Code `docs/tasks/*.md` chiuse.
- Sito pubblico su https://kappadacqua.github.io/nintendo-release-timeline/ (repository pubblico, Pages e workflow `update-and-deploy.yml` attivi dal 2026-10-03). Il bot fa commit dei dati su `main` ogni notte: `git pull` prima di lavorare in locale.
- Le vecchie modifiche per il 4K (canvas e sfondo, non verificate) sono archiviate nel tag `archive/wip-perf`.

## Storia recente

- Documenti allineati (2026-10-03): SPEC §10 (riquadro Data sources, frequenza di rilettura dei voti, workflow di pubblicazione sospeso), §11 milestone 7, intestazione e struttura cartelle; CLAUDE.md, AGENT-BRIEF.md e README (pubblicazione sospesa, `refresh-policy.ts` / `freshness.ts`, `data/manual-todo.md`). Solo documenti.
- Timeline: iterazione 4 (gruppi, zoom, presentazione) e correzioni fino a `ec1c916`; CSS diviso in `src/styles/` (build identica).
- Nuove pagine Rankings (SPEC §12) e Studios (SPEC §14); aggiornamenti gratuiti Switch 2 come voci `free-update` (SPEC §13): il primo import non genera novità in "What's new".
- Revisione di qualità in `docs/review/` (static, pages, data) con test Vitest; correzioni di media/alta gravità fatte (`docs/tasks/fixes.md`), le basse smistate in `docs/review/triage.md`.
- Documentazione: CLAUDE.md e SPEC allineati al codice, `README.md`; dati da inserire a mano in `data/manual-todo.md` (`docs/admin-todo.md` superato).
- wheel-seasons task 1 — SPEC §3, §4, §4.2, §4.3, §5, §10, §14, §15 allineate al codice (titoli ridotti e `inheritedFrom`, OpenCritic 429 e ritentativi a 30 giorni, Metacritic 410/404, Backloggd opzionale, `StudioGame` senza stato, sviluppatore del gioco base, valori dello sfondo stagionale dopo seasons-art-2); brief e skill senza `wip/perf`; `data/report.txt` ignorato da git. Solo documenti, niente da verificare nel browser.
- Decisioni: store Nintendo regione Italia; prestazioni ottimizzate per 1080p, 4K rimandato.

## Lavoro in corso

Nessuno.

## Da verificare nel browser (Architetto)

- **Sito pubblicato** — https://kappadacqua.github.io/nintendo-release-timeline/: timeline, Rankings e Studios (copertine, link tra le pagine). Il giorno dopo, nella tab Actions di GitHub, il run notturno (03:17 UTC) e il commit "Data: daily update …": è il primo fetch dai server di GitHub, mai provato (Metacritic e Wikipedia potrebbero rispondere 403; la pubblicazione va avanti lo stesso). In `/admin`, dopo `git pull`, il riquadro "Data sources" mostra le date del fetch notturno.

## Problemi noti

22. **Aggiornamento automatico** — il bot fa commit su `main` ogni notte: fare `git pull` prima di lavorare in locale. Metacritic e Wikipedia dagli IP di GitHub mai provati (un 403 ferma solo Metacritic, la pubblicazione va avanti). Snapshot giornaliero in `data/snapshots/` (un file al giorno nel repo). GitHub disattiva i workflow pianificati dopo 60 giorni senza attività nel repo (da controllare se i commit del bot bastano a tenerli attivi).

1. **Prestazioni solo in 4K** — su 4K a densità 2x lo scorrimento scende a 1–3 fps; su 1080p è fluido (60 fps). **In pausa**: se servirà, partire dal tag `archive/wip-perf`.
2. **Dati manuali mancanti** — Backloggd solo a mano dal pannello admin (backloggd.com risponde agli script con una verifica anti-bot, HTTP 403): in `data:validate` è una riga col conteggio. Link mancanti in `data/manual-todo.md` (`npm run data:validate -- --todo`), che sostituisce `docs/admin-todo.md` (del 27/09, superato). Fonti senza pagina: `"absent": { "<fonte>": { "status": "none", "reason", "checkedAt" } }` negli override.
3. **"What's new"** — mai verificato con due snapshot reali; un nuovo aggiornamento gratuito ("Free update · out <data>") non è verificabile finché non si aggiunge un titolo a `data/free-updates.json`.
4. **`data/free-updates-seen.json`** — va tenuto nel repo: se cancellato, la build tratta tutte le voci come già note (nessuna novità).
5. **Altezze stimate** — le pile usano altezze stimate per tipo di card (`CARD_HEIGHT` in `src/cards/layout.ts`), non misurate: titoli su 3 righe o badge su più righe possono sporgere qualche px in più o in meno.
6. **Due gruppi nello stesso giorno** — stessa x, separati dalle corsie; ordine da tastiera corretto (fixes-2 task 1), passaggio tra ventagli da verificare nel browser.
7. **Studios: giochi senza studio** — 3 giochi first party senza sviluppatore IGDB, più "DK Challenge" e "Ocarina of Time" (sviluppatore "Nintendo", nascosto). Da correggere dal pannello admin (campo "Developer").
8. **Studios: ordine** — ricalcolato sul gioco *mostrato*: studi senza gioco Switch 2 o con gioco senza data finiscono nel gruppo finale alfabetico.
9. **Studios: gioco fissato alla build** — `studios.json` ha un solo gioco per studio (lo stato uscito / in uscita viene dalla data nella pagina, il campo `status` non c'è più), ma la *scelta* del gioco resta quella del build. Da valutare: scrivere tutti i giochi Switch 2 e scegliere nella pagina.
10. **"Exclusives only" senza effetto sui dati attuali** — tutti gli 84 elementi sono esclusivi o solo Switch + telefoni; 3 giochi (Putty World, Bit Boy!! Arcade 2, Chit Chat Party!) non hanno `onOtherConsoles`, passano perché `exclusive`.
11. **Problemi di gravità bassa** — 28 smistati in `docs/review/triage.md`: 17 corretti (i 6 gruppi "fare" e il gruppo 4), 11 aperti nei gruppi "rimandare" (6, 8, 9, 11, 13) e "ignorare" (5).
12. **Rotella: riconoscimento del trackpad euristico** — un evento con delta piccolo (< 40 px) fa fare alla rotella solo scatti da 1 giorno per 400 ms; un trackpad che mandasse subito eventi grandi (fase di inerzia di macOS) verrebbe trattato come rotella e potrebbe scorrere libero (rotazione continua). Da provare su trackpad reali.
15. **Sfondo stagionale in presentazione** — resta sempre nascosto (un gioco è sempre selezionato, SPEC §15). Se lo si vuole visibile, serve una regola diversa (es. nasconderlo solo quando il gioco ha davvero un'immagine di sfondo).
14. **Sfondo stagionale: fps misurati solo in headless** — Chrome headless con GPU (GTX 1070), build di produzione, dopo `seasons-art` (2026-10-01): a 1920×1080 60 fps (p95 16,8 ms) in ogni stagione, a riposo, in scorrimento e al cambio di stagione. **A 2560×1440 con sfondo acceso 43–60 fps** (marcia 3 la peggiore, p95 33 ms), a sfondo spento 55–60: il costo resta anche senza disegnare particelle, quindi viene dal canvas a tutto schermo ridisegnato a ogni frame, non dalle sagome. Possibili rimedi (da decidere): canvas a densità ridotta oltre 1080p, oppure ridisegno a 30 fps. Da confermare su un monitor reale e in 4K. Dopo seasons-art-2 task 2 (50 particelle a 2560×1440): sfondo acceso 58–59 fps a riposo, **47–55 fps in marcia 2–3**; spento 59–60. A 1080p resta 60.
16. **Metacritic senza API** — si leggono le pagine HTML: se Metacritic cambia markup (schede `product-score-card`, sezione `user-reviews`, `aria-label` "Metascore … out of 100") il fetch lo dice esplicitamente ("Metacritic page layout not recognized … not found: …", stop dopo 3 pagine di fila) e restano gli ultimi voti in cache; un 403/429 ferma l'esecuzione. Regole in SPEC §4.3.
17. **Voti ereditati dal gioco base** — Switch 2 Edition / bundle senza pagina propria prendono voto e pagina del gioco base (titolo ridotto: senza "Nintendo Switch 2 Edition…", "+ …", "- Definitive Edition"), con `inheritedFrom`; una pagina OpenCritic ereditata basta anche a tenere l'edizione nel perimetro (SPEC §3, §4). La card non lo dice ancora.
19. **Transizione di stagione: vuoto residuo** (seasons-art-2 task 1) — **chiuso**: accettato dall'utente il 2026-10-03 (la massa scende al 23–67 % durante il cambio).
20. **Header e mesi sopra lo sfondo del gioco** — **chiuso** (polish task 3): fasce locali `--backdrop-scrim` dietro header, linea e footer, ≥ 4.5:1 nel caso peggiore nei due temi (`tests/contrast.test.ts`).
13. **Rotella in Month** — chiuso (wheel-seasons task 2): il limite di 91 giorni non c'è più.

23. **Mobile: limiti noti** (SPEC §16) — (a) verificato solo in emulazione Chromium (Playwright) e con un primo giro sul telefono dell'utente in Wi-Fi (2026-10-03); mai in Safari/iOS; (b) in Month la colonna doppia si impila molto (come sul desktop); (c) con CPU 4× più lenta Day ~42 fps e Month ~31 (le particelle non si fermano più durante lo scorrimento, scelta dell'utente); (d) la striscia chiara a sinistra resta sopra lo sfondo del gioco (leggibilità di numeri e mesi). Dopo la prima prova sul telefono: particelle più piccole e sempre in movimento, colonna dei gruppi trascinabile col dito, sfondo del gioco fino al bordo in basso, minimappa con densità minima che scorre (anche sul desktop, quando la timeline sarà più lunga); poi, su richiesta, la minimappa verticale è diventata una **rotella**: si trascina col dito (la timeline scorre ~24× più veloce in Day, 40 px al mese), segno fisso al centro, niente riquadro, tocco su un puntino = selezione del gioco.

21. **"Mark all as seen" senza hover** — **chiuso**: hover con tinta `--news` dal 14 % al 22 % (niente `brightness`), `--news-text-soft` chiaro `#005cc1`, scuro `#50a0ff` (≥ 4.68 / 4.75 su entrambe le tinte).

## Prossimi task (in ordine)

Nessuno: progetto chiuso. Se lo si riprende: gruppi "rimandare" di `docs/review/triage.md`; pubblicazione (SPEC §10).
