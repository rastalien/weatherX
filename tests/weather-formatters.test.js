import { describe, expect, it } from 'vitest';
import { formatHour, formatWeekday } from '../js/features/weather/dates.js';
import { getWeatherDescription, getWeatherIcon } from '../js/features/weather/maps.js';
import { getWeatherTheme } from '../js/features/weather/theme.js';
import {
  convertTemperature,
  formatTemperature,
  formatWindDirection,
  formatWindSpeed,
  TEMPERATURE_UNITS
} from '../js/features/weather/units.js';

describe('weather formatters', () => {
  it('converte e formatta correttamente le temperature', () => {
    expect(convertTemperature(0, TEMPERATURE_UNITS.FAHRENHEIT)).toBe(32);
    expect(formatTemperature(20)).toBe('20°C');
    expect(formatTemperature(20, { unit: TEMPERATURE_UNITS.FAHRENHEIT, rounded: true })).toBe('68°F');
  });

  it('formatta direzione e velocita del vento', () => {
    expect(formatWindDirection(90)).toBe('E');
    expect(formatWindDirection(225)).toBe('SO');
    expect(formatWindSpeed(10)).toBe('10 km/h');
    expect(formatWindSpeed(10, TEMPERATURE_UNITS.FAHRENHEIT)).toBe('6 mph');
  });

  it('formatta ore, giorni e tema meteo', () => {
    expect(formatHour('2026-04-02T18:35')).toBe('18:35');
    expect(formatWeekday('2026-04-02')).not.toBe('--');
    expect(getWeatherTheme({ time: '2026-04-02T19:15', isDay: true })).toBe('evening');
    expect(getWeatherTheme({ time: '2026-04-02T23:10', isDay: false })).toBe('night');
  });

  it('copre anche i codici meteo estesi di Open-Meteo', () => {
    expect(getWeatherDescription(0)).toBe('Soleggiato');
    expect(getWeatherDescription(0, false)).toBe('Sereno');
    expect(getWeatherDescription(67)).toBe('Pioggia gelata');
    expect(getWeatherDescription(99)).toBe('Temporale con grandine');
    expect(getWeatherIcon(77)).toBe('❄️');
    expect(getWeatherIcon(96)).toBe('⛈️');
  });
});
