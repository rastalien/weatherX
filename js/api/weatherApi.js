import { CONFIG } from '../config.js';
import { loadPersistentCache, loadPersistentCacheEntry, savePersistentCache } from '../shared/persistent-cache.js';

const REQUEST_TIMEOUT_MS = 8000;
const weatherCache = new Map();
const geocodingCache = new Map();
const reverseGeocodingCache = new Map();
const WEATHER_CACHE_NAMESPACE = 'weatherx.weather';
const GEOCODING_CACHE_NAMESPACE = 'weatherx.geocoding';
const REVERSE_GEOCODING_CACHE_NAMESPACE = 'weatherx.reverseGeocoding';

function createAppError(message, userMessage, canRetry = true, userTitle = 'Qualcosa e andato storto') {
  const error = new Error(message);
  error.userMessage = userMessage;
  error.canRetry = canRetry;
  error.userTitle = userTitle;
  return error;
}

function getServiceLabel(serviceName) {
  return serviceName === 'Geocoding' || serviceName === 'ReverseGeocoding' ? 'ricerca localita' : 'meteo';
}

function getHttpFailureDetails(serviceName, status) {
  const label = getServiceLabel(serviceName);

  if (status === 401 || status === 403) {
    return {
      title: 'Servizio non autorizzato',
      message: `Il servizio ${label} ha rifiutato la richiesta. Controlla la configurazione e riprova.`
    };
  }

  if (status === 404) {
    return {
      title: 'Servizio non trovato',
      message: `Il servizio ${label} non ha trovato l endpoint richiesto. Riprova tra poco.`
    };
  }

  if (status === 429) {
    return {
      title: 'Troppe richieste',
      message: `Il servizio ${label} sta ricevendo troppe richieste. Aspetta qualche minuto e riprova.`
    };
  }

  if (status >= 500) {
    return {
      title: serviceName === 'Geocoding' ? 'Ricerca localita non disponibile' : 'Meteo non disponibile',
      message: `Il servizio ${label} e momentaneamente in difficolta. Riprova tra poco.`
    };
  }

  return {
    title: 'Risposta non valida',
    message: `Il servizio ${label} ha risposto con codice ${status}. Riprova tra poco.`
  };
}

function getInvalidPayloadDetails(serviceName) {
  if (serviceName === 'Geocoding' || serviceName === 'ReverseGeocoding') {
    return {
      title: 'Risultati localita illeggibili',
      message: 'Ho ricevuto risultati di ricerca in un formato inatteso. Riprova tra poco.'
    };
  }

  return {
    title: 'Dati meteo illeggibili',
    message: 'Ho ricevuto dati meteo in un formato inatteso. Riprova tra poco.'
  };
}

function getTimeoutDetails(serviceName) {
  return {
    title: serviceName === 'Geocoding' ? 'Ricerca troppo lenta' : 'Meteo troppo lento',
    message: `La richiesta ${getServiceLabel(serviceName)} sta impiegando troppo tempo. Controlla la connessione e riprova.`
  };
}

function getNetworkFailureDetails(serviceName) {
  return {
    title: 'Connessione assente',
    message: `Non riesco a contattare il servizio ${getServiceLabel(serviceName)}. Verifica internet e riprova.`
  };
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

async function getOrSetHybridCachedValue(cache, namespace, key, ttlMs, loader) {
  const memoryValue = getCacheEntry(cache, key);
  if (memoryValue) {
    return memoryValue.value;
  }

  // Dopo un refresh la cache in memoria sparisce, quindi proviamo
  // a riusare la copia persistente se il TTL la considera ancora fresca.
  const persistentValue = loadPersistentCache(namespace, key);
  if (persistentValue !== null) {
    setCacheEntry(cache, key, persistentValue, ttlMs);
    return persistentValue;
  }

  return getOrSetCachedValue(cache, key, ttlMs, async () => {
    const resolvedValue = await loader();
    // Persistiamo solo il JSON finale risolto: la deduplica delle richieste
    // concorrenti continua invece a vivere solo nella cache in memoria.
    savePersistentCache(namespace, key, resolvedValue, ttlMs);
    return resolvedValue;
  });
}

function buildWeatherCacheKey(lat, lon) {
  // Arrotondiamo leggermente le coordinate per trattare come equivalenti
  // richieste praticamente identiche provenienti dallo stesso geocoder.
  return `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}`;
}

function buildGeocodingCacheKey(query) {
  return query.trim().toLowerCase();
}

function buildReverseGeocodingCacheKey(lat, lon) {
  return `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}`;
}

function attachWeatherMeta(weather, meta = {}) {
  // La UI usa questi metadati per comunicare quando il dato e stato aggiornato
  // e se proviene da una copia salvata invece che da una risposta appena ricevuta.
  return {
    ...weather,
    meta: {
      updatedAt: meta.updatedAt || new Date().toISOString(),
      isStale: meta.isStale === true
    }
  };
}

function markWeatherAsStale(weather) {
  // Se la rete fallisce, preserviamo l'orario originale del dato salvato:
  // cosi l'utente capisce quanto e vecchia la previsione mostrata.
  return attachWeatherMeta(weather, {
    updatedAt: weather?.meta?.updatedAt,
    isStale: true
  });
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
      const details = getHttpFailureDetails(serviceName, res.status);
      throw createAppError(
        `${serviceName} error: ${res.status}`,
        details.message,
        true,
        details.title
      );
    }

    const data = await res.json();
    if (!data || typeof data !== 'object') {
      const details = getInvalidPayloadDetails(serviceName);
      throw createAppError(
        `${serviceName} returned an invalid payload`,
        details.message,
        true,
        details.title
      );
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      const details = getTimeoutDetails(serviceName);
      throw createAppError(
        `${serviceName} timeout`,
        details.message,
        true,
        details.title
      );
    }

    if (err instanceof TypeError) {
      const details = getNetworkFailureDetails(serviceName);
      throw createAppError(
        `${serviceName} network failure`,
        details.message,
        true,
        details.title
      );
    }

    if (err.userMessage) {
      throw err;
    }

    throw createAppError(
      `${serviceName} unexpected error`,
      `Qualcosa ha interrotto la richiesta ${getServiceLabel(serviceName)}. Riprova tra poco.`,
      true,
      'Errore imprevisto'
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
      'La risposta meteo non contiene le condizioni attuali per questa localita. Riprova piu tardi.',
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
      'La risposta meteo e arrivata incompleta, quindi non posso mostrarla in modo affidabile. Riprova tra poco.',
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
  const memoryValue = getCacheEntry(weatherCache, cacheKey);
  if (memoryValue) {
    return memoryValue.value;
  }

  const persistentEntry = loadPersistentCacheEntry(
    WEATHER_CACHE_NAMESPACE,
    cacheKey,
    { allowExpired: true }
  );

  // Le voci persistenti ancora valide vengono riusate subito; quelle scadute
  // restano disponibili solo come fallback se il nuovo fetch non riesce.
  if (persistentEntry?.value && !persistentEntry.isExpired) {
    setCacheEntry(weatherCache, cacheKey, persistentEntry.value, CONFIG.CACHE_TTL_MS.weather);
    return persistentEntry.value;
  }

  try {
    return await getOrSetCachedValue(
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
        const weather = attachWeatherMeta(normalizeWeatherPayload(data));
        savePersistentCache(WEATHER_CACHE_NAMESPACE, cacheKey, weather, CONFIG.CACHE_TTL_MS.weather);
        return weather;
      }
    );
  } catch (err) {
    if (persistentEntry?.value) {
      return markWeatherAsStale(persistentEntry.value);
    }

    throw err;
  }
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

  return getOrSetHybridCachedValue(
    geocodingCache,
    GEOCODING_CACHE_NAMESPACE,
    cacheKey,
    CONFIG.CACHE_TTL_MS.geocoding,
    async () => {
      const params = new URLSearchParams({
        name: query,
        count: String(CONFIG.GEOCODING_PARAMS.count),
        language: CONFIG.GEOCODING_PARAMS.language,
        format: CONFIG.GEOCODING_PARAMS.format
      });

      const url = `${CONFIG.GEOCODING_API_BASE}?${params.toString()}`;
      const data = await fetchJson(url, 'Geocoding');

      // Alcune ricerche possono non restituire results: in quel caso lasciamo decidere ad app.js.
      return data;
    }
  );
}

/**
 * Ricava un indirizzo leggibile partendo dalle coordinate del browser.
 *
 * @param {number} lat Latitudine della posizione richiesta.
 * @param {number} lon Longitudine della posizione richiesta.
 * @returns {Promise<object>} Payload del reverse geocoder.
 *
 * @example
 * const place = await reverseGeocodeCoords(45.4642, 9.19);
 */
export async function reverseGeocodeCoords(lat, lon) {
  const cacheKey = buildReverseGeocodingCacheKey(lat, lon);

  return getOrSetHybridCachedValue(
    reverseGeocodingCache,
    REVERSE_GEOCODING_CACHE_NAMESPACE,
    cacheKey,
    CONFIG.CACHE_TTL_MS.geocoding,
    async () => {
      // La Geolocation API del browser restituisce solo coordinate:
      // questo endpoint le trasforma in una localita mostrabile nella card.
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(lat),
        lon: String(lon),
        addressdetails: '1',
        zoom: '10',
        'accept-language': CONFIG.GEOCODING_PARAMS.language
      });

      const url = `${CONFIG.REVERSE_GEOCODING_API_BASE}?${params.toString()}`;
      return fetchJson(url, 'ReverseGeocoding');
    }
  );
}
