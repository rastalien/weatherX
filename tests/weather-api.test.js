// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __test__, fetchWeatherByCoords, geocodeLocation, reverseGeocodeCoords } from '../js/api/weatherApi.js';

describe('weather api edge cases', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('gestisce una city name vuota senza risultati', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await geocodeLocation('');
    expect(result).toEqual({});
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('name=');
  });

  it('gestisce una citta non esistente restituendo results vuoto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] })
    }));

    const result = await geocodeLocation('CittaCheNonEsiste123');
    expect(result).toEqual({ results: [] });
  });

  it('gestisce invalid user input lasciando decidere al chiamante', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] })
    }));

    const result = await geocodeLocation('@@@');
    expect(result.results).toEqual([]);
  });

  it('recupera la localita leggibile dalle coordinate del browser', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        address: {
          city: 'Milano',
          state: 'Lombardia',
          country: 'Italia'
        }
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await reverseGeocodeCoords(45.4642, 9.19);
    const calledUrl = new URL(fetchMock.mock.calls[0][0]);

    expect(result.address.city).toBe('Milano');
    expect(calledUrl.hostname).toBe('nominatim.openstreetmap.org');
    expect(calledUrl.searchParams.get('format')).toBe('jsonv2');
    expect(calledUrl.searchParams.get('lat')).toBe('45.4642');
    expect(calledUrl.searchParams.get('lon')).toBe('9.19');
    expect(calledUrl.searchParams.get('zoom')).toBe('10');
  });

  it('rifiuta weather data null o incompleti', () => {
    expect(() => __test__.normalizeWeatherPayload({ current: null })).toThrow(
      'Open-Meteo payload missing current'
    );

    expect(() => __test__.normalizeWeatherPayload({
      current: {
        time: '2026-04-02T10:00',
        temperature_2m: 20,
        weather_code: 1,
        wind_speed_10m: null,
        is_day: 1
      }
    })).toThrow('Open-Meteo current missing wind_speed_10m');
  });

  it('gestisce malformed json con un errore leggibile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => null
    }));

    await expect(fetchWeatherByCoords(41.9028, 12.4964)).rejects.toMatchObject({
      userTitle: 'Dati meteo illeggibili',
      userMessage: 'Ho ricevuto dati meteo in un formato inatteso. Riprova tra poco.'
    });
  });

  it('personalizza gli errori HTTP del geocoding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({})
    }));

    await expect(geocodeLocation('Milano')).rejects.toMatchObject({
      userTitle: 'Troppe richieste',
      userMessage: 'Il servizio ricerca localita sta ricevendo troppe richieste. Aspetta qualche minuto e riprova.',
      canRetry: true
    });
  });

  it('personalizza gli errori di rete del meteo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    await expect(fetchWeatherByCoords(12.3456, 65.4321)).rejects.toMatchObject({
      userTitle: 'Connessione assente',
      userMessage: 'Non riesco a contattare il servizio meteo. Verifica internet e riprova.',
      canRetry: true
    });
  });

  it('riusa il weather salvato in localStorage dopo un refresh logico', async () => {
    const payload = {
      current: {
        time: '2026-04-02T19:15',
        temperature_2m: 21,
        weather_code: 1,
        wind_speed_10m: 12,
        wind_direction_10m: 45,
        relative_humidity_2m: 58,
        is_day: 1
      },
      daily: {
        time: ['2026-04-02', '2026-04-03'],
        weather_code: [1, 3],
        temperature_2m_max: [24, 22],
        temperature_2m_min: [15, 14],
        precipitation_probability_max: [10, 40]
      },
      hourly: {
        time: ['2026-04-02T19:00'],
        temperature_2m: [21],
        weather_code: [1],
        is_day: [1],
        precipitation_probability: [10]
      }
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstResult = await fetchWeatherByCoords(41.9028, 12.4964);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.resetModules();
    const reloadedModule = await import('../js/api/weatherApi.js');

    const secondResult = await reloadedModule.fetchWeatherByCoords(41.9028, 12.4964);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(secondResult).toEqual(firstResult);
  });

  it('mostra dati meteo stale dalla cache persistente se la rete fallisce', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    const payload = {
      current: {
        time: '2026-04-20T12:00',
        temperature_2m: 19,
        weather_code: 2,
        wind_speed_10m: 8,
        wind_direction_10m: 90,
        relative_humidity_2m: 50,
        is_day: 1
      },
      daily: {
        time: ['2026-04-20', '2026-04-21'],
        weather_code: [2, 3],
        temperature_2m_max: [21, 20],
        temperature_2m_min: [12, 11],
        precipitation_probability_max: [0, 30]
      },
      hourly: {
        time: ['2026-04-20T12:00'],
        temperature_2m: [19],
        weather_code: [2],
        is_day: [1],
        precipitation_probability: [0]
      }
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });
    vi.stubGlobal('fetch', fetchMock);

    const freshResult = await fetchWeatherByCoords(10.1234, 20.5678);
    expect(freshResult.meta.isStale).toBe(false);

    vi.advanceTimersByTime(3 * 60 * 1000 + 1);
    fetchMock.mockRejectedValue(new TypeError('network down'));

    const staleResult = await fetchWeatherByCoords(10.1234, 20.5678);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(staleResult.current.temperature).toBe(19);
    expect(staleResult.meta.updatedAt).toBe(freshResult.meta.updatedAt);
    expect(staleResult.meta.isStale).toBe(true);
  });
});
