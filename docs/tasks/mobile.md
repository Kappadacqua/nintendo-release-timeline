# Coda `mobile` — Sito usabile da telefono (SPEC "Mobile")

Lavoro autonomo su branch `mobile`, richiesto dall'utente il 2026-10-03: un passo per commit, questa coda aggiornata man mano.

## Regole della coda

- Branch `mobile`, un commit per passo concluso; typecheck e `npm test` verdi a ogni commit.
- Non toccare `scripts/`, `data/`, `admin.html`. Niente `data:fetch`, niente `git push`.
- Desktop (≥ 1280 px, puntatore fine) invariato: confronto con screenshot prima/dopo a 1440×900.
- Verifica con Playwright in emulazione touch (`isMobile`, `hasTouch`): 360×640, 390×844, 430×932, 768×1024, 1024×768, 844×390, 1440×900.

## Decisioni (prese dall'agente, da confermare)

- **Timeline verticale** con `(max-width: 820px), (max-height: 500px)`: telefoni in verticale e orizzontale, tablet in verticale, finestre strette. Tablet in orizzontale (1024×768) resta orizzontale.
- **Header compatto** (titolo · data · ricerca · menu) sotto i 1280 px o con altezza ≤ 500 px; le azioni dell'header diventano un pannello a comparsa; barra in basso con ‹ Today › e Day / Week / Month.
- Linea sul lato sinistro (x = 58 px), numeri e mesi a sinistra della linea, card a destra in una colonna (Day) o in due colonne strette con copertina e titolo (Week / Month). Minimappa come striscia verticale a destra.
- Su verticale le card non selezionate sono sempre righe compatte (copertina, titolo, badge); "Card style" vale solo per la timeline orizzontale.
- Scala Day invariata (32 px/giorno).

---

- [x] **Passo 1 — Asse verticale della timeline**
  `layout.ts` (criterio), `Timeline` con opzione `vertical` (canvas trasposto, mondo traslato in y, righe a destra, aggancio e inerzia invariati), tacche e pillola nel gutter, minimappa verticale, `assignLanes` con lati scelti, TBA in colonna, ricostruzione al cambio di layout con stessa data e selezione. Header compatto, pannello del menu, barra in basso.

- [ ] **Passo 2 — Card, selezione e gruppi in verticale**
  Righe, card espansa dentro lo schermo, ventaglio come colonna, sfondo del gioco, TBA.

- [ ] **Passo 3 — Gesti touch**
  Pizzico per lo zoom, pressione lunga per il titolo in Week / Month sulla timeline orizzontale touch, inerzia touch, niente selezione accidentale.

- [ ] **Passo 4 — Sfondo stagionale leggero su mobile**

- [ ] **Passo 5 — Rankings e Studios responsive**

- [ ] **Passo 6 — Verifica completa, test, SPEC "Mobile", STATUS**
