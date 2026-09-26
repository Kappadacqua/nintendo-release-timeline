# Iterazione 2 — Miglioramento del sito base

Questo documento si aggiunge a `SPEC.md`. Dove i due documenti sono in contrasto, vale questo. Alla fine del lavoro aggiorna anche `SPEC.md` in modo che resti la descrizione completa e aggiornata del progetto.

Pagine nuove (Studios, Rankings) **non** fanno parte di questa iterazione: sono descritte nel backlog in fondo solo per non prendere decisioni che le ostacolino.

---

## 1. Correzioni dalla revisione

1. **OpenCritic mancante**: molti giochi usciti e recensiti (es. *Donkey Kong Bananza*, *Drag x Drive*) hanno OpenCritic a `null`. Verificare l'abbinamento dei titoli e i limiti del piano RapidAPI. Se una chiamata fallisce, lo script deve segnalarlo in modo evidente e **non** sovrascrivere un valore esistente con `null`.
2. **`data:validate`** deve elencare i giochi usciti senza Metacritic o Backloggd.
3. **Bandiere**: bordo sottile attorno a tutte le bandiere (la giapponese sparisce nel tema chiaro).
4. **Date regionali uniformi**: bandiera + sigla (JP / EU / NA) + data o "TBA" in tutte le card, DLC comprese.
5. **Niente badge "Exclusive" sulle card DLC.**
6. **Sviluppatori lunghi**: abbreviati (es. "Nintendo EPD Production Group No. 5" → "Nintendo EPD"), con il nome completo in un tooltip.

## 2. Nuovo modello di navigazione

### Indicatore centrale

- Una **linea verticale sottile fissa al centro** dello schermo (playhead). La timeline scorre sotto di essa.
- L'header mostra la data esatta sotto l'indicatore: **anno · mese · giorno della settimana + numero** (es. `2026 · September · Sat 26`), con transizione animata al cambio.

### Tacche e numeri dei giorni

- Portare la spaziatura a circa **32px per giorno** (parametro configurabile).
- Mostrare il numero del giorno sotto le tacche dei giorni **1, 5, 10, 15, 20, 25**.
- Il giorno sotto l'indicatore mostra sempre il suo numero, più grande ed evidenziato.

### Controlli

| Input | Azione |
|---|---|
| Rotella del mouse | **1 scatto = 1 giorno**, con aggancio alla tacca. Sul trackpad i delta piccoli si accumulano fino a una soglia configurabile prima di avanzare di un giorno. |
| Trascinamento | Scorrimento libero; al rilascio si aggancia al giorno più vicino. |
| ← / → | Un giorno indietro / avanti |
| PagSu / PagGiù | Gioco precedente / successivo (vedi §3) |
| T | Torna a oggi |
| Home / Fine | Inizio timeline / zona TBA |
| Esc | Deseleziona |
| Clic sulla minimappa | Salto al punto scelto |

## 3. Selezione delle card

### Come si seleziona

- **PagGiù**: seleziona il gioco successivo rispetto alla card selezionata o, se nessuna è selezionata, il primo gioco dopo l'indicatore. **PagSu** fa l'opposto.
- Ordine: per prima data di uscita; a parità di data, per titolo. La zona TBA è inclusa in fondo, ordinata per anno.
- **Clic su una card**: la seleziona e la centra. Il clic non apre mai link.
- La timeline scorre con un'animazione fluida fino a portare la data della card sotto l'indicatore.

### Come si deseleziona

Rotella, trascinamento, frecce, clic sulla minimappa, T, Home/Fine, Esc o clic su un'area vuota.

### Aspetto della card selezionata

- Leggermente ingrandita (circa 1.05), bordo luminoso, sopra le altre (z-index).
- Le altre card si attenuano (opacità circa 0.5).
- In alto a sinistra il titolo del sito viene sostituito, con dissolvenza, da **miniatura della copertina + titolo del gioco**. Alla deselezione torna il titolo del sito.

### Contenuto in più nella card selezionata

La card si espande con un'animazione e mostra:

- **Descrizione breve**: il riassunto IGDB, troncato a circa 3 righe.
- **Tempo relativo**: "Out in 12 days", "Out today", "Released 3 days ago" (in base alla prima uscita).
- **Due pulsanti**: **Wikipedia** e **Nintendo Wiki**. Aprono il link in una nuova scheda. Se il link non esiste, il pulsante è grigio e disattivato.

Niente screenshot dei giochi nella card.

## 4. Sfondo del gioco selezionato

- Quando una card è selezionata, dietro tutto il sito compare un'immagine del gioco a tutto schermo.
- Priorità dell'immagine: **artwork IGDB** → screenshot IGDB → copertina (molto sfocata).
- Stile: sfocatura marcata, opacità bassa, sotto un velo del colore di sfondo del tema, così testo e card restano leggibili in entrambi i temi.
- Dissolvenza incrociata al cambio di gioco (circa 400ms); scompare alla deselezione.
- **Precaricare** le immagini del gioco precedente e successivo, perché PagSu/PagGiù sia istantaneo.

## 5. Animazione "uscito oggi"

- Si attiva se la data di uscita di **almeno una regione** coincide con oggi (fuso orario locale).
- Badge **"Out today"** se escono tutte e tre le regioni oggi, altrimenti "Out today in Japan / Europe / North America".
- Quando la card entra in vista: piccolo scoppio di coriandoli rossi (una volta sola), poi bagliore pulsante continuo attorno alla card.
- Con `prefers-reduced-motion`: solo il badge, niente coriandoli né pulsazione.

## 6. Bordi per tipo di card

- **Gioco**: bordo standard.
- **DLC**: resta com'è (bordo e nastro rossi).
- **Switch 2 Edition**: **bordo sfumato a due colori**, ispirato ai due Joy-Con (un colore per lato). Definire i colori come token CSS, funzionanti in entrambi i temi.

## 7. Dati: nuovi campi

Aggiungere a `Game` in `games.json`:

```ts
summary: string | null;         // riassunto IGDB
backgroundUrl: string | null;   // artwork → screenshot → copertina
links: {
  opencritic?: string;
  metacritic?: string;
  backloggd?: string;
  wikipedia?: string;           // nuovo
  nintendoWiki?: string;        // nuovo
};
```

Come ottenere i link:

- **Wikipedia**: da Wikidata (proprietà "IGDB game ID") → sitelink della Wikipedia inglese. Lo stesso abbinamento già usato per l'esclusività.
- **Nintendo Wiki** (`nintendo.fandom.com`): tramite l'API MediaWiki di Fandom, cercando per titolo. Accettare solo corrispondenze esatte o con titolo normalizzato; in caso di dubbio lasciare il link vuoto.
- Entrambi i link sono sovrascrivibili in `overrides.json` (`links.wikipedia`, `links.nintendoWiki`).
- `data:validate` elenca i giochi senza uno dei due link.

## 8. Ordine di lavoro

1. Correzioni (§1)
2. Indicatore centrale, tacche e nuovi controlli (§2)
3. Selezione e card espansa (§3), con i nuovi campi dati (§7)
4. Sfondo (§4)
5. Bordo Switch 2 Edition (§6) e animazione "uscito oggi" (§5)

Verificare nel browser dopo ogni punto.

---

## Backlog (prossime iterazioni, non implementare ora)

### Pagina Studios

- Fonte: categoria *First party developers* di Nintendo Wiki (`nintendo.fandom.com/wiki/Category:First_party_developers`), letta con l'API MediaWiki.
- Filtrare gli studi chiusi o accorpati (probabilmente con una lista curata a mano).
- Tabella di corrispondenza tra i nomi degli studi su Fandom e su IGDB.
- Per ogni studio: il **prossimo gioco in uscita** se esiste, altrimenti **l'ultimo uscito**; se non ha giochi Switch 2, la scritta **"No Switch 2 game yet"**.
- Interruttore **"Show third-party studios"** per mostrare anche gli studi esterni che hanno pubblicato un'esclusiva.

### Pagina Rankings

- Ordinamento per OpenCritic, Metacritic, Metacritic User, Backloggd, media critica e media utenti.
- Filtri: solo giochi / includi DLC / includi Switch 2 Edition, solo esclusive, anno.
- **Soglia minima di recensioni** scelta dall'utente, **default 20**.

### Navigazione

Con queste pagine l'header avrà la navigazione *Timeline · Studios · Rankings*. Per ora non aggiungerla, ma strutturare il codice in modo che aggiungere pagine sia semplice.
