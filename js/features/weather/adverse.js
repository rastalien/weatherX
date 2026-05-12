const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const HAIL_CODES = new Set([96, 99]);
const HEAVY_RAIN_CODES = new Set([65, 67, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const FREEZING_RAIN_CODES = new Set([56, 57, 66, 67]);
const FOG_CODES = new Set([45, 48]);

const HIGH_PRECIPITATION_PROBABILITY = 75;
const STRONG_WIND_SPEED_KMH = 40;
const HIGH_TEMPERATURE_C = 35;
const LOW_TEMPERATURE_C = 0;

function getRelevantWeatherCodes(data) {
  // Gli avvisi guardano condizioni attuali, prossime 24 ore e primi due giorni:
  // abbastanza vicino da essere utile nella card senza promettere allerte ufficiali.
  const currentCode = data?.current?.weatherCode;
  const hourlyCodes = Array.isArray(data?.hourly)
    ? data.hourly.slice(0, 24).map((item) => item.weatherCode)
    : [];
  const dailyCodes = Array.isArray(data?.daily?.forecast)
    ? data.daily.forecast.slice(0, 2).map((item) => item.weatherCode)
    : [];

  return [currentCode, ...hourlyCodes, ...dailyCodes].filter((code) => Number.isFinite(code));
}

function hasAnyCode(codes, codeSet) {
  return codes.some((code) => codeSet.has(code));
}

function hasHighPrecipitationProbability(data) {
  const hourlyProbability = Array.isArray(data?.hourly)
    ? data.hourly.slice(0, 24).some((item) => item.precipitationProbability >= HIGH_PRECIPITATION_PROBABILITY)
    : false;
  const dailyProbability = Array.isArray(data?.daily?.forecast)
    ? data.daily.forecast.slice(0, 2).some((item) => item.precipitationProbability >= HIGH_PRECIPITATION_PROBABILITY)
    : false;

  return hourlyProbability || dailyProbability;
}

function hasHighTemperature(data) {
  const currentTemperature = data?.current?.temperature;
  const maxTemperature = data?.daily?.maxTemp;

  return currentTemperature >= HIGH_TEMPERATURE_C || maxTemperature >= HIGH_TEMPERATURE_C;
}

function hasLowTemperature(data) {
  const currentTemperature = data?.current?.temperature;
  const minTemperature = data?.daily?.minTemp;

  return currentTemperature <= LOW_TEMPERATURE_C || minTemperature <= LOW_TEMPERATURE_C;
}

export function getAdverseWeatherAlert(data) {
  const codes = getRelevantWeatherCodes(data);

  // La priorita va dagli eventi piu immediatamente critici a quelli informativi,
  // cosi la card mostra una sola etichetta chiara quando piu condizioni coincidono.
  if (hasAnyCode(codes, HAIL_CODES)) {
    return {
      label: 'Allerta grandine',
      tone: 'danger'
    };
  }

  if (hasAnyCode(codes, THUNDERSTORM_CODES)) {
    return {
      label: 'Allerta temporali',
      tone: 'danger'
    };
  }

  if (hasAnyCode(codes, HEAVY_RAIN_CODES) || hasHighPrecipitationProbability(data)) {
    return {
      label: 'Allerta pioggia intensa',
      tone: 'warning'
    };
  }

  if (hasAnyCode(codes, FREEZING_RAIN_CODES)) {
    return {
      label: 'Allerta pioggia gelata',
      tone: 'danger'
    };
  }

  if (hasAnyCode(codes, SNOW_CODES)) {
    return {
      label: 'Allerta neve',
      tone: 'warning'
    };
  }

  if (data?.current?.windSpeed >= STRONG_WIND_SPEED_KMH) {
    return {
      label: 'Allerta vento forte',
      tone: 'warning'
    };
  }

  if (hasHighTemperature(data)) {
    return {
      label: 'Allerta caldo intenso',
      tone: 'warning'
    };
  }

  if (hasLowTemperature(data)) {
    return {
      label: 'Allerta gelo',
      tone: 'warning'
    };
  }

  if (hasAnyCode(codes, FOG_CODES)) {
    return {
      label: 'Allerta nebbia',
      tone: 'notice'
    };
  }

  return null;
}
