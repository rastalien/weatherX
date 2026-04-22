import { formatHour, formatWeekday } from '../features/weather/dates.js';
import {
  getDetailedWeatherDescription,
  getWeatherDescription,
  getWeatherIcon
} from '../features/weather/maps.js';
import { formatTemperature } from '../features/weather/units.js';

const MAX_HOURLY_ITEMS = 24;

function formatPrecipitationBadge(probability) {
  return probability > 0 ? `💧 ${probability}%` : '';
}

function getDailyTemperatureScale(items) {
  const minValues = items.map((item) => item.minTemp).filter((value) => typeof value === 'number');
  const maxValues = items.map((item) => item.maxTemp).filter((value) => typeof value === 'number');
  const globalMin = Math.min(...minValues);
  const globalMax = Math.max(...maxValues);

  if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
    return null;
  }

  return {
    min: globalMin,
    // `spread` non va mai a zero: anche con temperature quasi identiche
    // manteniamo una barra visibile e una formula stabile per il rendering.
    max: globalMax,
    spread: Math.max(1, globalMax - globalMin)
  };
}

function renderTemperatureRange(minTemp, maxTemp, temperatureUnit, scale) {
  // La barra mostra il range del giorno rispetto agli altri giorni visibili,
  // cosi il confronto tra minime e massime diventa davvero utile.
  const range = document.createElement('div');
  range.className = 'daily-forecast-temps';

  const min = document.createElement('span');
  min.className = 'daily-forecast-temp-min';
  min.textContent = formatTemperature(minTemp, { unit: temperatureUnit, rounded: true, showUnit: false });

  const track = document.createElement('div');
  track.className = 'daily-forecast-temp-track';
  track.setAttribute(
    'aria-label',
    `Intervallo termico tra ${formatTemperature(minTemp, { unit: temperatureUnit, rounded: true })} e ${formatTemperature(maxTemp, { unit: temperatureUnit, rounded: true })}`
  );

  const pill = document.createElement('span');
  pill.className = 'daily-forecast-temp-pill';
  if (scale) {
    const start = ((minTemp - scale.min) / scale.spread) * 100;
    const width = Math.max(10, ((maxTemp - minTemp) / scale.spread) * 100);
    pill.style.left = `${start}%`;
    pill.style.width = `${width}%`;
  }
  track.appendChild(pill);

  const max = document.createElement('span');
  max.className = 'daily-forecast-temp-max';
  max.textContent = formatTemperature(maxTemp, { unit: temperatureUnit, rounded: true, showUnit: false });

  range.appendChild(min);
  range.appendChild(track);
  range.appendChild(max);
  return range;
}

function getCurrentForecastItem(data, currentTime) {
  if (data.current && data.current.temperature !== undefined && data.current.weatherCode !== undefined) {
    // La sezione oraria parte sempre dal "presente", anche se l'API oraria
    // ha il primo slot utile qualche minuto o un'ora dopo.
    return {
      label: 'Adesso',
      time: currentTime,
      temperature: data.current.temperature,
      weatherCode: data.current.weatherCode,
      isDay: data.current.isDay,
      precipitationProbability: null
    };
  }

  return null;
}

export function getUpcomingHourlyForecast(data) {
  const currentTime = data.current?.time;
  const hourlyItems = Array.isArray(data.hourly) ? data.hourly : [];

  if (!currentTime || hourlyItems.length === 0) {
    return [];
  }

  const firstUpcomingIndex = hourlyItems.findIndex((item) => item.time >= currentTime);
  if (firstUpcomingIndex === -1) {
    return [];
  }

  const items = [];
  const currentForecast = getCurrentForecastItem(data, currentTime);

  // Inseriamo prima lo stato attuale, cosi la sezione ha un punto di partenza chiaro.
  if (currentForecast) {
    items.push(currentForecast);
  }

  // La vista oraria copre una giornata intera. Se mostriamo "Adesso",
  // riserviamo il resto dello spazio ai prossimi slot futuri.
  const remainingSlots = Math.max(0, MAX_HOURLY_ITEMS - items.length);
  const upcomingItems = hourlyItems.slice(firstUpcomingIndex, firstUpcomingIndex + remainingSlots).map((item) => ({
    label: formatHour(item.time),
    time: item.time,
    temperature: item.temperature,
    weatherCode: item.weatherCode,
    isDay: item.isDay,
    precipitationProbability: item.precipitationProbability
  }));

  return items.concat(upcomingItems);
}

export function renderHourlyForecast(items, temperatureUnit) {
  const card = document.createElement('section');
  card.className = 'hourly-card';
  card.setAttribute('aria-label', 'Previsione oraria');

  const header = document.createElement('div');
  header.className = 'forecast-header';

  const title = document.createElement('h2');
  title.className = 'forecast-title';
  title.textContent = 'Meteo prossime ore';

  const list = document.createElement('div');
  list.className = 'hourly-track';
  list.tabIndex = 0;
  list.setAttribute('role', 'list');
  list.setAttribute(
    'aria-label',
    'Previsione oraria scorrevole. Usa la rotella, il touchpad o scorri orizzontalmente per vedere altre ore.'
  );

  items.forEach((item) => {
    // Le card orarie sono volutamente compatte: ora, icona, temperatura
    // e probabilita di pioggia quando disponibile.
    // Anche qui la conversione avviene solo in fase di output.
    const slot = document.createElement('div');
    slot.className = 'hourly-item';
    if (item.label === 'Adesso') {
      slot.classList.add('is-current');
    }
    slot.setAttribute('role', 'listitem');

    const time = document.createElement('div');
    time.className = 'hourly-time';
    time.textContent = item.label || formatHour(item.time);

    const icon = document.createElement('div');
    icon.className = 'hourly-icon';
    icon.textContent = getWeatherIcon(item.weatherCode, item.isDay);
    icon.setAttribute('aria-hidden', 'true');

    const temp = document.createElement('div');
    temp.className = 'hourly-temp';
    temp.textContent = formatTemperature(item.temperature, {
      unit: temperatureUnit,
      rounded: true,
      showUnit: false
    });

    const precip = document.createElement('div');
    precip.className = 'hourly-precip';
    precip.textContent = formatPrecipitationBadge(item.precipitationProbability);

    if (precip.textContent) {
      precip.classList.add('hourly-precip-badge');
    }

    const slotLabel = [
      item.label || formatHour(item.time),
      getWeatherDescription(item.weatherCode, item.isDay),
      `temperatura ${formatTemperature(item.temperature, { unit: temperatureUnit, rounded: true })}`,
      item.precipitationProbability > 0 ? `probabilita di pioggia ${item.precipitationProbability}%` : ''
    ].filter(Boolean).join(', ');
    slot.setAttribute('aria-label', slotLabel);

    slot.appendChild(time);
    slot.appendChild(icon);
    slot.appendChild(temp);
    slot.appendChild(precip);
    list.appendChild(slot);
  });

  header.appendChild(title);
  card.appendChild(header);
  card.appendChild(list);
  return card;
}

export function renderDailyForecast(items, temperatureUnit) {
  const section = document.createElement('section');
  section.className = 'daily-forecast';
  // Calcoliamo una scala comune a tutti i giorni visibili, cosi le barre
  // min/max sono confrontabili tra loro e non solo dentro la singola riga.
  const temperatureScale = getDailyTemperatureScale(items);

  const title = document.createElement('h2');
  title.className = 'daily-forecast-title';
  title.textContent = 'Meteo prossimi giorni';
  const list = document.createElement('div');
  list.className = 'daily-forecast-list';

  items.forEach((item, index) => {
    // Ogni riga e divisa in tre zone:
    // 1. giorno
    // 2. riassunto visivo con icona, probabilita e descrizione
    // 3. barra termica con minimo e massimo
    const dayCard = document.createElement('article');
    dayCard.className = 'daily-forecast-row';
    if (index === 0) {
      dayCard.classList.add('is-primary');
    }
    const chanceLabel = item.precipitationProbability > 0 ? `, probabilita di pioggia ${item.precipitationProbability}%` : '';
    dayCard.setAttribute(
      'aria-label',
      `${formatWeekday(item.time, 'it-IT', 'long')}, ${getWeatherDescription(item.weatherCode, true)}, minima ${formatTemperature(item.minTemp, {
        unit: temperatureUnit,
        rounded: true
      })}, massima ${formatTemperature(item.maxTemp, {
        unit: temperatureUnit,
        rounded: true
      })}${chanceLabel}`
    );

    const dayIntro = document.createElement('div');
    dayIntro.className = 'daily-forecast-intro';

    const dayLabel = document.createElement('div');
    dayLabel.className = 'daily-forecast-day';
    const dayLabelFull = document.createElement('span');
    dayLabelFull.className = 'daily-forecast-day-full';
    dayLabelFull.textContent = formatWeekday(item.time, 'it-IT', 'long');

    const dayLabelShort = document.createElement('span');
    dayLabelShort.className = 'daily-forecast-day-short';
    dayLabelShort.textContent = formatWeekday(item.time, 'it-IT', 'short');

    dayLabel.appendChild(dayLabelFull);
    dayLabel.appendChild(dayLabelShort);

    const daySummary = document.createElement('div');
    daySummary.className = 'daily-forecast-summary';

    const visual = document.createElement('div');
    visual.className = 'daily-forecast-visual';

    const icon = document.createElement('div');
    icon.className = 'daily-forecast-icon';
    icon.textContent = getWeatherIcon(item.weatherCode, true);
    icon.setAttribute('aria-hidden', 'true');

    const description = document.createElement('div');
    description.className = 'daily-forecast-description small';
    const descriptionFull = document.createElement('span');
    descriptionFull.className = 'daily-forecast-description-full';
    descriptionFull.textContent = getDetailedWeatherDescription(item.weatherCode, true);

    const descriptionShort = document.createElement('span');
    descriptionShort.className = 'daily-forecast-description-short';
    descriptionShort.textContent = getWeatherDescription(item.weatherCode, true);

    description.appendChild(descriptionFull);
    description.appendChild(descriptionShort);

    const info = document.createElement('div');
    info.className = 'daily-forecast-info';

    const precip = document.createElement('div');
    precip.className = 'daily-forecast-chance small';
    precip.textContent = formatPrecipitationBadge(item.precipitationProbability);
    if (!precip.textContent) {
      precip.classList.add('is-empty');
      precip.textContent = '💧 --';
      precip.setAttribute('aria-hidden', 'true');
    }

    const temps = renderTemperatureRange(item.minTemp, item.maxTemp, temperatureUnit, temperatureScale);

    const meta = document.createElement('div');
    meta.className = 'daily-forecast-meta';

    visual.appendChild(icon);
    dayIntro.appendChild(dayLabel);
    info.appendChild(description);
    info.appendChild(precip);
    daySummary.appendChild(visual);
    daySummary.appendChild(info);
    meta.appendChild(temps);

    dayCard.appendChild(dayIntro);
    dayCard.appendChild(daySummary);
    dayCard.appendChild(meta);
    list.appendChild(dayCard);
  });

  section.appendChild(title);
  section.appendChild(list);
  return section;
}
