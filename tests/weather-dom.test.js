// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { getUpcomingHourlyForecast, renderWeather } from '../js/ui/index.js';
import { TEMPERATURE_UNITS } from '../js/features/weather/units.js';

const sampleWeatherData = {
  current: {
    time: '2026-04-02T19:15',
    temperature: 21,
    weatherCode: 1,
    windSpeed: 12,
    windDirection: 45,
    isDay: true,
    humidity: 58
  },
  daily: {
    maxTemp: 24,
    minTemp: 15,
    forecast: [
      {
        time: '2026-04-03',
        weatherCode: 3,
        maxTemp: 22,
        minTemp: 14,
        precipitationProbability: 40
      },
      {
        time: '2026-04-04',
        weatherCode: 61,
        maxTemp: 18,
        minTemp: 12,
        precipitationProbability: 70
      }
    ]
  },
  hourly: [
    { time: '2026-04-02T19:00', temperature: 21, weatherCode: 1, isDay: true, precipitationProbability: 10 },
    { time: '2026-04-02T20:00', temperature: 20, weatherCode: 2, isDay: false, precipitationProbability: 20 },
    { time: '2026-04-02T21:00', temperature: 18, weatherCode: 3, isDay: false, precipitationProbability: 0 }
  ]
};

afterEach(() => {
  document.body.innerHTML = '';
  delete document.documentElement.dataset.theme;
});

describe('weather DOM rendering', () => {
  it('limita la vista oraria a 24 elementi complessivi', () => {
    const hourly = Array.from({ length: 30 }, (_, index) => ({
      time: `2026-04-${String(index < 5 ? 2 : 3).padStart(2, '0')}T${String((index + 20) % 24).padStart(2, '0')}:00`,
      temperature: 20 - (index % 5),
      weatherCode: 2,
      isDay: index < 3,
      precipitationProbability: index
    }));

    const forecast = getUpcomingHourlyForecast({
      current: sampleWeatherData.current,
      hourly
    });

    expect(forecast).toHaveLength(24);
    expect(forecast[0]?.label).toBe('Adesso');
  });

  it('renderizza la card principale con luogo, temperatura e dettagli', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    renderWeather(root, sampleWeatherData, 'Roma, Lazio, Italia');

    expect(root.querySelector('.card')).not.toBeNull();
    expect(root.querySelector('.place-label')?.textContent).toBe('Roma, Lazio, Italia');
    expect(root.querySelector('.temp')?.textContent).toBe('21°');
    expect(root.textContent).toContain('Umidita');
    expect(root.textContent).toContain('Vento 12 km/h NE');
    expect(document.documentElement.dataset.theme).toBe('evening');
  });

  it('renderizza le sezioni oraria e giornaliera con gli elementi attesi', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    renderWeather(root, sampleWeatherData, 'Roma, Lazio, Italia', {
      temperatureUnit: TEMPERATURE_UNITS.FAHRENHEIT
    });

    expect(root.querySelectorAll('.hourly-item')).toHaveLength(3);
    expect(root.querySelectorAll('.daily-forecast-row')).toHaveLength(2);
    expect(root.textContent).toContain('Meteo prossime ore');
    expect(root.textContent).toContain('Meteo prossimi giorni');
    expect(root.textContent).toContain('💧 70%');
    expect(root.textContent).toContain('Adesso');
    expect(root.querySelector('.hourly-item')?.classList.contains('is-current')).toBe(true);
    expect(root.querySelector('.daily-forecast-row')?.classList.contains('is-primary')).toBe(true);
  });
});
