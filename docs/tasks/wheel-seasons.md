# Coda `wheel-seasons` — Documenti allineati, rotella libera con magnete, stagioni astronomiche

Salvare in `docs/tasks/wheel-seasons.md`. Lancio dal telefono: `Esegui il prossimo task di docs/tasks/wheel-seasons.md`.

## Regole della coda

- Un task per sessione.
- A fine task: typecheck, `npm test`, commit, riga in `STATUS.md`, spunta `[x]` nello stesso commit del lavoro.
- Niente `data:fetch`, niente `git push`.
- Report fisso: **Fatto / File / Verifica / Da verificare nel browser / Aperto**.
- Se un valore di questa coda è in conflitto con il codice, l'agente si ferma e lo scrive in **Aperto**.

## Decisioni dell'utente (2026-10-03)

- **Rotella**: la rampa continua (`wheelRamp*`) non piace: accelera in modo strano e non lineare. Nuovo modello: durante una rotazione continua la vista scorre **libera** (non a salti di giorno / settimana / mese), a velocità costante per scatto. Quando la rotazione finisce, un **magnete** la aggancia al giorno più vicino. Solo uno scatto isolato sposta di esattamente un giorno (una settimana / un mese).
- **Spinta delle particelle**: va nel verso **opposto** a quello attuale.
- **Cambio di stagione**: avviene a equinozi e solstizi, non il primo del mese.
- **Transizione tra stagioni** (seasons-art-2 task 1): resta com'è. Il vuoto residuo è accettato.
- **Branch `wip/perf`**: abbandonato. È archiviato nel tag `archive/wip-perf`, il branch è cancellato. Il blocco su `src/styles/backdrop.css` (gruppo 4 di `docs/review/triage.md`) **non vale più**.

---

- [x] **Task 1 — Documenti allineati al codice**

**File**
- Partire da: `STATUS.md`, `docs/SPEC.md` (§3, §4.2, §4.3, §14, §15; **non** §6), `docs/AGENT-BRIEF.md`, `.claude/skills/agent-brief/SKILL.md`, `docs/admin-todo.md`, `.gitignore`.
- Non toccare: codice in `src/` e `scripts/`, `scripts/scraper.py`.

**Contesto / decisioni**
- I documenti sono rimasti indietro rispetto ai commit fino a `68035f1`. Per ogni punto **il codice vince**: leggi il valore nel codice, non copiarlo da qui.

**Specifica**
- `STATUS.md`:
  - "Ultimo checkpoint" → `main` @ ultimo commit. Code: tutte completate tranne `wheel-seasons`; `seasons-art-2` task 1 chiuso per decisione dell'utente.
  - Togliere ogni riferimento a `wip/perf` come branch attivo (ora c'è il tag `archive/wip-perf`).
  - Problema noto 2: `docs/admin-todo.md` superato da `data/manual-todo.md`.
  - Problema noto 19: chiuso (accettato).
  - Problema noto 18: rimuoverlo dopo aver allineato la SPEC.
  - "Prossimi task" → la coda `wheel-seasons`.
- `docs/SPEC.md`:
  - §3, §4.2, §4.3, §14: quanto elencato nel problema noto 18 di STATUS (ritentativi OpenCritic a 30 giorni e stop al primo 429; Metacritic 410 definitivo, 404 ogni 30 giorni; fallback di titolo e voti ereditati con `inheritedFrom`; Backloggd opzionale; `status` tolto da `StudioGame`).
  - §15: tempi della dissolvenza (`crossDelayMs`, `crossInMs`, `crossOutMs`, curve), nascita delle particelle in un punto qualsiasi durante l'ingresso, numero di particelle, opacità per fascia, puntini di neve, rametto di abete anche nella fascia vicina. Non toccare i paragrafi "Stagione" e "Scorrimento veloce": li riscrivono i task 2 e 3.
- `docs/AGENT-BRIEF.md` e la skill `.claude/skills/agent-brief/SKILL.md` (devono restare coerenti tra loro):
  - Togliere il divieto su `backdrop.css` e la regola su `wip/perf`.
  - Rotella: dire che la regola il task 2 di questa coda, senza descrivere le marce.
  - Sfondo stagionale: resta visibile in scorrimento veloce, con dissolvenza incrociata.
  - Metacritic automatico (`data:fetch-metacritic`), Backloggd solo a mano.
  - Riferimento a `data/manual-todo.md` al posto di `docs/admin-todo.md`.
  - Il problema noto "Header … gruppo 4, bloccato" diventa "gruppo 4, da fare".
- `docs/admin-todo.md`: in testa, una riga che lo dichiara superato e rimanda a `data/manual-todo.md`. Il resto non cambia.
- `.gitignore`: aggiungere `data/report.txt`.

**Atteso**
- Nessuna differenza nota tra i documenti e il codice. Nessun file di codice cambiato.

**Verifica**
- Typecheck, `npm test` (devono passare invariati).
- `git diff --stat` con solo file di documentazione e `.gitignore`.
- **Da verificare nel browser:** niente.

---

- [x] **Task 2 — Rotella: scorrimento libero, magnete al giorno, spinta invertita**

**File**
- Partire da: `src/timeline/wheel-fling.ts` (+ `wheel-fling.test.ts`), `src/timeline/config.ts` (parametri `wheel*`), i punti di `src/timeline/scroller.ts` e `timeline.ts` che usano `WheelFling` (cercali con grep, non leggere i file interi), `src/seasons/particles.ts` (`WheelPush`) e `background.ts`, `SEASONS.react` in config.
- Aggiornare: SPEC §6 (tabella dei controlli, riga "Rotella del mouse") e il paragrafo "Scorrimento veloce" di §15.
- Non toccare: trackpad (`trackpadDayPx`, `wheelTrackpadHoldMs`), Shift + rotella, Ctrl + rotella (zoom), trascinamento e la sua inerzia (`fling*`).

**Contesto / decisioni**
- Vedi "Decisioni dell'utente". Il problema non è un valore da regolare: è il modello. Il passo in giorni che cresce con la durata della rotazione si sente come un'accelerazione strana. Il passo deve restare costante.

**Specifica**
- **Scatto isolato** (nessuno scatto nei `wheelGearGapMs` 150 ms precedenti): esattamente 1 unità (giorno / settimana / mese), come oggi. Due o tre scatti lenti e distanziati → 2 o 3 giorni esatti.
- **Rotazione continua** (dal secondo scatto entro 150 ms dal precedente): ogni scatto aggiunge alla destinazione una distanza **fissa in pixel**, `wheelSpinPx` (valore iniziale **120**), uguale a ogni livello di zoom e per tutta la rotazione. Niente rampa, niente marce, niente arrotondamento al giorno durante la rotazione. La velocità percepita dipende solo da quanto in fretta gira la rotella. L'animazione insegue la destinazione come oggi.
- **Fine della rotazione** (nessuno scatto per 150 ms): **magnete**. La destinazione va all'unità più vicina (giorno a Day, lunedì a Week, 1° del mese a Month). Se un'uscita è entro `wheelMagnetUnits` (2) unità, va su quella, come oggi. Lo spostamento è un breve inseguimento morbido, non un salto. Nessuna inerzia oltre l'ultimo scatto.
- **Limite**: togliere `wheelFlingMaxDays` (91), che in Month bloccava la rotella. Restano i limiti della timeline (inizio e zona TBA).
- **Rimuovere** da config e codice: `wheelGearSlowGapMs`, `wheelSlowLoss`, `wheelRampDelayMs`, `wheelRampMs`, `wheelMaxPace`, `wheelInertiaPerPace`, `wheelGearPace`, `wheelFlingFriction`, `wheelFlingMaxDays`. Tenere `wheelGearGapMs` (rinominarlo `wheelSpinGapMs` è ammesso). `?debug=wheel` resta e stampa: scatto isolato / in rotazione / magnete.
- **Reduced motion**: stesso modello. Il magnete può essere immediato.
- **Spinta sullo sfondo stagionale** (`WheelPush`):
  - Ogni scatto **in rotazione continua** (non quello isolato) dà la spinta `gainPxPerS[0]` (220 px/s), × `bandFactor` per fascia. Gli scatti si sommano fino a `maxPxPerS` (600) e decadono come oggi (600 ms). `gainPxPerS` diventa un solo numero.
  - **Verso invertito**: andando avanti nel tempo le particelle vanno verso **sinistra**, cioè con il contenuto (effetto parallasse). Cambiare `SEASONS.react.sign` e i test che lo descrivono.
  - Nessuna spinta col trackpad e con reduced motion, come oggi.

**Atteso**
- Uno scatto = un giorno esatto. Girando la rotella la timeline scorre fluida e lineare: con la rotella più veloce va più veloce, a ritmo costante va costante, senza scatti di marcia. Al rilascio si ferma morbida sul giorno più vicino.
- Le particelle vengono trascinate nello stesso verso del contenuto.

**Verifica**
- Typecheck, `npm test`. Riscrivere `wheel-fling.test.ts`:
  - scatto isolato → 1 unità;
  - 10 scatti a 50 ms → destinazione = 1 unità + 9 × `wheelSpinPx`, poi magnete al giorno più vicino;
  - stessa distanza in pixel per scatto a Day, Week e Month;
  - magnete su un'uscita entro 2 unità.
- In `particles.test.ts`: niente spinta sullo scatto isolato, verso invertito.
- **Da verificare nel browser (utente):**
  - la sensazione della rotella a Day, Week e Month. `wheelSpinPx` è il valore da regolare a mano;
  - uno scatto lento = 1 giorno;
  - al rilascio la linea si ferma su un giorno;
  - le particelle seguono il contenuto.

---

- [x] **Task 3 — Stagioni a equinozi e solstizi**

**File**
- Partire da: `src/seasons/season.ts` (`seasonOf`) e `season.test.ts`.
- Aggiornare: paragrafo "Stagione" di SPEC §15, aiuto "Seasonal background" nel pannello delle scorciatoie, se cita i mesi.
- Non toccare: transizione e pesi (`SeasonState`), sprite, spinta.

**Contesto / decisioni**
- Oggi la stagione cambia il 1° di marzo, giugno, settembre e dicembre. L'utente vuole le date astronomiche.

**Specifica**
- La stagione inizia il **giorno** (ora italiana) dell'equinozio o del solstizio: primavera all'equinozio di marzo, estate al solstizio di giugno, autunno all'equinozio di settembre, inverno al solstizio di dicembre.
- Tabella fissa in `season.ts` (fonte USNO, convertita in ora italiana):

  | Anno | Primavera | Estate | Autunno | Inverno |
  |---|---|---|---|---|
  | 2025 | 20 mar | 21 giu | 22 set | 21 dic |
  | 2026 | 20 mar | 21 giu | 23 set | 21 dic |
  | 2027 | 20 mar | 21 giu | 23 set | 22 dic |
  | 2028 | 20 mar | 20 giu | 22 set | 21 dic |
  | 2029 | 20 mar | 21 giu | 22 set | 21 dic |
  | 2030 | 20 mar | 21 giu | 23 set | 21 dic |

- Anni fuori tabella: 20 mar / 21 giu / 22 set / 21 dic.
- Il confronto resta sui campi UTC della data del giorno (come oggi `dayToDate` → `getUTC*`).
- A Week e Month vale il giorno sotto l'indicatore, come oggi (a Month, al 1° del mese, la stagione è quella del 1°: va bene così). Nella zona TBA resta l'ultima.

**Atteso**
- Scorrendo a Day: 20 marzo 2026 → primavera, 19 marzo → inverno; 23 settembre 2026 → autunno, 22 settembre → estate; 21 dicembre 2025 → inverno.

**Verifica**
- Typecheck, `npm test`. Test di `seasonOf` sui due giorni a cavallo di ogni confine 2025–2027 e su un anno fuori tabella.
- **Da verificare nel browser:** a Day, con le frecce, attraverso il 19/20 marzo 2026 e il 22/23 settembre 2026 il cambio avviene lì e non il 1° del mese.
