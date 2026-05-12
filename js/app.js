import { CONFIG } from './config.js';
import { formatPlace, formatReversePlace, dedupePlaces } from './shared/place.js';
import { geocodeLocation, reverseGeocodeCoords, fetchWeatherByCoords } from './api/weatherApi.js';
import {
  renderWeather,
  renderLocationChoices,
  renderError,
  renderLoading,
  renderWelcome,
  renderSuggestions,
  clearSuggestions
} from './ui/index.js';
import { getUserErrorMessage, getUserErrorTitle } from './shared/errors.js';
import { TEMPERATURE_UNITS } from './features/weather/units.js';
import { clearSavedResolvedPlace, loadSavedResolvedPlace, saveResolvedPlace } from './shared/last-place.js';
import { isFavoritePlace, loadFavoritePlaces, saveFavoritePlaces, toggleFavoritePlace } from './shared/favorites.js';
import { createAutocompleteController } from './controllers/autocomplete-controller.js';
import { createFavoritesController } from './controllers/favorites-controller.js';
import { createSearchController } from './controllers/search-controller.js';

const form = document.getElementById(CONFIG.SELECTORS.form);
const input = document.getElementById(CONFIG.SELECTORS.input);
const searchButton = document.getElementById(CONFIG.SELECTORS.searchButton);
const geolocationButton = document.getElementById(CONFIG.SELECTORS.geolocationButton);
const unitToggle = document.getElementById(CONFIG.SELECTORS.unitToggle);
const root = document.getElementById(CONFIG.SELECTORS.weatherRoot);
const favoritesRoot = document.getElementById(CONFIG.SELECTORS.favoritesRoot);
const mobileFavoritesRoot = document.getElementById(CONFIG.SELECTORS.mobileFavoritesRoot);
const feedbackRoot = document.getElementById(CONFIG.SELECTORS.feedbackRoot);
const suggestionsRoot = document.getElementById('location-suggestions');
const unitButtons = unitToggle ? Array.from(unitToggle.querySelectorAll('[data-unit]')) : [];
const TEMPERATURE_UNIT_STORAGE_KEY = 'weatherx.temperatureUnit';

let temperatureUnit = TEMPERATURE_UNITS.CELSIUS;
let feedbackTimer = null;
let searchController = null;

function createBootstrapError(message) {
  const error = new Error(message);
  error.canRetry = false;
  return error;
}

function getMissingBootstrapElements() {
  return [
    ['form', form],
    ['input', input],
    ['searchButton', searchButton],
    ['root', root]
  ].filter(([, element]) => !element).map(([name]) => name);
}

function assertBootstrapReady() {
  const missingElements = getMissingBootstrapElements();
  if (missingElements.length > 0) {
    throw createBootstrapError(
      `Bootstrap incompleto: mancano elementi DOM obbligatori (${missingElements.join(', ')}).`
    );
  }
}

function loadSavedTemperatureUnit() {
  try {
    const savedUnit = window.localStorage.getItem(TEMPERATURE_UNIT_STORAGE_KEY);
    if (savedUnit === TEMPERATURE_UNITS.CELSIUS || savedUnit === TEMPERATURE_UNITS.FAHRENHEIT) {
      return savedUnit;
    }
  } catch (err) {
    console.warn('Impossibile leggere la preferenza unita dal browser.', err);
  }

  return TEMPERATURE_UNITS.CELSIUS;
}

function saveTemperatureUnit(unit) {
  try {
    window.localStorage.setItem(TEMPERATURE_UNIT_STORAGE_KEY, unit);
  } catch (err) {
    console.warn('Impossibile salvare la preferenza unita nel browser.', err);
  }
}

function showFeedback(message) {
  if (!feedbackRoot) {
    return;
  }

  if (feedbackTimer) {
    window.clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }

  feedbackRoot.textContent = message;
  feedbackRoot.classList.add('is-visible');

  feedbackTimer = window.setTimeout(() => {
    feedbackRoot.classList.remove('is-visible');
  }, 2200);
}

function updateSearchButtonLabel() {
  if (!input || !searchButton) {
    return;
  }

  const hasTypedQuery = input.value.trim().length > 0;
  const canRefresh = !hasTypedQuery && searchController?.getCurrentPlace();
  searchButton.textContent = canRefresh ? 'Aggiorna' : 'Cerca';
}

function updateUnitToggle() {
  unitButtons.forEach((button) => {
    const isActive = button.dataset.unit === temperatureUnit;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function bindUnitToggle() {
  if (!unitToggle) {
    return;
  }

  unitToggle.addEventListener('click', (event) => {
    const target = event.target.closest('[data-unit]');
    if (!target) return;

    const nextUnit = target.dataset.unit;
    if (!nextUnit || nextUnit === temperatureUnit) return;

    temperatureUnit = nextUnit;
    saveTemperatureUnit(temperatureUnit);
    updateUnitToggle();

    if (searchController?.hasWeather()) {
      searchController.renderCurrentWeather();
    }
  });
}

function createControllers() {
  let favoritesController = null;

  // Le callback referenziano searchController solo dopo il bootstrap:
  // cosi evitiamo dipendenze circolari tra moduli e manteniamo il wiring in app.js.
  const autocompleteController = createAutocompleteController({
    input,
    suggestionsRoot,
    geocodeLocation,
    dedupePlaces,
    renderSuggestions,
    clearSuggestions,
    onSelect: (place) => {
      void searchController.handleSuggestionSelection(place);
    }
  });

  favoritesController = createFavoritesController({
    favoritesRoot,
    mobileFavoritesRoot,
    loadFavoritePlaces,
    saveFavoritePlaces,
    isFavoritePlace,
    toggleFavoritePlace,
    getCurrentPlace: () => searchController?.getCurrentPlace(),
    onSelect: (place) => searchController.handlePlaceSelection(place),
    onChange: () => {
      if (searchController?.hasWeather()) {
        searchController.renderCurrentWeather();
      }
    },
    showFeedback
  });

  searchController = createSearchController({
    form,
    input,
    root,
    geolocationButton,
    geocodeLocation,
    reverseGeocodeCoords,
    fetchWeatherByCoords,
    formatPlace,
    formatReversePlace,
    dedupePlaces,
    clearSavedResolvedPlace,
    loadSavedResolvedPlace,
    saveResolvedPlace,
    renderWeather,
    renderLocationChoices,
    renderError,
    renderLoading,
    renderWelcome,
    getUserErrorMessage,
    getUserErrorTitle,
    getTemperatureUnit: () => temperatureUnit,
    favoritesController,
    autocompleteController,
    showFeedback,
    updateSearchButtonLabel
  });

  return {
    autocompleteController,
    favoritesController,
    searchController
  };
}

async function bootstrapApp() {
  try {
    assertBootstrapReady();
    temperatureUnit = loadSavedTemperatureUnit();

    const controllers = createControllers();
    controllers.favoritesController.init();
    updateSearchButtonLabel();
    updateUnitToggle();
    bindUnitToggle();
    controllers.searchController.bindEventListeners();
    await controllers.searchController.loadInitialWeather();
  } catch (err) {
    console.error(err);

    if (root) {
      renderError(root, getUserErrorMessage(err), null, getUserErrorTitle(err));
    }
  }
}

bootstrapApp();
