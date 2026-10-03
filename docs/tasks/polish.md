# Coda `polish` — Rifiniture emerse dalla verifica del 2026-10-03

Salvare in `docs/tasks/polish.md`. Lancio dal telefono: `Esegui il prossimo task di docs/tasks/polish.md`.

## Regole della coda

- Un task per sessione.
- A fine task: typecheck, `npm test`, commit, riga in `STATUS.md`, spunta `[x]` nello stesso commit del lavoro.
- Niente `data:fetch`, niente `git push`.
- Report fisso: **Fatto / File / Verifica / Da verificare nel browser / Aperto**.
- Se un valore di questa coda è in conflitto con il codice, l'agente si ferma e lo scrive in **Aperto**.

---

- [x] **Task 1 — Riga delle date regionali che straborda**

**File**
- Partire da: `src/cards/card.ts` (`shortDate`, righe ~38 e ~122), `src/styles/card.css` (`.card__dates`, `.card__date`).
- Non toccare: la riga "Worldwide" dei free update, `layout.ts`.

**Contesto / decisioni**
- Verificato nel browser: Riichi Mahjong (JP 25 dic 2025, EU e NA 28 mag 2026). Con l'anno scritto per esteso ("May 28, 2026") le tre date non entrano nella card. "JP Dec 25" e la bandiera EU finiscono attaccati e il testo esce dal bordo.
- Inoltre `STATUS.md`, in "Ultimo checkpoint", indica ancora `3626b1b` e la coda `wheel-seasons` come aperta: correggerlo in questo task.

**Specifica**
- Anno abbreviato: una data in un anno diverso da `refYear` diventa `May 28 ’26` (apostrofo tipografico U+2019, niente virgola). Le date nello stesso anno restano `May 28`.
- L'anno per esteso resta dove c'è spazio: `aria-label` o `title` della data (es. "Europe: May 28, 2026"), se esiste già un'etichetta accessibile; altrimenti aggiungerla.
- Se anche così la riga non entra (card stretta, card compatta), le date vanno a capo (`flex-wrap: wrap`, `row-gap` 4 px, `column-gap` da token esistente). Non devono mai sovrapporsi né essere tagliate.
- Cercare con grep altri punti che usano `shortDate` o formati simili nelle card (card compatta, `expand.ts`) e applicare la stessa regola. **Non** toccare Rankings e Studios: hanno i loro `formatDate`.

**Atteso**
- Nessuna card con la riga delle date che esce dal bordo o con date attaccate, in Day / Week / Month e in compatto.

**Verifica**
- Typecheck, `npm test`. Test di `shortDate` (stesso anno, anno diverso, `refYear` 0) se la funzione è esportabile senza DOM; altrimenti spostarla in un modulo senza DOM.
- **Da verificare nel browser:**
  - Riichi Mahjong (25 dic 2025) nei due temi, anche in compatto;
  - per ogni card visibile, `.card__dates` con `scrollWidth <= clientWidth`.

---

- [x] **Task 2 — Sfondo del gioco: token in `tokens.css` e velo del tema scuro (gruppo 4)**

**File**
- Partire da: `src/styles/backdrop.css` (blocco `:root` e temi, righe ~37–53), `src/styles/tokens.css`, `tests/contrast.test.ts`, `docs/design-tokens.md`, `docs/review/triage.md` (gruppo 4).
- Non toccare: `backdrop.ts`, blur e saturazione del livello.

**Contesto / decisioni**
- `wip/perf` è archiviato, quindi `backdrop.css` non è più bloccato.
- Nel tema scuro con un gioco selezionato il velo è al 6 %. Su sfondi chiari (es. Pokémon Pokopia: Bubbly Basin, 5 ago 2026) il nome del mese in rosso e il testo dell'header si leggono male. Nel tema chiaro il velo è 0.45 e va bene.

**Specifica**
- Spostare `--backdrop-blur`, `--backdrop-blur-cover`, `--backdrop-opacity`, `--backdrop-veil` in `tokens.css`, nei **tre blocchi** dei temi. In `backdrop.css` restano solo le regole.
- Tema scuro: alzare `--backdrop-veil` al **valore più basso**, a passi di 0.05, per cui con Bubbly Basin selezionato e con altri due giochi dallo sfondo chiaro (sceglili tu nel browser e nominali nel report):
  - data dell'header e nome del mese sulla linea (es. "AUG") hanno contrasto ≥ 4.5:1 sul 10° percentile peggiore dei pixel di sfondo dietro il testo (screenshot headless, campionamento intorno al riquadro del testo).
- Tetto 0.5: se a 0.5 l'obiettivo non è raggiunto, fermarsi a 0.5 e riportare i valori misurati in **Aperto**.
- Tema chiaro: invariato (0.45).
- Gruppo 4 in `triage.md`: segnarlo come fatto. In `docs/design-tokens.md` aggiornare i token dello sfondo.

**Atteso**
- Nel tema scuro, con un gioco dallo sfondo chiaro selezionato, header e mesi leggibili. L'immagine di sfondo resta riconoscibile.
- Nessun cambio nel tema chiaro.

**Verifica**
- Typecheck, `npm test` (`contrast.test.ts`: i blocchi scuri devono coincidere).
- Tabella nel report: velo provato → contrasto minimo per ciascuno dei tre giochi.
- **Da verificare nel browser:** Bubbly Basin selezionato nei due temi; un gioco dallo sfondo scuro selezionato nel tema scuro, per controllare che non diventi troppo spento.

---

- [ ] **Task 3 — Fasce locali dietro header e linea al posto del velo alto (problema noto 20)**

**File**
- Partire da: `src/styles/selection-extras.css` (`.timeline__band`, `.has-backdrop .app-footer`), `src/styles/header.css`, `src/styles/tokens.css` (`--backdrop-veil`), `tests/contrast.test.ts`, `docs/design-tokens.md`.
- Non toccare: `backdrop.ts`, blur e opacità del livello, colori `--accent` / `--text-muted`.

**Contesto / decisioni (Architetto)**
- Il velo globale non può risolvere il problema: scurisce tutta l'immagine per salvare due strisce di testo, e il rosso `--accent` ha una luminanza intermedia, quindi non arriva a 4.5:1 con nessun velo. La soluzione è il modello del footer: fasce locali opache solo dove c'è testo.
- Caso peggiore calcolato (tema scuro, `--bg` `#0b0b0d` mescolato con bianco puro dietro): al 85 % → accent 4.06, muted 4.74; al **90 %** → accent 4.83, muted 5.64. La fascia attuale della linea è all'80 % (muted 3.96 nel caso peggiore) e la sua sfumatura (`mask-image` 18 % / 82 %) cade proprio sulle etichette dei mesi.

**Specifica**
- Con `.has-backdrop`:
  - **Header**: sfondo `color-mix(in srgb, var(--bg) X%, transparent)`, con transizione 0.4 s come il footer.
  - **Fascia della linea**: stessa percentuale X. La parte piena della maschera deve coprire per intero tacche, numeri dei giorni ed etichette dei mesi (anche la seconda riga, es. "JAN 2026"); la sfumatura comincia oltre le etichette. Allargare la fascia se serve, non restringere la parte piena.
- **X** = la percentuale più bassa, a passi di 5, per cui nel **caso peggiore** il contrasto è ≥ 4.5:1:
  - tema scuro: bianco puro dietro, per `--accent` e `--text-muted`;
  - tema chiaro: nero puro dietro, per `--accent-text` (o il token usato davvero per il mese dell'header nel chiaro) e `--text-muted`.

  Un nuovo token `--backdrop-scrim` nei tre blocchi, anche con valori diversi per tema. Atteso circa 90 % nello scuro.
- **Velo del tema scuro**: tornare a **0.2** (era 0.06 prima del task 2, ora 0.5). L'immagine deve tornare viva; la leggibilità la danno le fasce. Tema chiaro invariato (0.45).
- Footer: usare lo stesso token (oggi 85 % fisso).
- Aggiungere i casi peggiori a `tests/contrast.test.ts` (header e mesi, due temi).
- STATUS: chiudere il problema noto 20.

**Atteso**
- Con qualsiasi sfondo del gioco, data dell'header e mesi sulla linea ≥ 4.5:1 nei due temi.
- Nel tema scuro l'immagine di sfondo è più viva di adesso (velo 0.2 invece di 0.5).
- Le fasce si leggono come fasce morbide, non come rettangoli netti.

**Verifica**
- Typecheck, `npm test` (nuovi casi in `contrast.test.ts`).
- **Da verificare nel browser:** Bubbly Basin e Kirby selezionati nei due temi; Day, Week e Month (etichette dei mesi dentro la parte piena della fascia); deselezione (le fasce spariscono in 0.4 s).
