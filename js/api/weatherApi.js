import { CONFIG } from '../config.js';

const REQUEST_TIMEOUT_MS = 8000;
const weatherCache = new Map();
const geocodingCache = new Map();

function createAppError(message, userMessage, canRetry = true) {
  const error = new Error(message);
  error.userMessage = userMessage;
  error.canRetry = canRetry;
  return error;
}

function getServiceFailureMessage(serviceName) {
  switch (serviceName) {
    case 'Geocoding':
      return 'Il servizio di ricerca localita non risponde correttamente. Riprova tra poco.';
    default:
      return 'Il servizio meteo non risponde correttamente. Riprova tra poco.';
  }
}

function getCacheEntry(cache, key) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry;
}

function setCacheEntry(cache, key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

async function getOrSetCachedValue(cache, key, ttlMs, loader) {
  const cachedEntry = getCacheEntry(cache, key);
  if (cachedEntry) {
    return cachedEntry.value;
  }

  // Salviamo subito la promise in cache: se partono piu richieste uguali
  // nello stesso momento, tutte riuseranno la stessa risposta in volo.
  const pendingValue = loader();
  setCacheEntry(cache, key, pendingValue, ttlMs);

  try {
    const resolvedValue = await pendingValue;
    setCacheEntry(cache, key, resolvedValue, ttlMs);
    return resolvedValue;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

function buildWeatherCacheKey(lat, lon) {
  // Arrotondiamo leggermente le coordinate per trattare come equivalenti
  // richieste praticamente identiche provenienti dallo stesso geocoder.
  return `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}`;
}

function buildGeocodingCacheKey(query) {
  return query.trim().toLowerCase();
}

/**
 * Esegue una richiesta HTTP JSON con timeout e converte gli errori tecnici
 * in errori applicativi con messaggi leggibili per l'utente.
 *
 * @param {string} url Endpoint completo da chiamare.
 * @param {string} serviceName Nome logico del servizio usato nei messaggi di errore.
 * @returns {Promise<object>} Payload JSON validato come oggetto.
 * @throws {Error} Errore applicativo arricchito con `userMessage` e `canRetry`.
 *
 * @example
 * const data = await fetchJson('https://api.open-meteo.com/v1/forecast?...', 'Open-Meteo');
 */
async function fetchJson(url, serviceName) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      throw createAppError(
        `${serviceName} error: ${res.status}`,
        getServiceFailureMessage(serviceName)
      );
    }

    const data = await res.json();
    if (!data || typeof data !== 'object') {
      throw createAppError(
        `${serviceName} returned an invalid payload`,
        `La risposta di ${serviceName.toLowerCase()} non e valida. Riprova tra poco.`
      );
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw createAppError(
        `${serviceName} timeout`,
        'La richiesta sta impiegando troppo tempo. Controlla la connessione e riprova.'
      );
    }

    if (err instanceof TypeError) {
      throw createAppError(
        `${serviceName} network failure`,
        'Sembra esserci un problema di connessione. Verifica internet e riprova.'
      );
    }

    if (err.userMessage) {
      throw err;
    }

    throw createAppError(
      `${serviceName} unexpected error`,
      'Si e verificato un errore imprevisto. Riprova.'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Normalizza la risposta grezza di Open-Meteo nel formato interno usato dalla UI.
 * Qui vengono anche validati i campi minimi richiesti dal renderer.
 *
 * @param {object} data Payload JSON restituito dall'API Open-Meteo.
 * @returns {{
 *   current: {
 *     time: string,
 *     temperature: number,
 *     weatherCode: number,
 *     windSpeed: number,
 *     windDirection: number | null,
 *     isDay: boolean,
 *     humidity: number | null
 *   },
 *   daily: {
 *     maxTemp: number | null,
 *     minTemp: number | null,
 *     forecast: Array<{
 *       time: string,
 *       weatherCode: number,
 *       maxTemp: number | null,
 *       minTemp: number | null,
 *       precipitationProbability: number | null
 *     }>
 *   },
 *   hourly: Array<{
 *     time: string,
 *     temperature: number,
 *     weatherCode: number,
 *     isDay: boolean,
 *     precipitationProbability: number | null
 *   }>
 * }} Dati meteo trasformati nel formato consumato dai componenti UI.
 * @throws {Error} Errore applicativo se i campi obbligatori risultano assenti o incompleti.
 *
 * @example
 * const weather = normalizeWeatherPayload(openMeteoResponse);
 * console.log(weather.current.temperature);
 */
function normalizeWeatherPayload(data) {
  const current = data.current;
  if (!current || typeof current !== 'object') {
    throw createAppError(
      'Open-Meteo payload missing current',
      'Non sono riuscito a leggere i dati meteo per questa localita.',
      false
    );
  }

  const requiredCurrentFields = [
    'time',
    'temperature_2m',
    'weather_code',
    'wind_speed_10m',
    'is_day'
  ];

  const missingField = requiredCurrentFields.find((field) => current[field] === undefined || current[field] === null);
  if (missingField) {
    throw createAppError(
      `Open-Meteo current missing ${missingField}`,
      'I dati meteo ricevuti sono incompleti. Riprova tra poco.',
      false
    );
  }

  const hourlyTimes = Array.isArray(data.hourly?.time) ? data.hourly.time : [];
  const hourlyTemperatures = Array.isArray(data.hourly?.temperature_2m) ? data.hourly.temperature_2m : [];
  const hourlyWeatherCodes = Array.isArray(data.hourly?.weather_code) ? data.hourly.weather_code : [];
  const hourlyIsDay = Array.isArray(data.hourly?.is_day) ? data.hourly.is_day : [];
  const hourlyPrecipitationProbability = Array.isArray(data.hourly?.precipitation_probability)
    ? data.hourly.precipitation_probability
    : [];
  const dailyTimes = Array.isArray(data.daily?.time) ? data.daily.time : [];
  const dailyWeatherCodes = Array.isArray(data.daily?.weather_code) ? data.daily.weather_code : [];
  const dailyMaxTemps = Array.isArray(data.daily?.temperature_2m_max) ? data.daily.temperature_2m_max : [];
  const dailyMinTemps = Array.isArray(data.daily?.temperature_2m_min) ? data.daily.temperature_2m_min : [];
  const dailyPrecipitationProbability = Array.isArray(data.daily?.precipitation_probability_max)
    ? data.daily.precipitation_probability_max
    : [];

  // Convertiamo i tre blocchi dell'API (current, hourly, daily) in una struttura
  // piu stabile per la UI: nomi coerenti, valori gia ripuliti e campi opzionali espliciti.
  const hourly = hourlyTimes.map((time, index) => ({
    time,
    temperature: hourlyTemperatures[index],
    weatherCode: hourlyWeatherCodes[index],
    isDay: hourlyIsDay[index] === 1,
    precipitationProbability: hourlyPrecipitationProbability[index] ?? null
  })).filter((item) => item.temperature !== undefined && item.weatherCode !== undefined);

  // La lista giornaliera salta il primo giorno perche il meteo "di oggi"
  // e gia rappresentato nella card principale.
  const dailyForecast = dailyTimes.map((time, index) => ({
    time,
    weatherCode: dailyWeatherCodes[index],
    maxTemp: dailyMaxTemps[index] ?? null,
    minTemp: dailyMinTemps[index] ?? null,
    precipitationProbability: dailyPrecipitationProbability[index] ?? null
  })).filter((item) => item.weatherCode !== undefined).slice(1, 6);

  return {
    current: {
      time: current.time,
      temperature: current.temperature_2m,
      weatherCode: current.weather_code,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m ?? null,
      isDay: current.is_day === 1,
      humidity: current.relative_humidity_2m ?? null
    },
    daily: {
      maxTemp: data.daily?.temperature_2m_max?.[0] ?? null,
      minTemp: data.daily?.temperature_2m_min?.[0] ?? null,
      forecast: dailyForecast
    },
    hourly
  };
}

export const __test__ = {
  normalizeWeatherPayload
};

/**
 * Recupera e normalizza i dati meteo per una coppia di coordinate geografiche.
 *
 * @param {number} lat Latitudine della posizione richiesta.
 * @param {number} lon Longitudine della posizione richiesta.
 * @returns {Promise<object>} Dati meteo gia pronti per il renderer UI.
 *
 * @example
 * const weather = await fetchWeatherByCoords(41.9028, 12.4964);
 */
export async function fetchWeatherByCoords(lat, lon) {
  const cacheKey = buildWeatherCacheKey(lat, lon);

  return getOrSetCachedValue(
    weatherCache,
    cacheKey,
    CONFIG.CACHE_TTL_MS.weather,
    async () => {
      // URLSearchParams costruisce la query string evitando errori di concatenazione manuale.
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: CONFIG.DEFAULT_PARAMS.current,
        timezone: CONFIG.DEFAULT_PARAMS.timezone,
        daily: CONFIG.DEFAULT_PARAMS.daily,
        hourly: CONFIG.DEFAULT_PARAMS.hourly
      });

      const url = `${CONFIG.OPEN_METEO_BASE}?${params.toString()}`;
      const data = await fetchJson(url, 'Open-Meteo');
      return normalizeWeatherPayload(data);
    }
  );
}

/**
 * Cerca una localita testuale tramite il servizio di geocoding.
 *
 * @param {string} query Nome della localita inserito dall'utente.
 * @returns {Promise<object>} Payload del geocoder, potenzialmente con `results` assente o vuoto.
 *
 * @example
 * const geo = await geocodeLocation('Roma');
 */
export async function geocodeLocation(query) {
  const cacheKey = buildGeocodingCacheKey(query);

  return getOrSetCachedValue(
    geocodingCache,
    cacheKey,
    CONFIG.CACHE_TTL_MS.geocoding,
    async () => {
      // Codifica il testo per inserirlo in sicurezza nell'URL.
      const q = encodeURIComponent(query);
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=5&language=it&format=json`;
      const data = await fetchJson(url, 'Geocoding');

      // Alcune ricerche possono non restituire results: in quel caso lasciamo decidere ad app.js.
      return data;
    }
  );
}
