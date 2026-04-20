const LAST_PLACE_STORAGE_KEY = 'weatherx.lastResolvedPlace';

function isValidCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeSavedPlace(place) {
  if (!place || typeof place !== 'object') {
    return null;
  }

  const lat = Number(place.lat);
  const lon = Number(place.lon);
  const label = typeof place.label === 'string' ? place.label.trim() : '';

  if (!isValidCoordinate(lat) || !isValidCoordinate(lon) || label.length === 0) {
    return null;
  }

  return { lat, lon, label };
}

export function loadSavedResolvedPlace(storage = window.localStorage) {
  try {
    const rawValue = storage.getItem(LAST_PLACE_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    // localStorage puo contenere dati vecchi o modificati a mano:
    // normalizziamo tutto prima di fidarci del payload.
    const normalizedPlace = normalizeSavedPlace(parsedValue);
    if (!normalizedPlace) {
      storage.removeItem(LAST_PLACE_STORAGE_KEY);
      return null;
    }

    return normalizedPlace;
  } catch (err) {
    console.warn('Impossibile leggere l ultima localita salvata dal browser.', err);
    return null;
  }
}

export function saveResolvedPlace(place, storage = window.localStorage) {
  const normalizedPlace = normalizeSavedPlace(place);
  if (!normalizedPlace) {
    return;
  }

  try {
    // Ci bastano coordinate e label: e il minimo per ripristinare la schermata
    // iniziale senza dover rieseguire una ricerca testuale.
    storage.setItem(LAST_PLACE_STORAGE_KEY, JSON.stringify(normalizedPlace));
  } catch (err) {
    console.warn('Impossibile salvare l ultima localita nel browser.', err);
  }
}

export function clearSavedResolvedPlace(storage = window.localStorage) {
  try {
    storage.removeItem(LAST_PLACE_STORAGE_KEY);
  } catch (err) {
    console.warn('Impossibile rimuovere l ultima localita dal browser.', err);
  }
}

export const __test__ = {
  normalizeSavedPlace,
  LAST_PLACE_STORAGE_KEY
};
