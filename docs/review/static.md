# Revisione — Controlli automatici (Task 1)

Data: 2026-09-27 · commit di partenza `fdcef53` · sola lettura, nessuna correzione applicata.

## Comandi usati

```sh
# 1. Variabili, import e parametri inutilizzati
npx tsc --noEmit --noUnusedLocals --noUnusedParameters

# 2. Colori scritti direttamente
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" src/styles --include=*.css | grep -v src/styles/tokens.css
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" src/admin/admin.css
grep -nE "\b(white|black)\b" src/styles/*.css | grep -v tokens.css        # solo white-space: nessun colore con nome
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" src --include=*.ts
grep -rnE "style\.(color|background|backgroundColor|borderColor|fill|stroke)\b|fillStyle|strokeStyle|setProperty\(" src --include=*.ts
grep -n "^:root\|^  --" src/styles/*.css | grep -v tokens.css            # token definiti fuori da tokens.css

# 3. Classi CSS definite/usate: script temporaneo in scratchpad (non nel repo), poi verifica a mano con grep.
#    Raccoglie i selettori .classe da src/styles/*.css; le confronta con le parole presenti in src/**/*.ts e *.html,
#    tenendo conto dei prefissi dinamici (`card--${kind}`); poi l'inverso: class="…", className, classList.*,
#    querySelector/closest/matches(".…") senza regola CSS. Suffissi dinamici controllati con:
for p in card-- rank-row-- tl-item__dot-- minimap__dot-- studio-card-- studio-badge-- whats-new__item-- ring-- zoom-; do
  grep -rhoE "\.${p}[a-z0-9-]+" src/styles | sort -u; done

# 4. Residui di debug
grep -rnE "console\.log|debugger|TODO|FIXME" src scripts --include=*.ts

# 5. localStorage / sessionStorage
grep -rn "localStorage\|sessionStorage" src --include=*.ts
grep -n "localStorage" *.html
#    per ogni occorrenza: sed -n '<riga-5>,<riga+5>p' <file> | grep -nE "try|catch"

# 6. prefers-reduced-motion
#    CSS: script temporaneo che elenca ogni animation/transition con il selettore e se sta dentro @media (prefers-reduced-motion)
grep -nE "^\s*(animation|transition)(-[a-z]+)?\s*:|@keyframes|prefers-reduced-motion" src/styles/*.css
#    JS: file con GSAP/requestAnimationFrame/style.animation e conteggio dei controlli
grep -rln "gsap\|requestAnimationFrame\|style\.animation" src --include=*.ts
grep -nE "gsap\.(to|from|fromTo|timeline|set)|reducedMotion|requestAnimationFrame" <file>
```

## Riepilogo

| Controllo | Esito |
|---|---|
| 1. Inutilizzati | Nessun problema (tsconfig ha già `noUnusedLocals`/`noUnusedParameters`: il controllo coincide con `npm run typecheck`). |
| 2. Colori diretti | 9 problemi (0 alta, 3 media, 6 bassa). |
| 3. Classi CSS | 3 problemi (tutti bassa). |
| 4. Debug/TODO | 1 problema (bassa). Nessun `debugger`, `TODO`, `FIXME`. I `console.log` in `scripts/` sono output voluto della CLI. |
| 5. localStorage | Nessun problema: tutti gli accessi (8 moduli + script inline dei 4 `.html`) sono in try/catch. |
| 6. Reduced motion | 4 problemi (0 alta, 2 media, 2 bassa). |

**Totale: 17 problemi — 0 alta, 5 media, 12 bassa.**

## Problemi

### 2. Colori scritti direttamente

**[media] `src/styles/whats-new.css:3-6` — token `--news` / `--news-text` definiti fuori da `tokens.css`** ✔ corretto in `Style: tokens, reduced motion, free update group`
Blu `#0a7cff` e `#fff` in un `:root` del componente, senza variante per il tema scuro.
Correzione: spostarli in `tokens.css` con varianti scure.

**[media] `src/styles/delays.css:4-15` — palette "rinviato" con temi gestiti nel componente** ✔ corretto in `Style: tokens, reduced motion, free update group`
`#f5a623`, `#b36b00`, `#ffc15e` scritti a mano, con i selettori del tema scuro duplicati qui invece che in `tokens.css`.
Correzione: token `--delayed` / `--delayed-text` in `tokens.css` (chiaro + scuro) e `var()` qui.

**[media] `src/styles/whats-new.css:249` — `#d98200` per il tipo "delayed"** ✔ corretto in `Style: tokens, reduced motion, free update group`
Quarto arancione, diverso da quelli di `delays.css`, senza variante scura.
Correzione: usare lo stesso token `--delayed-text` del punto precedente.

**[bassa] Testo bianco su fondo colorato scritto come `#fff` (12 punti)** ✔ corretto in `Style: on-accent, shadows, overlay, reduced motion`
`dlc-card.css:34`, `timeline.css:154`, `shortcuts.css:58`, `header.css:173`, `out-today.css:5`, `studios.css:134`, `card.css:85`, `rankings.css:137`, `rankings.css:271`, `zoom.css:130`, `selection.css:71`; in TS `src/timeline/timeline.ts:932` (`onAccent: "#fff"` per il canvas).
Correzione: token `--on-accent` in `tokens.css`, letto anche da `readPalette()`.

**[bassa] Ombre e velature `rgb(0 0 0 / …)` fuori dai token (6 punti)** ✔ corretto in `Style: on-accent, shadows, overlay, reduced motion`
`header.css:70`, `filters.css:92`, `view-menu.css:99`, `groups.css:24` (ombre); `shortcuts.css:14`, `search.css:37` (velo 0.35 identico in due file).
Correzione: token `--shadow-sm` e `--overlay` accanto a `--card-shadow`.

**[bassa] `src/styles/filters.css:91` — pomello degli interruttori `background: #fff`** ✔ corretto in `Style: on-accent, shadows, overlay, reduced motion`
Bianco fisso anche nel tema scuro.
Correzione: token (es. `--switch-knob`) con variante scura se serve.

**[bassa] `src/cards/confetti.ts:3` — colori dei coriandoli**
`#ff8a95`, `#b3000e`, `#fff` accanto a `var(--red)`/`var(--red-soft)`.
Correzione: token `--confetti-*` in `tokens.css` o solo `var()` esistenti.

**[bassa] `src/styles/backdrop.css:37-53` — token in `:root` fuori da `tokens.css`**
`--backdrop-blur`, `--backdrop-opacity`, `--backdrop-veil` con varianti di tema definite nel componente (non colori, ma stessa convenzione).
Correzione: spostarli in `tokens.css`.

**[bassa] `src/admin/admin.css:99,276,292` — colori diretti nel pannello admin** ✔ corretto in `Style: on-accent, shadows, overlay, reduced motion`
`#fff` (×2) e `#1a8f3c`. Solo sviluppo.
Correzione: `var(--on-accent)` e `var(--free-update)` o un token `--success`.

Esclusi di proposito: `src/cards/flags.ts` (colori ufficiali delle bandiere) e `selection-extras.css:13-14` (`#000` in `mask-image`: indica l'opacità, non un colore).

### 3. Classi CSS

**[bassa] `src/timeline/group.ts:44` — `card--group-free-update` senza regole CSS** ✔ corretto in `Style: tokens, reduced motion, free update group`
Il gruppo di soli aggiornamenti riceve la classe, ma nessuno stile la usa: la card del gruppo non si distingue da quella dei giochi (i pallini sì, via `tl-item__dot--*`).
Correzione: aggiungere lo stile verde (bordo/badge) o togliere la classe.

**[bassa] `src/presentation.ts:51,70` — `is-presenting` sul body senza regole CSS**
Classe aggiunta e rimossa, mai usata da CSS o da `querySelector`.
Correzione: rimuoverla o usarla (es. al posto di stili impostati altrove).

**[bassa] Modificatori dinamici senza regole: `zoom-day|week|month` (`src/timeline/timeline.ts:186`) e `studio-card--<category>` (`src/studios/main.ts:119`)**
Nessun selettore li usa (lo zoom usa `is-zoomed-out`, gli studi il badge).
Correzione: rimuoverli o annotarli come aggancio voluto.

Nessuna classe definita in CSS risulta inutilizzata (i 3 candidati `timeline-header__month|day|year` sono costruiti in `header.ts:25`). Le classi senza CSS `search-toggle`, `shortcuts-toggle`, `theme-toggle`, `filters__count` sono agganci JS voluti.

### 4. Debug

**[bassa] `src/timeline/scroller.ts:238-240` — `console.log("[wheel]", …)` sotto `?debug=wheel`**
Non scrive nulla in uso normale, ma è strumentazione di debug rimasta nel codice di produzione.
Correzione: rimuoverla oppure limitarla a `import.meta.env.DEV`.

### 6. prefers-reduced-motion

**[media] `src/styles/header.css:43-45` — titolo/gioco selezionato: transizione di `transform` senza eccezione** ✔ corretto in `Style: tokens, reduced motion, free update group`
`.app-title__site` / `.app-title__game` scorrono di 6px in 0.3s; il blocco reduced-motion a riga 176 copre solo `.app-nav__link`.
Correzione: aggiungere i due selettori al blocco di riga 176 (`transition: none` o solo opacità).

**[media] `src/theme/theme.ts:44-48` — rotazione dell'icona del tema con GSAP senza controllo** ✔ corretto in `Style: tokens, reduced motion, free update group`
`gsap.fromTo` (rotate −90°→0, scale 0.6→1, `back.out`) parte sempre.
Correzione: saltare l'animazione se `matchMedia("(prefers-reduced-motion: reduce)").matches`.

**[bassa] `src/styles/filters.css:93` — pomello degli interruttori `transition: transform 0.2s`** ✔ corretto in `Style: on-accent, shadows, overlay, reduced motion`
Movimento breve, ma non disattivato con reduced motion (usato anche in Rankings e Studios).
Correzione: `transition: none` per `.filters__switch::after` in un blocco reduced-motion.

**[bassa] `src/presentation.ts:96` — barra di avanzamento `presentation-fill` sempre animata** ✔ corretto in `Style: on-accent, shadows, overlay, reduced motion`
Nessun controllo di reduced motion né in `presentation.ts` né in `presentation.css:102` (che copre solo il toast). È un indicatore di tempo, quindi accettabile, ma va deciso.
Correzione: con reduced motion, barra piena statica o solo il contatore.

Animazioni già conformi: `backdrop`, `compact` (`is-restyling` si attiva solo se `animate`, che controlla reduced motion in `timeline.ts:742`), `groups`, `out-today`, `presentation-toast`, `today-pulse`; GSAP in `appear.ts` (anche i coriandoli), `expand.ts`, `compact.ts`, `group.ts`, `header.ts`, `zoom-control.ts`, `rankings/main.ts`, `studios/main.ts`, `scroller.ts`. Le transizioni di solo colore/opacità (`base`, `card`, `selection`, `selection-extras`, `rankings`, `view-menu`) non sono movimento e sono lasciate fuori.
