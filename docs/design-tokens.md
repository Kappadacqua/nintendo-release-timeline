# Design system attuale

Fotografia del sistema visivo di `main` al 2026-09-29, ricavata leggendo il codice (CSS, `config.ts`, moduli dei temi e delle animazioni, i quattro HTML). È la base per le specifiche visive, a partire dagli sfondi stagionali (`docs/tasks/seasons.md`). Non descrive il branch `wip/perf`.

Percorsi relativi alla root; `file:riga` si riferisce allo stato di questo commit.

**Aggiornato** (2026-09-29) dopo le code `docs/tasks/design.md` e `docs/tasks/design2.md`: token dei riempimenti con testo (WCAG AA), palette delle stagioni, velo delle card non selezionate, ordine sfondo stagionale / sfondo del gioco, larghezza di Rankings e Studios, icona del tema, interruzione dell'indicatore sulla pillola. I `file:riga` delle parti non toccate da quelle code possono essere spostati di qualche riga.

---

## 1. Temi

**Temi:** due, chiaro (predefinito) e scuro. Nessun altro tema e nessun tema per pagina.

**Meccanismo**

| Livello | Cosa fa | Dove |
|---|---|---|
| Variabili CSS | Tutti i colori di tema sono custom property su `:root`. Il tema chiaro è il valore di base. | `src/styles/tokens.css:3-84` |
| Tema scuro di sistema | `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` | `src/styles/tokens.css:86-125` |
| Tema scuro scelto | `:root[data-theme="dark"] { … }`, stesso elenco del blocco sopra (duplicato a mano). | `src/styles/tokens.css:127-164` |
| Attributo | `data-theme="light" \| "dark"` su `<html>`. Nessuna classe. | — |
| Prima del paint | Script inline che legge `localStorage.theme` e imposta `data-theme` solo se c'è una scelta salvata. | `index.html:18-24`, `rankings.html:18-24`, `studios.html:18-24`, `admin.html:11-16` |
| Runtime | `initTheme()`: all'avvio imposta **sempre** `data-theme` (scelta salvata, altrimenti sistema); segue il sistema finché l'utente non preme il pulsante; il clic salva in `localStorage` e ruota l'icona con GSAP. | `src/theme/theme.ts` |
| `color-scheme` | `light` / `dark` nei tre blocchi, quindi anche controlli nativi e scrollbar cambiano. | `tokens.css:83,123,163` |

**File che ridefiniscono valori per tema** (oltre a `tokens.css`):

- `src/styles/backdrop.css:37-53` — `--backdrop-veil` (0.45 chiaro, 0.06 scuro), con la stessa doppia regola media + attributo.
- `src/styles/groups.css:80-92` — filtro delle card non selezionate nel ventaglio (`brightness(0.95)` chiaro, `0.7` scuro), stessa doppia regola.
- `src/styles/header.css:114-140` — icona del tema: sole nel chiaro, luna nello scuro (due SVG inline nel pulsante), con la stessa doppia regola media + attributo, quindi luna corretta anche al primo paint prima di `initTheme`.

**Chi legge i colori da JS** (e quindi si aggiorna al cambio tema):

- Canvas della timeline: `readPalette()` in `src/timeline/timeline.ts:956-969` legge `--timeline`, `--month-band`, `--tick`, `--text-muted`, `--accent` (tacca dell'indicatore), `--accent-fill` (pillola del giorno), `--on-accent` e la `font-family` del body; un `MutationObserver` su `data-theme` ridisegna.
- Canvas stagionale: `readPalette()` in `src/seasons/background.ts:262` legge `--season-*` e `--season-alpha`; si aggiorna al cambio di `prefers-color-scheme` e di `data-theme`, e ridisegna le sprite delle stagioni visibili (`SpriteCache.setPalette`).

**Pagine:** timeline, Rankings e Studios chiamano `initTheme` e hanno il pulsante. **Admin no**: nessun pulsante e nessun `initTheme`, quindi segue la scelta salvata (script inline) o il sistema tramite il blocco `@media`.

---

## 2. Colori

### 2.1 Token (`src/styles/tokens.css`, più `backdrop.css`)

"=" significa che il tema scuro non ridefinisce il token.

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--red` | `#e60012` | = | Base di `--accent`/`--timeline` chiari, coriandoli |
| `--red-soft` | `#ff4d5a` | = | Base di `--accent`/`--timeline` scuri, coriandoli |
| `--accent` | `#e60012` (`--red`) | `#ff4d5a` (`--red-soft`) | Colore d'azione: selezione, focus, bordi e bagliori, mese nell'header, indicatore. **Non** come fondo sotto un testo: lì c'è `--accent-fill` |
| `--accent-fill` | `#e60012` | `#cc2433` | Riempimento con testo `--on-accent` sopra (≥ 4.5:1): badge "Exclusive" e "Out today", pulsanti della card, navigazione attiva, zoom e anni di Rankings attivi, First party, chiudi delle scorciatoie, "Today", pillola sotto l'indicatore, chip e Salva dell'admin |
| `--accent-text` | `#b8000e` | `#ff4d5a` | Testo su `--accent` al 16 %: "Timed exclusive", badge Partner |
| `--timeline` | `#e60012` | `#ff4d5a` | Linea sul canvas, pallini dei giochi, baseline della minimappa |
| `--bg` | `#ffffff` | `#0b0b0d` | Sfondo della pagina, velo dello sfondo del gioco, testo su fondo `--text` |
| `--surface` | `#f5f5f7` | `#17171b` | Pulsanti, pillole, hover delle righe nei menu |
| `--surface-2` | `#ebebef` | `#222228` | Badge neutri, segnaposto delle copertine, traccia dei cerchietti, interruttore spento |
| `--border` | `#e0e0e6` | `#2c2c33` | Tutti i bordi da 1 px, divisori |
| `--text` | `#16161a` | `#f3f3f6` | Testo principale |
| `--text-muted` | `#6b6b76` | `#9a9aa6` | Testo secondario, etichette, numeri dei giorni sul canvas |
| `--tick` | `#b4b4be` | `#4a4a55` | Tacche sul canvas, divisori dei mesi nella minimappa |
| `--connector` | `#c9c9d1` | `#3a3a43` | Linee card ↔ linea (SVG) |
| `--flag-border` | `rgb(0 0 0 / 0.28)` | `rgb(255 255 255 / 0.4)` | Contorno delle bandierine |
| `--month-band` | `rgb(0 0 0 / 0.03)` | `rgb(255 255 255 / 0.035)` | Fasce dei mesi alterni sul canvas |
| `--card` | `#ffffff` | `#141417` | Sfondo card, pannelli dei menu, ricerca |
| `--card-dlc` | `#faf7ff` | `#17141e` | Sfondo card DLC (anche riga DLC in Rankings) |
| `--card-free-update` | `#f6fcf8` | `#121a15` | Sfondo card e gruppi di aggiornamenti gratuiti |
| `--joycon-left` | `#00b8e6` | `#2ccfff` | Switch 2 Edition, metà sinistra |
| `--joycon-right` | `#ff3b4e` | `#ff5a69` | Switch 2 Edition, metà destra |
| `--dlc` | `#7c3aed` | `#a98bff` | DLC: pallini, bordo, bagliore |
| `--dlc-fill` | `#7c3aed` | `#6d4bd8` | Nastro "DLC" e badge DLC di Rankings (testo `--on-accent`) |
| `--free-update` | `#0f9d58` | `#3ddc84` | Aggiornamenti gratuiti: pallini, bordo, bagliore, numero del gruppo |
| `--free-update-fill` | `#0b7d45` | `#1d7a4a` | Badge "Free update" (testo `--on-accent`) |
| `--news` | `#0a7cff` | `#3d95ff` | "What's new": pallini, bordo in hover, tinta di "Mark all as seen", tipo di novità |
| `--news-fill` | `#0066d6` | `#2466cc` | Badge "New", cerchietto "!" (in negativo), icona e numero del pulsante "What's new" (testo `--on-accent`) |
| `--news-text-soft` | `#0066d6` | `#3d95ff` | Testo di "Mark all as seen" su `--news` al 14 % |
| `--delayed` | `#f5a623` | = | Tinta del badge "Delayed" (al 22%) |
| `--delayed-text` | `#8a5200` | `#ffc15e` | Testo "Delayed" |
| `--on-accent` | `#fff` | = | Testo e segni su tutti i riempimenti colorati (`*-fill`), anche "Free update" |
| `--switch-knob` | `#fff` | = | Pomello degli interruttori |
| `--success` | `#1a8f3c` | `#3ddc84` | "Saved" nel pannello admin |
| `--overlay` | `rgb(0 0 0 / 0.35)` | = | Velo dietro i dialoghi (scorciatoie, ricerca) |
| `--card-shadow` | `0 4px 16px rgb(0 0 0 / 0.07)` | `0 4px 16px rgb(0 0 0 / 0.5)` | Ombra a riposo di card, righe Rankings, card Studios |
| `--card-shadow-hover` | `0 10px 28px rgb(0 0 0 / 0.14)` | `0 10px 28px rgb(0 0 0 / 0.7)` | Hover card, card selezionata, pannelli, dialoghi |
| `--shadow-sm` | `0 1px 3px rgb(0 0 0 / 0.25)` | = | Pomello, segmento attivo del menu View |
| `--shadow-md` | `0 2px 8px rgb(0 0 0 / 0.2)` | = | Miniatura nell'header, copertine del gruppo chiuso |
| `--score-mighty` | `#fc430a` | = | Fascia voto "Mighty" |
| `--score-strong` | `#9d3ef0` | = | Fascia voto "Strong" |
| `--score-fair` | `#4aa1ce` | = | Fascia voto "Fair" |
| `--score-weak` | `#80b06a` | = | Fascia voto "Weak" |
| `--score-none` | `#9a9aa3` | = | Nessun voto |
| `--season-winter` | `#6f8499` | `#d3dce5` | Inverno: fiocchi dendritici, lastre esagonali, puntini morbidi, rametti di abete |
| `--season-spring` | `#c07890` | `#e6c3cf` | Primavera: petali con tacca, fiori di ciliegio, rametti fioriti, boccioli |
| `--season-summer` | `#4f8fb0` | `#a9cde0` | Estate: bolle, grappoli di bolle, conchiglie a ventaglio, stelle marine |
| `--season-autumn` | `#b36d3f` | `#dcae8c` | Autunno: foglie di acero, quercia, betulla, ginkgo |
| `--season-alpha` | `0.40` | `0.28` | Opacità delle particelle (`globalAlpha`), moltiplicata per la fascia di profondità (0.55 / 0.80 / 1.00) e per il peso della stagione nella transizione; contrasto della fascia vicina sullo sfondo ~1.6 chiaro, ~1.8–2.1 scuro |
| `--backdrop-veil` | `0.45` | `0.06` | Opacità del velo `--bg` sopra lo sfondo del gioco (`backdrop.css`) |
| `--backdrop-blur` | `28px` | = | Sfocatura dello sfondo del gioco (`backdrop.css`) |
| `--backdrop-blur-cover` | `70px` | = | Sfocatura quando lo sfondo è la copertina IGDB (`backdrop.css`) |
| `--backdrop-opacity` | `1` | = | Opacità del livello visibile (`backdrop.css`) |

Non sono colori ma stanno in `tokens.css`: `--font`, `--radius-*`, `--page-max` (1200px, larghezza del contenuto di Rankings e Studios: `min(var(--page-max), 100% − 64px)`), `--season-fade-in` / `--season-fade-out` (vedi §4-6).

**Regola dei riempimenti:** i token di base (`--accent`, `--dlc`, `--news`, `--free-update`) valgono per linee, pallini, bordi, bagliori e anelli; dove c'è testo sopra un riempimento si usa il `*-fill` corrispondente con testo `--on-accent`. `tests/contrast.test.ts` controlla che ogni coppia sia ≥ 4.5:1 in entrambi i temi (anche `--accent-fill` con `brightness(0.9)`, l'hover dei pulsanti della card) e che i due blocchi scuri coincidano.

**Custom property impostate da JS o per componente** (non sono token di tema):

| Proprietà | Dove si imposta | Scopo |
|---|---|---|
| `--card-scale` | `timeline.ts:587` | Rimpicciolimento delle card su finestre basse (min 0.55) |
| `--w-full`, `--w-compact`, `--w-cover` | `card.ts:168-170`, `group.ts:37-39` | Larghezze della card nei tre modi |
| `--i` | `group.ts:60` | Indice della copertina nel gruppo chiuso (ventaglio) |
| `--dot` | `dots.css` | Colore del pallino per tipo |
| `--ring` | `card.css:175-194` | Colore della fascia voto in cerchietto, sparkline, pillole di Rankings |
| `--pill-top`, `--pill-bottom` | `timeline.ts:999-1000` (su `.timeline__stage`, da `PILL` in `ticks.ts:33`) | Bordi della pillola del giorno: la linea dell'indicatore si interrompe lì |

### 2.2 Colori derivati con `color-mix`

Molti colori non sono token ma miscele di un token. I più visibili, calcolati:

| Espressione | Chiaro | Scuro | Dove |
|---|---|---|---|
| `color-mix(--accent 45%, --border)` | `#e37b87` | `#8b3b45` | Bordo della card in hover (`card.css:17`) |
| `color-mix(--accent 35%, --border)` | `#e2929c` | `#763841` | Bordo tratteggiato della zona TBA (`tba.css:9`) |
| `color-mix(--dlc 55%, --border)` | `#a985ea` | `#7160a3` | Bordo card DLC (`dlc-card.css:5`) |
| `color-mix(--free-update 55%, --border)` | `#6dbb98` | `#358d60` | Bordo card/gruppo aggiornamento gratuito (`dlc-card.css:11`, `groups.css:10`) |

Miscele con `transparent` (equivalenti a un rgba del token): `--accent` al 10 % (fascia "upcoming"), 12 % (risultato di ricerca attivo, righe della TBA nella minimappa), 14 % (lacune admin), 16 % (badge "Timed exclusive", badge studio partner), 18 % (barra della presentazione), 30-75 % (bagliori); `--news` al 14 % (fondo di "Mark all as seen") e 60 %; `--delayed` al 22 %; `--text` al 6 % (riquadro della minimappa); `--bg` all'80 % (`.timeline__band`) e 85 % (minimappa, controllo zoom, footer su sfondo); `--surface` al 70 % (zona TBA).

### 2.3 Colori scritti a mano, fuori dai token

| Valore | File:riga | Uso |
|---|---|---|
| `#ff8a95`, `#b3000e`, `#fff` | `src/cards/confetti.ts:3` | Coriandoli "Out today" (con `var(--red)` e `var(--red-soft)`); stessi colori nei due temi |
| `#fff`, `#bc002d` | `src/cards/flags.ts:9` | Bandiera giapponese |
| `#039`, `#fc0` | `src/cards/flags.ts:12,15` | Bandiera UE |
| `#fff`, `#b22234`, `#3c3b6e` | `src/cards/flags.ts:20-22` | Bandiera USA |
| `%23e60012` + `white` | `index.html:10`, `rankings.html:10`, `studios.html:10` | Favicon SVG inline (rosso fisso, anche in tema scuro; admin senza favicon) |
| `#000`, `transparent` | `src/styles/selection-extras.css:13-14` | Maschera della `.timeline__band` (non visibile come colore) |
| `#000`, `transparent` | `src/styles/timeline.css:98-104` | Maschera dell'indicatore, interrotto 3 px sopra e sotto la pillola (non visibile come colore) |
| `#000`, `rgb(0 0 0 / 0)` | `src/seasons/background.ts:216-219` | Maschera `destination-out` che sfuma le particelle sulla fascia della linea (non visibile come colore) |

Opacità scritte a mano che agiscono come colore:

| Valore | File:riga | Uso |
|---|---|---|
| `globalAlpha 0.45` | `src/timeline/timeline.ts:1065,1077` | Linea futura tratteggiata, segno di interruzione prima della TBA |
| `globalAlpha 0.3` | `timeline.ts:1086` | Guida punteggiata nella zona TBA |
| `globalAlpha 0.55` | `src/timeline/ticks.ts:55` | Tacche e numeri dei giorni futuri |
| `opacity 0.85` / `0.7` | `src/styles/delays.css:29,43` | Fantasma e arco della data originale |
| `opacity 0.55` | `src/styles/whats-new.css:188` | Voce disabilitata di "What's new" |
| velo `--bg` a `opacity 0.5` | `src/styles/selection.css:12-26` | Card non selezionate (la card resta opaca) |
| `filter: brightness(0.9)` | `src/styles/selection.css:100` | Hover dei pulsanti della card |
| `saturate(1.25)` / `saturate(1.4)` | `src/styles/backdrop.css:15,21` | Sfondo del gioco / copertina |

---

## 3. Colori per tipo di elemento

### 3.1 Tipi di voce

| | Game | Switch 2 Edition | DLC | Free update |
|---|---|---|---|---|
| **Classe** | `card--game` | `card--switch2-edition` | `card--dlc` | `card--free-update` |
| **Bordo** | 1px `--border`; uscita futura: tratteggiato | 2px trasparente su gradiente 90° `--joycon-left` 0-35 % → `--joycon-right` 65-100 % (`switch2-edition.css`) | 2px `mix(--dlc 55%, --border)` | 2px `mix(--free-update 55%, --border)` |
| **Sfondo** | `--card` | `--card` (padding-box) | `--card-dlc` | `--card-free-update` |
| **Forma** | card piena, padding 12 | come Game | più bassa: padding 10/12, copertina 56×75, titolo 13.5 px su 2 righe, `overflow: clip` con `overflow-clip-margin: 2px` (il nastro è tagliato sul bordo esterno, così il velo di attenuazione copre anche il bordo) | come Game, data unica "Worldwide" al posto delle tre bandiere |
| **Badge / segno** | "Exclusive" (`--accent-fill`, testo `--on-accent`), "Timed exclusive" (`--accent` 16 %, testo `--accent-text`) | "Switch 2 Edition": fondo `--text`, testo `--bg` | nastro "DLC" a 45° in alto a destra: fondo `--dlc-fill`, testo `--on-accent`, 10 px/900, spaziatura 0.12em (`dlc-card.css:28`). In Rankings `badge--dlc`: fondo `--dlc-fill`, testo `--on-accent` | "Free update": fondo `--free-update-fill`, testo `--on-accent` |
| **Hover** | bordo `mix(--accent 45%, --border)`, `--card-shadow-hover` | bordo resta trasparente (gradiente visibile), ombra hover | bordo resta viola, ombra hover | bordo resta verde, ombra hover |
| **Selezionato** | bordo `--accent` + anello `0 0 0 3px --accent` + bagliore `0 0 18px 4px` accent 65 % + `0 0 60px 14px` accent 38 % + ombra hover (`selection.css:14-21`) | niente anello; quattro bagliori laterali: `∓16px 0 30px 2px` Joy-Con 80 %, `∓30px 0 70px 10px` Joy-Con 40 %, sinistro a sinistra e destro a destra (`selection-extras.css:33-40`) | niente anello; bagliore `18px 4px` `--dlc` 65 % + `60px 14px` `--dlc` 38 % (`selection-extras.css:83-88`) | niente anello; bagliore uguale in `--free-update` (`selection-extras.css:70-75`) |
| **Pallino sulla linea** | pieno `--timeline` 12 px (bordo 3 px); futuro: anello con centro `--bg` | diviso a metà sinistro/destro, anche come anello | `--dlc`, **quadrato** (raggio 3 px) | `--free-update`, tondo |
| **Pallino minimappa** | 7 px, stesso schema | stesso schema | quadrato (raggio 1.5 px) | tondo verde |

Varianti comuni a tutti i tipi:

- **Non selezionata con una selezione attiva:** la card resta **opaca**; sopra c'è un velo `.card::after` in `--bg` a `opacity 0.5` (`inset: -2px`, raggio `--radius-md` + 2, `z-index` 10 sopra tutto il contenuto, nastro DLC compreso; `isolation: isolate` sulla card; transizione `opacity 0.3s ease`, nessuna con reduced motion) (`selection.css:1-32`). Due card sovrapposte non si vedono più l'una attraverso l'altra. Nel ventaglio aperto il velo non c'è: resta `saturate(0.5) brightness(0.95)` chiaro / `brightness(0.7)` scuro (`groups.css:80-92`).
- **Out today:** badge `--accent-fill` con alone `0 0 0 2px` accent 30 % e "★"; card che pulsa tra `0 0 0 1px` accent 35 % + `0 0 10px` accent 20 % e `0 0 0 2px` accent 75 % + `0 0 30px` accent 55 % (`out-today.css`).
- **Rinviato:** badge con fondo `--delayed` 22 %, testo `--delayed-text` (`#8a5200` nel chiaro); fantasma della data originale tratteggiato `--text-muted`.
- **Novità:** badge `--news-fill` con cerchietto "!" invertito (fondo `--on-accent`, "!" `--news-fill`); nella minimappa pallino 11 px `--news` con alone.
- **Gruppo dello stesso giorno:** card normale con copertine a ventaglio; se sono solo aggiornamenti gratuiti bordo e fondo verdi e numero in `--free-update` (`groups.css:9-20`). Pallino 18 px (bordo 4); giorno misto giochi + aggiornamenti: pallino diviso `--timeline` / `--free-update` (`dots.css:47-58`).
- **Fascia voto** (`--ring`): cerchietto 44 px, tratto 4, traccia `--surface-2`; numero 14 px/900 nel colore della fascia.

### 3.2 Tipi di studio (`src/styles/studios.css`)

Solo il badge cambia; la card dello studio è identica per tutti (bordo `--border`, fondo `--card`, `--card-shadow`).

| Tipo | Classe | Fondo badge | Testo badge |
|---|---|---|---|
| First party | `studio-badge--first-party` | `--accent-fill` | `--on-accent` |
| Partner | `studio-badge--partner` | `--accent` 16 % | `--accent-text` |
| Terze parti | `studio-badge--third-party` | `--surface-2` (badge di base) | `--text-muted` |

Stato del gioco mostrato: "Upcoming" in `--accent` (`studios.css:193`), altrimenti `--text-muted`. Blocco "No Switch 2 game yet": bordo tratteggiato `--border`.

---

## 4. Tipografia

**Famiglia:** una sola, `--font` = `"Nunito", "M PLUS Rounded 1c", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif` (`tokens.css:4`). Nunito arriva da Google Fonts con i pesi **400, 600, 700, 800, 900** (i quattro HTML, riga 15 o 10). "M PLUS Rounded 1c" non viene caricata: vale solo se installata. Il canvas usa la `font-family` calcolata del body (`timeline.ts:965`).

**Pesi in uso:** 400 (testo corrente: descrizioni, `dd`, footer, piccoli testi senza peso), 600 (data barrata dei rinvii, campi admin), 700 (meta, date, didascalie), 800 (titoli di card, pulsanti, badge, etichette), 900 (titoli di pagina, numeri, etichette maiuscole).

**Scala delle dimensioni** (px, con il numero di occorrenze nel CSS):

| Px | Occ. | Dove |
|---|---|---|
| 40 | 1 | Anno nell'header (900, −0.03em) |
| 34 | 1 | "TBA" nella zona TBA (900, −0.02em, lh 1) |
| 28 | 2 | Titolo di Rankings e Studios (900, −0.01em) |
| 22 | 7 | Titolo del sito (900, −0.01em), mese e giorno nell'header (800), posizione e media in Rankings (900), titolo admin |
| 20 | 1 | Titolo del dialogo scorciatoie |
| 18 | 4 | Nome del gioco selezionato nell'header, icone dei pulsanti tondi, campo di ricerca (700), link admin |
| 16 | 4 | Titolo pannello "What's new", numero del gruppo, titolo riga Rankings, nome studio |
| 15 | 5 | Titolo card (800, lh 1.25), primo risultato di ricerca, messaggi di stato/lista vuota |
| 14 | 19 | Pulsanti e link di navigazione (800), valore del cerchietto (900), testo del dialogo, campi |
| 13.5 | 2 | Titolo card DLC, titolo voce "What's new" |
| 13 | 17 | Contatori, segmenti del menu View, sottotitoli di sezione |
| 12.5 | 1 | Riassunto nella card selezionata (lh 1.45) |
| 12 | 28 | Meta della card (lh 1.35), etichetta "Today", didascalie, footer, pulsanti piccoli — il livello più usato |
| 11.5 | 3 | Date della card (700), pulsanti della card, data in "What's new" |
| 11 | 6 | Legend e titoletti maiuscoli (900, 0.08em), anno originale |
| 10.5 | 3 | Badge (800), tipo di novità, lacune admin |
| 10 | 6 | Titoli dei gruppi di voti (900, 0.1em, maiuscolo), fonte del voto, nastro DLC, regione della data |
| 9.5 | 2 | Numero di recensioni, "!" del badge novità |
| 9 | 3 | Mesi e "TBA" della minimappa, "1 of 2 sources" |

Sul canvas della timeline (`src/timeline/ticks.ts`): numeri dei giorni / settimane **700 11px**, mesi **800 13px**, pillola sotto l'indicatore **900 14px** (testo `--on-accent` su `--accent-fill`; posizione e misure in `PILL`, `ticks.ts:33`: 22 px sotto la linea, alta 22).

**Line-height:** di default `normal` di Nunito. Valori espliciti: 1 (icone, "TBA", minimappa), 1.1 (media Rankings), 1.15 (header), 1.2 (nome gioco nell'header, fonte voto), 1.25 (titoli di card, riga Rankings, studio, anteprima minimappa, etichetta zoom), 1.3 (titolo gioco in Studios), 1.35 (meta card), 1.4 (`kbd`), 1.45 (riassunto).

**Maiuscolo spaziato** (sempre 900 e `--text-muted`, salvo "Upcoming" in `--accent`): 0.04em (quando/tipo novità), 0.06em (titoli del dialogo), 0.08em (legend View, sezioni "What's new", "Upcoming", "TBA" minimappa), 0.1em (gruppi di voti, sottotitolo TBA, etichette Rankings), 0.12em (nastro DLC).

**Numeri:** `font-variant-numeric: tabular-nums` su giorno nell'header, valori dei cerchietti, contatori, posizioni in Rankings, contatore della presentazione.

---

## 5. Spaziature, raggi, ombre e bagliori

### 5.1 Spaziature

Nessun token di spaziatura: i valori sono sparsi. Quelli ricorrenti:

| Px | Uso tipico |
|---|---|
| 2, 3, 4 | Distanze dentro badge, cerchietti, gruppi di badge (gap 4), padding dei segmenti (3) |
| 6 | Gap tra pulsanti della card, azioni dell'header sotto 1660 px, margini di meta |
| 8 | Gap nei pulsanti con icona, padding dei pannelli filtri, distanza pannello ↔ pulsante (`top: calc(100% + 8px)`) |
| 10 | Gap delle azioni dell'header, margine sopra date e voti nella card |
| 12 | Padding card, gap copertina ↔ testo, gap delle righe nei menu |
| 14, 16 | Padding pannelli (View 12/14), gap e padding di Rankings/Studios |
| 20, 24 | Gap tra card nella zona TBA (20), padding dialoghi e zona TBA (24) |
| 32 | Margine laterale della pagina: header, footer, minimappa, controllo zoom; 24 sotto 1660 px (solo header). Rankings e Studios: contenuto largo `min(--page-max 1200px, 100% − 64px)`, padding 32 sopra e 48 sotto, testata con 20 sotto, `scrollbar-gutter: stable` (i titoli delle due pagine allineati) |

Costanti di layout della timeline (`src/timeline/config.ts`): `cardOffset` 64 (distanza linea ↔ prima card, fascia di numeri e mesi), `stackStepY` 56 / `stackStepX` 22 (pile), `laneGap` 16, `tbaGapPx` 240, `minimapBandPx` 64, `minCardScale` 0.55. Larghezze: gruppo 240 (`group.ts:13`), card solo copertina 74 (`card.ts:14`).

### 5.2 Raggi

| Token | Valore | Uso |
|---|---|---|
| `--radius-sm` | 8px | Copertine, righe dei menu, fascia "upcoming", campi, anteprima minimappa, etichetta zoom |
| `--radius-md` | 14px | Card, pannelli dei menu, righe di Rankings, card di Studios |
| `--radius-lg` | 22px | Zona TBA, dialoghi scorciatoie e ricerca |
| (fisso) | 999px | Tutte le pillole: pulsanti, navigazione, badge, segmenti, interruttori |
| (fisso) | 50% | Pallini, pulsanti tondi 44 px |

Raggi fuori scala: 1px (coriandoli, "Today" minimappa), 1.5px (bandiere, pallino DLC minimappa), 2px (focus del link studio), 3px (pallino DLC), 4px (miniature ricerca e admin), 5px (miniature "What's new" e anteprima), 6px (miniatura header, `kbd`, TBA minimappa), 7px (riquadro minimappa), 11px (pillola sul canvas, `PILL.height / 2`, `ticks.ts:107`), 12px (minimappa).

### 5.3 Ombre

| Ombra | Dove |
|---|---|
| `--card-shadow` | Card a riposo, righe Rankings, card Studios |
| `--card-shadow-hover` | Card in hover e selezionata, pannelli (filtri, View, "What's new"), anteprima minimappa, dialoghi |
| `--shadow-sm` | Pomello interruttore, segmento attivo |
| `--shadow-md` | Miniatura nell'header, copertine del gruppo chiuso |
| `inset 3px 0 0 --accent` | Risultato di ricerca attivo (`search.css:97`) |
| `inset 0 0 0 1.5px --ring` | Cerchietto/media su cui si ordina in Rankings (`rankings.css:288,301`) |

### 5.4 Bagliori e sfocature

| Effetto | Valori | Dove |
|---|---|---|
| Selezione (game) | anello 3px + `0 0 18px 4px` 65 % + `0 0 60px 14px` 38 % | `selection.css:16-20` |
| Selezione DLC / free update | `0 0 18px 4px` 65 % + `0 0 60px 14px` 38 % nel colore del tipo | `selection-extras.css:70-88` |
| Selezione Switch 2 Edition | `∓16px 0 30px 2px` 80 % + `∓30px 0 70px 10px` 40 % | `selection-extras.css:33-40` |
| Out today | pulsazione 1px/10px ↔ 2px/30px | `out-today.css:17-31` |
| Pallino novità (minimappa) | `0 0 0 2px --news` + `0 0 10px 2px` 60 % | `whats-new.css:33` |
| Oggi | anello `--bg` 3px, pulsazione fino a scala 3.2 | `timeline.css:109-138` |
| Sfocatura sfondo gioco | 28px (70px per la copertina), bordi fuori di 80px | `backdrop.css:13-21` |
| Vetro | `backdrop-filter: blur(8px)` su minimappa e controllo zoom | `minimap.css:14`, `zoom.css:111` |
| Indicatore | gradiente verticale `--accent` 45 % tra il 12 % e l'88 %, interrotto da una `mask-image` da 3 px sopra a 3 px sotto la pillola del giorno (`--pill-top` / `--pill-bottom`) | `timeline.css:84-106` |

---

## 6. Movimento

### 6.1 Transizioni CSS

| Durata · easing | Proprietà | Scopo | File:riga | Reduced motion |
|---|---|---|---|---|
| 0.3s ease | background, color | Cambio tema della pagina | `base.css:192` | invariata |
| 0.3s ease | opacity, transform (±6px) | Titolo del sito ↔ gioco selezionato | `header.css:43` | solo opacity |
| 0.2s ease | background, color | Link di navigazione | `header.css:163` | nessuna |
| 0.2s ease | box-shadow, border-color | Hover e selezione card | `card.css:11`, `selection.css:5` | nessuna (`compact.css:40`) |
| 0.3s ease | opacity | Velo delle card non selezionate | `selection.css:21` | nessuna (`selection.css:28`) |
| 0.35s ease | width, margin-left | Card piena ↔ compatta | `compact.css:8-15` | nessuna |
| 0.35s ease | transform | Scala delle card durante il cambio stile | `compact.css:37` | nessuna regola |
| 0.4s ease | opacity | Dissolvenza tra sfondi del gioco | `backdrop.css:17` | nessuna |
| 0.4s ease | opacity / background | Fascia dietro la linea, footer su sfondo | `selection-extras.css:16,25` | nessuna regola |
| 0.3s ease | opacity | Indicatore che sparisce nella zona TBA | `selection-extras.css:50` | nessuna regola |
| 0.2s ease | background / transform | Interruttore: fondo / pomello | `filters.css:80,93` | pomello: nessuna |
| 0.2s ease | background, color | Segmenti del menu View | `view-menu.css:91` | nessuna regola |
| 0.25s ease | transform | Ventaglio chiuso che si apre in hover | `groups.css:42` | nessuna |
| 0.15s (ease) | border-color | Campi e "Reset" di Rankings | `rankings.css:53,183` | nessuna regola |
| `--season-fade-in` 0.6s ease | opacity | Comparsa sfondo stagionale | `seasons.css:13` | nessuna |
| `--season-fade-out` 0.2s | opacity | Scomparsa sfondo stagionale | `seasons.css:19` | nessuna |

### 6.2 Animazioni CSS

| Nome | Durata · easing | Scopo | File | Reduced motion |
|---|---|---|---|---|
| `today-pulse` | 1.8s ease-out infinite | Onda del pallino "oggi" | `timeline.css:126` | ferma |
| `out-today-glow` | 1.8s ease-in-out infinite | Bagliore delle card "Out today" | `out-today.css:14` | ferma |
| `presentation-fill` | 6000ms linear (da `presentationSeconds`), inline | Barra del tempo in presentazione | `presentation.ts` | barra nascosta, contatore "3 / 20" |
| `presentation-toast` | 2.6s ease forwards | Avvisi della presentazione ("Presentation · Space to pause…", "Paused", "Presentation stopped") | `presentation.css:78` | visibile fermo, senza movimento |

### 6.3 GSAP

| Durata · easing | Scopo | File:riga | Reduced motion |
|---|---|---|---|
| 0.45s `back.out(2)` | Icona del tema: rotazione −90° e scala 0.6 → 1 | `theme/theme.ts:46-50` | nessuna |
| 0.25s `power2.out` | Connettore che cresce | `cards/appear.ts:29` | stato finale |
| 0.55s `back.out(1.4)`, ritardo 0.1s | Card che sale dalla linea (scala 0.7, 48px) | `cards/appear.ts:30-42` | stato finale |
| 0.9s `power2.out`, sfalsati di 0.08s da 0.45s | Riempimento cerchietti e conteggio del voto | `cards/score-ring.ts:85-91` | valore finale |
| 0.9-1.4s `power2.out` / `power1.in`, uscita 0.3s | Coriandoli (28 pezzi) | `cards/confetti.ts:21-41` | nessun coriandolo |
| 0.3s `power2.out` | Card selezionata: scala 1.05 | `cards/expand.ts:161` | istantaneo |
| 0.35s `power2.out` | Apertura del contenuto extra | `cards/expand.ts:162` | istantaneo |
| 0.2s / 0.25s `power2.out` | Adattamento della card aperta alla finestra | `cards/expand.ts:146,154` | 0 |
| 0.25s `power2.out` / `power2.in` | Chiusura della card | `cards/expand.ts:172-176` | 0 |
| 0.35s `power2.out`; chiusura 0.28s `power2.in` | Parti della card che si aprono/chiudono (piena ↔ compatta) | `cards/compact.ts:6,34-43` | nessuna |
| 0.35s `power2.out` / `power1.in` | Card e connettori che scivolano al cambio stile | `timeline/timeline.ts:813-814` | nessuna |
| 0.12s `power1.in` + 0.24s `power3.out` | Cambio di anno / mese / giorno nell'header (±60 %) | `timeline/header.ts:62-69` | testo diretto; anche sotto 250 ms tra cambi |
| 0.45s `back.out(1.2)`, sfalsati di 0.025s | Apertura del ventaglio (scala 0.6) | `timeline/group.ts:21,180-188` | istantaneo |
| 0.27s `power2.in` | Pila che sparisce all'apertura | `group.ts:177` | istantaneo |
| 0.3s `power2.in` / `power2.out` (ritardo 0.12s) | Chiusura del ventaglio / ritorno della pila | `group.ts:22,212-221` | istantaneo |
| 0.3s `power2.out` | Card del ventaglio che si riposizionano | `group.ts:155` | istantaneo |
| 0.3s `power2.out` | Cambio zoom: scena da 0.85 o 1.18, opacità 0 | `zoom-control.ts:43-50` | nessuna |
| 0.35s `power2.out`, sfalsati di 0.03s; cambio lista 0.22s | Entrata righe Rankings | `rankings/main.ts:331,353` | nessuna |
| 0.35s `power2.out`, sfalsati di 0.02s; cambio lista 0.22s | Entrata card Studios | `studios/main.ts:179-191` | nessuna |

### 6.4 Movimento in JS (senza GSAP)

| Valore | Scopo | Dove |
|---|---|---|
| `smoothing` 0.16 per frame | Inseguimento del bersaglio (rotella, frecce) | `config.ts:18` |
| `min(600, 250 + 0.12·px)` ms, cubic in-out | Salti lunghi (oltre 300px) | `scroller.ts:77,181` |
| `flingFriction` / `wheelFlingFriction` 0.94 per frame | Inerzia di trascinamento e rotella | `config.ts:24,46` |
| `SEASONS.fadeInMs` 800 | Comparsa di una particella | `config.ts:91` |
| `SEASONS.crossDelayMs` 300, `crossInMs` 2000 (ease-out) | Transizione incrociata: il peso della nuova stagione sale a 1 dopo il ritardo | `config.ts:97-98` |
| `SEASONS.crossOutMs` 1500 (ease-in) | Transizione incrociata: il peso delle altre stagioni scende a 0, senza ritardo | `config.ts:99` |
| `SEASONS.crossCap` 1.3 | Tetto delle particelle disegnate durante la transizione (× il numero pieno) | `config.ts:101` |
| `SEASONS.restMs` 500 | Ritorno dello sfondo dopo lo scorrimento veloce | `config.ts:103` |
| `SEASONS.bands` | Fasce di profondità lontana / media / vicina: quota 45 / 35 / 20 %, dimensione × 0.55 / 1 / 1.6, velocità × 0.6 / 1 / 1.5, opacità × 0.55 / 0.80 / 1, contorno 1.2 / 1.4 / 1.6 px | `config.ts:167` |
| `SEASONS.wobbleAmpPx` [12, 40], `wobblePeriodS` [4, 9] | Ondeggiamento laterale `x0 + A · sin(2πt / T + φ)` (px a 1080p, s); ogni stagione può allargarlo (`spring`, `summer`, `leaves`, `winter.fir`) | `config.ts:173-174` |
| `SEASONS.tiltDeg` 35 | Inclinazione fissa di ogni particella (± gradi): nessuna rotazione nel tempo | `config.ts:176` |
| `SEASONS.sizeJitter` 0.12, `viewHeight` 1080, `viewScale` [0.75, 1.25] | Dimensione ± 12 % nella fascia; dimensioni e ampiezze scalano con `innerHeight / 1080` | `config.ts:178-181` |
| `SEASONS.variants` 6 / 3, `spriteSeed` 1789, `sprite` | Sprite pre-renderizzate per tipo (comuni / rari) × fascia, con seme fisso; stile del tratto (riempimento 0.16, nervature 0.8 × e 0.7, secondo tratto 0.6–0.8 px a 0.45) | `config.ts:183-187` |
| `SEASONS.spring`, `summer`, `leaves`, `winter` | Quote dei tipi di ogni stagione e movimenti propri (bolle che salgono, conchiglie e stelle che scendono a × 0.35, raffiche invernali ± 20 px/s per 2 s ogni 6–12 s, rametto di abete × 0.7) | `config.ts:115-153` |
| `presentationSeconds` 6, `presentationCursorMs` 2500 | Ritmo della presentazione, cursore nascosto | `config.ts:81-83` |

### 6.5 `prefers-reduced-motion`

- **CSS** (`@media (prefers-reduced-motion: reduce)`): `header.css:191`, `selection.css:28`, `timeline.css:140`, `backdrop.css:55`, `seasons.css:22`, `out-today.css:50`, `filters.css:120`, `compact.css:40`, `groups.css:112`, `presentation.css:123`.
- **JS** (`matchMedia`): `theme.ts`, `appear.ts`, `expand.ts`, `compact.ts`, `header.ts`, `group.ts`, `scroller.ts` (salti immediati, niente inerzia), `timeline.ts:768` (niente animazione al cambio stile), `zoom-control.ts`, `presentation.ts` (contatore al posto della barra), `rankings/main.ts`, `studios/main.ts`, `seasons/background.ts` (particelle ferme), `view.ts` (sfondo stagionale spento per impostazione predefinita).
- **Senza regola reduced motion:** transizioni di opacità e colore (fascia, footer, indicatore, segmenti, campi di Rankings), trasformazione di scala durante il cambio stile (`compact.css:37`), cambio tema del body. Sono dissolvenze, non movimenti, tranne la scala.

---

## 7. Livelli

### 7.1 z-index

| Valore | Elemento | Contesto | File |
|---|---|---|---|
| −1 | `.backdrop` (fisso), aggiunto con `prepend` | radice | `backdrop.css:5` |
| −1 | `.seasons` canvas (fisso), aggiunto con `append`: sempre dopo `.backdrop` | radice | `seasons.css:6`, `background.ts:52` |
| 1 | Pallino novità nella minimappa | minimappa | `whats-new.css:27` |
| 2 | Anteprima della minimappa | minimappa | `minimap-preview.css:13` |
| 2 | Card selezionata nella zona TBA | blocco TBA | `selection.css:28` |
| 5 | Etichetta del titolo (Week/Month) | card (`isolation: isolate`) | `zoom.css:42` |
| 10 | Velo delle card non selezionate (`.card::after`) | card (`isolation: isolate`) | `selection.css:15` |
| `10 − livello` (inline) | `.tl-item` nelle pile | `.timeline__world` | `timeline.ts:736` |
| n (inline) | Copertine del gruppo chiuso | card gruppo | `group.ts:61` |
| 20 | Pallino "oggi" | `.timeline__world` | `timeline.css:103` |
| 25 | `.tl-item:hover` | `.timeline__world` | `timeline-items.css:30` |
| 26 | `.tl-item:focus-within` | `.timeline__world` | `timeline-items.css:21` |
| 30 | Minimappa | `.timeline` | `minimap.css:5` |
| 35 | Controllo zoom | `main` | `zoom.css:103` |
| 38 | `.tl-item:hover` in Week/Month | `.timeline__world` | `zoom.css:68` |
| 39 | Voce con ventaglio aperto | `.timeline__world` | `groups.css:72` |
| 40 | Voce selezionata | `.timeline__world` | `selection.css:24` |
| 50 − distanza / 100 (inline) | Card del ventaglio / selezionata | voce del ventaglio | `group.ts:152` |
| 50 | Coriandoli | gruppo della card | `out-today.css:35` |
| 60 | Pannelli: filtri, View, "What's new" | radice (l'header non è posizionato) | `filters.css:43`, `view-menu.css:29`, `whats-new.css:92` |
| 90 | Barra e contatore della presentazione | radice | `presentation.css:6,33` |
| 91 | Avviso della presentazione | radice | `presentation.css:62` |
| 99 | Card del ventaglio in hover | voce del ventaglio | `groups.css:76` |
| top layer | Dialoghi `<dialog>` scorciatoie e ricerca, con `::backdrop` `--overlay` | — | `shortcuts.css`, `search.css` |

`.timeline__world` ha `will-change: transform`, quindi crea un contesto di sovrapposizione: gli z-index delle voci (10-40) valgono solo tra le voci e restano sotto la minimappa (30) e il controllo zoom (35).

### 7.2 Ordine di sovrapposizione della timeline (dal basso)

1. Sfondo del `body` (`--bg`), propagato alla radice.
2. **Livello −1**, nell'ordine del DOM:
   - `.backdrop` (aggiunto con `prepend` al `body`, anche a ogni ricostruzione della timeline): due livelli con l'immagine del gioco (visibili solo con un gioco selezionato che ha uno sfondo) e **sopra, sempre presente, il velo `::after` in `--bg`** all'opacità di `--backdrop-veil` (0.45 chiaro, 0.06 scuro);
   - canvas stagionale `.seasons` (aggiunto con `append` al `body`, `background.ts:52`): a parità di z-index conta l'ordine del DOM, quindi sta **sempre sopra** `.backdrop` e il suo velo, all'avvio e dopo zoom, filtri o raggruppamento.
3. Header (non posizionato, nel flusso).
4. Dentro `main` → `.timeline` → `.timeline__stage`, nell'ordine del DOM (`timeline.ts:227`):
   1. `.timeline__band`: fascia `--bg` 80 % dietro la linea, visibile solo con sfondo del gioco;
   2. `.timeline__canvas`: fasce dei mesi, linea, tacche, numeri, pillola;
   3. `.timeline__playhead`: indicatore verticale, interrotto sulla pillola del giorno (maschera, §5.4) così non attraversa il numero;
   4. `.timeline__world`: pallino oggi, fantasmi dei rinvii, voci (connettore, pallino, card).
5. Minimappa (30), controllo zoom (35).
6. Pannelli dei menu (60).
7. Barra/contatore/avviso della presentazione (90-91).
8. Dialoghi (top layer).

**Per il canvas stagionale:** livelli invariati dalle tre fasce di profondità (sono un ordine di disegno dentro lo stesso canvas: lontana, media, vicina). Sta al livello −1, sopra lo sfondo del gioco e sotto l'header e tutta la timeline; attraversa anche l'header e il footer (è `position: fixed; inset: 0`). Le particelle sfumano via nella fascia della linea (`.timeline__band` letta da `background.ts:227`, bordi `bandFeatherPx` 24).

---

## 8. Breakpoint e media query

Il sito è solo desktop: `body { min-width: 1280px }` (`base.css:186`), admin `1100px` (`admin.css:4`). Nessun breakpoint verso il basso oltre questi.

| Condizione | Effetto | File:riga |
|---|---|---|
| `max-width: 1659px` | Titolo "Nintendo Release Timeline" → pallino + "NRT" (il nome resta per i lettori di schermo); header a griglia `clamp(88px, 100vw − 1180px, 200px) · minmax(0,1fr) · auto`, `column-gap` 24, padding laterale 24; data senza larghezza minima (sopra: `min-width: 420px`); gap delle azioni 6 (sopra: 10) | `header.css:204-233` |
| `max-width: 1500px` | "What's new" solo icona e numero, senza etichetta | `whats-new.css:259-267` |
| `prefers-color-scheme: dark` | Tema scuro se non c'è una scelta salvata | `tokens.css:74`, `backdrop.css:45`, `groups.css:88` |
| `prefers-reduced-motion: reduce` | Vedi §6.5 | — |

**Soglia dei 1440 px:** non esiste più. Era la soglia dell'header in fixes-3 task 2; nei "Ritocchi finali" è passata a **1660 px** (`max-width: 1659px`). Sotto 1660 l'header mostra "NRT", da 1660 in su il nome intero.

Misure che dipendono dalla finestra: dialogo scorciatoie `min(460px, 100vw − 32px)`, ricerca `min(620px, 100vw − 32px)` a `12vh` dall'alto, pannello "What's new" alto al massimo `min(560px, 100vh − 100px)`. Densità del canvas stagionale limitata a 1.5 (`SEASONS.maxDpr`); numero di particelle da 20 (1280×720) a 40 (2560×1440).

---

## 9. Stati

### 9.1 Focus

Regola unica: `:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }` (`header.css:108`). Outline sempre visibile da tastiera, mai rimosso globalmente. Eccezioni:

| Elemento | Outline | File:riga |
|---|---|---|
| Card | 3px, offset 3 | `timeline-items.css:24` |
| Interruttori (input nascosto) | 3px, offset 2, sull'interruttore visibile | `filters.css:104` |
| Segmenti del menu View | 3px, offset 1, sul segmento | `view-menu.css:102` |
| Campi, "Reset" e anni in Rankings | **2px**, offset 1 | `rankings.css:60,140,190` |
| Link dello studio | **2px**, offset 2, raggio 2 | `studios.css:121` |
| `.timeline` | `outline: none` (il focus è sulla card) | `timeline.css:10` |
| Campo di ricerca | `outline: none` (il dialogo è già evidente) | `search.css:75` |
| Gruppo chiuso | anche le copertine si aprono come in hover | `groups.css:46` |

### 9.2 Card

| Stato | Resa |
|---|---|
| Riposo | bordo `--border`, `--card-shadow` |
| Hover | voce sopra le altre (z 25), bordo `mix(--accent 45%)` (tranne tipi colorati, §3.1), `--card-shadow-hover` |
| Selezionata | §3.1; scala 1.05; contenuto extra; voce a z 40; le altre card opache con il velo `--bg` al 50 % (§3.1) |
| In uscita | bordo tratteggiato (solo Game, vedi §10), fascia `--accent` 10 % con "Upcoming" |
| Week/Month | solo copertina; in hover etichetta scura (`--text` / `--bg`) sopra o sotto |
| Trascinamento | cursore `grabbing` |

**Pulsanti nella card** (`.card-button`, `selection.css:81-108`): pillola `--accent-fill` piena (anche il bordo), testo `--on-accent`; hover `filter: brightness(0.9)` (si scurisce: 5.74:1 chiaro, 6.41:1 scuro); disabilitato `.is-disabled` + `aria-disabled`: bordo `--border`, fondo `--surface-2`, testo `--text-muted`, cursore `not-allowed`.

### 9.3 Bottoni e controlli

| Controllo | Riposo | Hover | Attivo / premuto | Disabilitato |
|---|---|---|---|---|
| Pulsante tondo 44px (`.icon-button`) | `--surface`, bordo `--border` | bordo `--accent` | — | — |
| Pillole dell'header (Filters, View, 44px) | `--surface`, bordo `--border` | bordo `--accent` | Filters con filtri attivi: pallino `--accent` 8px | — |
| "What's new" (44px) | come sopra | bordo **`--news`** | con novità: icona `--news-fill` + numero `--news-fill`, testo `--on-accent` | — |
| Navigazione (`.app-nav__link`) | testo `--text-muted` | testo `--text` | pagina corrente: `--accent-fill` pieno, `--on-accent` | — |
| Controllo zoom / anni di Rankings | testo `--text-muted`, trasparente | testo `--text` | `aria-pressed`: `--accent-fill` pieno | — |
| Segmenti del menu View | testo `--text-muted` su `--surface-2` | — | selezionato: fondo `--card`, testo `--text`, `--shadow-sm` | — |
| Interruttore | fondo `--surface-2`, pomello bianco | riga `--surface` | acceso: fondo `--accent`, pomello +16px | — |
| "Start presentation" (`.view-menu__action`) | `--surface`, bordo `--border` | bordo `--accent` | — | — |
| Chiudi (dialogo scorciatoie) | `--accent-fill` pieno | nessuno | — | — |
| "Mark all as seen" | `--news` 14 %, testo `--news-text-soft` | nessuno | — | fondo `--surface`, testo `--text-muted`, cursore normale |
| Campi e "Reset" di Rankings (34px) | `--surface`, bordo `--border` | bordo **`--text-muted`** | — | — |
| Chip admin | `--surface`, bordo `--border` | nessuno | `aria-pressed`: `--accent-fill` pieno (anche il bordo) | — |
| Salva / Rimuovi (admin) | `--accent-fill` pieno (anche il bordo) / contorno `--accent` | nessuno | — | — |
| Tema (`.theme-toggle`, 44px) | `.icon-button`; icona sole (chiaro) o luna (scuro), 18px `--text` | bordo `--accent` | clic: rotazione −90° → 0 (GSAP) | — |

### 9.4 Menu e liste

| Elemento | Hover | Selezionato | Disabilitato |
|---|---|---|---|
| Righe filtri e View (`.filters__option`) | fondo `--surface` | stato nell'interruttore | — |
| Voce "What's new" | fondo `--surface` | vista: niente pallino blu, tipo in `--text-muted` | opacità 0.55, cursore normale, niente hover |
| Risultato di ricerca | — (la selezione segue il puntatore via JS) | `aria-selected`: `--accent` 12 % + barra `inset 3px` `--accent` | — |
| Gioco nella lista admin | fondo `--surface-2` | `aria-current`: fondo `--surface-2` (uguale all'hover) | — |
| Link (voti, studi) | testo `--accent` sottolineato | — | — |

---

## 10. Incoerenze

**Header sopra lo sfondo del gioco nel tema scuro**

- Con `--backdrop-veil` 0.06 il mese in `--accent` e i testi dell'header hanno poco contrasto su sfondi chiari (es. Pokémon Pokopia: Bubbly Basin). Dipende dal gruppo 4 (`backdrop.css`, in conflitto con `wip/perf`).

**Valori quasi uguali**

| Valori | Dove | Nota |
|---|---|---|
| `--text-muted` scuro `#9a9aa6` / `--score-none` `#9a9aa3` | `tokens.css:81,18` | Stesso grigio, due token |
| `--success` scuro `#3ddc84` = `--free-update` scuro `#3ddc84`; nel chiaro `#1a8f3c` / `#0f9d58` | `tokens.css` | Uguali nello scuro, diversi nel chiaro |
| `--dlc` `#7c3aed` / `--score-strong` `#9d3ef0` | `tokens.css:36,15` | Due viola vicini con significati diversi (tipo di voce vs fascia di voto) nella stessa card |
| `--joycon-right` `#ff3b4e` / `#ff5a69` vs `--accent` `#e60012` / `#ff4d5a` | `tokens.css` | Nello scuro il Joy-Con destro e il rosso d'accento sono quasi uguali |
| `--on-accent`, `--switch-knob` | `tokens.css` | Entrambi `#fff` in entrambi i temi |
| `--accent-fill` chiaro = `--accent` chiaro `#e60012`; `--dlc-fill` chiaro = `--dlc` chiaro `#7c3aed`; `--news-text-soft` = `--news-fill` nel chiaro, = `--news` nello scuro | `tokens.css` | Token distinti con lo stesso valore in un tema: differiscono solo nell'altro |
| Miniature: 32×44 r4 (ricerca), 34×45 r5 ("What's new"), 34×46 r6 (header), 34×46 r4 (admin), 36×48 r5 (anteprima) | `search.css:102`, `whats-new.css:206`, `header.css:66`, `admin.css:139`, `minimap-preview.css:40` | Cinque varianti per la stessa cosa |
| Copertine: 72×96 (card), 64×86 (Week/Month), 66×88 (gruppo), 60×80 (Studios), 48×64 (Rankings), 56×75 (DLC) | vari | Proporzioni simili ma non uguali (3:4 circa) |
| Raggi fuori scala: 4, 5, 6, 7, 12px accanto a `--radius-sm` 8 e `--radius-md` 14 | §5.2 | Minimappa 12px ≈ né sm né md |
| Outline di focus 3px (sito) vs 2px (Rankings, Studios); offset 1, 2 o 3 | §9.1 | — |
| Hover dei bordi: `--accent` (header), `--news` ("What's new"), `--text-muted` (Rankings) | §9.3 | Tre regole per lo stesso gesto |
| Durata del cambio di bordo: 0.2s (card) vs 0.15s senza easing esplicito (Rankings) | `card.css:13`, `rankings.css:53` | — |
| Altezza dei controlli: 44px (header) vs 34px (Rankings) | `filters.css:12`, `rankings.css:43` | — |
| Larghezza dei pannelli: 290 (filtri), 300 (View), 380 ("What's new") | `filters.css:46`, `view-menu.css:32`, `whats-new.css:97` | — |
| Pillole dei pulsanti dell'header: padding 16 (Filters, View) vs 14/10 ("What's new") | `filters.css:13`, `view-menu.css:13`, `whats-new.css:46` | — |
| Pallini: 12 (linea), 14 (legenda, fantasma), 18 (gruppo), 7 e 11 (minimappa), 16 (oggi) | vari | — |
| Dimensioni del testo con mezzi pixel: 9.5, 10.5, 11.5, 12.5, 13.5 | §4 | 19 dimensioni diverse in tutto |

**Token definiti ma poco o mai usati**

- Nessun token è del tutto inutilizzato.
- `--red` e `--red-soft` servono solo come base di `--accent`/`--timeline` e nei coriandoli.
- `--backdrop-opacity` vale sempre 1 e non ha varianti.
- `--delayed`, `--on-accent`, `--switch-knob`, `--overlay`, `--shadow-sm`, `--shadow-md` e tutti i `--score-*` non hanno varianti scure: stessi valori nei due temi.
- I token dello sfondo del gioco (`--backdrop-*`) stanno in `backdrop.css`, non in `tokens.css`.

**Colori senza token**

- Coriandoli `#ff8a95`, `#b3000e`, `#fff` (`confetti.ts:3`) e favicon `#e60012` scritto a mano nei tre HTML.
- Bandiere (`flags.ts`): colori ufficiali, sensato tenerli fissi.
- Opacità sul canvas (0.45, 0.3, 0.55) e filtri (0.5, 0.95, 0.7) scritti nel codice (§2.3).

**Regole duplicate o in conflitto**

- Il tema scuro è scritto due volte a mano (`tokens.css:86-125` e `127-164`) e l'indentazione del primo blocco è irregolare. Stessa doppia regola in `backdrop.css`, `groups.css` e `header.css` (icona del tema). Qualsiasi nuovo token scuro va aggiunto in tutti e due i posti (`tests/contrast.test.ts` controlla che coincidano per i token dei riempimenti).
- La `transition` di `.card` è dichiarata in quattro punti (`card.css:11`, `selection.css:5`, `compact.css:8`, `groups-fan.css:17`), ognuno sovrascrive il precedente.
- `.minimap.is-scrubbing` è dichiarato due volte (`minimap.css:19`, `minimap-preview.css:7`).
- **Bordo tratteggiato delle uscite future solo per i giochi normali:** `.card--upcoming { border-style: dashed }` (`card.css:262`) viene sovrascritto dalla scorciatoia `border: 2px solid …` di DLC, aggiornamenti gratuiti e Switch 2 Edition (stessa specificità, file successivi). Una DLC in uscita ha il bordo pieno.
- Controllo zoom e anni di Rankings hanno stili identici copiati (`zoom.css:114-131`, `rankings.css:121-138`); i segmenti del menu View sono un terzo modello diverso.
- Dialogo scorciatoie su `--bg`, dialogo ricerca su `--card`: nel tema scuro `#0b0b0d` vs `#141417`.
- La pagina Admin non ha pulsante del tema e non chiama `initTheme`.
