export const TEMPERATURE_UNITS = {
  CELSIUS: 'celsius',
  FAHRENHEIT: 'fahrenheit'
};

export function formatWindDirection(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';

  // Usiamo 8 direzioni cardinali principali per evitare di mostrare gradi
  // poco leggibili per un utente finale.
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const normalized = ((value % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % directions.length;
  return directions[index];
}

export function convertTemperature(value, unit = TEMPERATURE_UNITS.CELSIUS) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (unit === TEMPERATURE_UNITS.FAHRENHEIT) {
    // Convertiamo solo al momento del rendering, cosi i dati originali
    // restano sempre nello stesso formato interno in tutta l'app.
    return (value * 9) / 5 + 32;
  }

  return value;
}

export function formatTemperature(
  value,
  { unit = TEMPERATURE_UNITS.CELSIUS, rounded = false, showUnit = true } = {}
) {
  const convertedValue = convertTemperature(value, unit);
  if (convertedValue === null) {
    return showUnit ? `--${getTemperatureUnitSymbol(unit)}` : '--';
  }

  const displayValue = rounded
    ? Math.round(convertedValue)
    : Number.isInteger(convertedValue)
      ? convertedValue
      : Number(convertedValue.toFixed(1));

  // `showUnit: false` e utile quando il contesto visivo rende gia chiara
  // l'unita, come nel caso del toggle globale °C / °F.
  return showUnit ? `${displayValue}${getTemperatureUnitSymbol(unit)}` : `${displayValue}\u00B0`;
}

export function getTemperatureUnitSymbol(unit = TEMPERATURE_UNITS.CELSIUS) {
  return unit === TEMPERATURE_UNITS.FAHRENHEIT ? '\u00B0F' : '\u00B0C';
}

export function formatWindSpeed(value, unit = TEMPERATURE_UNITS.CELSIUS) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-- km/h';
  }

  if (unit === TEMPERATURE_UNITS.FAHRENHEIT) {
    // Quando l'utente sceglie Fahrenheit adattiamo anche la velocita del vento
    // a mph, cosi il toggle resta coerente con l'aspettativa locale.
    const mphValue = Math.round(value * 0.621371);
    return `${mphValue} mph`;
  }

  return `${Math.round(value)} km/h`;
}
