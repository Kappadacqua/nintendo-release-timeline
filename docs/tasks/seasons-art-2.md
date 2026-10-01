# Coda `seasons-art-2` — Correzioni dello sfondo stagionale dopo la verifica

Salvare in `docs/tasks/seasons-art-2.md`. Lancio dal telefono: `Esegui il prossimo task di docs/tasks/seasons-art-2.md`.

## Regole della coda

- Un task per sessione.
- A fine task: typecheck, `npm test`, commit, riga in `STATUS.md`, spunta `[x]` nello stesso commit del lavoro.
- Niente `data:fetch`, niente `git push`. Non toccare il branch `wip/perf` né `src/styles/backdrop.css` (gruppo 4).
- Report fisso: **Fatto / File / Verifica / Da verificare nel browser / Aperto**.
- Se un valore di questa coda è in conflitto con il codice, l'agente si ferma e lo scrive in **Aperto**.
- Mantengono validi tutti i principi di `docs/tasks/seasons-art.md` (niente rotazione, un colore per stagione, stile disegnato, tre fasce).

## Contesto (misurato nel browser, 1920×1080)

- **Transizione:** al passaggio agosto → settembre la massa disegnata sul canvas scende a ~33 % di quella iniziale dopo ~1,2 s e torna piena solo dopo ~2,5 s. Il risultato è un "vuoto", non una sovrapposizione.
- **Contrasto** (stroke pieno, calcolo WCAG su `--bg`): tema chiaro, fascia vicina 1.54–1.64, media 1.40–1.48, lontana 1.26–1.30; tema scuro, vicina 1.78–2.09, media 1.55–1.75, lontana 1.31–1.41. Le particelle lontane nel chiaro sono quasi invisibili.
- **Densità:** in inverno e primavera, nella metà sinistra dello schermo, spesso restano pochi elementi; i puntini di neve sono di 1–2 px e non si leggono.
- **Rametto di abete:** quasi invisibile, si legge come una piuma.

---

- [ ] **Task 1 — Transizione: niente vuoto**

**File**
- Partire da: `src/seasons/background.ts`, `src/seasons/particles.ts`, `src/config.ts` (`SEASONS.cross*`).

**Contesto / decisioni**
- La causa probabile: le particelle della nuova stagione nascono solo dal bordo da cui entrano (in alto o in basso) e impiegano secondi ad attraversare lo schermo, mentre le vecchie sfumano subito.

**Specifica**
- Quando una stagione ha peso `w` crescente, le **nuove** particelle si generano in posizioni casuali **su tutto il viewport** (y casuale, x casuale), ciascuna con dissolvenza individuale di 800 ms. Dopo il periodo di ingresso tornano a nascere dal bordo normale.
- `crossDelayMs`: 300 → **0**.
- Peso della stagione uscente: curva **lineare**, 1 → 0 in `crossOutMs` **1800** (non più ease-in).
- Peso della stagione entrante: ease-in-out, 0 → 1 in `crossInMs` **1800**.
- Il tetto di 1.3 × il target resta.

**Atteso**
- Durante tutto il cambio la massa disegnata non scende sotto il 70 % di quella a regime della stagione uscente.

**Verifica**
- Typecheck, `npm test`.
- Misura: campionare ogni 200 ms il numero di pixel con alpha > 20 sul canvas (griglia ogni 3 px) per 6 s dopo ciascun cambio (nov/dic, feb/mar, mag/giu, ago/set). Riportare la tabella; minimo ≥ 70 % della massa iniziale.
- **Da verificare nel browser:** con le frecce attraverso i quattro confini; avanti e indietro sul confine: nessun pop; reduced motion: cambio immediato; fps ≥ 58.

---

- [x] **Task 2 — Leggibilità: lontane, puntini, densità**

**File**
- Partire da: `src/config.ts` (`SEASONS.bands`, conteggi), `src/seasons/sprites.ts` (puntini).

**Specifica**
- **Moltiplicatori di opacità:** fascia media 0.80 → **0.85**; fascia lontana 0.55 → **0.65**. La vicina resta 1.0. Contrasto atteso nel chiaro: lontana ≈ 1.34, media ≈ 1.5; nello scuro: lontana ≈ 1.35–1.5.
- **Puntini di neve:** raggio 1.5–3.5 px → **2.5–5 px**; alpha di riempimento 0.9 (invariato).
- **Numero di particelle:** +25 % a ogni risoluzione (1280×720: 20 → 25; 1920×1080: 28 → 35; 2560×1440: 40 → 50). Se il Task 7 della coda precedente dà fps < 58 in una stagione, ridurre prima i tipi rari, poi la fascia vicina.
- Nessuna modifica di forme, colori o dimensioni.

**Atteso**
- Nessuna zona ampia dello schermo senza particelle visibili; le lontane si vedono nel tema chiaro senza superare l'intensità delle vicine.

**Verifica**
- Typecheck, `npm test`.
- Rimisurare gli fps come nel Task 7 (a riposo e in marcia 2–3, quattro stagioni, acceso/spento) e, se possibile, a 2560×1440 (già aperto, problema noto 14).
- Ricalcolare i contrasti con lo script (tabella nel report).
- **Da verificare nel browser:** quattro stagioni nei due temi, 1920 / 1440 / 1280: le card restano leggibili e lo sfondo non attira più dell'indicatore e dei numeri della linea.

---

- [x] **Task 3 — Rametto di abete più leggibile**

**File**
- Partire da: `src/seasons/sprites.ts` (rametto), `src/config.ts` (fasce ammesse).

**Specifica**
- Fasce ammesse: **media e vicina** (prima solo media); lunghezze **70 / 105 px**.
- Aghi: spessore 1.4 px (media) e 1.7 px (vicina), non 0.8 × il contorno; fusto 1.8 px.
- Aggiungere un riempimento tenue (alpha 0.16) sulla sagoma dell'insieme degli aghi (poligono che li inviluppa), così il rametto si legge come una massa e non come una piuma.
- Quota: resta 5 %; fra le due fasce 60 % media / 40 % vicina.

**Atteso**
- Il rametto si riconosce a colpo d'occhio come un ramo di abete, senza risultare più evidente dei fiocchi.

**Verifica**
- Typecheck, `npm test`.
- **Da verificare nel browser:** dicembre, gennaio, febbraio, nei due temi; il rametto non sembra una piuma e non spicca più delle altre particelle.
