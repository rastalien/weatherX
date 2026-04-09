function extractHourFromIso(value) {
  if (typeof value !== 'string') return null;
  const [, timePart = ''] = value.split('T');
  const hour = Number.parseInt(timePart.slice(0, 2), 10);
  return Number.isNaN(hour) ? null : hour;
}

export function getWeatherTheme(currentWeather) {
  const hour = extractHourFromIso(currentWeather?.time);
  const isDay = currentWeather?.isDay === true;

  if (hour !== null && hour >= 18 && hour < 21) {
    return 'evening';
  }

  if (!isDay || hour === null || hour >= 21 || hour < 6) {
    return 'night';
  }

  return 'day';
}

export function applyWeatherTheme(currentWeather) {
  const theme = getWeatherTheme(currentWeather);
  if (document.documentElement.dataset.theme !== theme) {
    document.documentElement.dataset.theme = theme;
  }
  return theme;
}
