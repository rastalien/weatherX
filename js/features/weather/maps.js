// Tabella compatta che traduce i codici meteo Open-Meteo in icone UI.
// Alcuni codici hanno una variante diversa tra giorno e notte.
const WEATHER_ICON_MAP = {
  0: { day: '\u2600\uFE0F', night: '\uD83C\uDF19' },
  1: { day: '\uD83C\uDF24\uFE0F', night: '\uD83C\uDF19' },
  2: { day: '\u26C5', night: '\u2601\uFE0F' },
  3: '\u2601\uFE0F',
  45: '\uD83C\uDF2B\uFE0F',
  48: '\uD83C\uDF2B\uFE0F',
  51: '\uD83C\uDF26\uFE0F',
  53: '\uD83C\uDF26\uFE0F',
  55: '\uD83C\uDF26\uFE0F',
  56: '\uD83C\uDF27\uFE0F',
  57: '\uD83C\uDF27\uFE0F',
  61: '\uD83C\uDF27\uFE0F',
  63: '\uD83C\uDF27\uFE0F',
  65: '\uD83C\uDF27\uFE0F',
  66: '\uD83C\uDF27\uFE0F',
  67: '\uD83C\uDF27\uFE0F',
  71: '\uD83C\uDF28\uFE0F',
  73: '\uD83C\uDF28\uFE0F',
  75: '\uD83C\uDF28\uFE0F',
  77: '\u2744\uFE0F',
  80: '\uD83C\uDF26\uFE0F',
  81: '\uD83C\uDF26\uFE0F',
  82: '\uD83C\uDF26\uFE0F',
  85: '\uD83C\uDF28\uFE0F',
  86: '\uD83C\uDF28\uFE0F',
  95: '\u26C8\uFE0F',
  96: '\u26C8\uFE0F',
  99: '\u26C8\uFE0F'
};

const WEATHER_DESCRIPTION_MAP = {
  0: 'Soleggiato',
  1: 'Sereno',
  2: 'Poco nuvoloso',
  3: 'Coperto',
  45: 'Nebbia',
  48: 'Nebbia gelata',
  51: 'Pioviggine',
  53: 'Pioviggine',
  55: 'Pioviggine',
  56: 'Pioviggine gelata',
  57: 'Pioviggine gelata',
  61: 'Pioggia',
  63: 'Pioggia',
  65: 'Pioggia',
  66: 'Pioggia gelata',
  67: 'Pioggia gelata',
  71: 'Neve',
  73: 'Neve',
  75: 'Neve',
  77: 'Neve granulosa',
  80: 'Rovesci',
  81: 'Rovesci',
  82: 'Rovesci',
  85: 'Rovesci di neve',
  86: 'Rovesci di neve',
  95: 'Temporale',
  96: 'Temporale con grandine',
  99: 'Temporale con grandine'
};

// Le descrizioni dettagliate devono restare semanticamente allineate
// alla mappa compatta: cambia il livello di dettaglio, non il significato.
const WEATHER_DESCRIPTION_DETAILED_MAP = {
  0: 'Cielo soleggiato',
  1: 'Cielo in prevalenza sereno',
  2: 'Cielo poco nuvoloso',
  3: 'Cielo coperto',
  45: 'Banchi di nebbia',
  48: 'Nebbia con brina',
  51: 'Pioviggine debole',
  53: 'Pioviggine moderata',
  55: 'Pioviggine intensa',
  56: 'Pioviggine gelata debole',
  57: 'Pioviggine gelata intensa',
  61: 'Pioggia debole',
  63: 'Pioggia moderata',
  65: 'Pioggia intensa',
  66: 'Pioggia gelata debole',
  67: 'Pioggia gelata intensa',
  71: 'Nevicate deboli',
  73: 'Nevicate moderate',
  75: 'Neve intensa',
  77: 'Neve granulosa',
  80: 'Rovesci di pioggia deboli',
  81: 'Rovesci di pioggia moderati',
  82: 'Rovesci di pioggia intensi',
  85: 'Rovesci di neve deboli',
  86: 'Rovesci di neve intensi',
  95: 'Temporali isolati',
  96: 'Temporali con grandine debole',
  99: 'Temporali con grandine intensa'
};

const DEFAULT_WEATHER_DESCRIPTION = 'Condizioni variabili';

export function getWeatherIcon(code, isDay = true) {
  const icon = WEATHER_ICON_MAP[code];
  // Fallback neutro nel caso in cui l'API introduca un codice non ancora mappato.
  if (!icon) return '\uD83D\uDCE1';

  if (typeof icon === 'string') {
    return icon;
  }

  return isDay ? icon.day : icon.night;
}

export function getWeatherDescription(code, isDay = true) {
  if (code === 0) {
    return isDay ? 'Soleggiato' : 'Sereno';
  }

  // Il testo di default evita stringhe vuote anche con codici sconosciuti.
  return WEATHER_DESCRIPTION_MAP[code] || DEFAULT_WEATHER_DESCRIPTION;
}

export function getDetailedWeatherDescription(code, isDay = true) {
  if (code === 0) {
    return isDay ? 'Cielo soleggiato' : 'Cielo sereno';
  }

  // In fallback riusiamo la descrizione compatta per evitare divergenze.
  return WEATHER_DESCRIPTION_DETAILED_MAP[code] || getWeatherDescription(code, isDay);
}
