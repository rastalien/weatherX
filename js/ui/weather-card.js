import {
  getDetailedWeatherDescription,
  getWeatherDescription,
  getWeatherIcon
} from '../features/weather/maps.js';
import {
  formatTemperature,
  formatWindDirection,
  formatWindSpeed,
  TEMPERATURE_UNITS
} from '../features/weather/units.js';
import { applyWeatherTheme } from '../features/weather/theme.js';
import { getUpcomingHourlyForecast, renderDailyForecast, renderHourlyForecast } from './forecast.js';

function createDetailItem(label, value) {
  const item = document.createElement('div');
  item.className = 'detail-item';

  const title = document.createElement('span');
  title.className = 'detail-label';
  title.textContent = label;

  const text = document.createElement('strong');
  text.className = 'detail-value';
  text.textContent = value;

  item.appendChild(title);
  item.appendChild(text);
  return item;
}

export function renderWeather(root, data, placeLabel, options = {}) {
  // Svuotiamo il contenitore per sostituire l'eventuale risultato precedente.
  root.innerHTML = '';
  // Il toggle passa qui l'unita scelta, ma il payload `data` resta invariato.
  // In questo modo possiamo cambiare visualizzazione senza toccare la logica API.
  const temperatureUnit = options.temperatureUnit || TEMPERATURE_UNITS.CELSIUS;
  const shouldFocusCard = options.focusOnRender === true;
  const card = document.createElement('section');
  card.className = 'card';
  card.setAttribute('aria-label', `Meteo attuale per ${placeLabel}`);
  card.tabIndex = -1;
  const currentWeather = data.current;
  applyWeatherTheme(currentWeather);
  const weatherDescription = getWeatherDescription(currentWeather.weatherCode, currentWeather.isDay);
  const humidity = currentWeather.humidity;
  const maxTemp = data.daily?.maxTemp;
  const minTemp = data.daily?.minTemp;

  // Layout principale della card: riepilogo meteo centrato con temperatura,
  // icona, descrizione e dettagli secondari nello stesso blocco.
  const row = document.createElement('div');
  row.className = 'row weather-main';

  const col1 = document.createElement('div');
  col1.className = 'weather-main-content';
  const place = document.createElement('div');
  place.className = 'place-label';
  place.textContent = placeLabel;

  const currentLabel = document.createElement('div');
  currentLabel.className = 'current-label';
  currentLabel.textContent = 'Condizioni attuali';

  const headline = document.createElement('div');
  headline.className = 'weather-headline';

  const temp = document.createElement('div');
  temp.className = 'temp';
  temp.textContent = formatTemperature(currentWeather.temperature, {
    unit: temperatureUnit,
    rounded: true,
    showUnit: false
  });

  const icon = document.createElement('span');
  icon.className = 'weather-icon';
  icon.textContent = getWeatherIcon(currentWeather.weatherCode, currentWeather.isDay);
  icon.setAttribute('aria-hidden', 'true');

  const description = document.createElement('div');
  description.className = 'weather-description';
  const descriptionFull = document.createElement('span');
  descriptionFull.className = 'weather-description-full';
  descriptionFull.textContent = getDetailedWeatherDescription(currentWeather.weatherCode, currentWeather.isDay);

  const descriptionShort = document.createElement('span');
  descriptionShort.className = 'weather-description-short';
  descriptionShort.textContent = weatherDescription;

  description.appendChild(descriptionFull);
  description.appendChild(descriptionShort);

  const summary = document.createElement('div');
  summary.className = 'summary-row';

  const wind = document.createElement('div');
  wind.className = 'small weather-wind';
  const windDirection = formatWindDirection(currentWeather.windDirection);
  const windSpeed = formatWindSpeed(currentWeather.windSpeed, temperatureUnit);
  wind.textContent = windDirection
    ? `Vento ${windSpeed} ${windDirection}`
    : `Vento ${windSpeed}`;

  const details = document.createElement('div');
  details.className = 'details-grid';

  if (maxTemp !== null) {
    details.appendChild(createDetailItem('Max', formatTemperature(maxTemp, {
      unit: temperatureUnit,
      rounded: true,
      showUnit: false
    })));
  }

  if (minTemp !== null) {
    details.appendChild(createDetailItem('Min', formatTemperature(minTemp, {
      unit: temperatureUnit,
      rounded: true,
      showUnit: false
    })));
  }

  if (humidity !== null) {
    details.appendChild(createDetailItem('Umidita', `${humidity}%`));
  }

  col1.appendChild(place);
  col1.appendChild(currentLabel);
  headline.appendChild(icon);
  headline.appendChild(temp);
  col1.appendChild(headline);
  summary.appendChild(description);
  col1.appendChild(summary);
  col1.appendChild(wind);
  if (details.childElementCount > 0) {
    col1.appendChild(details);
  }

  row.appendChild(col1);
  card.appendChild(row);

  const hourlyForecast = getUpcomingHourlyForecast(data);
  if (hourlyForecast.length > 0) {
    card.appendChild(renderHourlyForecast(hourlyForecast, temperatureUnit));
  }

  const dailyForecast = Array.isArray(data.daily?.forecast) ? data.daily.forecast : [];
  if (dailyForecast.length > 0) {
    card.appendChild(renderDailyForecast(dailyForecast, temperatureUnit));
  }

  root.appendChild(card);
  if (shouldFocusCard) {
    card.focus();
  }
}
