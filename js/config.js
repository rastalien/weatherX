export const CONFIG = {
  // Posizione iniziale mostrata al primo avvio prima di qualsiasi ricerca utente.
  DEFAULT_LOCATION: {
    label: 'Roma, Lazio, Italia',
    coords: {
      lat: 41.9028,
      lon: 12.4964
    }
  },
  // Gli id HTML sono centralizzati qui per evitare stringhe duplicate sparse nell'app.
  SELECTORS: {
    form: 'search-form',
    input: 'location-input',
    searchButton: 'search-button',
    unitToggle: 'temperature-unit-toggle',
    weatherRoot: 'weather-root'
  },
  OPEN_METEO_BASE: 'https://api.open-meteo.com/v1/forecast',
  CACHE_TTL_MS: {
    // Il meteo puo essere riusato per pochi minuti senza cambiare davvero
    // la percezione del dato, ma riducendo richieste ripetute inutili.
    weather: 3 * 60 * 1000,
    geocoding: 5 * 60 * 1000
  },

  // Parametri condivisi per le richieste meteo, cosi non vengono duplicati altrove.
  DEFAULT_PARAMS: {
    // Elenco dei campi richiesti all'API per previsioni orarie e giornaliere.
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    current: 'temperature_2m,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m',

    // "auto" fa adattare il fuso orario alla posizione cercata.
    timezone: 'auto'
  }
};
