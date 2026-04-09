# WeatherX

Applicazione web client-side per cercare il meteo di una localita e visualizzare meteo attuale, progressione oraria e prossimi giorni usando le API di Open-Meteo.

## Panoramica

WeatherX e una piccola app frontend scritta in HTML, CSS e JavaScript modulare. L'utente cerca una localita per nome e l'app:

- risolve il nome tramite geocoding
- mostra il meteo attuale della localita selezionata
- mostra `Meteo prossime ore` in formato carosello
- mostra `Meteo prossimi giorni` in una lista piu dettagliata
- gestisce ricerche ambigue con una scelta manuale della localita corretta
- permette di aggiornare rapidamente i dati dell'ultima localita visualizzata

Il progetto non usa framework o bundler: gira direttamente nel browser tramite ES modules.

## Funzionalita

- Ricerca per nome citta o localita
- Gestione risultati multipli con selezione manuale
- Aggiornamento rapido dell'ultima localita visualizzata
- Deduplica dei risultati troppo simili restituiti dal geocoder
- Meteo attuale con temperatura, descrizione, umidita, min/max e vento con direzione cardinale
- Sezione `Meteo prossime ore` con progressione oraria in carosello
- Sezione `Meteo prossimi giorni` con lista dedicata, probabilita di pioggia e barra termica min/max
- Gestione errori di rete, timeout e risposte API incomplete
- Protezione da race condition tra ricerche consecutive
- Tema dinamico che cambia tra giorno, sera e notte in base all'orario della localita mostrata
- Suggerimenti automatici durante la digitazione con selezione via click o tastiera

## Struttura Del Progetto

```text
weather-app/
|-- index.html
|-- README.md
|-- package.json
|-- package-lock.json
|-- css/
|   `-- styles.css
|-- js/
|   |-- app.js
|   |-- config.js
|   |-- api/
|   |   `-- weatherApi.js
|   |-- features/
|   |   `-- weather/
|   |       |-- dates.js
|   |       |-- maps.js
|   |       |-- theme.js
|   |       `-- units.js
|   |-- shared/
|   |   |-- errors.js
|   |   `-- place.js
|   `-- ui/
|       |-- forecast.js
|       |-- index.js
|       |-- suggestions.js
|       |-- states.js
|       `-- weather-card.js
|-- tests/
|   |-- place.test.js
|   |-- suggestions-dom.test.js
|   |-- weather-api.test.js
|   |-- weather-dom.test.js
|   `-- weather-formatters.test.js
`-- assets/
    `-- icons/
```

## Installazione

Non serve una build vera e propria, ma per eseguire correttamente l'app e consigliato usare un piccolo server locale.

### Prerequisiti

- Node.js installato sul computer

### Avvio Rapido

1. Apri un terminale nella cartella del progetto.
2. Avvia il server locale:

```bash
npm start
```

3. Apri il browser su `http://localhost:8080`.

### Come Clonare Ed Eseguire Il Progetto

```bash
git clone https://github.com/rastalien/weatherX.git
cd weatherX
npm install
npm start
```

Poi apri il browser su `http://localhost:8080`.

### Note

- Lo script `npm start` usa `npx http-server -c-1 . -p 8080`.
- Se `npx` non e disponibile, puoi usare qualsiasi server statico equivalente.
- Usare un server locale evita problemi con i moduli ES nel browser.

## Test

La suite automatica usa Vitest e `jsdom`.

Esegui tutti i test con:

```bash
npm test
```

Per la modalita watch:

```bash
npm run test:watch
```

La suite copre:

- helper e formatter
- casi limite del layer API
- rendering DOM principale
- rendering DOM dei suggerimenti autocomplete

## Guida All'Uso

### Ricerca per nome

Inserisci una localita come:

```text
Roma
Milano
Napoli
```

Se il geocoder trova una sola corrispondenza, il meteo viene mostrato subito. Se trova piu risultati, compare una lista di scelte.

Durante la digitazione, l'app prova anche a mostrare suggerimenti automatici delle localita piu probabili.

### Suggerimenti Automatici

Quando l'utente scrive almeno due caratteri:

- parte una ricerca con debounce leggero
- vengono mostrati fino a 5 suggerimenti
- si puo scegliere con click
- si puo navigare con `ArrowUp`, `ArrowDown`, `Enter` ed `Escape`

La selezione di un suggerimento usa direttamente le coordinate restituite dal geocoder, evitando una seconda risoluzione testuale.

### Aggiornamento dei dati

Quando l'input e vuoto e c'e gia una localita caricata, il bottone principale passa da `Cerca` a `Aggiorna`. In questo caso l'app ricarica i dati meteo senza rifare il geocoding.

### Comportamento dell'interfaccia

- All'avvio l'app mostra un esempio predefinito su Roma.
- Durante le richieste la UI mostra uno stato di caricamento.
- In caso di errore l'app mostra un messaggio leggibile e, quando possibile, un pulsante per riprovare.
- Su schermi piccoli alcune etichette del forecast usano una versione piu compatta, mentre su schermi ampi vengono mostrate descrizioni meteo piu complete.

## API Utilizzate

- Open-Meteo Forecast API
- Open-Meteo Geocoding API

## Gestione Degli Errori

L'app gestisce diversi scenari di errore e prova a mostrare sempre un messaggio leggibile per l'utente.

I casi principali sono:

- localita non trovata: il geocoder restituisce `results` assente o vuoto
- localita ambigua: il geocoder restituisce piu risultati e l'utente deve scegliere
- rete assente o non raggiungibile: la richiesta `fetch` fallisce
- timeout: la richiesta supera il limite interno di 8 secondi
- errore HTTP del servizio, ad esempio `500`
- payload JSON nullo, non valido o incompleto

Comportamento dell'app:

- gli errori tecnici vengono trasformati in messaggi utente nel layer API
- quando possibile viene mostrato un pulsante `Riprova`
- se il meteo ricevuto non contiene i campi minimi obbligatori, il payload viene rifiutato
- in caso di ricerche concorrenti, le risposte obsolete vengono ignorate per evitare stati incoerenti

Esempi di messaggi mostrati:

- `Non ho trovato nessuna localita con questo nome.`
- `Sembra esserci un problema di connessione. Verifica internet e riprova.`
- `La richiesta sta impiegando troppo tempo. Controlla la connessione e riprova.`
- `Il servizio meteo non risponde correttamente. Riprova tra poco.`
- `I dati meteo ricevuti sono incompleti. Riprova tra poco.`

## Struttura Dei Dati API

L'app usa due livelli di dati:

- payload grezzo restituito da Open-Meteo
- payload normalizzato interno, prodotto da `js/api/weatherApi.js`

### Campi Attesi Dal Payload Grezzo

Per il meteo, l'app si aspetta almeno questi campi in `current`:

- `time`
- `temperature_2m`
- `weather_code`
- `wind_speed_10m`
- `is_day`

Campi opzionali usati quando disponibili:

- `wind_direction_10m`
- `relative_humidity_2m`
- blocchi `hourly`
- blocchi `daily`

Esempio semplificato di payload grezzo:

```json
{
  "current": {
    "time": "2026-04-02T19:15",
    "temperature_2m": 21,
    "weather_code": 1,
    "wind_speed_10m": 12,
    "wind_direction_10m": 45,
    "relative_humidity_2m": 58,
    "is_day": 1
  },
  "hourly": {
    "time": ["2026-04-02T19:00", "2026-04-02T20:00"],
    "temperature_2m": [21, 20],
    "weather_code": [1, 2],
    "is_day": [1, 0],
    "precipitation_probability": [10, 20]
  },
  "daily": {
    "time": ["2026-04-02", "2026-04-03"],
    "weather_code": [1, 3],
    "temperature_2m_max": [24, 22],
    "temperature_2m_min": [15, 14],
    "precipitation_probability_max": [10, 40]
  }
}
```

### Payload Normalizzato Interno

Il layer API trasforma la risposta in una struttura piu stabile per la UI:

```json
{
  "current": {
    "time": "2026-04-02T19:15",
    "temperature": 21,
    "weatherCode": 1,
    "windSpeed": 12,
    "windDirection": 45,
    "isDay": true,
    "humidity": 58
  },
  "daily": {
    "maxTemp": 24,
    "minTemp": 15,
    "forecast": [
      {
        "time": "2026-04-03",
        "weatherCode": 3,
        "maxTemp": 22,
        "minTemp": 14,
        "precipitationProbability": 40
      }
    ]
  },
  "hourly": [
    {
      "time": "2026-04-02T19:00",
      "temperature": 21,
      "weatherCode": 1,
      "isDay": true,
      "precipitationProbability": 10
    }
  ]
}
```

Questo e il formato consumato dal layer UI.

## Configurazione API

In questo progetto non serve alcuna chiave API.

Quindi:

- non e richiesto un file `.env`
- non ci sono token o segreti da configurare
- gli endpoint pubblici sono definiti in `js/config.js`

Nota importante:

- se in futuro userai un servizio che richiede una chiave API, non inserirla direttamente nel frontend
- una chiave esposta nel browser non e sicura, anche se generata da variabili di ambiente in fase di build
- in quel caso la soluzione corretta e usare un backend o proxy server che legga i segreti dall'ambiente

## Miglioramenti Futuri

- Mostrare piu dettagli meteo, ad esempio pressione, alba e tramonto
- Introdurre icone o asset dedicati invece delle emoji
- Aggiungere supporto multilingua
- Permettere il salvataggio delle localita preferite

## File Principali

- `index.html`: struttura base della pagina e punto di ingresso dell'app nel browser
- `css/styles.css`: stile completo dell'interfaccia, temi e responsive
- `js/app.js`: coordinamento del flusso principale, ricerca, autocomplete, refresh e stato UI
- `js/api/weatherApi.js`: chiamate alle API Open-Meteo, cache e normalizzazione dei dati
- `js/features/weather/maps.js`: mapping dei codici meteo in emoji e descrizioni
- `js/features/weather/dates.js`: formatter per giorni e orari
- `js/features/weather/units.js`: formatter per temperatura e vento
- `js/features/weather/theme.js`: scelta del tema giorno, sera o notte
- `js/shared/place.js`: formattazione e deduplica delle localita
- `js/shared/errors.js`: trasformazione degli errori tecnici in messaggi leggibili
- `js/ui/weather-card.js`: rendering del meteo principale
- `js/ui/forecast.js`: rendering delle sezioni `Meteo prossime ore` e `Meteo prossimi giorni`
- `js/ui/suggestions.js`: rendering dei suggerimenti automatici durante la digitazione
- `js/ui/states.js`: rendering degli stati di loading, errore e scelta localita
- `tests/`: test automatici Vitest per logica, API e rendering DOM

## Sviluppo

Le aree principali del codice sono:

- `index.html`: struttura base della pagina
- `js/app.js`: coordinamento del flusso di ricerca e aggiornamento
- `js/api/weatherApi.js`: chiamate API, cache e normalizzazione dati
- `js/features/weather/`: logica e formatter specifici del dominio meteo
- `js/features/weather/theme.js`: scelta del tema visivo in base all'orario locale della previsione
- `js/shared/place.js`: formattazione e deduplica localita
- `js/shared/errors.js`: gestione dei messaggi utente per gli errori
- `js/ui/weather-card.js`: rendering della card meteo principale
- `js/ui/forecast.js`: rendering della previsione oraria e giornaliera
- `js/ui/suggestions.js`: rendering della lista autocomplete delle localita
- `js/ui/states.js`: rendering di loading, errori e scelta localita
- `js/ui/index.js`: punto di ingresso del layer UI
- `tests/`: suite Vitest per logica, layer API e rendering DOM

## Licenza

MIT
