# Iterazione 3 — Gestione dati, novità settimanali, ricerca e filtri

Da iniziare **dopo** aver completato `ITERATION-2.md`. Dove c'è contrasto con i documenti precedenti, vale questo. A fine lavoro aggiorna `SPEC.md`.

Il focus del sito resta sui **giochi**: niente eventi, Direct o altri marcatori non legati ai giochi.

---

## 1. Separare raccolta e costruzione dei dati

Prerequisito per tutto il resto. Dividere lo script in due fasi:

- `npm run data:fetch` → interroga le API (IGDB, OpenCritic, Wikipedia/Wikidata, Fandom) e salva le risposte grezze in `data/cache/`.
- `npm run data:build` → unisce cache + `overrides.json` + storico e genera `public/data/games.json`. Non fa chiamate di rete, quindi è istantaneo.

Così il pannello admin (§2) può rigenerare il sito senza consumare quota API.

## 2. Pannello di amministrazione locale

- Pagina `/admin`, disponibile **solo in sviluppo** (`import.meta.env.DEV`); non deve finire nella build di produzione.
- Un piccolo **plugin Vite** espone un endpoint locale che scrive `data/overrides.json` (formattato, con validazione dello schema e una copia di backup prima di ogni salvataggio) e lancia `data:build`.

Funzioni:

- Elenco dei giochi con dati mancanti, filtrabile per tipo: Metacritic, Backloggd, link Wikipedia / Nintendo Wiki / Nintendo Store, conflitti di esclusività.
- Per ogni gioco un modulo con i campi di `overrides.json` (voti, numero recensioni, esclusività, "Also on Switch 1", link).
- Accanto ai campi, link rapidi per aprire la ricerca del gioco su Metacritic e Backloggd, così trovi il valore e lo copi.
- Pulsante **Save** che scrive gli override e rigenera `games.json`; il sito in sviluppo si aggiorna da solo.

## 3. Storico: rinvii e andamento dei voti

Ogni esecuzione di `data:fetch` salva uno **snapshot** in `data/snapshots/YYYY-MM-DD.json` con, per ogni gioco: date regionali, prima data di uscita e voti normalizzati. `data:build` confronta gli snapshot e produce lo storico.

### Rinvii

- Un rinvio è: una data precisa che diventa più tardi, oppure una data precisa che torna vaga o TBA. Una data vaga che diventa precisa **non** è un rinvio.
- Nuovo campo `dateHistory: { date: string; firstReleaseDate: string | null }[]`.
- Card: badge **"Delayed"** con la data precedente barrata accanto a quella nuova.
- Timeline: un piccolo segno tratteggiato ("fantasma") nella posizione della data originale, collegato alla card.

### Andamento dei voti

- Nuovo campo `scoreHistory`: per ogni fonte, una lista di `{ date, normalized }`.
- Nella card **selezionata**, sotto ogni cerchietto, una piccola linea (sparkline) con l'andamento. Si mostra solo se ci sono almeno 2 punti diversi.

## 4. Novità della settimana e dall'ultima visita

### Dati

`data:build` genera `public/data/changes.json` confrontando l'ultimo snapshot con i precedenti. Tipi di novità:

- `new` — gioco aggiunto
- `delayed` — gioco rinviato
- `reviews-in` — il gioco riceve il primo voto della critica

Ogni voce ha data della rilevazione e id del gioco.

### Cosa vede l'utente

- Il sito ricorda nel browser (localStorage) quali novità sono già state viste. Alla prima visita mostra quelle dell'ultima settimana.
- **Card**: un badge **"!"** con etichetta (`New`, `Delayed`, `Reviews in`).
- **Minimappa**: i giochi con novità non viste hanno un punto evidenziato e ben distinguibile dagli altri.
- **Header**: un pulsante **"What's new"** con il numero di novità. Apre un pannello con l'elenco raggruppato per settimana; cliccando una voce la timeline salta al gioco e lo seleziona.
- Una novità diventa "vista" quando si seleziona la card, oppure con **"Mark all as seen"** nel pannello.

## 5. Ricerca rapida

- Tasto **`/`** (oppure un'icona lente nell'header) apre un campo di ricerca sovrapposto.
- Ricerca tollerante agli errori sui titoli (es. con Fuse.js); risultati con miniatura della copertina, tipo (gioco / DLC / Switch 2 Edition) e data.
- Frecce su/giù per scegliere, **Invio** per saltare al gioco e selezionarlo, **Esc** per chiudere.
- Mentre la ricerca è aperta, le scorciatoie della timeline sono disattivate.

## 6. Filtri

- Interruttori nell'header: **DLC**, **Switch 2 Edition**, **Third-party**, **Exclusives only**.
- I filtri si applicano a timeline, minimappa, PagSu/PagGiù e ricerca.
- Mostrare quanti giochi sono visibili (es. "42 of 58 games").
- Le scelte restano salvate nel browser.

## 7. Pulsante Nintendo Store

- Terzo pulsante nella card selezionata, accanto a Wikipedia e Nintendo Wiki; grigio e disattivato se il link manca.
- Nuovo campo `links.nintendoStore`.
- Regione dello store: **Europa** di default, configurabile in un file di impostazioni.
- Fonte del link: verificare se IGDB (campo websites) o Wikidata forniscono il link o l'ID dello store Nintendo; altrimenti inserimento manuale tramite il pannello admin.
- Per DLC e Switch 2 Edition, se non esiste una pagina dedicata, va bene il link alla pagina del gioco base.

## 8. Ordine di lavoro

1. Separazione fetch/build (§1)
2. Pannello admin (§2)
3. Pulsante Nintendo Store (§7)
4. Ricerca (§5) e filtri (§6)
5. Snapshot e storico (§3)
6. Novità (§4)

---

## Backlog aggiornato

**Prossime feature già definite** (vedi `ITERATION-2.md`): pagina Studios, pagina Rankings.

**In futuro, forse**: wishlist e giochi giocati, esportazione in calendario (.ics), pagina statistiche, riepilogo annuale, badge "Divisive" per critica e pubblico molto distanti.

**Scartate**: marcatori per eventi Nintendo (Direct, hardware), arco annuncio → uscita.
