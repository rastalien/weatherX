import { describe, expect, it, vi } from 'vitest';
import { __test__, clearSavedResolvedPlace, loadSavedResolvedPlace, saveResolvedPlace } from '../js/shared/last-place.js';

function createStorageMock(initialState = {}) {
  const store = new Map(Object.entries(initialState));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

describe('last resolved place persistence', () => {
  it('salva e rilegge una localita valida', () => {
    const storage = createStorageMock();
    const place = {
      lat: 45.4642,
      lon: 9.19,
      label: 'Milano, Lombardia, Italia'
    };

    saveResolvedPlace(place, storage);

    expect(loadSavedResolvedPlace(storage)).toEqual(place);
  });

  it('scarta payload incompleti o corrotti', () => {
    const storage = createStorageMock({
      [__test__.LAST_PLACE_STORAGE_KEY]: JSON.stringify({ lat: 'abc', label: '' })
    });

    expect(loadSavedResolvedPlace(storage)).toBeNull();
    expect(storage.getItem(__test__.LAST_PLACE_STORAGE_KEY)).toBeNull();
  });

  it('gestisce json non valido senza lanciare errori', () => {
    const storage = createStorageMock({
      [__test__.LAST_PLACE_STORAGE_KEY]: '{not-json}'
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(loadSavedResolvedPlace(storage)).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('rimuove la localita salvata quando richiesto', () => {
    const storage = createStorageMock({
      [__test__.LAST_PLACE_STORAGE_KEY]: JSON.stringify({
        lat: 41.9028,
        lon: 12.4964,
        label: 'Roma, Lazio, Italia'
      })
    });

    clearSavedResolvedPlace(storage);

    expect(storage.getItem(__test__.LAST_PLACE_STORAGE_KEY)).toBeNull();
  });
});
