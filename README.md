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
- permette di salvare localita preferite e riaprirle rapidamente

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
- Ripristino automatico dell'ultima localita valida dopo il refresh della pagina
- Cache ibrida in memoria e persistente con TTL per meteo e geocoding
- Localita preferite persistenti con accesso rapido da desktop e mobile

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
|   |-- runtime-env.js
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
|   |   |-- favorites.js
|   |   |-- last-place.js
|   |   |-- persistent-cache.js
|   |   `-- place.js
|   `-- ui/
|       |-- forecast.js
|       |-- index.js
|       |-- suggestions.js
|       |-- states.js
|       `-- weather-card.js
|-- tests/
|   |-- favorites.test.js
|   |-- last-place.test.js
|   |-- place.test.js
|   |-- persistent-cache.test.js
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

Per avviare l'app in locale:

```bash
npm start
```

Poi apri il browser su `http://localhost:8080`.

### Come Clonare Ed Eseguire Il Progetto

```bash
git clone https://github.com/rastalien/weatherX.git
cd weatherX
npm install
npm start
```

Infine apri il browser su `http://localhost:8080`.

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

### Localita Preferite

Dalla card meteo principale puoi salvare o rimuovere la localita corrente dai preferiti.

- su desktop i preferiti compaiono in una sezione laterale dedicata
- durante la digitazione dei suggerimenti su desktop, il pannello preferiti si nasconde temporaneamente per lasciare piu spazio alla ricerca
- su mobile i preferiti restano disponibili in una sezione dedicata sotto il pannello di ricerca
- ogni preferito salvato conserva label e coordinate, quindi al click il meteo viene caricato direttamente senza nuovo geocoding

### Comportamento dell'interfaccia

- All'avvio l'app ripristina l'ultima localita valida salvata nel browser; se non esiste usa la localita di default configurata, inizialmente Roma.
- Su schermi desktop l'interfaccia usa una sidebar con ricerca, selezione unita e localita preferite.
- Su tablet e mobile il layout passa a una colonna singola senza barra laterale fissa.
- Durante le richieste la UI mostra uno stato di caricamento.
- In caso di errore l'app mostra un messaggio leggibile e, quando possibile, un pulsante per riprovare.
- Su schermi piccoli alcune etichette del forecast usano una versione piu compatta, mentre su schermi ampi vengono mostrate descrizioni meteo piu complete.

### Persistenza e Cache

- L'ultima localita risolta viene salvata in `localStorage` e riutilizzata dopo un refresh pagina.
- Il layer API controlla prima una cache in memoria e poi una cache persistente nel browser.
- Le voci persistenti hanno sempre una scadenza TTL e vengono eliminate quando risultano scadute o non valide.
- Il meteo e il geocoding restano configurabili via `.env` anche per quanto riguarda i TTL della cache.

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

- non e richiesta alcuna chiave segreta
- non ci sono token o segreti da configurare
- gli endpoint pubblici possono essere personalizzati tramite `.env`

### Configurazione Tramite `.env`

L'app gira nel browser, quindi non puo leggere direttamente un file `.env`.
Per questo il progetto include ora uno script Node che, prima di `npm start` e `npm test`, legge `.env` e genera `js/runtime-env.js`.

Per iniziare:

```bash
cp .env.example .env
```

Su Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Poi modifica i valori che ti servono e avvia normalmente:

```bash
npm start
```

Variabili supportate:

- `WEATHER_DEFAULT_LOCATION_LABEL`
- `WEATHER_DEFAULT_LAT`
- `WEATHER_DEFAULT_LON`
- `WEATHER_FORECAST_API_BASE`
- `WEATHER_GEOCODING_API_BASE`
- `WEATHER_LANGUAGE`
- `WEATHER_TIMEZONE`
- `WEATHER_GEOCODING_COUNT`
- `WEATHER_GEOCODING_FORMAT`
- `WEATHER_CACHE_TTL_WEATHER_MS`
- `WEATHER_CACHE_TTL_GEOCODING_MS`

Esempio:

```dotenv
WEATHER_DEFAULT_LOCATION_LABEL=Milano, Lombardia, Italia
WEATHER_DEFAULT_LAT=45.4642
WEATHER_DEFAULT_LON=9.19
WEATHER_LANGUAGE=it
WEATHER_TIMEZONE=auto
```

Nota importante:

- se in futuro userai un servizio che richiede una chiave API, non inserirla direttamente nel frontend
- una chiave esposta nel browser non e sicura, anche se generata da variabili di ambiente in fase di build
- in quel caso la soluzione corretta e usare un backend o proxy server che legga i segreti dall'ambiente

## Miglioramenti Futuri

- Mostrare piu dettagli meteo, ad esempio pressione, alba e tramonto
- Introdurre icone o asset dedicati invece delle emoji
- Aggiungere supporto multilingua
- Migliorare il riordino o la gestione avanzata delle localita preferite

## File Principali

- `index.html`: struttura base della pagina e punto di ingresso dell'app nel browser
- `css/styles.css`: stile completo dell'interfaccia, temi e responsive
- `js/app.js`: coordinamento del flusso principale, ricerca, autocomplete, refresh e stato UI
- `js/api/weatherApi.js`: chiamate alle API Open-Meteo, cache e normalizzazione dei dati
- `js/runtime-env.js`: configurazione runtime generata automaticamente a partire da `.env`
- `js/features/weather/maps.js`: mapping dei codici meteo in emoji e descrizioni
- `js/features/weather/dates.js`: formatter per giorni e orari
- `js/features/weather/units.js`: formatter per temperatura e vento
- `js/features/weather/theme.js`: scelta del tema giorno, sera o notte
- `js/shared/favorites.js`: persistenza, deduplica e toggle delle localita preferite
- `js/shared/last-place.js`: persistenza e validazione dell'ultima localita mostrata
- `js/shared/persistent-cache.js`: helper di cache persistente con TTL in `localStorage`
- `js/shared/place.js`: formattazione e deduplica delle localita
- `js/shared/errors.js`: trasformazione degli errori tecnici in messaggi leggibili
- `js/ui/weather-card.js`: rendering del meteo principale
- `js/ui/forecast.js`: rendering delle sezioni `Meteo prossime ore` e `Meteo prossimi giorni`
- `js/ui/suggestions.js`: rendering dei suggerimenti automatici durante la digitazione
- `js/ui/states.js`: rendering degli stati di loading, errore e scelta localita
- `tests/`: test automatici Vitest per logica, API e rendering DOM

## Sviluppo

Per orientarti rapidamente nel codice:

- `js/api/` contiene il layer di accesso alle API e la normalizzazione dei dati
- `js/features/weather/` raccoglie formatter, mapping meteo e logica di tema
- `js/shared/` contiene utility riusabili trasversali
- `js/ui/` gestisce il rendering dell'interfaccia e degli stati
- `tests/` raccoglie la suite Vitest per logica, API e DOM

## Licenza

MIT
