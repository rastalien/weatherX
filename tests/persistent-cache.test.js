import { afterEach, describe, expect, it, vi } from 'vitest';
import { __test__, clearPersistentCache, loadPersistentCache, savePersistentCache } from '../js/shared/persistent-cache.js';

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

describe('persistent cache helpers', () => {
  it('salva e rilegge una voce valida con ttl attivo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    const storage = createStorageMock();

    savePersistentCache('weatherx.weather', 'rome', { temp: 22 }, 1000, storage);

    expect(loadPersistentCache('weatherx.weather', 'rome', storage)).toEqual({ temp: 22 });
  });

  it('rimuove una voce scaduta', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    const storage = createStorageMock();

    savePersistentCache('weatherx.weather', 'rome', { temp: 22 }, 1000, storage);
    vi.advanceTimersByTime(1001);

    expect(loadPersistentCache('weatherx.weather', 'rome', storage)).toBeNull();
    expect(storage.getItem(__test__.createStorageKey('weatherx.weather', 'rome'))).toBeNull();
  });

  it('gestisce valori corrotti senza interrompere l app', () => {
    const storage = createStorageMock({
      [__test__.createStorageKey('weatherx.weather', 'rome')]: '{broken-json}'
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(loadPersistentCache('weatherx.weather', 'rome', storage)).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('rimuove una voce quando richiesto', () => {
    const storage = createStorageMock({
      [__test__.createStorageKey('weatherx.weather', 'rome')]: JSON.stringify({
        value: { temp: 22 },
        expiresAt: Date.now() + 1000
      })
    });

    clearPersistentCache('weatherx.weather', 'rome', storage);

    expect(storage.getItem(__test__.createStorageKey('weatherx.weather', 'rome'))).toBeNull();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
