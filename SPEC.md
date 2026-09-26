# Nintendo Release Timeline — Specifica di progetto

Sito desktop che mostra, su una timeline orizzontale scorrevole, i giochi Nintendo usciti (e in uscita) dal lancio di Switch 2 (5 giugno 2025) in poi, con voti aggregati di critica e pubblico.

Per ora il sito è solo per uso personale in locale; la pubblicazione su GitHub Pages arriverà più avanti.

---

## 1. Stack

- **Vite + TypeScript** (vanilla, niente framework UI salvo necessità)
- **GSAP** per animazioni
- Script di raccolta dati in **Node + TypeScript** (`tsx` per eseguirli)
- Nessun backend: il sito legge un file statico `public/data/games.json`
- Chiavi API in `.env` (mai committate), in futuro nei GitHub Secrets

## 2. Struttura cartelle (proposta)

```
/scripts
  fetch-data.ts        # interroga IGDB + OpenCritic, unisce overrides, scrive games.json
  validate-data.ts     # segnala giochi con dati manuali mancanti
  lib/igdb.ts
  lib/opencritic.ts
/data
  overrides.json       # dati inseriti a mano (vedi §4)
/public/data
  games.json           # output finale letto dal sito
/src
  main.ts
  timeline/            # rendering linea, tacche, scroll, header sticky, minimappa
  cards/               # card gioco e card DLC
  theme/               # tema giorno/notte
  styles/
.env.example
```

## 3. Perimetro dei giochi

Si includono i giochi con **prima data di uscita ≥ 2025-06-05** che rientrano in almeno uno di questi casi:

1. Pubblicati da **Nintendo** o **The Pokémon Company** per Switch 2 e/o Switch 1.
2. Giochi di **terze parti esclusivi per console Nintendo** (anche esclusive temporali), es. *The Duskbloods* di FromSoftware. Si ricavano automaticamente (vedi §4.1), con possibilità di aggiunta o esclusione manuale in `overrides.json`.

Casi particolari:

- **Switch 2 Edition**: incluse, con la data di uscita della Switch 2 Edition. Il gioco originale uscito prima del 5/6/2025 non compare.
- **DLC / espansioni**: inclusi, come voce separata con la propria data e un design di card diverso (vedi §7).
- Switch 2 Edition e DLC entrano se hanno (o avranno) recensioni dedicate: in pratica se esiste una pagina su OpenCritic o se sono aggiunti in `overrides.json`.
- Un gioco **appena uscito** senza recensioni si mostra comunque, con tutti i voti a **N/D**.
- **Giochi annunciati**:
  - con data precisa (giorno) → sulla timeline nel futuro, stato "Upcoming";
  - con data vaga (solo anno, trimestre, "TBA") → nella **zona TBA** in fondo alla linea, raggruppati per anno.

## 4. Fonti dati

| Dato | Fonte | Modalità |
|---|---|---|
| Titolo (inglese), copertina, sviluppatore, genere, piattaforme | IGDB API | automatica |
| Date di uscita JP / EU / NA | IGDB API (`release_dates`, campo regione) | automatica |
| Voto critica OpenCritic (Top Critic Average) + n° recensioni | OpenCritic API (RapidAPI) | automatica |
| Metacritic Metascore + n° recensioni | — (nessuna API) | **manuale** |
| Metacritic User Score + n° voti | — (nessuna API) | **manuale** |
| Backloggd rating + n° voti | — (nessuna API) | **manuale** |
| Esclusività, "Also on Switch 1", inclusione terze parti | Wikipedia (categoria) + piattaforme IGDB, vedi §4.1 | automatica, con override manuale |

Note:

- **Niente scraping** di Metacritic o Backloggd (vietato dai termini d'uso). I valori si inseriscono a mano in `overrides.json`.
- IGDB: autenticazione con Twitch client credentials. Verificare nella documentazione attuale gli ID piattaforma di Switch 2 e Switch 1 e i campi per tipo di gioco (DLC, espansione, port/edizione), perché lo schema IGDB è cambiato nel tempo.
- Copertine: usare il CDN di IGDB (`images.igdb.com`, taglia `cover_big`).
- Matching tra IGDB e OpenCritic: per titolo, con possibilità di forzare l'ID OpenCritic in `overrides.json` quando il match automatico sbaglia.

### 4.1 Esclusività

Due fonti combinate:

1. **Wikipedia**, categoria [Nintendo Switch 2-only games](https://en.wikipedia.org/wiki/Category:Nintendo_Switch_2-only_games). Leggerla tramite la **MediaWiki API** (`action=query&list=categorymembers`), non con lo scraping dell'HTML, impostando uno `User-Agent` descrittivo come richiesto dalle linee guida di Wikimedia.
2. **Piattaforme IGDB**: un gioco è esclusivo se tutte le sue piattaforme sono Switch 2 e/o Switch 1. Questo copre anche i giochi usciti su entrambe le Switch (es. un Pokémon cross-gen), che **non** compaiono nella categoria "Switch 2-only".

Regole:

- **Abbinamento Wikipedia ↔ IGDB**: tramite **Wikidata** (proprietà "IGDB game ID"), perché i titoli delle pagine Wikipedia possono avere suffissi come "(video game)". Fallback sul titolo normalizzato.
- **Inclusione terze parti**: ogni gioco della categoria con data ≥ 2025-06-05 entra automaticamente nel perimetro.
- **Esclusive temporali**: quando un gioco esce dalla categoria o compare su altre piattaforme, non si trova più come esclusivo. Lo script quindi salva lo storico in `data/exclusivity-history.json`: se un gioco era esclusivo e non lo è più, diventa `"timed"`.
- **Conflitti**: se Wikipedia e IGDB non concordano, lo script lo segnala in `data:validate`; decide il valore in `overrides.json`.
- La categoria Wikipedia è curata a mano dagli editor e può essere incompleta o in ritardo: va trattata come segnale, non come verità assoluta.

### Esempio `data/overrides.json`

```json
{
  "games": {
    "igdb:123456": {
      "include": true,
      "exclusivity": "exclusive",
      "alsoOnSwitch1": false,
      "opencriticId": 98765,
      "metacritic": { "critic": 91, "criticCount": 112, "user": 8.7, "userCount": 2400 },
      "backloggd": { "rating": 4.3, "count": 5100 }
    }
  }
}
```

`exclusivity`: `"exclusive"` | `"timed"` | `null`. Campo opzionale: se presente sovrascrive il valore calcolato automaticamente (§4.1).

## 5. Schema di `games.json`

```ts
type Region = "JP" | "EU" | "NA";

interface Game {
  id: string;                    // "igdb:<id>"
  kind: "game" | "switch2-edition" | "dlc";
  title: string;                 // titolo inglese
  baseGameTitle?: string;        // solo per DLC
  coverUrl: string;
  developer: string | null;
  genres: string[];
  releaseDates: Partial<Record<Region, string | null>>; // "YYYY-MM-DD" o null = TBA
  firstReleaseDate: string | null;  // la più vicina tra JP/EU/NA
  vagueRelease?: { year: number; label: string }; // per la zona TBA
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

Normalizzazione: Metacritic user ×10, Backloggd ×20. Nel cerchietto si mostra il **valore originale**, il riempimento usa il valore normalizzato.

## 6. Timeline

- **Linea orizzontale rossa** al centro dello schermo, dal 5/6/2025 fino all'ultima data precisa + un margine, poi la zona TBA.
- **Scroll**: la rotella del mouse muove la linea in orizzontale (anche il trackpad), più frecce da tastiera e trascinamento col mouse. Scorrimento fluido con inerzia leggera.
- **Tacche** (circa 24px per giorno, parametro configurabile):
  - giorno: tacca corta e sottile;
  - inizio settimana: tacca media;
  - inizio mese: tacca alta con etichetta del mese.
- **Header sticky** in alto: anno grande, mese sotto, aggiornati in base al centro del viewport, con transizione animata al cambio.
- **All'apertura** la timeline è centrata su **oggi** (fuso orario locale dell'utente).
- **Indicatore "Today"** pulsante sulla data odierna.
- **Passato vs futuro**: linea piena nel passato, tratteggiata o più chiara nel futuro.
- **Zona TBA**: dopo uno stacco visivo, blocchi per anno ("2026", "2027"...) con le card dei giochi senza data precisa.
- **Minimappa** in basso: barra sottile con i mesi e un puntino per ogni gioco; un riquadro mostra la porzione visibile; cliccando si salta al punto scelto.
- **Performance**: disegnare solo le tacche e le card visibili (virtualizzazione o canvas per le tacche).
- **Collisioni**: se più giochi escono nello stesso giorno o a pochi giorni di distanza, le card si alternano sopra e sotto la linea e, se serve, si impilano, collegate alla loro tacca con un sottile connettore.

## 7. Card

### Card gioco (e Switch 2 Edition)

- Copertina
- Titolo
- Sviluppatore · genere/i
- **Date regionali**: bandiere JP / EU / NA con la data, o "TBA". La posizione sulla timeline è data dalla prima uscita.
- **Badge**: `Exclusive`, `Timed exclusive`, `Switch 2 Edition`, `Also on Switch 1`
- **Blocco Critics**: cerchietto OpenCritic + cerchietto Metacritic
- **Blocco Users**: cerchietto Metacritic User + cerchietto Backloggd
- Sotto ogni cerchietto: nome della fonte (link alla pagina originale) e numero di recensioni o voti, in piccolo
- Stato **Upcoming** per i giochi futuri al posto dei voti

### Card DLC

Design visibilmente diverso: più compatta, bordo o nastro "DLC", riga "Expansion for *<gioco base>*", stessi blocchi voti.

### Cerchietti dei voti

- Anello che si riempie in proporzione al voto normalizzato (0–100), con il valore al centro.
- Colori secondo le fasce OpenCritic: **Mighty ≥ 84**, **Strong 75–83**, **Fair 65–74**, **Weak < 65**. Replicare la palette di OpenCritic (verificare i colori sul sito) e definirla come token CSS.
- Nessun voto → anello vuoto grigio con "N/D".

### Animazione di comparsa

Quando la data di uscita entra nella zona visibile, la card appare con un'animazione GSAP: la copertina sale dalla linea con fade e scale, poi i cerchietti si riempiono. L'animazione scatta una volta sola per card.

Al clic sulla card per ora non succede nulla.

## 8. Grafica

- Richiamo Nintendo: **rosso** come colore primario (timeline, accenti), angoli arrotondati, look pulito.
- **Tema giorno/notte**: sfondo bianco o nero. Segue la preferenza di sistema, con un interruttore manuale. Tutti i colori sono definiti come variabili CSS.
- Font arrotondato (es. *Nunito* o *M PLUS Rounded 1c* da Google Fonts) con fallback di sistema.
- Niente loghi o font ufficiali Nintendo. Nel footer: "Not affiliated with Nintendo. Scores from OpenCritic, Metacritic and Backloggd."
- Interfaccia in **inglese**.
- Solo **desktop** (larghezza minima indicativa 1280px).

## 9. Aggiornamento dati

- `npm run data:fetch` → rigenera `public/data/games.json` unendo le API e `overrides.json`.
- `npm run data:validate` → elenca i giochi con campi manuali mancanti (Metacritic, Backloggd) e i conflitti di esclusività tra Wikipedia e IGDB, così è chiaro cosa aggiornare.
- Più avanti: GitHub Action settimanale che esegue il fetch, fa il commit di `games.json` e ripubblica su GitHub Pages.

## 10. Milestone di sviluppo

1. **Scaffold**: Vite + TS + GSAP, tema giorno/notte, un `games.json` finto con 8–10 giochi realistici (inclusi un DLC, una Switch 2 Edition, un Upcoming e un TBA).
2. **Timeline**: linea, tacche, scroll orizzontale, header sticky, "Today", apertura su oggi.
3. **Card**: card gioco e card DLC, cerchietti, badge, gestione delle collisioni, animazione di comparsa.
4. **Zona TBA e minimappa**.
5. **Script dati**: IGDB + OpenCritic, merge degli overrides, validazione.
6. **Rifinitura**: performance, accessibilità da tastiera, dettagli visivi.
7. *(Più avanti)* GitHub Action e pubblicazione su GitHub Pages.

Lavorare una milestone alla volta, verificando nel browser prima di passare alla successiva.
