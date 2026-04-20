// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __test__, fetchWeatherByCoords, geocodeLocation } from '../js/api/weatherApi.js';

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
      userMessage: 'La risposta di open-meteo non e valida. Riprova tra poco.'
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
});
