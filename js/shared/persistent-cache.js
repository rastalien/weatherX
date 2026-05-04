function getDefaultStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function createStorageKey(namespace, key) {
  return `${namespace}:${key}`;
}

export function loadPersistentCache(namespace, key, storage = getDefaultStorage()) {
  const entry = loadPersistentCacheEntry(namespace, key, { allowExpired: false }, storage);
  return entry?.value ?? null;
}

export function loadPersistentCacheEntry(namespace, key, options = {}, storage = getDefaultStorage()) {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(createStorageKey(namespace, key));
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== 'object') {
      return null;
    }

    // Normalmente il TTL scaduto elimina la voce. Il meteo pero puo usare
    // `allowExpired` per mostrare una copia stale quando l'utente e offline.
    if (typeof parsedValue.expiresAt !== 'number' || Date.now() > parsedValue.expiresAt) {
      if (!options.allowExpired) {
        storage.removeItem(createStorageKey(namespace, key));
        return null;
      }

      return {
        value: parsedValue.value ?? null,
        expiresAt: parsedValue.expiresAt,
        isExpired: true
      };
    }

    return {
      value: parsedValue.value ?? null,
      expiresAt: parsedValue.expiresAt,
      isExpired: false
    };
  } catch (err) {
    console.warn('Impossibile leggere una voce di cache persistente.', err);
    return null;
  }
}

export function savePersistentCache(namespace, key, value, ttlMs, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  try {
    // Salviamo anche la scadenza assoluta: al prossimo refresh possiamo capire
    // immediatamente se il valore e ancora riusabile senza altre conversioni.
    storage.setItem(
      createStorageKey(namespace, key),
      JSON.stringify({
        value,
        expiresAt: Date.now() + ttlMs
      })
    );
  } catch (err) {
    console.warn('Impossibile salvare una voce di cache persistente.', err);
  }
}

export function clearPersistentCache(namespace, key, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(createStorageKey(namespace, key));
  } catch (err) {
    console.warn('Impossibile rimuovere una voce di cache persistente.', err);
  }
}

export const __test__ = {
  createStorageKey
};
