# Nintendo Release Timeline — Specifica di progetto

Sito desktop che mostra, su una timeline orizzontale scorrevole, i giochi Nintendo usciti (e in uscita) dal lancio di Switch 2 (5 giugno 2025) in poi, con voti aggregati di critica e pubblico.

Per ora il sito è solo per uso personale in locale; la pubblicazione su GitHub Pages arriverà più avanti. Il codice è su GitHub nel repository privato `Kappadacqua/nintendo-release-timeline`.

> **Stato:** milestone 1–6 completate, più le correzioni del §1 di `ITERATION-2.md`. I punti §2–§7 di `ITERATION-2.md` (indicatore centrale, selezione delle card, sfondo, animazione "uscito oggi", bordo Switch 2 Edition, nuovi campi dati) sono **in corso** e non sono ancora descritti qui: questo documento verrà aggiornato alla fine dell'iterazione. Dove `ITERATION-2.md` e questo documento sono in contrasto, vale `ITERATION-2.md`.

---

## 1. Stack

- **Vite 7 + TypeScript** (vanilla, niente framework UI)
- **GSAP** per animazioni
- Script di raccolta dati in **Node + TypeScript** (`tsx` per eseguirli)
- Node **≥ 20.19** (`.nvmrc`: 24). Le variabili di `.env` sono lette con `process.loadEnvFile`, senza dipendenze.
- Nessun backend: il sito legge il file statico `public/data/games.json`
- Chiavi API in `.env` (escluso da git), in futuro nei GitHub Secrets

## 2. Struttura cartelle

```
/scripts
  fetch-data.ts          # IGDB + Wikipedia/Wikidata + OpenCritic + overrides → games.json
  validate-data.ts       # cosa va completato o deciso a mano
  lib/env.ts             # percorsi, lettura .env
  lib/http.ts            # fetch JSON con throttle, retry e HttpError
  lib/igdb.ts            # client IGDB (auth Twitch, paginazione stabile)
  lib/opencritic.ts      # client OpenCritic (catalogo Switch 2, ricerche, cache, budget)
  lib/wikipedia.ts       # categoria Wikipedia + slug IGDB da Wikidata
  lib/transform.ts       # IGDB → Game: tipo, date regionali, perimetro, esclusività IGDB
  lib/exclusivity.ts     # storico esclusività (→ "timed")
  lib/overrides.ts       # overrides.json: override per gioco, abbinamenti Wikipedia, giochi manuali
  lib/report.ts          # tipo di data/fetch-report.json
/data
  overrides.json         # dati inseriti a mano (vedi §4.2)
  exclusivity-history.json   # storico esclusività, da versionare
  cache/opencritic.json  # abbinamenti, dettagli e catalogo OpenCritic, da versionare
  fetch-report.json      # esito dell'ultimo fetch, letto da validate (ignorato da git)
  sample-games.json      # dati finti delle prime milestone
/public
  data/games.json        # output finale letto dal sito
  covers/placeholder.svg # copertina di ripiego
/src
  main.ts                # tema, dialogo scorciatoie, caricamento dati
  types.ts               # schema di games.json
  timeline/              # timeline, scroll, header, minimappa, zona TBA, date, config
  cards/                 # card, cerchietti, layout collisioni, animazioni, bandiere, nomi sviluppatori
  theme/                 # tema giorno/notte
  styles/main.css        # tutti i token e gli stili
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
| Date di uscita JP / EU / NA | IGDB (`release_dates` con `release_region` e `date_format`) | automatica, correggibile a mano |
| Voto OpenCritic (Top Critic Average) + n° top critic | OpenCritic API (RapidAPI) | automatica |
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

- **Catalogo Switch 2**: lo script scarica l'elenco completo dei giochi Switch 2 (`GET /game?platforms=Switch 2&sort=name`, ~38 pagine da 20) e lo tiene in cache per `OPENCRITIC_CATALOG_DAYS` giorni (default 3). Gli abbinamenti per titolo normalizzato si fanno sul catalogo, **senza ricerche**; il voto viene dal catalogo.
- **Ricerche** (`/game/search`) solo come ripiego per i giochi che non sono nel catalogo; i mancati abbinamenti si ritentano dopo 3 giorni (giochi usciti da poco) o 14.
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
  generatedAt: string;           // ISO timestamp del fetch
  games: Game[];                 // ordinati per data, poi TBA per anno, poi titolo
}

interface Game {
  id: string;                    // "igdb:<id>" oppure "manual:<slug>"
  kind: "game" | "switch2-edition" | "dlc";
  title: string;                 // titolo inglese
  baseGameTitle?: string;        // solo per DLC
  coverUrl: string;
  developer: string | null;
  genres: string[];
  releaseDates: Partial<Record<Region, string | null>>; // "YYYY-MM-DD" o null = TBA
  firstReleaseDate: string | null;  // la più vicina tra JP/EU/NA
  vagueRelease?: { year: number; label: string }; // per la zona TBA ("2026", "Q2 2027"…)
  exclusivity: "exclusive" | "timed" | null;
  alsoOnSwitch1: boolean;
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
  links: { opencritic?: string; metacritic?: string; backloggd?: string };
}

interface Score {
  value: number;       // valore originale
  scale: 5 | 10 | 100;
  normalized: number;  // 0–100
  count: number | null;
}
```

Tipo: "Nintendo Switch 2 Edition" nel nome → `switch2-edition`; tipo IGDB DLC / espansione → `dlc`; altrimenti `game`. Normalizzazione: Metacritic user ×10, Backloggd ×20. Nel cerchietto si mostra il **valore originale**, il riempimento usa il valore normalizzato.

## 6. Timeline

- **Linea orizzontale rossa** dal 5/6/2025 all'ultima data precisa (o a oggi) + 60 giorni, con un pallino e l'etichetta della data iniziale; poi, dopo uno stacco con segno di interruzione (//), la **zona TBA**. La linea è centrata verticalmente nello spazio sopra la minimappa.
- **Passato vs futuro**: linea piena nel passato, tratteggiata e più chiara nel futuro.
- **Tacche** (24px per giorno, `dayPx` in `src/timeline/config.ts`): giorno corta, lunedì media, inizio mese alta con etichetta del mese (con l'anno a gennaio). Linea e tacche sono disegnate su canvas, solo per la parte visibile.
- **Header anno / mese** al centro della barra in alto (fra titolo e pulsanti), aggiornato in base al centro del viewport con transizione animata nella direzione dello scroll; nella zona TBA mostra l'anno del blocco e "Date TBA".
- **All'apertura** la timeline è centrata su **oggi** (fuso orario locale), con l'indicatore **"Today"** pulsante.
- **Zona TBA**: blocchi per anno ("2026", "2027"…, poi "TBA"), tratteggiati, con le card dei giochi senza data precisa, collegati da una linea puntinata.
- **Minimappa** in basso: mesi (anno a gennaio), un puntino per gioco (pieno se uscito, vuoto se futuro, quadrato se DLC, titolo al passaggio del mouse), lineetta su oggi, zona TBA a righe, riquadro della porzione visibile. Clic = salto con scorrimento; trascinamento = segue in diretta.
- **Collisioni**: assegnazione a corsie sopra/sotto la linea; una card può scivolare di lato fino al 60% della larghezza (connettore a gomito) prima di impilarsi a mazzo; la card sotto il mouse o con il focus va in primo piano.
- **Finestre basse**: le card si rimpiccioliscono verso la loro data (fino a 0.6) per stare fra la barra in alto e la minimappa.
- **Performance**: card create solo quando si avvicinano al viewport e nascoste quando sono lontane; 60fps misurati durante lo scorrimento.

### Controlli

| Input | Azione |
|---|---|
| Rotella / trackpad | Scorrimento orizzontale fluido con inerzia leggera |
| Trascinamento | Scorrimento, con slancio al rilascio (parte dopo 5px, così i link restano cliccabili) |
| ← / → | Una settimana (Shift: un mese) |
| PagSu / PagGiù | Gioco precedente / successivo (TBA compresi) |
| Home | Oggi; premuto di nuovo, inizio della timeline |
| Fine | Zona TBA |
| T | Oggi |
| Tab | Card al centro, poi i suoi link |
| ? | Dialogo con le scorciatoie (anche dal pulsante "?" nell'header) |

Con `prefers-reduced-motion` lo scorrimento salta direttamente, header e card non si animano, "Today" non pulsa.

## 7. Card

### Card gioco (e Switch 2 Edition)

- Copertina
- Titolo (massimo 3 righe)
- Sviluppatore · generi. I nomi di sviluppatore oltre 20 caratteri sono **abbreviati** ("Nintendo EPD Production Group No. 5" → "Nintendo EPD", "Konami Digital Entertainment" → "Konami", alias "Nintendo Software Technology" → "NST"), con il nome completo nel tooltip.
- **Date regionali**: in tutte le card, DLC comprese, **bandiera + sigla (JP / EU / NA) + data** o "TBA". Bandiere SVG con bordo sottile a colore di tema (visibile anche la giapponese sul bianco).
- **Badge**: `Switch 2 Edition`, `Exclusive`, `Timed exclusive`, `Also on Switch 1`
- **Blocco Critics**: OpenCritic + Metacritic; **Blocco Users**: Metacritic User + Backloggd
- Sotto ogni cerchietto: nome della fonte (link, se c'è) e numero di recensioni o voti in forma compatta ("3.1K ratings")
- **Upcoming** per i giochi futuri al posto dei voti ("In 12 days", "Tomorrow"); per i TBA "Expected 2027" o "Date TBA"; bordo tratteggiato

### Card DLC

Più compatta, nastro diagonale "DLC", bordo rosso, sfondo leggermente rosato, riga "Expansion for *<gioco base>*", stessi blocchi voti. **Niente badge di esclusività** (riguarda il gioco base).

### Cerchietti dei voti

- Anello che si riempie in proporzione al voto normalizzato, valore originale al centro.
- Colori per fasce OpenCritic: **Mighty ≥ 84**, **Strong 75–83**, **Fair 65–74**, **Weak < 65**, come token CSS (`--score-*`). I colori sono approssimati e vanno ancora verificati su opencritic.com.
- Nessun voto → anello grigio con "N/D".

### Animazione di comparsa

Quando la data entra nel viewport: il connettore cresce, la card sale dalla linea con fade e scale, poi i cerchietti si riempiono con il numero che sale. Una volta sola per card; durante un salto lungo (es. dalla minimappa) le card che scorrono via non consumano l'animazione.

### Accessibilità

- Solo la card al centro (e i suoi link) è nel tab order; con PagSu/PagGiù, Home, Fine, T e frecce il focus segue il gioco al centro.
- Ogni card ha un riassunto per i lettori di schermo (titolo, tipo, data, esclusività, voto OpenCritic).
- Contorno di focus rosso uniforme per tutti gli elementi raggiungibili da tastiera.

Al clic sulla card per ora non succede nulla (cambia con `ITERATION-2.md` §3).

## 8. Grafica

- Richiamo Nintendo: **rosso** primario, angoli arrotondati, look pulito.
- **Tema giorno/notte**: segue la preferenza di sistema, con interruttore manuale ricordato nel browser (applicato prima del primo paint). Tutti i colori sono variabili CSS.
- Font **Nunito** (Google Fonts) con fallback arrotondati di sistema.
- Niente loghi o font ufficiali Nintendo. Footer: "Not affiliated with Nintendo. Scores from OpenCritic, Metacritic and Backloggd."
- Interfaccia in **inglese**. Solo **desktop** (larghezza minima 1280px).
- Favicon SVG inline, stato "Loading games…" e messaggio d'errore se `games.json` non si carica.

## 9. Aggiornamento dati

Variabili in `.env` (vedi `.env.example`): `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `RAPIDAPI_KEY` (facoltativa), `OPENCRITIC_MAX_SEARCHES`, `OPENCRITIC_MAX_REQUESTS`, `OPENCRITIC_CATALOG_DAYS`, `WIKI_CONTACT`.

- `npm run data:fetch` → rigenera `public/data/games.json`. Se un passo essenziale fallisce (es. credenziali IGDB mancanti) si ferma senza toccare il file.
- `npm run data:validate` → elenca:
  - giochi **usciti senza Metacritic o Backloggd** (con quali mancano);
  - conflitti di esclusività non ancora decisi;
  - pagine Wikipedia senza gioco IGDB;
  - giochi usciti senza abbinamento OpenCritic;
  - DLC / Switch 2 Edition esclusi (senza pagina OpenCritic) o non verificati;
  - errori OpenCritic e voti mantenuti dal fetch precedente;
  - override che puntano a giochi assenti;
  - il contenuto della zona TBA.

  Con `--stubs` stampa il blocco JSON da completare per i voti manuali mancanti.
- Più avanti: GitHub Action settimanale che esegue il fetch, fa il commit di `games.json` (e di cache e storico) e ripubblica su GitHub Pages.

## 10. Milestone di sviluppo

1. ~~**Scaffold**: Vite + TS + GSAP, tema giorno/notte, `games.json` finto.~~ ✔
2. ~~**Timeline**: linea, tacche, scroll, header, "Today", apertura su oggi.~~ ✔
3. ~~**Card**: card gioco e DLC, cerchietti, badge, collisioni, animazione di comparsa.~~ ✔
4. ~~**Zona TBA e minimappa**.~~ ✔
5. ~~**Script dati**: IGDB + OpenCritic, merge degli overrides, validazione.~~ ✔
6. ~~**Rifinitura**: performance, accessibilità da tastiera, dettagli visivi.~~ ✔
7. *(Più avanti)* GitHub Action e pubblicazione su GitHub Pages.

**Iterazione 2** (`ITERATION-2.md`): §1 correzioni ✔; in corso §2 navigazione con indicatore centrale, §3 selezione e card espansa con i dati del §7, §4 sfondo, §5 animazione "uscito oggi", §6 bordo Switch 2 Edition.

Lavorare un punto alla volta, verificando nel browser prima di passare al successivo.
