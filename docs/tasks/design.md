# Coda design — correzioni dall'audit visivo (2026-09-29)

Fonte: audit del Web Designer su `docs/design-tokens.md` e sulle pagine nel browser (1920×1080, 1440, 1280, temi chiaro e scuro).

## Regole della coda

- Un task per sessione, nell'ordine. Esegui il primo task non spuntato.
- A fine task: typecheck, `npm test`, commit, riga in `STATUS.md`, poi **spunta la casella del task in questo file** (`- [ ]` → `- [x]`) nello stesso commit.
- Niente `data:fetch`, niente `git push`, non toccare il branch `wip/perf`.
- **Non modificare `src/styles/backdrop.css`** (gruppo 4 in conflitto con `wip/perf`).
- Ogni nuovo colore di tema va scritto in **tutti e tre** i blocchi di `tokens.css`: `:root`, `@media (prefers-color-scheme: dark)` e `:root[data-theme="dark"]`.
- Report fisso: Fatto / File / Verifica / Da verificare nel browser / Aperto.
- Se un valore di questa coda è in conflitto con il codice, non inventare: fermati e scrivilo in "Aperto".

---

- [x] **Task 1 — Ordine stabile tra sfondo stagionale e sfondo del gioco**

**File**
- Da cui partire: `src/seasons/background.ts` (inserimento del canvas nel DOM), `src/styles/seasons.css`.
- Da non toccare: `src/styles/backdrop.css`, `src/timeline/*`, `main.ts`.

**Contesto / decisioni**
- Oggi `.seasons` e `.backdrop` hanno entrambi `z-index: -1` e sono inseriti con `prepend`. Il velo `.backdrop::after` sta sopra le particelle all'avvio e sotto dopo ogni ricostruzione della timeline (zoom, filtri, raggruppamento). In tema chiaro le particelle cambiano intensità da sole.
- Decisione: le particelle stanno **sempre sopra** il livello dello sfondo del gioco e **sempre sotto** tutto il contenuto (header, timeline, minimappa, footer).
- Soluzione: inserisci il canvas con `document.body.append(canvas)` al posto di `prepend`. Lascia invariato `z-index: -1`. A parità di z-index conta l'ordine del DOM, quindi il canvas finisce sempre dopo `.backdrop`, che viene aggiunto con `prepend`, e resta sotto il contenuto non posizionato.
- Non cambiare opacità, colori o comportamento dello sfondo stagionale: la taratura è nel Task 3.

**Atteso**
- Il canvas `.seasons` segue `.backdrop` nel DOM all'avvio e dopo ogni cambio di zoom, filtri e raggruppamento.
- Le particelle non passano mai sopra testo, card, header, minimappa o footer.
- Scomparsa con un gioco selezionato, scorrimento veloce e reduced motion invariati.

**Verifica**
- Se esiste un test del modulo seasons, aggiungi un caso: dopo aver ricreato un `.backdrop` con `prepend`, il canvas resta dopo di esso (`compareDocumentPosition`).
- Typecheck e `npm test`.
- Da verificare nel browser: nel tema chiaro le foglie hanno la stessa intensità prima e dopo un cambio di zoom Day → Month → Day.

---

- [x] **Task 2 — Card non selezionate attenuate senza trasparenza**

**File**
- Da cui partire: `src/styles/selection.css` (regola `filter: opacity(0.5)`, righe 10-11), `src/styles/card.css`, `src/styles/dlc-card.css` (il nastro DLC usa già uno pseudo-elemento?).
- Da non toccare: la regola del ventaglio aperto in `groups.css:80-92` (`saturate` / `brightness`), la logica di selezione in TS.

**Contesto / decisioni**
- Con `opacity(0.5)` ogni card diventa trasparente da sola. Dove due card si sovrappongono si legge il contenuto di quella sotto (es. il cerchietto "82" di Orbitals attraverso Pikmin 3 Deluxe).
- Decisione: la card resta **opaca**. L'attenuazione diventa un velo del colore della pagina posato sopra la card.

**Specifica**
- Rimuovi `filter: opacity(0.5)` dalle card non selezionate.
- Aggiungi il velo con uno pseudo-elemento libero della card. Se `::before` e `::after` sono entrambi occupati (nastro DLC, bordo Switch 2 Edition), usa un `<span class="card__dim" aria-hidden="true">` come ultimo figlio della card.
- Velo:
  - `position: absolute; inset: -2px; border-radius: calc(var(--radius-md) + 2px);`
  - `background: var(--bg); opacity: 0; pointer-events: none;`
  - `z-index` sopra tutto il contenuto della card, nastro DLC compreso; `isolation: isolate` sulla card.
- Stato "non selezionata con una selezione attiva": `opacity: 0.5` sul velo. La resa è quasi identica a oggi, ma senza trasparenza.
- Transizione del velo: `opacity 0.3s ease`, la stessa del `filter` attuale. Con reduced motion segui la regola già esistente per le card (`compact.css:40`).
- Hover su una card attenuata: mantieni il comportamento attuale, qualunque sia.
- Vale per tutti i tipi (game, switch2-edition, dlc, free-update, gruppo), per le card solo copertina (Week/Month) e per la zona TBA.

**Atteso**
- Con un gioco selezionato, due card sovrapposte non mostrano più il contenuto di quella sotto.
- La card selezionata e il ventaglio aperto sono invariati.

**Verifica**
- Typecheck e `npm test`.
- Da verificare nel browser, in entrambi i temi: selezionare Pokémon Pokopia: Bubbly Basin (5 ago 2026) e guardare Orbitals / Pikmin 3 Deluxe (fine agosto). Non deve trasparire nulla e i bordi colorati (verde, viola, gradiente) devono risultare attenuati come il resto.

---

- [x] **Task 3 — Palette e opacità delle stagioni bilanciate tra i temi**

**File**
- Da cui partire: `src/styles/tokens.css` (token `--season-*`, `--season-alpha`, nei tre blocchi).
- Da non toccare: `src/seasons/background.ts` (forma, densità, velocità restano invariate), `backdrop.css`.

**Contesto / decisioni**
- Prerequisito: Task 1 fatto, quindi il velo del backdrop non attenua più le particelle.
- Oggi il contrasto particella/sfondo è di 1.3–1.4 nel chiaro (quasi invisibile) e di 2.1–2.5 nello scuro. Obiettivo: ~1.55–1.65 nel chiaro e ~1.8–2.1 nello scuro. L'effetto deve restare percepibile e sempre secondario alle card.

**Specifica**

| Token | Chiaro (nuovo) | Scuro (nuovo) |
|---|---|---|
| `--season-winter` | `#6f8499` | `#d3dce5` (invariato) |
| `--season-spring` | `#c07890` | `#e6c3cf` (invariato) |
| `--season-summer` | `#4f8fb0` | `#a9cde0` (invariato) |
| `--season-autumn` | `#b36d3f` | `#dcae8c` (invariato) |
| `--season-alpha` | `0.40` | `0.28` |

**Atteso**
- Token aggiornati nei tre blocchi e nessun altro file modificato.

**Verifica**
- Typecheck e `npm test`.
- Da verificare nel browser (lo giudica l'utente): autunno in entrambi i temi, le foglie devono essere visibili ma mai più evidenti di tacche e numeri della linea. Per controllare le altre stagioni, spostare l'indicatore su gennaio, aprile e luglio.

---

- [ ] **Task 4 — Contrasto dei badge e dei riempimenti con testo (WCAG AA)**

**File**
- Da cui partire: `src/styles/tokens.css`, `src/styles/card.css` (badge, righe 93-101), `src/styles/dlc-card.css` (nastro), `src/styles/selection.css` (`.card-button`), `src/styles/studios.css` (badge studio), `src/styles/rankings.css` (`badge--dlc`), `src/styles/whats-new.css`, `src/styles/out-today.css`, `src/styles/header.css` (navigazione attiva), `src/styles/zoom.css`, `src/timeline/ticks.ts` e `readPalette()` in `src/timeline/timeline.ts` (pillola sotto l'indicatore).
- Da non toccare: linee, pallini, bordi, bagliori e anelli, che continuano a usare i token di base.

**Contesto / decisioni**
- Testi da 10–14 px su riempimenti colorati: serve un contrasto di almeno 4.5:1. Oggi falliscono: bianco su `--accent` scuro (3.25), bianco su `--dlc` scuro (2.68), testo su `--free-update` chiaro (3.51), bianco su `--news` (3.93 / 3.03), badge Partner chiaro (3.6), "Delayed" chiaro (3.58).
- Decisione: nuovi token `*-fill` usati **solo** dove c'è testo sopra un riempimento. Il testo su riempimento è sempre `--on-accent` (`#fff`), anche per "Free update", che oggi usa `--bg`.

**Nuovi token**

| Token | Chiaro | Scuro | Contrasto con `#fff` |
|---|---|---|---|
| `--accent-fill` | `#e60012` | `#cc2433` | 4.80 / 5.43 |
| `--dlc-fill` | `#7c3aed` | `#6d4bd8` | 5.70 / 5.76 |
| `--news-fill` | `#0066d6` | `#2466cc` | 5.42 / 5.46 |
| `--free-update-fill` | `#0b7d45` | `#1d7a4a` | 5.21 / 5.34 |
| `--accent-text` | `#b8000e` | `#ff4d5a` | testo su `--accent` 16 %: 5.16 / 4.69 |

Da modificare:

| Token | Chiaro | Scuro | Note |
|---|---|---|---|
| `--delayed-text` | `#8a5200` (era `#b36b00`) | `#ffc15e` (invariato) | Chiaro: 5.46 sul fondo al 22 % |

**Dove applicarli**
- Cerca ogni combinazione `color: var(--on-accent)`, `var(--news-text)` o `var(--bg)` su un fondo `--accent`, `--dlc`, `--news` o `--free-update`, e sostituisci il fondo con il relativo `*-fill`. Come minimo: badge "Exclusive", "Out today", "Free update", nastro e badge DLC, badge "!" e pulsante di "What's new", pulsanti della card, link di navigazione attivo, controllo zoom e anni di Rankings attivi, badge First party, chiudi del dialogo scorciatoie, "Today", pillola sotto l'indicatore sul canvas (`readPalette` deve leggere anche `--accent-fill`), chip e Salva dell'admin.
- Badge Partner (Studios) e "Timed exclusive": il testo passa a `--accent-text`, il fondo resta `--accent` al 16 %.
- "Mark all as seen": il testo passa a `--news-fill` nel chiaro. Se serve, aggiungi `--news-text-soft` con gli stessi valori di `--news-fill`: chiaro `#0066d6`, scuro `#3d95ff` (invariato).
- Interruttori accesi: invariati (nessun testo sopra).

**Atteso**
- Nessun testo su riempimento colorato sotto 4.5:1 in nessuno dei due temi.
- In "Aperto", l'elenco dei selettori modificati.

**Verifica**
- Aggiungi `tests/contrast.test.ts`: legge `tokens.css`, estrae i valori hex dei token sopra per il blocco chiaro e per i due blocchi scuri, verifica che i due blocchi scuri coincidano e che ogni coppia testo/fondo della tabella sia ≥ 4.5.
- Typecheck e `npm test`.
- Da verificare nel browser: badge e pulsanti in entrambi i temi su timeline, Rankings e Studios; la pillola del giorno sul canvas.

---

- [ ] **Task 5 — Stessa larghezza e allineamento per Rankings e Studios**

**File**
- Da cui partire: `src/styles/rankings.css`, `src/styles/studios.css`, `src/styles/tokens.css`.
- Da non toccare: logica di ordinamento e filtri, `src/rankings/main.ts` e `src/studios/main.ts` (salvo l'attributo `title` sotto).

**Contesto / decisioni**
- Rankings è larga 960 px e taglia i titoli lunghi. Studios ha un'altra larghezza, e i titoli delle due pagine non sono allineati.

**Specifica**
- Nuovo token (non di tema) in `:root`: `--page-max: 1200px`.
- Contenitore di entrambe le pagine (`.rankings`, e l'equivalente di Studios): `width: min(var(--page-max), 100% - 64px); margin-inline: auto;`.
- Titolo, sottotitolo e barra dei controlli: stesso padding superiore e stesse distanze in entrambe le pagine. Usa i valori attuali di Rankings come riferimento e riportali in "Fatto".
- Studios: 3 colonne a 1200 px, mantenendo il gap attuale.
- Rankings: il titolo resta su una riga con ellissi se serve; aggiungi `title="<nome completo>"` all'elemento del titolo.

**Atteso**
- A 1920, 1440 e 1280 px, il titolo "Rankings" e il titolo "Studios" iniziano alla stessa x e alla stessa y.

**Verifica**
- Typecheck e `npm test`.
- Da verificare nel browser: alternare Rankings e Studios a 1920 e 1280 px; nessuno spostamento del titolo tra le due pagine; "Super Mario Bros. Wonder: Nintendo Switch 2 Edition + …" più leggibile di prima.

---

- [ ] **Task 6 — Icona del tema chiaro riconoscibile (sole)**

**File**
- Da cui partire: il pulsante del tema nell'header (markup in `index.html`, `rankings.html` e `studios.html`, oppure dove viene generato), `src/styles/header.css:122-125`.
- Da non toccare: `src/theme/theme.ts` (la rotazione GSAP resta), la pagina admin.

**Contesto / decisioni**
- Nel tema chiaro l'icona è un disco nero pieno e non si capisce che è l'interruttore del tema. Lo scuro mostra la luna: il chiaro mostra il sole, cioè l'icona rappresenta il tema attuale.

**Specifica**
- Due SVG inline nel pulsante, 18×18, `viewBox="0 0 24 24"`, `fill`/`stroke` = `currentColor`:
  - sole: cerchio centrale r 5 pieno + 8 raggi (linee da r 8.5 a r 11, `stroke-width 2`, `stroke-linecap round`);
  - luna: quella attuale.
- Visibilità: sole con `data-theme="light"`, luna con `data-theme="dark"`, usando la stessa logica ad attributo di `header.css:122`.
- `aria-label` invariato.

**Atteso**
- Icona del sole nel tema chiaro e luna nello scuro, sulle tre pagine; la rotazione al clic è invariata.

**Verifica**
- Typecheck e `npm test`.
- Da verificare nel browser: cambio tema sulle tre pagine, icona corretta e animazione invariata.
