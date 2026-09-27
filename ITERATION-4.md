# Iterazione 4 — Miglioramenti della timeline

Da iniziare dopo aver completato le correzioni dell'iterazione 3. Dove c'è contrasto con i documenti precedenti, vale questo. A fine lavoro aggiorna `SPEC.md`.

---

## 1. Menu "View" (impostazioni di visualizzazione)

Nuovo pulsante nell'header che apre un piccolo pannello, simile a quello dei filtri. Contiene:

- **Card style**: `Full` (come ora) / `Compact` (vedi §2)
- **Group same-day releases**: on / off (vedi §4)

Le scelte restano salvate nel browser. Il pannello di aiuto "?" va aggiornato con tutte le nuove scorciatoie.

## 2. Card compatte

- In modalità `Compact` le card **non selezionate** mostrano solo: copertina, titolo, badge.
- La card **selezionata** si espande sempre nella versione completa (voti, date regionali, descrizione, pulsanti), in entrambe le modalità.
- Le card compatte occupano meno spazio: il calcolo delle collisioni (alternanza sopra/sotto e impilamento) deve usare le dimensioni reali della modalità attiva.
- Il cambio di modalità è animato (le card si ridimensionano, non spariscono e ricompaiono).

## 3. Pallini colorati per tipo

I pallini sulla linea e nella minimappa prendono il colore in base al **tipo**:

| Tipo | Pallino |
|---|---|
| Gioco | Rosso pieno (colore primario) |
| Switch 2 Edition | Diviso a metà con i due colori del bordo Switch 2 Edition (stessi token CSS) |
| DLC | Colore distinto dai due precedenti, coerente con la card DLC; definire un token dedicato |

- Resta la distinzione attuale tra passato e futuro (pieno vs contorno): nel futuro il pallino è un anello del colore del tipo.
- Aggiungere una piccola **legenda** nel pannello di aiuto "?".
- Verificare che i colori si distinguano in entrambi i temi.

## 4. Raggruppamento delle uscite dello stesso giorno

Attivo solo se l'opzione è accesa nel menu View.

- Quando **3 o più giochi** (dopo i filtri) escono nello stesso giorno, al posto delle singole card compare un **gruppo**: copertine sovrapposte a ventaglio chiuso con l'etichetta "N games".
- Clic sul gruppo o PagSu/PagGiù che ci arriva: il gruppo si **apre a ventaglio** mostrando le card, e si seleziona il primo gioco.
- Con il gruppo aperto, PagSu/PagGiù scorre i giochi al suo interno, poi prosegue con quelli successivi.
- Alla deselezione il gruppo si richiude.
- Nella minimappa il gruppo è un unico punto leggermente più grande.
- Con l'opzione spenta, comportamento attuale (card singole impilate).

## 5. Fasce dei mesi

Sfondo alternato appena percettibile per ogni mese, dietro la linea e nell'area delle card. Deve restare leggibile e discreto in entrambi i temi, anche con lo sfondo del gioco selezionato.

## 6. Livelli di zoom

Tre livelli: **Day** (attuale), **Week**, **Month**.

- **Ctrl + rotella** oppure i tasti **+** e **−** cambiano livello; lo zoom resta centrato sull'indicatore.
- Transizione animata tra i livelli.
- Nel livello Week e Month:
  - la rotella avanza di una settimana o di un mese;
  - le tacche e le etichette si adattano (settimane numerate o solo mesi);
  - le card sono sempre in versione **solo copertina**, indipendentemente dal menu View; il titolo compare al passaggio del mouse.
- L'header continua a mostrare la data sotto l'indicatore.
- Mostrare il livello attuale con un piccolo indicatore (es. vicino all'header o nel menu View), cliccabile per cambiarlo.
- Selezionare un gioco da Week o Month riporta automaticamente al livello Day.

## 7. Minimappa

- **Anteprima al passaggio del mouse**: tooltip con copertina, titolo e data del gioco (o dei giochi, per un gruppo).
- **Riquadro trascinabile**: il riquadro della parte visibile si può trascinare, e la timeline lo segue in tempo reale. Il clic su un punto continua a funzionare come ora.

## 8. Salti per mese

- **`[`** e **`]`**: mese precedente / successivo (si posiziona sul primo giorno del mese).
- **Maiusc + rotella**: un mese per scatto.
- Deselezionano la card, come gli altri controlli di scorrimento.

## 8b. Trascinamento con inerzia

- Rilasciando il trascinamento, la timeline continua a scorrere nella stessa direzione con la velocità del gesto e rallenta gradualmente.
- Quando la velocità scende sotto una soglia, si aggancia al giorno più vicino (o alla settimana/mese nei livelli di zoom).
- Qualsiasi nuovo input (clic, rotella, tasti) interrompe subito l'inerzia.
- Un trascinamento lento o breve non genera inerzia: si aggancia subito come ora.
- Attrito e soglia come parametri configurabili.
- Con `prefers-reduced-motion`: niente inerzia, aggancio immediato.

## 9. Modalità presentazione

- Tasto **`P`** (e una voce nel menu View) avvia o ferma la presentazione.
- Parte dalla posizione attuale e passa al gioco successivo ogni **6 secondi** (valore configurabile), con selezione, sfondo e animazioni come con PagGiù.
- Rispetta i filtri attivi. Arrivata all'ultimo gioco con data precisa, ricomincia da capo (la zona TBA è esclusa).
- **Spazio** mette in pausa e riprende. Qualsiasi altro input (rotella, clic, tasti di navigazione) ferma la presentazione.
- Una sottile barra di avanzamento in basso mostra il tempo prima del gioco successivo.
- Durante la presentazione il cursore si nasconde dopo qualche secondo di inattività.
- Con `prefers-reduced-motion`: transizioni semplificate.

## 10. Trascinamento con inerzia

- Al rilascio del trascinamento la timeline continua a scorrere con la velocità del gesto e rallenta gradualmente (attrito configurabile).
- A fine corsa si aggancia al giorno più vicino, come ora.
- Un nuovo input (clic, rotella, tasti) ferma subito l'inerzia.
- L'inerzia si ferma ai limiti della timeline senza superarli (niente rimbalzo oltre l'inizio o la zona TBA).
- Un trascinamento molto breve o lento non genera inerzia, così un clic leggermente mosso non fa scorrere la timeline.
- Con `prefers-reduced-motion`: niente inerzia, solo aggancio.

## 11. Ordine di lavoro

1. Menu View e card compatte (§1, §2)
2. Pallini per tipo e fasce dei mesi (§3, §5)
3. Minimappa (§7), salti per mese (§8) e trascinamento con inerzia (§10)
4. Raggruppamento (§4)
5. Livelli di zoom (§6)
6. Modalità presentazione (§9)

Verificare nel browser dopo ogni punto.

---

## Scartate

Date regionali diverse come segni separati sulla linea.
