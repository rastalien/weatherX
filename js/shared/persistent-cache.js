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

    // Quando il TTL scade eliminiamo subito la voce dal browser,
    // cosi il resto dell'app non deve gestire cache stale.
    if (typeof parsedValue.expiresAt !== 'number' || Date.now() > parsedValue.expiresAt) {
      storage.removeItem(createStorageKey(namespace, key));
      return null;
    }

    return parsedValue.value ?? null;
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
