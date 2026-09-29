# Nintendo Release Timeline — Specifica di progetto

Sito desktop che mostra, su una timeline orizzontale scorrevole, i giochi Nintendo usciti (e in uscita) dal lancio di Switch 2 (5 giugno 2025) in poi, con voti aggregati di critica e pubblico.

Per ora il sito è solo per uso personale in locale; la pubblicazione su GitHub Pages arriverà più avanti. Il codice è su GitHub nel repository privato `Kappadacqua/nintendo-release-timeline`.

> **Stato:** milestone 1–6, `ITERATION-2.md`, `ITERATION-3.md` e `ITERATION-4.md` completate. Dove un documento di iterazione è in contrasto con questo, vale l'iterazione.

---

## 1. Stack

- **Vite 7 + TypeScript** (vanilla, niente framework UI)
- **GSAP** per animazioni
- **Fuse.js** per la ricerca tollerante agli errori
- Script di raccolta dati in **Node + TypeScript** (`tsx` per eseguirli)
- Node **≥ 20.19** (`.nvmrc`: 24). Le variabili di `.env` sono lette con `process.loadEnvFile`, senza dipendenze.
- Nessun backend: il sito legge i file statici `public/data/games.json`, `public/data/changes.json` e `public/data/studios.json`. Solo in sviluppo un plugin Vite serve il pannello admin (§10)
- Chiavi API in `.env` (escluso da git), in futuro nei GitHub Secrets

## 2. Struttura cartelle

```
/scripts
  fetch-data.ts          # solo rete: IGDB, Wikipedia/Wikidata, OpenCritic, Fandom → data/cache/, poi build e snapshot
  build-data.ts          # senza rete: cache + overrides + storico → games.json e changes.json
  fetch-free-updates.ts  # solo rete: IGDB, Wikipedia, Nintendo Wiki per data/free-updates.json → data/cache/free-updates.json (§13)
  fetch-studios.ts       # solo rete: studi first party da Nintendo Wiki → data/cache/studios.json (§14)
  validate-data.ts       # cosa va completato o deciso a mano
  vite-admin.ts          # plugin Vite del pannello admin (solo `vite dev`)
  lib/build.ts           # perimetro, merge, link Nintendo Store, storico → games.json
  lib/cache.ts           # formato dei file in data/cache/
  lib/snapshots.ts       # snapshot giornalieri, dateHistory / scoreHistory, changes.json
  lib/overrides-schema.ts  # validazione di overrides.json (usata dal pannello admin)
  lib/env.ts             # percorsi, lettura .env
  lib/http.ts            # fetch JSON con throttle, retry e HttpError
  lib/igdb.ts            # client IGDB (auth Twitch, paginazione stabile)
  lib/opencritic.ts      # client OpenCritic (catalogo Switch 2, ricerche, cache, budget)
  lib/wikipedia.ts       # categoria Wikipedia + slug IGDB da Wikidata
  lib/links.ts           # link Wikipedia (Wikidata SPARQL) e Nintendo Wiki (API Fandom)
  lib/transform.ts       # IGDB → Game: tipo, date regionali, perimetro, esclusività IGDB
  lib/exclusivity.ts     # storico esclusività (→ "timed")
  lib/overrides.ts       # overrides.json: override per gioco, abbinamenti Wikipedia, giochi manuali
  lib/report.ts          # tipo di data/fetch-report.json
  lib/free-updates.ts    # aggiornamenti gratuiti Switch 2 → voci free-update, free-updates-seen.json
  lib/fandom.ts          # studi da Nintendo Wiki (API MediaWiki)
  lib/studios.ts         # costruzione di studios.json
  *.test.ts              # test Vitest accanto ai moduli (anche in /src)
/data
  overrides.json         # dati inseriti a mano (vedi §4.2)
  settings.json          # impostazioni (regione del Nintendo Store)
  free-updates.json      # aggiornamenti gratuiti Switch 2, curati a mano (§13)
  free-updates-seen.json # giorno in cui ogni aggiornamento è comparso, da versionare e mai cancellare (§13)
  studios-overrides.json # correzioni agli studi: chiusi, nascosti, alias (§14)
  exclusivity-history.json   # storico esclusività, da versionare
  cache/                 # risposte grezze delle API, da versionare: igdb, wikipedia, links, opencritic, free-updates, studios
                         # (fetch-status.json, esito delle chiamate, è ignorato da git)
  snapshots/YYYY-MM-DD.json  # uno per giorno di data:fetch, da versionare (§5)
  backups/               # copie di overrides.json prima di ogni salvataggio dall'admin (ignorato da git)
  fetch-report.json      # esito dell'ultima build, letto da validate (ignorato da git)
  sample-games.json      # dati finti delle prime milestone
/public
  data/games.json        # output finale letto dal sito
  data/changes.json      # novità (§8)
  data/studios.json      # studi e loro gioco Switch 2 (§14)
  covers/placeholder.svg # copertina di ripiego
index.html, rankings.html, studios.html, admin.html   # pagine (admin solo in sviluppo)
/src
  main.ts                # tema, dialogo scorciatoie, caricamento dati, collegamento dei pezzi
  types.ts               # schema di games.json, changes.json e studios.json
  games.ts               # caricamento di games.json (timeline e Rankings)
  test-utils.ts          # dati minimi per i test
  history.ts             # regole dei rinvii (condivise da build e sito)
  news.ts                # novità viste / non viste (localStorage)
  whats-new.ts           # pulsante e pannello "What's new"
  search.ts              # ricerca rapida
  filters.ts             # filtri dell'header
  view.ts                # menu "View" (stile card, raggruppamento, presentazione)
  zoom-control.ts        # selettore Day / Week / Month e transizione di zoom
  presentation.ts        # modalità presentazione
  admin/                 # pannello admin (admin.html, solo in sviluppo)
  rankings/              # pagina Rankings (main.ts) e ordinamento senza DOM (rank.ts) (§12)
  studios/               # pagina Studios (main.ts) e ordine senza DOM (order.ts) (§14)
  timeline/              # timeline (selezione compresa), scroll e inerzia, header data, minimappa, zona TBA,
                         # sfondo del gioco selezionato (backdrop.ts), titolo del sito (site-title.ts), config,
                         # livelli di zoom (zoom.ts), tacche (ticks.ts), gruppi dello stesso giorno (group.ts)
  cards/                 # card, card espansa (expand.ts), card compatte (compact.ts), cerchietti, layout collisioni, animazioni,
                         # coriandoli (confetti.ts), bandiere, nomi sviluppatori
  theme/                 # tema giorno/notte
  styles/main.css        # solo @import delle parti della timeline, nell'ordine della cascata
  styles/tokens.css      # token in :root e temi; le altre parti per componente (card.css, minimap.css…)
  styles/rankings.css, styles/studios.css   # stili delle pagine Rankings e Studios
.env.example
```

## 3. Perimetro dei giochi

Si includono i giochi la cui **prima uscita su qualsiasi piattaforma** (`first_release_date` di IGDB) è **≥ 2025-06-05** e che rientrano in almeno uno di questi casi:

1. Pubblicati da **Nintendo** o **The Pokémon Company** (tutte le filiali regionali) per Switch 2 e/o Switch 1.
2. **DLC / espansioni e Switch 2 Edition** di un gioco del punto 1, anche se il gioco base è precedente al 2025.
3. Giochi di **terze parti esclusivi per console Nintendo** (anche esclusive temporali), ricavati dalla categoria Wikipedia (§4.1).
4. Giochi forzati a mano in `overrides.json` (`"include": true` o `manualGames`).

Regole di dettaglio:

- Un gioco vecchio che riceve una nuova data Switch (es. un titolo GBA del 2004 uscito su Switch nel 2026) **non** entra: conta la prima uscita assoluta.
- Il `parent_game` di IGDB porta dentro solo DLC e Switch 2 Edition: remake, remaster e port hanno anche loro un `parent_game`, ma non entrano per quella via (evita remake di terze parti di giochi che Nintendo aveva pubblicato in passato).
- Le altre edizioni di un gioco (Special Edition, collezioni: `version_parent` senza "Nintendo Switch 2 Edition" nel nome) non compaiono come voce separata.
- Esclusi i tipi IGDB bundle, pack, update, mod.
- Giochi con sola data "TBD" (nemmeno l'anno): inclusi solo se per Switch 2.
- **Switch 2 Edition**: incluse, con la data della Switch 2 Edition.
- **DLC / espansioni**: voce separata con propria data e card diversa (§7).
- Switch 2 Edition e DLC entrano solo se hanno una pagina OpenCritic o se sono forzati in `overrides.json`. Se OpenCritic non è stato interrogabile, restano (e `data:validate` lo segnala).
- Un gioco **appena uscito** senza recensioni si mostra comunque, con i voti a **N/D**.
- **Giochi annunciati**:
  - con data precisa → sulla timeline nel futuro, stato "Upcoming";
  - con data vaga (anno, trimestre, mese) → nella **zona TBA**, raggruppati per anno; senza nemmeno l'anno → blocco "TBA" in fondo.

## 4. Fonti dati

| Dato | Fonte | Modalità |
|---|---|---|
| Titolo (inglese), copertina, sviluppatore, generi, piattaforme, tipo | IGDB API | automatica |
| Riassunto, immagine di sfondo (key art senza logo → screenshot → … → copertina) | IGDB API | automatica |
| Link Wikipedia | Wikidata (P5794 → sitelink enwiki) o pagina della categoria | automatica, sovrascrivibile |
| Link Nintendo Wiki (`nintendo.fandom.com`) | API MediaWiki di Fandom | automatica, sovrascrivibile |
| Link Nintendo Store | Wikidata (P12418 eShop EU, P8084 eShop US) e link `websites` di IGDB | automatica, sovrascrivibile |
| Date di uscita JP / EU / NA | IGDB (`release_dates` con `release_region` e `date_format`) | automatica, correggibile a mano |
| Voto OpenCritic (Top Critic Average) + n° top critic | OpenCritic API (RapidAPI); ID anche da Wikidata (P2864) | automatica, ID forzabile |
| Metacritic Metascore + n° recensioni | — (nessuna API) | **manuale** |
| Metacritic User Score + n° voti | — | **manuale** |
| Backloggd rating + n° voti | — | **manuale** |
| Esclusività, "Also on Switch 1", terze parti | Wikipedia + piattaforme IGDB (§4.1) | automatica, con override |

Note:

- **Niente scraping** di Metacritic o Backloggd: i valori si inseriscono a mano in `overrides.json`.
- **IGDB**: autenticazione Twitch client credentials. Switch 2 = piattaforma **508**, Switch = **130**. Si usano i campi nuovi `game_type`, `release_region`, `date_format` (non gli enum deprecati `category` / `region`), chiesti **per nome**: i formati data attuali sono `YYYYMMDD`, `YYYYMM`, `YYYY`, `YYYYQ1…Q4`, `TBD` (accettati anche i vecchi nomi `YYYYMMMMDD` / `YYYYMMMM`). Paginazione sempre con `sort id asc`, altrimenti le pagine saltano o ripetono righe. Limite 4 richieste/s, 500 risultati per richiesta.
- **Date regionali**: per ogni regione vince la data specifica della regione sulla "worldwide"; senza voci per Switch si usa `first_release_date`. `firstReleaseDate` è la più vicina fra JP/EU/NA.
- **Copertine**: CDN IGDB (`images.igdb.com`, taglia `cover_big`); se l'immagine non si carica, il sito mostra `placeholder.svg`.
- **Link Backloggd**: automatico (Backloggd usa gli slug IGDB). **Metacritic**: da inserire in `links` negli override.
- **Link Wikipedia**: una query SPARQL su Wikidata per tutti i giochi (slug IGDB → articolo della Wikipedia inglese); per i giochi della categoria Switch 2-only vale anche la pagina della categoria.
- **DLC e Switch 2 Edition** senza pagina propria usano le pagine del **gioco base** (`parent_game` / `version_parent` di IGDB, altrimenti il titolo senza "Nintendo Switch 2 Edition…").
- **Link Nintendo Wiki**: titolo esatto (o redirect definito dalla wiki) con l'API di Fandom; altrimenti una ricerca, accettata solo se il titolo normalizzato coincide. In caso di dubbio nessun link (DLC e titoli minori spesso non hanno pagina).
- **Link Nintendo Store**: regione in `data/settings.json` (`nintendoStore.region`, default `"EU"`; `euSite` sceglie il sito europeo, impostato su `www.nintendo.it` (default del codice `www.nintendo.co.uk`); `fallbackRegions`, default `["US"]`, si provano in ordine se la regione scelta non ha la pagina). Pagina EU: `https://<euSite>/-/-<id>.html` con l'id eShop europeo (Wikidata o link IGDB a un sito Nintendo europeo); pagina US: link IGDB a `nintendo.com/us/store/products/` o id Wikidata. DLC e Switch 2 Edition senza pagina propria usano quella del gioco base.
- Se Wikidata o Fandom non rispondono, restano i link del `games.json` precedente.
- **Immagine di sfondo** (taglia `1080p`): solo immagini orizzontali e senza trasparenza, in quest'ordine: artwork di tipo *key art without logo* → screenshot → *concept art* → altri artwork → *key art with logo* → copertina. Gli artwork IGDB sono spesso la copertina stessa (key art con logo) o un personaggio su fondo trasparente, che sfocati sembrano la copertina: per questo si leggono `artwork_type`, dimensioni e `alpha_channel`.

### 4.1 Esclusività

Due fonti combinate:

1. **Wikipedia**, categoria [Nintendo Switch 2-only games](https://en.wikipedia.org/wiki/Category:Nintendo_Switch_2-only_games), letta con la **MediaWiki API** e uno `User-Agent` descrittivo (con il contatto `WIKI_CONTACT`).
2. **Piattaforme IGDB**: esclusivo se tutte le piattaforme sono Switch 2 e/o Switch 1 (copre i cross-gen Nintendo, assenti dalla categoria).

Regole:

- **Abbinamento Wikipedia ↔ IGDB**: via **Wikidata** (P5794 "IGDB game ID", che contiene lo slug). Senza Wikidata: ricerca IGDB per titolo, accettata solo se il titolo normalizzato coincide. Abbinamenti forzati nella sezione `wikipedia` di `overrides.json`, anche verso più giochi o verso giochi manuali.
- **Inclusione terze parti**: ogni gioco della categoria con data nel perimetro entra automaticamente.
- **Esclusive temporali**: lo storico è in `data/exclusivity-history.json`; un gioco che era esclusivo e non lo è più diventa `"timed"`.
- **Conflitti** Wikipedia/IGDB: segnalati da `data:validate` finché non si decide in `overrides.json` (un conflitto già deciso a mano non viene più elencato).
- La categoria Wikipedia è un segnale, non una verità assoluta.

### 4.2 OpenCritic

Piano gratuito RapidAPI: **25 ricerche e 200 richieste al giorno** (visibili negli header `x-ratelimit-*`). Per questo:

- **ID noti senza ricerca**, con precedenza su ogni abbinamento per titolo: `opencriticId` in `overrides.json`, poi l'ID OpenCritic di Wikidata (P2864, letto con la stessa query dei link, solo per lo slug IGDB del gioco stesso). Serve per i giochi che OpenCritic non elenca come Switch 2 (es. Drag x Drive, segnato solo "Switch").
- **Catalogo Switch 2**: lo script scarica l'elenco completo dei giochi Switch 2 (`GET /game?platforms=Switch 2&sort=name`, ~38 pagine da 20) e lo tiene in cache per `OPENCRITIC_CATALOG_DAYS` giorni (default 3). Gli abbinamenti per titolo normalizzato si fanno sul catalogo, **senza ricerche**; il voto viene dal catalogo.
- **Ricerche** (`/game/search`) solo come ripiego per i giochi che non sono nel catalogo; i giochi **mai cercati passano per primi**, poi gli altri dal più recente. I mancati abbinamenti si ritentano dopo 3 giorni (giochi usciti da poco) o 14. Oltre al titolo identico (normalizzato) si accetta un risultato vicino solo se ha **le stesse parole** a meno di articoli e congiunzioni (evita "Xenoblade Chronicles X" al posto di "Xenoblade Chronicles", o un "2" perso).
- **Dettagli** (`/game/{id}`) per il numero di top critic, in cache 1 giorno per i giochi usciti da meno di 45 giorni, 14 per gli altri.
- Ogni esecuzione ha un tetto (`OPENCRITIC_MAX_SEARCHES`, `OPENCRITIC_MAX_REQUESTS`). Esaurire le ricerche non blocca le richieste; un 429 sulle richieste o una chiave rifiutata fermano le chiamate ma **la cache continua a essere usata**.
- **Mai sovrascrivere con `null`**: se per un gioco uscito OpenCritic non dà una risposta certa in questo run (errore, quota, chiave assente), il voto e il link del `games.json` precedente restano. Una risposta certa è: voto trovato, gioco senza pagina, o pagina con voto `-1` (troppe poche recensioni).
- A fine fetch un riquadro di avviso elenca le chiamate fallite (con il motivo reale) e quanti voti sono stati mantenuti.
- Abbinamento sbagliato o titolo diverso: si forza con `opencriticId` negli override.

### Esempio `data/overrides.json`

```json
{
  "games": {
    "igdb:123456": {
      "_title": "Promemoria, ignorato dagli script",
      "include": true,
      "exclusivity": "exclusive",
      "alsoOnSwitch1": false,
      "opencriticId": 98765,
      "releaseDates": { "JP": "2025-12-25" },
      "metacritic": { "critic": 91, "criticCount": 112, "user": 8.7, "userCount": 2400 },
      "backloggd": { "rating": 4.3, "count": 5100 },
      "links": { "metacritic": "https://www.metacritic.com/game/…/" }
    }
  },
  "wikipedia": {
    "Pokémon Winds and Waves": ["igdb:393105", "igdb:393104"],
    "Putty World": ["manual:putty-world"]
  },
  "manualGames": [
    {
      "id": "manual:putty-world",
      "title": "Putty World",
      "developer": null,
      "genres": [],
      "vagueRelease": { "year": 2027, "label": "2027" }
    }
  ]
}
```

- `include`: `true` forza l'inclusione, `false` nasconde il gioco.
- `exclusivity`: `"exclusive"` | `"timed"` | `null`; se presente sovrascrive il valore calcolato.
- `releaseDates`: corregge singole date regionali (`null` = TBA) e ricalcola `firstReleaseDate`.
- `manualGames`: giochi assenti da IGDB, con id `manual:<slug>`; voti e link si aggiungono in `games["manual:…"]` come per gli altri. Senza `vagueRelease.year` e senza date finiscono nel blocco "TBA".

## 5. Schema di `games.json`

```ts
type Region = "JP" | "EU" | "NA";

interface GamesFile {
  generatedAt: string;           // ISO timestamp della build
  games: Game[];                 // ordinati per data, poi TBA per anno, poi titolo
}

interface Game {
  id: string;                    // "igdb:<id>", "manual:<slug>" oppure "free-update:<titolo>"
  kind: "game" | "switch2-edition" | "dlc" | "free-update";
  title: string;                 // titolo inglese
  baseGameTitle?: string;        // solo per DLC
  coverUrl: string;
  summary: string | null;        // riassunto IGDB
  backgroundUrl: string | null;  // artwork → screenshot → copertina
  developer: string | null;
  genres: string[];
  releaseDates: Partial<Record<Region, string | null>>; // "YYYY-MM-DD" o null = TBA
  firstReleaseDate: string | null;  // la più vicina tra JP/EU/NA
  vagueRelease?: { year: number; label: string }; // per la zona TBA ("2026", "Q2 2027"…)
  originalReleaseYear?: number;  // solo free-update: anno di uscita originale su Switch
  dateHistory?: { date: string; firstReleaseDate: string | null }[];  // solo i cambi, se più di uno
  scoreHistory?: Partial<Record<"opencritic" | "metacritic" | "metacriticUser" | "backloggd",
    { date: string; normalized: number }[]>>;  // solo i cambi, fonti con almeno 2 punti
  exclusivity: "exclusive" | "timed" | null;
  alsoOnSwitch1: boolean;
  firstParty: boolean;           // Nintendo / The Pokémon Company, o DLC / edizione di un loro gioco
  onOtherConsoles?: boolean;     // anche su altre console o PC (i telefoni non contano); assente per i giochi manuali
  scores: {
    critic: {
      opencritic: Score | null;
      metacritic: Score | null;
    };
    user: {
      metacritic: Score | null;  // originale 0–10
      backloggd: Score | null;   // originale 0–5
    };
  };
  links: {
    opencritic?: string;
    metacritic?: string;
    backloggd?: string;
    wikipedia?: string;
    nintendoWiki?: string;
    nintendoStore?: string;
  };
}

interface Score {
  value: number;       // valore originale
  scale: 5 | 10 | 100;
  normalized: number;  // 0–100
  count: number | null;
}
```

Tipo: "Nintendo Switch 2 Edition" nel nome → `switch2-edition`; tipo IGDB DLC / espansione → `dlc`; altrimenti `game`. Normalizzazione: Metacritic user ×10, Backloggd ×20. Nel cerchietto si mostra il **valore originale**, il riempimento usa il valore normalizzato.

### Snapshot e storico

Ogni `data:fetch` salva `data/snapshots/YYYY-MM-DD.json` (uno per giorno, un secondo fetch lo stesso giorno lo sostituisce) con, per ogni gioco: titolo, date regionali, prima data, etichetta vaga e voti normalizzati. `data:build` mette in fila gli snapshot precedenti a oggi più i valori attuali e ne ricava `dateHistory`, `scoreHistory` e `changes.json`. La cartella si può spostare con la variabile `SNAPSHOTS_DIR` (utile per i test).

- **Rinvio** (regole in `src/history.ts`): fra due punti consecutivi, una data precisa che diventa più tardi o che torna vaga / TBA. Vaga → precisa **non** è un rinvio. Il rinvio si mostra finché il gioco non è uscito e la data non è tornata alla precedente (o prima).

### `changes.json`

```ts
interface ChangesFile {
  generatedAt: string;
  changes: Change[];             // dalla più recente, ultimi 60 giorni, solo giochi ancora presenti
}

type Change = { date: string; id: string } & (   // date = giorno della rilevazione
  | { type: "new" }                                // assente da tutti i punti precedenti
  | { type: "delayed"; from: string; to: string | null }
  | { type: "reviews-in"; source: "opencritic" | "metacritic"; normalized: number }  // primo voto della critica
);
```

Il primo snapshot fa da base: nessun gioco è "new" rispetto a esso.

## 6. Timeline

- **Linea orizzontale rossa** dal 5/6/2025 all'ultima data precisa (o a oggi) + 60 giorni, con un pallino e l'etichetta della data iniziale; poi, dopo uno stacco con segno di interruzione (//), la **zona TBA**. La linea è centrata verticalmente nello spazio sopra la minimappa.
- **Passato vs futuro**: linea piena nel passato, tratteggiata e più chiara nel futuro.
- **Indicatore centrale** (playhead): linea verticale sottile fissa al centro; la timeline scorre sotto di essa, le card le passano sopra. Il giorno sotto l'indicatore ha la tacca in evidenza e il numero in una pillola rossa.
- **Tacche** (livello Day: 32px per giorno, scale in `src/timeline/zoom.ts`): giorno corta, lunedì media, inizio mese alta. Numero del giorno sotto i giorni 1, 5, 10, 15, 20, 25 (`labeledDays`), etichetta del mese sotto i numeri (con l'anno a gennaio). Linea e tacche sono disegnate su canvas, solo per la parte visibile (`ticks.ts`).
- **Fasce dei mesi**: un mese sì e uno no appena tinto (`--month-band`), dal bordo alto alla minimappa, dietro linea e card; solo sulla linea datata.
- **Pallini per tipo**, sulla linea e nella minimappa: gioco rosso (`--timeline`), Switch 2 Edition diviso a metà nei due colori Joy-Con (`--joycon-left` / `--joycon-right`), DLC viola (`--dlc`) e quadrato. Pieno se uscito, anello se futuro. Legenda nel dialogo "?".
- **Header** al centro della barra in alto: la data sotto l'indicatore, `2026 · September · Sat 26`; anno, mese e giorno si animano ognuno per conto suo nella direzione dello scroll; durante un movimento continuo (la data cambia più volte in 250ms) si aggiornano subito, senza animazione, così l'header segue sempre la data sotto l'indicatore. Nella zona TBA: "2027 · Date TBA" per i blocchi con anno, solo "Date TBA" per quello senza; l'indicatore centrale lì è nascosto.
- **Durata degli spostamenti**: rotella e frecce inseguono la destinazione; i salti lunghi (oltre `glideMinPx`, 300px: Home, Fine, T, minimappa, ricerca, novità) sono una corsa a tempo che dura al massimo `maxGlideMs` (600ms).
- **Aggancio al giorno**: ogni movimento (rotella, frecce, fine del trascinamento, minimappa) si ferma esattamente su un giorno (Week: sul lunedì; Month: sul 1° del mese); la zona TBA è libera.
- **All'apertura** la timeline è centrata su **oggi** (fuso orario locale), con l'indicatore **"Today"** pulsante.
- **Zona TBA**: blocchi per anno ("2026", "2027"…, poi "TBA"), tratteggiati, con le card dei giochi senza data precisa, collegati da una linea puntinata.
- **Minimappa** in basso: mesi (anno a gennaio), un puntino per gioco (colore e forma per tipo come sulla linea; **blu, più grande e con alone** se il gioco ha novità non viste, §8; un solo punto più grande per un gruppo dello stesso giorno), lineetta su oggi, zona TBA a righe, riquadro della porzione visibile. Clic = salto con scorrimento; trascinamento = segue in diretta. Al passaggio del mouse su un punto, anteprima con copertina, titolo e data (tutti i giochi, per un gruppo). Il **riquadro si trascina**: la timeline lo segue in tempo reale (un clic senza movimento resta un salto).
- **Uscite dello stesso giorno** (opzione "Group same-day releases" nel menu View, accesa di default): da **3 giochi** in su nello stesso giorno (dopo i filtri) compare un **gruppo** — copertine sovrapposte a ventaglio chiuso, "N games" e la data, pallino più grande. Clic sul gruppo o PagGiù che ci arriva: le card si **aprono a ventaglio** e si seleziona il primo gioco. Il ventaglio è una fila: la card selezionata, completa, sta sotto l'indicatore; le altre, compatte (copertina e titolo), la seguono in ordine ai due lati senza sovrapporsi (titoli sempre leggibili), leggermente inclinate man mano che si allontanano; il gruppo chiuso ("8 games") è nascosto finché il ventaglio è aperto; la fila scorre quando cambia la selezione e le card oltre i bordi entrano con PagSu/PagGiù; PagSu che ci arriva da dopo seleziona l'ultimo, così il gruppo si percorre nei due versi. Dentro, PagSu/PagGiù scorrono i suoi giochi e poi proseguono; uscendo o deselezionando il ventaglio si richiude. Con l'opzione spenta, card singole.
- **Rinvii**: nella posizione della data originale un cerchietto tratteggiato ("fantasma"), collegato da un arco tratteggiato al pallino della nuova data (solo il fantasma se il gioco è tornato TBA).
- **Collisioni**: assegnazione a corsie sopra/sotto la linea; una card può scivolare di lato fino al 60% della larghezza (connettore a gomito) prima di impilarsi a mazzo; la card sotto il mouse o con il focus va in primo piano.
- **Finestre basse**: le card si rimpiccioliscono (fino a 0.55) per stare fra la barra in alto e la minimappa. La fascia sotto la linea con numeri e mesi (`cardOffset`, 64px) non si restringe mai: il primo tratto del connettore resta fisso, si scala solo il gruppo con la card.
- **Performance**: card create solo quando si avvicinano al viewport e nascoste quando sono lontane; 60fps misurati durante lo scorrimento.

### Livelli di zoom

Tre livelli: **Day** (32px/giorno), **Week** (8px/giorno), **Month** (2,6px/giorno). Si cambiano con **Ctrl + rotella** (anche il pizzico del trackpad; al massimo un livello ogni 350ms), i tasti **+** / **−**, o il selettore **Day · Week · Month** in alto a destra nella timeline, che mostra il livello attuale. La pagina si apre sempre a Day.

- Il cambio ricostruisce la timeline alla nuova scala centrata sullo stesso giorno: la vista vecchia sparisce subito (mai due timeline sovrapposte), la nuova entra in 300ms attorno all'indicatore, un po' più piccola (zoom in) o più grande (zoom out); la minimappa non si anima.
- Week / Month: rotella e frecce avanzano di una settimana / un mese (Shift: 4 settimane / 3 mesi); tacche ai lunedì con le settimane numerate ("W23") o solo ai mesi; la pillola dell'indicatore mostra "W39" o "SEP". L'header mostra la data sotto l'indicatore adattata al livello: "2026 · September · W39" a Week, "2026 · October" a Month. Le etichette dei mesi che finirebbero sotto la pillola o addosso all'etichetta precedente (es. "JUN 5, 2025" e "JUL") non si disegnano.
- Week / Month: le card (anche nella zona TBA) sono **solo copertina**, qualunque sia lo stile scelto; il titolo compare al passaggio del mouse. I gruppi dello stesso giorno si rimpiccioliscono ("8 games").
- Selezionare un gioco da Week o Month (clic, PagSu/PagGiù, ricerca, novità) riporta a **Day** con il gioco selezionato; passando a Week o Month la selezione si toglie.

### Modalità presentazione

- Tasto **P** o "Start presentation" nel menu View; da Week / Month riporta prima a Day.
- Parte dalla posizione attuale (dal gioco selezionato, o dal primo dopo l'indicatore) e passa al successivo ogni **6 secondi** (`presentationSeconds` in `config.ts`), con selezione, sfondo e animazioni come PagGiù. Rispetta i filtri; dopo l'ultimo gioco con data precisa ricomincia da capo (zona TBA esclusa).
- **Spazio** mette in pausa e riprende; qualsiasi altro input (rotella, clic, tasti) la ferma e fa il suo effetto normale. Fermandosi (anche con P) deseleziona: un gruppo aperto si richiude e le card tornano allo stato normale / compatto.
- Una barra sottile in basso mostra il tempo prima del gioco successivo; un breve avviso dice come controllarla; il cursore si nasconde dopo 2,5s di immobilità.

### Controlli

| Input | Azione |
|---|---|
| Rotella del mouse | 1 scatto = 1 giorno (Week / Month: una settimana / un mese; Shift: un mese a qualsiasi livello), sommato alla destinazione (l'animazione la insegue). Modalità righe/pagine (`deltaMode` 1/2): 1 giorno per evento. Modalità pixel: un evento ≥ `wheelNotchPx` (40px) è uno scatto; se il browser ha unito più scatti vale `floor(delta / wheelNotchUnitPx)` giorni (100px). `?debug=wheel` stampa ogni evento in console |
| Trackpad | Solo i delta sotto `wheelNotchPx` si sommano, `trackpadDayPx` (40px) per giorno |
| Trascinamento | Scorrimento libero (parte dopo 5px, così i clic sulle card restano clic). Rilasciando mentre si muove, **inerzia**: continua alla velocità del gesto e rallenta per attrito (`flingFriction`), poi si aggancia; per quanto veloce sia il gesto non percorre mai più di `flingMaxDays` (30 giorni) al livello di zoom corrente; un trascinamento lento o breve (sotto `flingMinVelocity`) si aggancia subito. Qualsiasi input la ferma (un clic durante l'inerzia non seleziona), si ferma ai limiti della timeline; niente inerzia con `prefers-reduced-motion` |
| Ctrl + rotella, + / − | Livello di zoom (Day, Week, Month) |
| ← / → | Un giorno (Shift: una settimana); a Week / Month una settimana / un mese |
| [ / ] | Mese precedente / successivo (il 1° del mese); funziona anche con AltGr (tastiera italiana) |
| P / Spazio | Avvia o ferma la presentazione / pausa |
| PagSu / PagGiù | Seleziona il gioco precedente / successivo (§7) |
| Home / Fine | Inizio della timeline / zona TBA |
| T | Oggi |
| Esc | Deseleziona |
| Clic sulla minimappa | Salto al punto scelto (trascinando: segue in diretta); trascinando il riquadro, la vista lo segue |
| Tab | Card al centro (o selezionata), poi i suoi link; Invio o Spazio la seleziona |
| ? | Dialogo con le scorciatoie (anche dal pulsante "?" nell'header) |
| / | Ricerca rapida (§8) |

Rotella, trascinamento, frecce, [ / ], minimappa, T, Home/Fine, Esc e clic su un'area vuota **deselezionano**. Passando a un altro gioco (PagSu/PagGiù, clic) la card precedente si richiude subito, senza animazione.

Con `prefers-reduced-motion` lo scorrimento salta direttamente, header e card non si animano, "Today" non pulsa.

## 7. Card

### Card gioco (e Switch 2 Edition)

- Copertina
- Titolo (massimo 3 righe)
- Sviluppatore · generi. I nomi di sviluppatore oltre 20 caratteri sono **abbreviati** ("Nintendo EPD Production Group No. 5" → "Nintendo EPD", "Konami Digital Entertainment" → "Konami", alias "Nintendo Software Technology" → "NST"), con il nome completo nel tooltip.
- **Date regionali**: in tutte le card, DLC comprese, **bandiera + sigla (JP / EU / NA) + data** o "TBA". Bandiere SVG con bordo sottile a colore di tema (visibile anche la giapponese sul bianco).
- **Badge**: `! New` / `! Delayed` / `! Reviews in` (novità non vista, blu, §8), `Out today…` (§7, "Uscito oggi"), `Delayed`, `Switch 2 Edition`, `Exclusive`, `Timed exclusive`, `Also on Switch 1`. Un rinvio non ancora visto mostra solo `! Delayed`, che dopo la visione torna il normale `Delayed` ambra.
- **Rinvio**: sotto i badge la data precedente barrata → la nuova (o la data vaga / "TBA").
- **Blocco Critics**: OpenCritic + Metacritic; **Blocco Users**: Metacritic User + Backloggd
- Sotto ogni cerchietto: nome della fonte (link, se c'è) e numero di recensioni o voti in forma compatta ("3.1K ratings")
- **Upcoming** per i giochi futuri al posto dei voti ("In 12 days", "Tomorrow"); per i TBA "Expected 2027" o "Date TBA"; bordo tratteggiato

### Card compatte

Nel menu **View**, "Card style": `Full` (tutto) o `Compact` (solo copertina, titolo e badge; larghezza 236px, 220 per i DLC). La card **selezionata** torna sempre completa (voti, date, descrizione, pulsanti), crescendo attorno al proprio centro. Le corsie si ricalcolano con le larghezze della modalità attiva. Il cambio è animato: le card scivolano al nuovo posto mentre si ridimensionano, le parti nascoste si ripiegano. Nella zona TBA le card compatte mantengono la larghezza e si accorciano soltanto.

### Card DLC

Più compatta, nastro diagonale "DLC" e bordo viola (`--dlc`, lo stesso colore dei suoi pallini), sfondo leggermente violaceo, riga "Expansion for *<gioco base>*", stessi blocchi voti. **Niente badge di esclusività** (riguarda il gioco base).

### Card Switch 2 Edition

Bordo sfumato a due colori, ispirato ai due Joy-Con: blu a sinistra, rosso a destra (token `--joycon-left` / `--joycon-right`, più chiari nel tema scuro). Il bordo resta sfumato anche al passaggio del mouse e da selezionata.

### Cerchietti dei voti

- Anello che si riempie in proporzione al voto normalizzato, valore originale al centro.
- Colori per fasce OpenCritic: **Mighty ≥ 84**, **Strong 75–83**, **Fair 65–74**, **Weak < 65**, come token CSS (`--score-*`). I colori sono approssimati e vanno ancora verificati su opencritic.com.
- Nessun voto → anello grigio con "N/D".

### Animazione di comparsa

Le card già visibili all'apertura del sito compaiono subito, senza animazione. Le altre, quando la data entra nel viewport: il connettore cresce, la card sale dalla linea con fade e scale, poi i cerchietti si riempiono con il numero che sale. Una volta sola per card; durante un salto lungo (es. dalla minimappa) le card che scorrono via non consumano l'animazione.

### Selezione

- **Come si seleziona**: PagGiù / PagSu scelgono il gioco successivo / precedente rispetto a quello selezionato o, se nessuno è selezionato, il primo gioco strettamente dopo / prima dell'indicatore. Ordine: prima data di uscita, a parità di data titolo; la zona TBA in fondo, per anno. Clic su una card (o Invio/Spazio con il focus) la seleziona. La timeline scorre fluida fino a portare la card sotto l'indicatore.
- **Link**: in una card non selezionata il clic seleziona e non apre mai link; nella card selezionata link e pulsanti funzionano (nuova scheda).
- **Aspetto**: la card selezionata è ingrandita (×1.05) verso la linea, ha un bordo luminoso ed è sopra le altre; le altre si attenuano (opacità 0.5). In alto a sinistra il titolo del sito lascia il posto, con dissolvenza, a miniatura della copertina + titolo del gioco.
- **Card espansa**: si apre con un'animazione e mostra il **tempo relativo** (nelle card in uscita dentro la fascia "UPCOMING", al posto del conto alla rovescia breve) ("Out in 12 days", "Out today", "Out tomorrow", "Released 3 days ago"; oltre 60 giorni in mesi, oltre 24 mesi in anni; per i TBA "Expected 2027"), il **riassunto** IGDB troncato a 3 righe (testo intero nel tooltip) e i pulsanti **Wikipedia**, **Nintendo Wiki** e **Store** (Nintendo Store: nome completo in tooltip e `aria-label`), sempre **su una riga** anche nella card DLC, grigi e disattivati se il link manca. Sotto ogni cerchietto una **sparkline** con l'andamento del voto (`scoreHistory`), solo se ci sono almeno 2 valori diversi. Se la card espansa esce dall'area visibile viene spostata dentro; se è più alta dello spazio sul suo lato della linea si rimpicciolisce, col bordo verso la linea fermo, invece di scavalcare la linea.
- Selezionare una card segna come viste le sue novità (§8).
- `selectById(gameId)` della timeline è pubblico: lo usano ricerca e novità.

### Sfondo del gioco selezionato

- Dietro tutto il sito, a tutto schermo, l'immagine del gioco selezionato (`backgroundUrl`): sfocatura marcata (molto più forte se è la copertina), sotto un velo del colore di sfondo del tema (token `--backdrop-blur`, `--backdrop-blur-cover`, `--backdrop-veil`).
- Dissolvenza incrociata fra due livelli (400ms); un'immagine appare solo quando è caricata e se è ancora quella richiesta. Scompare alla deselezione.
- Con lo sfondo attivo, una fascia semitrasparente (colore di sfondo del tema) sta dietro la linea, i numeri dei giorni e i mesi, e dietro il footer. Velo: 0.45 nel tema chiaro, 0.06 nel tema scuro.
- Selezionata, una Switch 2 Edition non ha l'anello rosso (coprirebbe il bordo sfumato) ma un bagliore esterno blu/rosso.
- Alla selezione si precaricano le immagini del gioco precedente e successivo.

### Uscito oggi

- Se la data di **almeno una regione** coincide con oggi (fuso orario locale): badge **"Out today"** se escono tutte e tre le regioni, altrimenti "Out today in Japan", "Out today in Europe & North America"…
- Quando la card entra in vista: uno scoppio di coriandoli rossi (una volta sola, insieme all'animazione di comparsa), poi un bagliore pulsante continuo (sospeso mentre la card è selezionata).
- Con `prefers-reduced-motion`: solo il badge.

### Accessibilità

- Solo la card al centro o selezionata (e i suoi link) è nel tab order; con PagSu/PagGiù, Home, Fine, T e frecce il focus segue il gioco.
- Ogni card ha un riassunto per i lettori di schermo (titolo, tipo, data, esclusività, voto OpenCritic).
- Contorno di focus rosso uniforme per tutti gli elementi raggiungibili da tastiera.

## 8. Novità, ricerca e filtri

Nell'header, a destra: **What's new**, **View**, **filtri**, **ricerca**, **?**, **tema** (in sviluppo anche il link ✎ al pannello admin).

### Menu "View"

Pannello simile a quello dei filtri: **Card style** (Full / Compact), **Group same-day releases** (acceso di default), **Seasonal background** (§15), **Start presentation** (P). Le scelte restano nel browser (`localStorage`, `view`); il livello di zoom no (la pagina si apre a Day).

### Novità ("What's new")

- Il sito ricorda in `localStorage` (`whats-new`) le novità già viste. Alla **prima visita** conta come non viste solo quelle degli ultimi 7 giorni.
- **Pulsante** "What's new" con il numero di novità non viste (sotto i 1500px di larghezza solo "!" e il numero). Apre un pannello con le novità degli ultimi 60 giorni **raggruppate per settimana** ("This week", "Last week", "Week of Sep 7"): tipo, copertina, titolo, dettaglio ("Added · out Oct 22, 2026", "Oct 15, 2026 → Oct 22, 2026", "First reviews · OpenCritic 80"), data; un pallino blu segna quelle non viste. Clic su una voce: la timeline salta al gioco e lo seleziona. Le voci di giochi nascosti dai filtri sono disattivate ("Hidden by the current filters").
- Una novità diventa vista quando si **seleziona la card**, oppure con **"Mark all as seen"** nel pannello; badge sulle card, puntini della minimappa e contatore si aggiornano subito.
- Senza `changes.json` (o senza novità) il pannello lo dice e il sito funziona come prima.

### Ricerca

- Tasto **`/`** o lente nell'header: finestra modale con un campo di ricerca (Fuse.js su titolo e titolo del gioco base, tollerante agli errori di battitura), fino a 8 risultati con copertina, tipo (Game / DLC / Switch 2 Edition) e data.
- ↑/↓ scelgono, **Invio** (o clic) salta al gioco e lo seleziona, **Esc** o clic fuori chiude. Mentre è aperta le scorciatoie della timeline sono disattivate.
- Cerca solo fra i giochi visibili con i filtri attuali.

### Filtri

- Pulsante "67 games ▾" (o "42 of 67 games", con un pallino se i filtri non sono quelli di default) che apre gli interruttori **DLC**, **Switch 2 Edition**, **Third-party**, **Exclusives only**. "Exclusives only" nasconde i giochi usciti anche su altre console o PC; i giochi Switch + telefono (Pokémon Friends, Pokémon Champions) restano.
- Si applicano a timeline, minimappa, PagSu/PagGiù e ricerca; cambiarli ricostruisce la timeline mantenendo la posizione e, se ancora visibile, il gioco selezionato.
- Le scelte restano salvate nel browser (`localStorage`, `filters`).

## 9. Grafica

- Richiamo Nintendo: **rosso** primario, angoli arrotondati, look pulito.
- **Tema giorno/notte**: segue la preferenza di sistema, con interruttore manuale ricordato nel browser (applicato prima del primo paint). Tutti i colori sono variabili CSS.
- Font **Nunito** (Google Fonts) con fallback arrotondati di sistema.
- Niente loghi o font ufficiali Nintendo. Footer: "Not affiliated with Nintendo. Scores from OpenCritic, Metacritic and Backloggd."
- Interfaccia in **inglese**. Solo **desktop** (larghezza minima 1280px). Un titolo di gioco lungo nell'header finisce con i puntini.
- Favicon SVG inline, stato "Loading games…" e messaggio d'errore se `games.json` non si carica.

## 10. Aggiornamento dati

Variabili in `.env` (vedi `.env.example`): `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `RAPIDAPI_KEY` (facoltativa), `OPENCRITIC_MAX_SEARCHES`, `OPENCRITIC_MAX_REQUESTS`, `OPENCRITIC_CATALOG_DAYS`, `WIKI_CONTACT`.

- `npm run data:fetch` → interroga le API e salva le risposte grezze in `data/cache/`, poi esegue la build e scrive lo snapshot del giorno. Se un passo essenziale fallisce (es. credenziali IGDB mancanti) si ferma senza toccare `games.json`.
- `npm run data:build` → **senza rete** (~50ms): cache + `overrides.json` + `settings.json` + storico esclusività + snapshot + `free-updates.json` + `studios-overrides.json` → `public/data/games.json`, `public/data/changes.json`, `public/data/studios.json` e `data/fetch-report.json` (aggiorna anche `data/free-updates-seen.json`). Si usa dopo aver modificato a mano overrides o impostazioni.
- `npm run data:fetch-free-updates` e `npm run data:fetch-studios` → rete, solo per aggiornamenti gratuiti (§13) e studi (§14).
- `npm run data:validate` → elenca:
  - giochi **usciti senza Metacritic o Backloggd** (con quali mancano);
  - conflitti di esclusività non ancora decisi;
  - pagine Wikipedia senza gioco IGDB;
  - giochi usciti senza abbinamento OpenCritic;
  - DLC / Switch 2 Edition esclusi (senza pagina OpenCritic) o non verificati;
  - giochi senza link **Wikipedia** o **Nintendo Wiki**;
  - errori OpenCritic, Wikipedia e Nintendo Wiki, e voti mantenuti dal fetch precedente;
  - override che puntano a giochi assenti;
  - il contenuto della zona TBA.

  Con `--stubs` stampa il blocco JSON da completare per i voti manuali mancanti.
- **Pannello admin** (`/admin`, solo con `npm run dev`; non finisce nella build di produzione):
  - elenco dei giochi con dati mancanti, filtrabile: Metacritic, Backloggd, link Wikipedia / Nintendo Wiki / Nintendo Store, conflitti di esclusività; ricerca per titolo;
  - per ogni gioco un modulo con i campi di `overrides.json` (voti e numero di recensioni, esclusività, "Also on Switch 1", link), con link rapidi alla ricerca del gioco su Metacritic e Backloggd;
  - sezione **OpenCritic**: voto attuale in sola lettura (voto, top critic, ID abbinato) e campo per forzare l'ID. La build non va in rete: se l'ID forzato non è già in cache, il voto arriva con il `data:fetch` successivo (l'admin lo dice). Filtro "OpenCritic" per i giochi usciti senza voto;
  - **Save**: il plugin Vite (`scripts/vite-admin.ts`) valida lo schema, copia il file precedente in `data/backups/` (ultime 30 copie), scrive `overrides.json` formattato, lancia `data:build` e il sito aperto si ricarica da solo mantenendo posizione e selezione.
- Più avanti: GitHub Action settimanale che esegue il fetch, fa il commit di `games.json` e `changes.json` (e di cache, snapshot e storico) e ripubblica su GitHub Pages.

## 11. Milestone di sviluppo

1. ~~**Scaffold**: Vite + TS + GSAP, tema giorno/notte, `games.json` finto.~~ ✔
2. ~~**Timeline**: linea, tacche, scroll, header, "Today", apertura su oggi.~~ ✔
3. ~~**Card**: card gioco e DLC, cerchietti, badge, collisioni, animazione di comparsa.~~ ✔
4. ~~**Zona TBA e minimappa**.~~ ✔
5. ~~**Script dati**: IGDB + OpenCritic, merge degli overrides, validazione.~~ ✔
6. ~~**Rifinitura**: performance, accessibilità da tastiera, dettagli visivi.~~ ✔
7. *(Più avanti)* GitHub Action e pubblicazione su GitHub Pages.

**Iterazione 2** (`docs/archive/ITERATION-2.md`) ✔: correzioni, indicatore centrale e controlli per giorno, selezione e card espansa, nuovi campi dati, sfondo, "uscito oggi", bordo Switch 2 Edition.

**Iterazione 3** (`docs/archive/ITERATION-3.md`) ✔: fetch e build separati, pannello admin, pulsante Nintendo Store, ricerca e filtri, snapshot con rinvii e andamento dei voti, novità.

**Iterazione 4** (`docs/archive/ITERATION-4.md`) ✔: menu View e card compatte, pallini per tipo e fasce dei mesi, minimappa con anteprima e riquadro trascinabile, salti per mese e inerzia, gruppi dello stesso giorno, livelli di zoom, modalità presentazione.

Lavorare un punto alla volta, verificando nel browser prima di passare al successivo.

## 12. Rankings

**Stato: fatto** (coda in `docs/tasks/rankings.md`).

Pagina `rankings.html` (`src/rankings/main.ts`, `src/styles/rankings.css`), inclusa nella build di produzione.

- Header con navigazione **"Timeline · Rankings · Studios"** su tutte e tre le pagine, pagina attiva evidenziata; stesso tema giorno/notte.
- Solo giochi **usciti** (data di prima uscita ≤ oggi).
- Ogni riga: posizione, copertina piccola, titolo, badge del tipo (DLC / Switch 2 Edition), data di uscita, quattro cerchietti (OpenCritic, Metacritic, Metacritic User, Backloggd; N/D dove manca il voto). Il cerchietto usato per ordinare è evidenziato; per le medie c'è anche una pillola col valore della media.

**Ordinamento** — selettore "Sort by": OpenCritic, Metacritic, Metacritic User, Backloggd, Critics average (OpenCritic + Metacritic, voti normalizzati), Users average (Metacritic User + Backloggd). A parità di valore: più recensioni, poi titolo. Predefinito: OpenCritic.

**Soglia** — campo "Min. reviews", predefinito 20. Per una singola fonte vale sul numero di recensioni di quella fonte; per le medie contano solo le fonti che superano la soglia, e il gioco entra se almeno una la supera. **Numero di recensioni sconosciuto**: con soglia maggiore di 0 il voto non entra in classifica per quella fonte né nelle medie (con soglia 0 entra); nel cerchietto "—" al posto del conteggio. Esclusi: riga finale "N games hidden (no score or fewer than X reviews)", con "; K with no review count" se alcuni hanno un voto senza conteggio. Una classifica corta per Metacritic e Backloggd (dati manuali incompleti) è attesa.

**Filtri** — indipendenti da quelli della timeline:
- Includi DLC (predefinito off), includi Switch 2 Edition (on), solo esclusive (off, stessa regola della timeline: contano solo altre console e PC), anno (All / anni presenti nei giochi usciti; predefinito All).
- Posizioni ricalcolate dopo i filtri (1, 2, 3… senza buchi). Contatore "N games ranked".
- Nessun risultato per colpa dei filtri (con i filtri predefiniti ci sarebbe almeno un gioco): "No games match these filters" con pulsante "Reset filters". Se la colpa è la soglia: "No games to rank" e la riga dei nascosti.

Ordinamento, soglia e filtri sono salvati nel browser (`localStorage`, chiavi `rankings-settings` e `rankings-filters`). Cambiarli aggiorna la lista subito con una breve dissolvenza (niente animazione con `prefers-reduced-motion`).

## 13. Free updates

**Stato: fatto** (coda in `docs/tasks/free-updates.md`).

Giochi Switch 1 con un aggiornamento gratuito per Switch 2. Fonte: `data/free-updates.json`, curato a mano dalla pagina Nintendo "games with free updates" (titolo, uscita originale, data dell'aggiornamento, link allo store USA). Campo facoltativo `igdbId`: id IGDB del gioco originale, da mettere quando la ricerca per titolo trova il gioco sbagliato o nessuno, o quando `data:fetch-free-updates` segnala un abbinamento "solo per anno".

**Dati**
- Tipo `free-update` in `games.json` (id `free-update:<titolo>`), accanto a `game`, `switch2-edition`, `dlc`. `firstReleaseDate` = data dell'aggiornamento; in più l'anno di uscita originale.
- `npm run data:fetch-free-updates` interroga IGDB solo per questi titoli (copertina, riassunto, link Wikipedia e Nintendo Wiki) → `data/cache/free-updates.json`. `data:build` crea le voci; `data:validate` segnala quelle senza copertina.
- **Niente voti.** Una sola data, senza regioni.
- **Doppioni**: se il dataset ha già una voce dello stesso gioco (titolo normalizzato, es. una Switch 2 Edition), l'aggiornamento non crea una card.
- **Store**: pagina italiana se la logica dei link la trova, altrimenti `store_url` del file.

**Timeline e card**
- Card con colore dedicato (token `--free-update`, bordo e pallini su linea e minimappa), badge "Free update", riga "Worldwide · data", "Originally released AAAA", nessuna sezione voti. Selezionata: riassunto, tempo relativo, pulsanti Wikipedia / Nintendo Wiki / Store.
- Gli aggiornamenti dello stesso giorno formano un **gruppo separato** da quello dei giochi ("N free updates").
- Voce nella legenda del pannello "?".

**Resto del sito**
- Filtro timeline **"Free updates"**, acceso di default, salvato con gli altri; il contatore "N of M games" li include.
- **Rankings** e **Studios**: mai presenti, nemmeno nel conteggio dei nascosti.
- **Ricerca**: presenti, indicati come "Free update".
- **What's new**: gli aggiornamenti non sono negli snapshot di `data:fetch`; il giorno in cui compaiono nel file lo registra `data:build` in `data/free-updates-seen.json`. Il primo import (17 voci) vale come già noto (`null`): solo i titoli aggiunti dopo compaiono come "New", con dettaglio "Free update · data".

## 14. Studios

**Stato: fatto** (coda in `docs/tasks/studios.md`).

Pagina `studios.html` (`src/studios/main.ts`, `src/styles/studios.css`), inclusa nella build di produzione. Navigazione **"Timeline · Rankings · Studios"** su tutte e tre le pagine, pagina attiva evidenziata.

**Dati** — `public/data/studios.json`, scritto da `npm run data:build`.
- **First party**: categoria `Category:First_party_developers` di Nintendo Wiki (API MediaWiki, `npm run data:fetch-studios` → `data/cache/studios.json`). Esclusi gli studi chiusi o accorpati (categorie "Defunct"/"Former"); i casi incerti restano attivi. Esclusa "Nintendo" (casa madre).
- **Partner**: sviluppano almeno un gioco del dataset pubblicato da Nintendo o The Pokémon Company (publisher IGDB in cache).
- **Third party**: solo esclusive di altri editori.
- Corrispondenza nomi Wiki ↔ IGDB con nomi normalizzati, più `data/studios-overrides.json` (`active`, `igdbNames`, `hidden`; una chiave che non è una pagina della wiki è un alias per partner e terze parti).
- **Gioco mostrato**: il prossimo in uscita con data precisa, altrimenti l'ultimo uscito. Contano giochi e Switch 2 Edition, non DLC né free update. `hasSwitch2Game` e, per gli studi senza gioco Switch 2, `latestSwitch1Game`.

**Pagina**
- Una card per studio: nome (link a Nintendo Wiki in una nuova scheda, solo per i first party), badge "First party" / "Partner" / "Third party", gioco con copertina, titolo, data e stato ("Upcoming · in 26 days" / "Released 3 months ago", calcolato dalla data a ogni visita).
- Senza gioco Switch 2: "No Switch 2 game yet" e, se c'è, una riga piccola "Latest: <titolo> · Switch 1". Con un gioco Switch 2 senza data precisa: "Release date TBA".
- **Ordine**: prima gli studi con un gioco in uscita (data più vicina prima), poi quelli con un gioco uscito (più recente prima), infine quelli senza gioco Switch 2 datato (alfabetico).
- First party e Partner sempre visibili; interruttore **"Show third-party studios"**, spento di default, salvato nel browser (`localStorage`, chiave `studios-show-third-party`). Contatore "N studios" degli studi visibili.
- Comparsa delle card con breve dissolvenza, e dissolvenza al cambio dell'interruttore (niente animazione con `prefers-reduced-motion`).

## 15. Sfondo stagionale

**Stato: fatto** (coda in `docs/tasks/seasons.md`).

Particelle animate dietro linea e card (`src/seasons/`: `season.ts` logica pura, `particles.ts` forme e fisica, `background.ts` canvas e ciclo; `src/styles/seasons.css`; costanti `SEASONS` in `src/timeline/config.ts`).

- **Stagione** dal giorno sotto l'indicatore, a mesi interi: inverno dic–feb, primavera mar–mag, estate giu–ago, autunno set–nov. Vale per tutto lo schermo; nella zona TBA resta l'ultima.
- **Forme**: solo contorni, un colore per stagione, niente immagini, un unico canvas. Estate: bolle con riflessi che salgono. Primavera: petali con la tacca in punta che scendono in diagonale ruotando e, circa 1 su 10 (`blossomChance`), un fiore di ciliegio intero più lento. Autunno: foglie d'acero che cadono ondeggiando. Inverno: fiocchi a sei raggi, lenti, con leggera deriva.
- **Quantità**: 20–40 particelle secondo l'area della finestra (20 fino a 1280×720, 40 da 2560×1440).
- **Colori**: token `--season-<stagione>` e `--season-alpha` in `tokens.css`, attenuati; nel tema chiaro più scuri (es. neve azzurro-grigia), nello scuro più chiari.
- **Livelli**: dietro tutto (`z-index: -1`, come lo sfondo del gioco). Le particelle sfumano via nella fascia della linea (tacche, numeri, mesi; bordi morbidi di `bandFeatherPx`), così non sembrano attraversarla.
- **Cambio stagione**: una sola stagione per volta; le particelle vecchie sfumano via in ~500 ms (`leaveMs`), poi le nuove compaiono gradualmente in ~2 s (`rampMs`), ognuna con una dissolvenza.
- **Scorrimento veloce** (rotella dalla marcia 2, trascinamento oltre `fastDragPxPerMs`, salto più lungo della finestra): lo sfondo sfuma via in ~200 ms e ricompare ~500 ms (`restMs`) dopo l'ultimo movimento.
- **Gioco selezionato**: sfondo stagionale nascosto (c'è lo sfondo del gioco). In presentazione un gioco è sempre selezionato, quindi resta nascosto e torna a fine presentazione.
- **Zoom**: uguale in Day, Week e Month (segue la timeline corrente anche dopo cambi di zoom e filtri).
- **Menu View**: interruttore **"Seasonal background"**, acceso di default, salvato nel browser (chiave `view`, campo `seasonalBackground`, scritto solo dopo una scelta esplicita).
- **Reduced motion**: spento di default; se l'utente lo accende, particelle ferme (decorazione statica, ridisegnata solo al cambio di stagione, tema o finestra).
- **Prestazioni**: densità del canvas al massimo 1.5, nessun filtro blur; animazione ferma con sfondo spento o nascosto e con la scheda non visibile. Misurato (Chrome headless con GPU, 1920×1080, build di produzione): 60 fps a riposo e durante lo scorrimento, come a sfondo spento.
- **Aiuto**: sezione "Seasonal background" nel pannello delle scorciatoie (?).
