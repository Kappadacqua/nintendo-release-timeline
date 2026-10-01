# Coda `seasons-art` — Sfondo stagionale: stile disegnato, profondità, transizione incrociata

Salvare in `docs/tasks/seasons-art.md`. Lancio dal telefono: `Esegui il prossimo task di docs/tasks/seasons-art.md`.

## Regole della coda

- Un task per sessione.
- A fine task: typecheck, `npm test`, commit, riga in `STATUS.md`, spunta `[x]` nello stesso commit del lavoro.
- Niente `data:fetch`, niente `git push`. Non toccare il branch `wip/perf` né `src/styles/backdrop.css` (gruppo 4).
- Report fisso: **Fatto / File / Verifica / Da verificare nel browser / Aperto**.
- Se un valore di questa coda è in conflitto con il codice, l'agente si ferma e lo scrive in **Aperto**.
- Riferimento: `docs/design-tokens.md` (§2.1 palette stagioni, §6.4 costanti `SEASONS`, §7 livelli).
- Il task 8 è **bloccato** finché l'Architetto non lo approva: non eseguirlo.

## Direzione (valida per tutti i task)

Lo sfondo oggi sembra un diagramma: contorni tutti dello stesso spessore, senza riempimento, senza imperfezioni, con una sola specie di elemento per stagione. Lo portiamo verso un **disegno acquerellato**, senza rubare attenzione alla timeline.

Principi fissi:

1. **Nessuna particella ruota.** Ogni particella ha un orientamento fisso, scelto una volta alla creazione. Il movimento è solo traslazione più ondeggiamento laterale.
2. **Stile disegnato:** contorno a tratto arrotondato, riempimento tenue dello stesso colore, nervature più sottili, un secondo tratto leggermente sfalsato (effetto matita).
3. **Più tipi per stagione** (3–4), con proporzioni diverse e un elemento raro che spezza la ripetizione.
4. **Tre fasce di profondità** uguali per tutte le stagioni: lontana, media, vicina.
5. **Un solo colore per stagione** (token `--season-*` esistenti). Nessun nuovo colore, quindi nessun nuovo token nei tre blocchi di `tokens.css`.
6. **Transizione incrociata** tra stagioni: una leggera sovrapposizione, non più "sparisce e poi ricompare".
7. Restano i vincoli già decisi: stagione dal giorno sotto l'indicatore a mesi interi; interruttore nel menu View; reduced motion spento di default e statico se riacceso; sfondo nascosto con gioco selezionato; mai a scapito della leggibilità delle card; fps misurati.

---

- [x] **Task 1 — Motore: sprite pre-renderizzati, fasce di profondità, niente rotazione**

**File**
- Partire da: `src/seasons/background.ts`, `src/seasons/` (nuovo `sprites.ts` per il disegno delle sagome), `src/config.ts` (`SEASONS`).
- Non toccare: `src/styles/backdrop.css`, `wheel-fling.ts`.

**Contesto / decisioni**
- Le sagome fini (nervature, doppio tratto, riempimento) ridisegnate a ogni frame sono troppo pesanti. Ogni sagoma si disegna **una sola volta** su un canvas fuori schermo e poi si riusa con `drawImage`.
- Questo task prepara l'infrastruttura. Le forme nuove arrivano nei task 3–6; qui si migrano le forme esistenti allo stesso meccanismo.
- Casualità delle forme: generatore con seme fisso (es. mulberry32), così le varianti sono le stesse a ogni avvio.

**Specifica**
- **Sprite:** per ogni tipo di elemento, `VARIANTS` varianti (6 per i tipi comuni, 3 per quelli rari) × 3 fasce. Risoluzione = dimensione CSS × `devicePixelRatio` (limitato da `SEASONS.maxDpr` 1.5).
- **Cache:** si costruiscono solo le sprite delle stagioni con peso > 0. Si invalidano al cambio di tema o di `prefers-color-scheme` (rilettura di `readPalette()`).
- **Orientamento fisso:** inclinazione scelta alla creazione della particella, uniforme in ±35°, già "cotta" nella sprite (o applicata con una `setTransform` costante, mai variabile nel tempo). Eliminare ogni rotazione dipendente dal tempo.
- **Ondeggiamento laterale:** `x = x0 + A · sin(2π · t / T + φ)`, con A in 12–40 px, T in 4–9 s, φ casuale. In 1080p; scalare con il fattore di vista sotto.
- **Fasce di profondità** (per ogni nuova particella):

| Fascia | Quota particelle | Scala dimensione | Moltiplicatore velocità | Moltiplicatore di opacità |
|---|---|---|---|---|
| Lontana | 45 % | 0.55 | 0.6 | 0.55 |
| Media | 35 % | 1.0 | 1.0 | 0.80 |
| Vicina | 20 % | 1.6 | 1.5 | 1.00 |

- **Opacità finale** di ogni particella = `--season-alpha` × moltiplicatore della fascia × dissolvenza della particella. La fascia vicina resta quindi all'intensità attuale (già bilanciata: contrasto ~1.6 chiaro, ~1.9–2.1 scuro). Non introdurre altri `globalAlpha` scritti a mano.
- **Velocità:** la velocità base di ogni stagione resta quella attuale (la dà la fascia media). Si applica solo il moltiplicatore.
- **Dimensioni:** ±12 % casuale dentro la fascia. Fattore di vista `s = clamp(innerHeight / 1080, 0.75, 1.25)` applicato a tutte le dimensioni e ampiezze (se esiste già una regola di scala per il numero di particelle, mantenerla: 20 / 28 / 40).
- **Costanti in `config.ts`** dentro `SEASONS`: `bands` (tabella sopra), `wobbleAmpPx: [12, 40]`, `wobblePeriodS: [4, 9]`, `tiltDeg: 35`, `variants`. Niente numeri sparsi nel codice.
- **Stile del tratto delle sprite** (comune a tutti i tipi, da implementare qui come funzioni di utilità):
  - contorno 1.2 px (lontana), 1.4 px (media), 1.6 px (vicina); `lineCap` e `lineJoin` arrotondati; alpha 1.0;
  - riempimento dello stesso colore, alpha 0.16;
  - nervature: 0.8 × lo spessore del contorno, alpha 0.7;
  - secondo tratto del contorno, sfalsato di 0.6–0.8 px in una direzione casuale (fissata per variante), alpha 0.45.

**Atteso**
- Con le forme ancora quelle di prima, nessuna particella ruota più; le fasce danno volume (piccole e lente dietro, grandi e un po' più veloci davanti).
- Nessun calo di fps rispetto a oggi.

**Verifica**
- Typecheck, `npm test`.
- Cercare nel codice che non resti nessun `rotate` dipendente dal tempo in `src/seasons/`.
- **Da verificare nel browser:** quattro stagioni (settembre, gennaio, aprile, luglio) nei due temi: niente rotazione, tre profondità riconoscibili; cambio tema: colori aggiornati subito; reduced motion: particelle ferme.

---

- [x] **Task 2 — Transizione incrociata tra stagioni**

**File**
- Partire da: `src/seasons/background.ts`, `src/config.ts` (`SEASONS.rampMs`, `fadeInMs`, `leaveMs`).

**Contesto / decisioni**
- Cambia la regola di iterazione 1 "mai due stagioni insieme". Decisione di design: una leggera sovrapposizione.
- Il calcolo della stagione non cambia (mesi interi dal giorno sotto l'indicatore; zona TBA: resta la stagione precedente).

**Specifica**
- Ogni stagione ha un **peso** `w` tra 0 e 1.
  - La stagione corrente sale verso 1 dopo un ritardo `crossDelayMs` 300, in `crossInMs` 2000 (ease-out).
  - Le altre scendono verso 0 in `crossOutMs` 1500 (ease-in), senza ritardo.
- Il numero di particelle generate da una stagione = target × `w`. Le particelle già in volo non spariscono di colpo: finiscono il percorso con la propria opacità moltiplicata per il peso della loro stagione.
- Tetto: in nessun momento il totale disegnato supera 1.3 × il target.
- **Avanti e indietro sul confine:** poiché il peso si muove da dove si trova, una stagione che rientra riparte dal suo valore attuale, senza ricomparse di colpo.
- Valori di `rampMs`, `fadeInMs` e `leaveMs` sostituiti dalle tre nuove costanti. Rimuovere le vecchie se non servono più.
- Reduced motion (acceso e statico): cambio immediato, niente dissolvenza.

**Atteso**
- Passando da fine novembre a dicembre, i fiocchi iniziano a comparire mentre le foglie ancora scendono; per ~1 s si vedono entrambe, poi restano solo i fiocchi.
- Nessun "vuoto" tra le due stagioni.

**Verifica**
- Typecheck, `npm test`.
- **Da verificare nel browser:** con le frecce, confini 28→1 di ogni cambio di stagione (nov/dic, feb/mar, mag/giu, ago/set); due scatti avanti e indietro sul confine: nessun pop; zona TBA: stagione precedente; fps durante il cambio (≥ 58 a 1080p).

---

- [ ] **Task 3 — Autunno: foglie di quattro specie**

**File**
- Partire da: `src/seasons/sprites.ts`, `src/seasons/background.ts`.

**Contesto / decisioni**
- La foglia d'acero a tre lobi è simmetrica, con dentelli regolari: sembra un simbolo. Si sostituisce con quattro specie, tutte con colore `--season-autumn` e stile del Task 1.
- Ogni punto di controllo di ogni variante è perturbato di ±8 % (con il seme fisso), il lembo è leggermente curvo, il picciolo è curvo.

**Specifica**
- **Specie e quote** (di tutte le particelle della stagione):

| Specie | Quota | Forma |
|---|---|---|
| Acero a cinque lobi, irregolare | 35 % | Lobo centrale lungo 0.5 L; due lobi superiori a ±40° lunghi 0.42 L; due inferiori a ±85° lunghi 0.26 L; 2–3 denti per lobo; seni arrotondati; picciolo 0.28 L |
| Quercia lobata | 25 % | Ovale allungato, larghezza 0.55 L; 3–4 lobi arrotondati per lato, alternati di profondità; picciolo 0.12 L |
| Betulla | 25 % | Ovata, larghezza 0.7 L, punta apicale; margine dentato con ~14 denti piccoli; picciolo 0.2 L |
| Ginkgo | 15 % | Ventaglio con apertura di ~150° e tacca centrale profonda 0.45 L; 7 nervature radiali; picciolo lungo 0.4 L |

- **Nervature:** una centrale e 3–4 coppie secondarie curve (acero, quercia, betulla); radiali per il ginkgo.
- **Dimensioni** (L, lunghezza della foglia in 1080p, per fascia lontana / media / vicina): **31 / 56 / 90 px**. Il ginkgo ha larghezza 1.1 L.
- **Movimento:** discesa verticale con velocità attuale delle foglie × moltiplicatore della fascia; ondeggiamento laterale ampio (A 20–40 px, T 5–9 s). Nessuna rotazione.
- Opacità e contrasto: vedi Task 1. Le foglie vicine non devono mai risultare più evidenti di tacche e numeri della linea.

**Atteso**
- Quattro silhouette distinguibili, nessuna foglia simmetrica o a stampo, nessuna rotazione.

**Verifica**
- Typecheck, `npm test`.
- **Da verificare nel browser:** settembre e ottobre, nei due temi, 1920 / 1440 / 1280; gennaio, aprile e luglio senza foglie residue; fps ≥ 58.

---

- [ ] **Task 4 — Inverno: fiocchi dendritici, lastre, puntini, rametto di abete**

**File**
- Partire da: `src/seasons/sprites.ts`, `src/seasons/background.ts`.

**Specifica**
- **Tipi e quote:**

| Tipo | Quota | Forma | Dimensione (lontana / media / vicina) |
|---|---|---|---|
| Fiocco dendritico | 45 % | Sei raggi principali di lunghezza R; coppie di rami a 60° a 0.35 R, 0.6 R e 0.82 R, lunghe 0.35 R, 0.25 R, 0.15 R; ogni variante perturba le lunghezze dei rami di ±20 %; simmetria a sei, ma diversa tra le varianti | 20 / 36 / 58 px (diametro) |
| Lastra esagonale | 20 % | Esagono esterno, esagono interno a 0.55 R, sei raggi di collegamento, piccole tacche | 17 / 30 / 48 px |
| Puntino morbido | 30 % | Cerchio pieno senza contorno, raggio 1.5–3.5 px (non scala con la fascia) | solo fascia lontana |
| Rametto di abete | 5 % | Fusto curvo e 7–9 coppie di aghi curvi verso il basso, di lunghezza decrescente verso la punta; solo linee, senza riempimento | solo fascia media: 70 px di lunghezza |

- Nella fascia lontana: puntini e fiocchi piccoli. I fiocchi vicini sono i più grandi e i più lenti rispetto alla loro dimensione: moltiplicatore di velocità di questa stagione = quello della fascia × 0.9.
- **Movimento:** discesa lenta (velocità attuale dei fiocchi × moltiplicatore della fascia); raffiche laterali: ogni 6–12 s un impulso orizzontale comune di ±20 px/s, della durata di 2 s (ease in-out), uguale per tutte le particelle di una fascia e di segno casuale. Il rametto cade ancora più lento (× 0.7) con ondeggiamento ampio (A 25–40 px).
- Colore: `--season-winter`.

**Atteso**
- Nevicata fitta ma leggera: puntini e fiocchi lontani come "texture", pochi fiocchi grandi davanti, qualche rametto di abete che scende lento.

**Verifica**
- Typecheck, `npm test`.
- **Da verificare nel browser:** dicembre, gennaio e febbraio nei due temi (nel chiaro `#6f8499`, nello scuro `#d3dce5`); i fiocchi non si leggono come testo o puntini della linea; fps ≥ 58.

---

- [ ] **Task 5 — Primavera: petali, fiori, rametti, boccioli (senza rotazione)**

**File**
- Partire da: `src/seasons/sprites.ts`, `src/seasons/background.ts`.

**Specifica**
- **Tipi e quote:**

| Tipo | Quota | Forma | Dimensione (lontana / media / vicina) |
|---|---|---|---|
| Petalo singolo con tacca in punta | 55 % | Tre sagome: ovale con tacca stretta, ovale con tacca larga, asimmetrico; due livelli di opacità di riempimento (0.12 e 0.20) | 15 / 28 / 45 px |
| Fiore di ciliegio intero | 15 % | Cinque petali con tacca, anello al centro, 8–10 stami con pallino; orientamento fisso | solo media e vicina: 60 / 96 px; più lento del 20 % |
| Rametto con fiori e boccioli | 10 % | Ramo curvo (tratto 1.6 px) con 2–3 fiori piccoli (0.4 × la scala del fiore) e 2–3 boccioli ellittici | solo media: 110 px di lunghezza |
| Boccioli e petali minuscoli | 20 % | Ellisse piccola o petalo semplice senza tacca | solo lontana: 10 px |

- **Movimento:** diagonale morbida (velocità attuale × moltiplicatore della fascia), con ondeggiamento laterale ampio (A 25–40 px, T 5–8 s). **Nessuna rotazione**, nemmeno lenta, nemmeno per il fiore intero.
- Colore: `--season-spring`.

**Atteso**
- Un solo colore rosa, forme riconoscibili (petali, fiori, rametti), movimento morbido senza rotazioni.

**Verifica**
- Typecheck, `npm test`.
- **Da verificare nel browser:** marzo, aprile e maggio nei due temi (`#c07890` chiaro, `#e6c3cf` scuro); il rametto non finisce mai sotto la linea o i numeri; fps ≥ 58.

---

- [ ] **Task 6 — Estate: mare vivo (bolle, grappoli, conchiglie, stelle marine)**

**File**
- Partire da: `src/seasons/sprites.ts`, `src/seasons/background.ts`.

**Contesto / decisioni**
- Le bolle da sole sono monotone: tutte cerchi, un solo moto. Il mare è fatto di profondità: cose che salgono e cose che scendono.

**Specifica**
- **Tipi e quote:**

| Tipo | Quota | Forma | Dimensione (lontana / media / vicina) |
|---|---|---|---|
| Bolla singola | 55 % | Cerchio con riempimento radiale tenue; due riflessi: un arco grande in alto a sinistra e un puntino in basso a destra | 31 / 56 / 90 px (diametro) |
| Grappolo di bolle | 20 % | Una sprite con 3–5 bolle di raggi 1 : 0.7 : 0.5 : 0.4 : 0.3, in catena verticale con scarto laterale ±0.6 raggio | solo media e vicina: bolla maggiore 40 / 64 px |
| Conchiglia a ventaglio | 15 % | Sette–nove coste che partono dalla cerniera, margine ondulato, base piccola | solo media e vicina: 60 / 96 px |
| Stella marina | 10 % | Cinque bracci affusolati con curvatura leggera e irregolare; fila di 6–8 puntini lungo ogni braccio | solo media e vicina: 64 / 96 px |

- **Movimento:**
  - bolle e grappoli **salgono** (velocità attuale × moltiplicatore della fascia), con ondeggiamento A 10–28 px, T 3–6 s;
  - conchiglie e stelle marine **scendono** lente (0.35 × la velocità base × moltiplicatore della fascia), con ondeggiamento ampio A 20–40 px, T 7–12 s, orientamento fisso (inclinazione ±35°).
- Il contrasto tra chi sale e chi scende dà l'effetto acqua.
- Colore: `--season-summer`.

**Atteso**
- Si riconosce il mare: bolle di dimensioni molto diverse che salgono in grappoli, ogni tanto una conchiglia o una stella che scende.

**Verifica**
- Typecheck, `npm test`.
- **Da verificare nel browser:** giugno, luglio e agosto nei due temi (`#4f8fb0` chiaro, `#a9cde0` scuro); conchiglie e stelle non ricordano emoji (nessun dettaglio troppo fitto a 1.2 px); fps ≥ 58.

---

- [ ] **Task 7 — Misura degli fps, contrasti e documentazione**

**File**
- Partire da: `src/seasons/background.ts`, `docs/design-tokens.md`, `docs/SPEC.md` (§15), `STATUS.md`.

**Specifica**
- **Misura degli fps** con lo stesso metodo del report precedente (Chrome headless con GPU, build di produzione, 1920×1080):
  - per ciascuna delle quattro stagioni: a riposo, durante scorrimento continuo (marce 1, 2 e 3), con sfondo acceso e spento;
  - durante un cambio di stagione (Task 2);
  - se possibile, anche a 2560×1440 (densità limitata a 1.5).
- **Soglia:** media ≥ 58 fps e 95° percentile del tempo di frame ≤ 20 ms. Se una stagione non regge, ridurre **prima** la quota dei tipi rari, poi il numero di particelle della fascia vicina, mai la qualità delle sagome né la leggibilità delle card.
- **Documentazione:**
  - `docs/design-tokens.md`: aggiornare §2.1 (`--season-*` ora descrive più tipi di elemento, non solo "Fiocchi", "Petali", "Bolle", "Foglie d'acero"), §6.4 (costanti `SEASONS` nuove) e §7 (nessun cambio di livelli).
  - `docs/SPEC.md` §15: nuove regole (niente rotazione, fasce, transizione incrociata).
  - `STATUS.md`: riga con i risultati degli fps.

**Atteso**
- Una tabella nel report: stagione × condizione × fps medi e 95° percentile.

**Verifica**
- Typecheck, `npm test`.
- **Da verificare nel browser:** nessuna regressione delle card con lo sfondo acceso; focus, header e linea invariati.

---

- [ ] **Task 8 — Reazione dello sfondo alla rotella** (**BLOCCATO: da portare all'Architetto**)

**Perché è bloccato.** Collega il motore stagionale alle marce di `wheel-fling.ts` ed è una **funzione nuova**; inoltre sostituisce la regola già decisa "lo sfondo sparisce nello scorrimento veloce". Serve l'approvazione dell'Architetto prima dell'esecuzione. L'agente, se lo trova come prossimo task, **non lo esegue** e lo scrive in **Aperto**.

**File**
- Partire da: `src/seasons/background.ts`, `src/wheel-fling.ts` (solo per esporre un evento o un valore di marcia, senza cambiare le marce), `src/config.ts`.

**Specifica visiva** (da approvare)
- **Marcia 1** (scatti singoli o rotazione breve): le particelle non reagiscono.
- **Marce 2 e 3:** impulso orizzontale **nella direzione opposta** allo scorrimento (scorrendo in avanti, le particelle vanno verso destra). Il segno sta in `SEASONS.reactSign` per poterlo invertire se dal vivo non convince.
- **Intensità:** velocità aggiuntiva `v = reactSign × guadagno[marcia] × fattore di fascia`, con guadagno marcia 2 = 220 px/s, marcia 3 = 420 px/s; fattore di fascia: lontana 0.4, media 1.0, vicina 1.8.
- **Tetto:** la velocità aggiuntiva non supera 600 px/s su nessuna particella.
- **Decadimento:** esponenziale con costante ~600 ms (ease-out), poi si torna alla deriva normale. Un nuovo scatto in marcia 2–3 durante il decadimento si somma, sempre entro il tetto.
- **Week / Month:** stesse marce e stessi valori.
- **Trackpad:** nessuna reazione (resta marcia 1).
- **Reduced motion:** nessuna reazione.
- **Regola sostituita:** non si nasconde più lo sfondo nello scorrimento veloce, né con la rotella, né con trascinamento, né con salti lunghi (Home/End, minimappa, ricerca). Con gioco selezionato lo sfondo resta nascosto come oggi.
- **Fps:** rimisurare con scorrimento continuo (marce 2 e 3) in tutte e quattro le stagioni; soglia come nel Task 7.

**Atteso**
- Un breve scorrimento non fa nulla; uno più veloce spinge le particelle in modo dinamico, più le vicine delle lontane, e poi tutto si distende.

**Verifica**
- Typecheck, `npm test`.
- **Da verificare nel browser:** (la sensazione la giudica l'utente) marcia 1: nessun effetto; marce 2 e 3: spinta visibile in tutte le stagioni; salti lunghi: lo sfondo non sparisce più; reduced motion: nessun effetto.
