import { RUNTIME_ENV } from './runtime-env.js';

const DEFAULT_CONFIG = {
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
    weatherRoot: 'weather-root',
    favoritesRoot: 'favorites-root',
    mobileFavoritesRoot: 'mobile-favorites-root',
    feedbackRoot: 'feedback-root'
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

function getStringEnvValue(key, fallback) {
  // La config runtime arriva da un file generato: qui normalizziamo valori vuoti
  // o mancanti per evitare condizioni speciali sparse nel resto dell'app.
  const value = RUNTIME_ENV[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function getNumberEnvValue(key, fallback) {
  const rawValue = RUNTIME_ENV[key];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export const CONFIG = {
  ...DEFAULT_CONFIG,
  DEFAULT_LOCATION: {
    label: getStringEnvValue('WEATHER_DEFAULT_LOCATION_LABEL', DEFAULT_CONFIG.DEFAULT_LOCATION.label),
    coords: {
      lat: getNumberEnvValue('WEATHER_DEFAULT_LAT', DEFAULT_CONFIG.DEFAULT_LOCATION.coords.lat),
      lon: getNumberEnvValue('WEATHER_DEFAULT_LON', DEFAULT_CONFIG.DEFAULT_LOCATION.coords.lon)
    }
  },
  // Gli endpoint restano pubblici e configurabili: questo aiuta test locali,
  // proxy futuri o eventuali varianti dell'ambiente senza toccare il codice app.
  OPEN_METEO_BASE: getStringEnvValue('WEATHER_FORECAST_API_BASE', DEFAULT_CONFIG.OPEN_METEO_BASE),
  GEOCODING_API_BASE: getStringEnvValue('WEATHER_GEOCODING_API_BASE', 'https://geocoding-api.open-meteo.com/v1/search'),
  CACHE_TTL_MS: {
    weather: getNumberEnvValue('WEATHER_CACHE_TTL_WEATHER_MS', DEFAULT_CONFIG.CACHE_TTL_MS.weather),
    geocoding: getNumberEnvValue('WEATHER_CACHE_TTL_GEOCODING_MS', DEFAULT_CONFIG.CACHE_TTL_MS.geocoding)
  },
  DEFAULT_PARAMS: {
    ...DEFAULT_CONFIG.DEFAULT_PARAMS,
    timezone: getStringEnvValue('WEATHER_TIMEZONE', DEFAULT_CONFIG.DEFAULT_PARAMS.timezone)
  },
  // Teniamo separati i parametri di geocoding per poterli riusare sia
  // nel fetch che nella documentazione/configurazione senza duplicazioni.
  GEOCODING_PARAMS: {
    count: getNumberEnvValue('WEATHER_GEOCODING_COUNT', 5),
    language: getStringEnvValue('WEATHER_LANGUAGE', 'it'),
    format: getStringEnvValue('WEATHER_GEOCODING_FORMAT', 'json')
  }
};
