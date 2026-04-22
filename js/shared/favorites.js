const FAVORITES_STORAGE_KEY = 'weatherx.favoritePlaces';

function normalizeFavoritePlace(place) {
  if (!place || typeof place !== 'object') {
    return null;
  }

  const lat = Number(place.lat);
  const lon = Number(place.lon);
  const label = typeof place.label === 'string' ? place.label.trim() : '';

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || label.length === 0) {
    return null;
  }

  return { lat, lon, label };
}

function dedupeFavorites(places) {
  const seenKeys = new Set();
  const normalizedPlaces = [];

  places.forEach((place) => {
    const normalizedPlace = normalizeFavoritePlace(place);
    if (!normalizedPlace) {
      return;
    }

    // Usiamo label e coordinate arrotondate per evitare doppioni quasi identici
    // provenienti da salvataggi ripetuti della stessa localita.
    const key = `${normalizedPlace.label.toLowerCase()}|${normalizedPlace.lat.toFixed(4)}|${normalizedPlace.lon.toFixed(4)}`;
    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    normalizedPlaces.push(normalizedPlace);
  });

  return normalizedPlaces;
}

export function loadFavoritePlaces(storage = window.localStorage) {
  try {
    const rawValue = storage.getItem(FAVORITES_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      storage.removeItem(FAVORITES_STORAGE_KEY);
      return [];
    }

    // Ripuliamo sempre il payload letto dal browser: se cambiano struttura
    // o compaiono record corrotti, la lista resta comunque usabile.
    const normalizedPlaces = dedupeFavorites(parsedValue);
    if (normalizedPlaces.length !== parsedValue.length) {
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalizedPlaces));
    }

    return normalizedPlaces;
  } catch (err) {
    console.warn('Impossibile leggere le localita preferite dal browser.', err);
    return [];
  }
}

export function saveFavoritePlaces(places, storage = window.localStorage) {
  try {
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(dedupeFavorites(places)));
  } catch (err) {
    console.warn('Impossibile salvare le localita preferite nel browser.', err);
  }
}

export function isFavoritePlace(place, favorites) {
  const normalizedPlace = normalizeFavoritePlace(place);
  if (!normalizedPlace) {
    return false;
  }

  return favorites.some((favorite) => (
    favorite.label === normalizedPlace.label
    && favorite.lat === normalizedPlace.lat
    && favorite.lon === normalizedPlace.lon
  ));
}

export function toggleFavoritePlace(place, favorites) {
  const normalizedPlace = normalizeFavoritePlace(place);
  if (!normalizedPlace) {
    return favorites;
  }

  // Il toggle ci basta per entrambe le azioni: se la localita esiste la togliamo,
  // altrimenti la aggiungiamo in testa per darle massima visibilita nella lista.
  if (isFavoritePlace(normalizedPlace, favorites)) {
    return favorites.filter((favorite) => !(
      favorite.label === normalizedPlace.label
      && favorite.lat === normalizedPlace.lat
      && favorite.lon === normalizedPlace.lon
    ));
  }

  return [normalizedPlace, ...favorites];
}

export const __test__ = {
  FAVORITES_STORAGE_KEY,
  normalizeFavoritePlace,
  dedupeFavorites
};
