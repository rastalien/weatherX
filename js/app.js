import { CONFIG } from './config.js';
import { formatPlace, dedupePlaces } from './shared/place.js';
import { geocodeLocation, fetchWeatherByCoords } from './api/weatherApi.js';
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

// Riferimenti agli elementi HTML che useremo per leggere input e mostrare output.
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
const AUTOCOMPLETE_MIN_CHARS = 2;
const AUTOCOMPLETE_DEBOUNCE_MS = 300;
const DESKTOP_SUGGESTION_MEDIA_QUERY = '(min-width: 721px)';

let lastSearchQuery = '';
let activeSearchId = 0;
let temperatureUnit = TEMPERATURE_UNITS.CELSIUS;
// Salviamo l'ultima localita risolta per poter aggiornare il meteo
// senza dover ripetere la ricerca testuale dal geocoder.
let lastResolvedPlace = null;
// Conserviamo anche l'ultimo payload meteo renderizzato, cosi il toggle
// puo cambiare unita all'istante senza nuove richieste HTTP.
let latestWeatherData = null;
let latestPlaceLabel = '';
let hasRenderedWeather = false;
let autocompleteTimer = null;
let activeAutocompleteId = 0;
let suggestionPlaces = [];
let activeSuggestionIndex = -1;
let favoritePlaces = [];
let feedbackTimer = null;

function createBootstrapError(message) {
  const error = new Error(message);
  error.canRetry = false;
  return error;
}

function createUserFacingError(message, userMessage, canRetry = false, userTitle = 'Qualcosa e andato storto') {
  const error = new Error(message);
  error.userMessage = userMessage;
  error.canRetry = canRetry;
  error.userTitle = userTitle;
  return error;
}

function createPermissionDeniedError() {
  const error = createUserFacingError(
    'Geolocation permission denied',
    'Posizione non consentita. Cerca una citta per vedere il meteo.',
    false,
    'Permesso posizione negato'
  );
  error.reason = 'geolocation-permission-denied';
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
    // L'app continua a funzionare anche se localStorage non e disponibile.
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

function createSidebarButton(place, extraClassName = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `sidebar-place-button${extraClassName ? ` ${extraClassName}` : ''}`;
  button.textContent = place.label;
  button.setAttribute('aria-label', `Mostra il meteo per ${place.label}`);

  // Evidenziamo la localita attualmente caricata, cosi nella sidebar
  // resta sempre chiaro quale meteo stiamo guardando in questo momento.
  if (
    lastResolvedPlace
    && lastResolvedPlace.label === place.label
    && lastResolvedPlace.lat === place.lat
    && lastResolvedPlace.lon === place.lon
  ) {
    button.classList.add('is-active');
  }

  button.addEventListener('click', () => {
    void handleSidebarPlaceSelection(place);
  });

  return button;
}

function renderFavoriteList(targetRoot, emptyMessage) {
  if (!targetRoot) {
    return;
  }

  targetRoot.innerHTML = '';

  if (favoritePlaces.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'sidebar-empty';
    empty.textContent = emptyMessage;
    targetRoot.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'sidebar-place-list';
  // Su desktop la sidebar diventa il punto di rientro rapido per le localita
  // salvate: ogni voce ricarica direttamente il meteo senza nuovo geocoding.
  favoritePlaces.forEach((place) => {
    list.appendChild(createSidebarButton(place));
  });
  targetRoot.appendChild(list);
}

function renderFavoritesPanel() {
  renderFavoriteList(
    favoritesRoot,
    'Salva una localita dalla card meteo per ritrovarla qui.'
  );
}

function renderMobileFavoritesPanel() {
  renderFavoriteList(
    mobileFavoritesRoot,
    'Salva una localita dalla card meteo per ritrovarla anche qui su mobile.'
  );
}

function renderSidebarPanels() {
  renderFavoritesPanel();
  renderMobileFavoritesPanel();
}

function handleError(err, retryAction = null) {
  console.error(err);
  const canRetry = retryAction && err?.canRetry !== false;
  renderError(root, getUserErrorMessage(err), canRetry ? retryAction : null, getUserErrorTitle(err));
}

function setBusy(isBusy) {
  if (!root || !form) {
    return;
  }

  // Disabilitiamo form e bottone durante le richieste per evitare submit doppi
  // e stati incoerenti mentre la UI sta aspettando una risposta di rete.
  root.setAttribute('aria-busy', String(isBusy));
  form.querySelectorAll('input, button').forEach((element) => {
    element.disabled = isBusy;
  });
}

function updateSearchButtonLabel() {
  if (!input || !searchButton) {
    return;
  }

  const hasTypedQuery = input.value.trim().length > 0;
  const canRefresh = !hasTypedQuery && lastResolvedPlace;
  searchButton.textContent = canRefresh ? 'Aggiorna' : 'Cerca';
}

function updateInputSuggestionState() {
  if (!input) return;
  const hasSuggestions = suggestionPlaces.length > 0;
  input.setAttribute('aria-expanded', String(hasSuggestions));
  if (activeSuggestionIndex >= 0) {
    input.setAttribute('aria-activedescendant', `suggestion-${activeSuggestionIndex}`);
  } else {
    input.removeAttribute('aria-activedescendant');
  }

  // Su desktop, quando la tendina suggerimenti e aperta, togliamo temporaneamente
  // il pannello preferiti per lasciare piu spazio visivo alla ricerca attiva.
  if (document.body) {
    const shouldHideFavorites = hasSuggestions && window.matchMedia(DESKTOP_SUGGESTION_MEDIA_QUERY).matches;
    document.body.classList.toggle('is-searching-desktop', shouldHideFavorites);
  }
}

function updateUnitToggle() {
  // Aggiorniamo lo stato visivo e accessibile dei due pulsanti del toggle.
  unitButtons.forEach((button) => {
    const isActive = button.dataset.unit === temperatureUnit;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function renderCurrentWeather() {
  if (!root || !latestWeatherData || !latestPlaceLabel) {
    return;
  }

  // Tutto il meteo viene renderizzato partendo dai dati normalizzati in Celsius.
  // Il renderer si occupa poi di convertirli nell'unita scelta dall'utente.
  renderWeather(root, latestWeatherData, latestPlaceLabel, {
    temperatureUnit,
    isFavorite: lastResolvedPlace ? isFavoritePlace(lastResolvedPlace, favoritePlaces) : false,
    onToggleFavorite: lastResolvedPlace ? handleFavoriteToggle : null
  });
  hasRenderedWeather = true;
}

function createSearchId() {
  // Ogni ricerca ottiene un id crescente. Quando una risposta arriva in ritardo,
  // possiamo confrontare l'id e ignorare i risultati obsoleti.
  activeSearchId += 1;
  return activeSearchId;
}

function isStaleSearch(searchId) {
  return searchId !== activeSearchId;
}

function getCurrentPosition() {
  // I browser espongono la geolocalizzazione solo in secure context:
  // localhost/127.0.0.1 vanno bene, un IP di rete in HTTP invece no.
  if (window.isSecureContext === false) {
    return Promise.reject(createUserFacingError(
      'Geolocation blocked on insecure origin',
      'La geolocalizzazione funziona solo su HTTPS o localhost. Apri l app da http://127.0.0.1:8081 o http://localhost:8081.',
      false,
      'Connessione non sicura'
    ));
  }

  if (!navigator.geolocation) {
    return Promise.reject(createUserFacingError(
      'Geolocation not supported',
      'Il browser non rende disponibile la geolocalizzazione su questo indirizzo. Prova da localhost o abilita i servizi di posizione.',
      false,
      'Posizione non supportata'
    ));
  }

  const readPosition = (options) => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

  const standardOptions = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 5 * 60 * 1000
  };

  const highAccuracyOptions = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0
  };

  const createGeolocationError = (err) => {
    if (err.code === err.PERMISSION_DENIED) {
      return createPermissionDeniedError();
    }

    if (err.code === err.TIMEOUT) {
      return createUserFacingError(
        'Geolocation timeout',
        'Non sono riuscito a leggere la posizione in tempo. Avvicinati a una finestra, verifica i servizi di posizione e riprova.',
        true,
        'Posizione troppo lenta'
      );
    }

    return createUserFacingError(
      'Geolocation unavailable',
      'Il browser non riesce a determinare la posizione. Controlla che i servizi di posizione siano attivi nel sistema operativo e che il browser abbia il permesso di usarli.',
      true,
      'Posizione non disponibile'
    );
  };

  // Alcuni desktop rispondono POSITION_UNAVAILABLE al primo tentativo.
  // In quel caso riproviamo con alta accuratezza prima di mostrare l'errore.
  return readPosition(standardOptions).catch(async (err) => {
    if (err.code !== err.POSITION_UNAVAILABLE) {
      throw createGeolocationError(err);
    }

    try {
      return await readPosition(highAccuracyOptions);
    } catch (retryErr) {
      throw createGeolocationError(retryErr);
    }
  });
}

function retryLastSearch() {
  if (!form || !input || !lastSearchQuery) return;
  input.value = lastSearchQuery;
  updateSearchButtonLabel();
  const evt = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(evt);
}

function setLastResolvedPlace(lat, lon, label) {
  // Manteniamo i dati gia risolti della localita corrente per il pulsante "Aggiorna".
  lastResolvedPlace = { lat, lon, label };
  saveResolvedPlace(lastResolvedPlace);
  renderSidebarPanels();
  updateSearchButtonLabel();
}

function persistFavoritePlaces(nextFavorites) {
  // Manteniamo un unico punto di sincronizzazione tra stato in memoria,
  // localStorage e pannello laterale, cosi la UI resta coerente subito.
  favoritePlaces = nextFavorites;
  saveFavoritePlaces(favoritePlaces);
  renderSidebarPanels();
}

function handleFavoriteToggle() {
  if (!lastResolvedPlace) {
    return;
  }

  const wasFavorite = isFavoritePlace(lastResolvedPlace, favoritePlaces);
  persistFavoritePlaces(toggleFavoritePlace(lastResolvedPlace, favoritePlaces));
  showFeedback(
    wasFavorite
      ? `${lastResolvedPlace.label} rimossa dai preferiti.`
      : `${lastResolvedPlace.label} aggiunta ai preferiti.`
  );
  if (hasRenderedWeather) {
    renderCurrentWeather();
  }
}

async function handleSidebarPlaceSelection(place) {
  const searchId = createSearchId();
  setBusy(true);

  try {
    // Le voci della sidebar hanno gia label e coordinate affidabili:
    // possiamo saltare il geocoding e andare direttamente al fetch meteo.
    resetSuggestions();
    input.value = '';
    lastSearchQuery = place.label;
    await showWeatherForPlace(place.lat, place.lon, place.label, searchId);
    updateSearchButtonLabel();
  } catch (err) {
    if (!isStaleSearch(searchId)) {
      handleError(err, () => handleSidebarPlaceSelection(place));
    }
  } finally {
    if (!isStaleSearch(searchId)) {
      setBusy(false);
    }
  }
}

async function handleGeolocationSelection() {
  const searchId = createSearchId();
  setBusy(true);

  try {
    resetSuggestions();
    input.value = '';
    lastSearchQuery = '';
    showFeedback('Cerco la tua posizione...');
    const position = await getCurrentPosition();
    if (isStaleSearch(searchId)) return;

    // La Geolocation API restituisce solo coordinate, non il nome della citta.
    // Per questo usiamo una label generica finche non avremo reverse geocoding.
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    await showWeatherForPlace(lat, lon, 'La tua posizione', searchId);
    updateSearchButtonLabel();
  } catch (err) {
    if (!isStaleSearch(searchId)) {
      if (err?.reason === 'geolocation-permission-denied') {
        renderWelcome(root);
        showFeedback(err.userMessage);
        return;
      }

      handleError(err, err?.canRetry ? handleGeolocationSelection : null);
    }
  } finally {
    if (!isStaleSearch(searchId)) {
      setBusy(false);
    }
  }
}

function resetSuggestions() {
  // Azzeriamo sia la lista visibile sia lo stato accessibile dell'input:
  // in questo modo tastiera e screen reader non restano collegati a opzioni stale.
  suggestionPlaces = [];
  activeSuggestionIndex = -1;
  clearSuggestions(suggestionsRoot);
  updateInputSuggestionState();
}

function showSuggestions(places) {
  suggestionPlaces = places;
  activeSuggestionIndex = -1;
  renderSuggestions(suggestionsRoot, suggestionPlaces, activeSuggestionIndex, handleSuggestionSelection);
  tagSuggestionOptions();
  updateInputSuggestionState();
}

function tagSuggestionOptions() {
  if (!suggestionsRoot) return;
  suggestionsRoot.querySelectorAll('[role="option"]').forEach((element, index) => {
    element.id = `suggestion-${index}`;
  });
}

function rerenderSuggestions() {
  renderSuggestions(suggestionsRoot, suggestionPlaces, activeSuggestionIndex, handleSuggestionSelection);
  tagSuggestionOptions();
  updateInputSuggestionState();
}

function createAutocompleteId() {
  activeAutocompleteId += 1;
  return activeAutocompleteId;
}

function isStaleAutocomplete(autocompleteId) {
  return autocompleteId !== activeAutocompleteId;
}

async function handleSuggestionSelection(place) {
  // La selezione di un suggerimento salta il submit testuale:
  // abbiamo gia le coordinate e possiamo andare direttamente al fetch meteo.
  resetSuggestions();
  input.value = formatPlace(place);
  lastSearchQuery = formatPlace(place);
  const searchId = createSearchId();
  setBusy(true);

  try {
    await showWeatherForPlace(place.latitude, place.longitude, formatPlace(place), searchId);
    input.value = '';
    updateSearchButtonLabel();
  } catch (err) {
    if (!isStaleSearch(searchId)) {
      handleError(err, () => handleSuggestionSelection(place));
    }
  } finally {
    if (!isStaleSearch(searchId)) {
      setBusy(false);
    }
  }
}

async function loadSuggestions(query, autocompleteId) {
  const geo = await geocodeLocation(query);
  if (isStaleAutocomplete(autocompleteId)) return;

  const places = dedupePlaces(geo?.results);
  if (places.length === 0) {
    resetSuggestions();
    return;
  }

  showSuggestions(places.slice(0, 5));
}

function scheduleSuggestions() {
  if (!input) return;

  const query = input.value.trim();
  if (autocompleteTimer) {
    clearTimeout(autocompleteTimer);
    autocompleteTimer = null;
  }

  if (query.length < AUTOCOMPLETE_MIN_CHARS) {
    createAutocompleteId();
    resetSuggestions();
    return;
  }

  const autocompleteId = createAutocompleteId();
  // Debounce leggero: mentre l'utente sta ancora scrivendo non interroghiamo subito il geocoder.
  autocompleteTimer = window.setTimeout(async () => {
    try {
      await loadSuggestions(query, autocompleteId);
    } catch (err) {
      if (!isStaleAutocomplete(autocompleteId)) {
        resetSuggestions();
      }
    }
  }, AUTOCOMPLETE_DEBOUNCE_MS);
}

/**
 * Recupera i dati meteo per una posizione gia risolta e aggiorna la UI
 * solo se la richiesta e ancora quella piu recente.
 *
 * @param {number} lat Latitudine della localita selezionata.
 * @param {number} lon Longitudine della localita selezionata.
 * @param {string} placeLabel Etichetta leggibile da mostrare nella card meteo.
 * @param {number} searchId Identificatore della ricerca corrente usato per evitare race condition.
 * @returns {Promise<void>} Completa il rendering del meteo oppure termina senza effetti se la ricerca e obsoleta.
 *
 * @example
 * await showWeatherForPlace(45.4642, 9.19, 'Milano, Lombardia, Italia', currentSearchId);
 */
async function showWeatherForPlace(lat, lon, placeLabel, searchId) {
  renderLoading(root);
  const data = await fetchWeatherByCoords(lat, lon);
  if (isStaleSearch(searchId)) return;
  setLastResolvedPlace(lat, lon, placeLabel);
  latestWeatherData = data;
  latestPlaceLabel = placeLabel;
  renderWeather(root, latestWeatherData, latestPlaceLabel, {
    temperatureUnit,
    isFavorite: isFavoritePlace({ lat, lon, label: placeLabel }, favoritePlaces),
    onToggleFavorite: handleFavoriteToggle,
    focusOnRender: true
  });
  hasRenderedWeather = true;
}

/**
 * Gestisce il flusso principale di ricerca per nome localita, interroga i servizi esterni
 * e aggiorna la UI con risultato, errori o lista di scelte.
 *
 * @param {number} searchId Identificatore della ricerca corrente per ignorare risposte arrivate in ritardo.
 * @returns {Promise<void>} Completa il flusso di ricerca e il rendering associato.
 *
 * @example
 * const searchId = createSearchId();
 * await handleSearch(searchId);
 */
async function handleSearch(searchId) {
  const q = input.value.trim();
  if (!q) return;
  lastSearchQuery = q;
  resetSuggestions();

  // Feedback immediato mentre aspettiamo la risposta delle API.
  renderLoading(root);

  // Chiamata all'API di geocoding per trovare il luogo richiesto.
  const geo = await geocodeLocation(q);
  if (isStaleSearch(searchId)) return;
  const places = dedupePlaces(geo?.results);
  if (places.length === 0) {
    renderError(
      root,
      `Non ho trovato "${q}". Controlla eventuali errori nel nome oppure prova con provincia o paese.`,
      null,
      'Localita non trovata'
    );
    return;
  }

  // Se troviamo una sola citta mostriamo subito il meteo.
  // Se i risultati sono piu di uno, chiediamo all'utente quale usare.
  if (places.length === 1) {
    const top = places[0];
    await showWeatherForPlace(top.latitude, top.longitude, formatPlace(top), searchId);
    input.value = '';
    updateSearchButtonLabel();
    return;
  }

  renderLocationChoices(root, places, async (selectedPlace) => {
    try {
      await showWeatherForPlace(
        selectedPlace.latitude,
        selectedPlace.longitude,
        formatPlace(selectedPlace),
        searchId
      );
      input.value = '';
      updateSearchButtonLabel();
    } catch (err) {
      handleError(err, retryLastSearch);
    }
  });
}

/**
 * Aggiorna i dati meteo per l'ultima localita risolta senza rieseguire il geocoding.
 *
 * @param {number} searchId Identificatore della richiesta corrente.
 * @returns {Promise<void>} Ricarica il meteo dell'ultima localita nota.
 *
 * @example
 * const searchId = createSearchId();
 * await refreshCurrentWeather(searchId);
 */
async function refreshCurrentWeather(searchId) {
  if (!lastResolvedPlace) return;

  await showWeatherForPlace(
    lastResolvedPlace.lat,
    lastResolvedPlace.lon,
    lastResolvedPlace.label,
    searchId
  );
}

async function loadInitialWeather() {
  // Al bootstrap ripristiniamo solo l'ultima localita valida vista.
  // Se non esiste, lasciamo l'app in attesa di ricerca o geolocalizzazione.
  const savedPlace = loadSavedResolvedPlace();

  if (!savedPlace) {
    // Niente piu fallback automatico su Roma: il primo meteo mostrato deve
    // arrivare da una scelta esplicita dell'utente o da una localita salvata.
    renderWelcome(root);
    updateSearchButtonLabel();
    return;
  }

  const searchId = createSearchId();
  setBusy(true);

  try {
    input.value = '';
    lastSearchQuery = '';
    await showWeatherForPlace(savedPlace.lat, savedPlace.lon, savedPlace.label, searchId);
  } catch (err) {
    if (!isStaleSearch(searchId)) {
      // Se la localita salvata nel browser e corrotta o non piu caricabile,
      // la rimuoviamo per evitare tentativi falliti anche al prossimo refresh.
      clearSavedResolvedPlace();
      renderWelcome(root);
      showFeedback('Non sono riuscito a ripristinare l ultima localita salvata.');
    }
  } finally {
    if (!isStaleSearch(searchId)) {
      setBusy(false);
    }
  }
}

function bindEventListeners() {
  form.addEventListener('submit', async (e) => {
    // Evita il refresh della pagina causato dal submit standard del browser.
    e.preventDefault();
    const searchId = createSearchId();
    setBusy(true);

    try {
      if (input.value.trim()) {
        await handleSearch(searchId);
      } else {
        await refreshCurrentWeather(searchId);
      }
    } catch (err) {
      // Gestione centralizzata degli errori di rete o delle API.
      if (!isStaleSearch(searchId)) {
        handleError(err, retryLastSearch);
      }
    } finally {
      if (!isStaleSearch(searchId)) {
        setBusy(false);
      }
    }
  });

  input.addEventListener('input', () => {
    updateSearchButtonLabel();
    scheduleSuggestions();
  });

  input.addEventListener('keydown', (event) => {
    if (suggestionPlaces.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, suggestionPlaces.length - 1);
      rerenderSuggestions();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
      rerenderSuggestions();
      return;
    }

    if (event.key === 'Escape') {
      resetSuggestions();
      return;
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      handleSuggestionSelection(suggestionPlaces[activeSuggestionIndex]);
    }
  });

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      resetSuggestions();
    }, 120);
  });

  if (unitToggle) {
    unitToggle.addEventListener('click', (event) => {
      const target = event.target.closest('[data-unit]');
      if (!target) return;

      const nextUnit = target.dataset.unit;
      if (!nextUnit || nextUnit === temperatureUnit) return;

      temperatureUnit = nextUnit;
      saveTemperatureUnit(temperatureUnit);
      updateUnitToggle();

      // Se abbiamo gia un meteo a schermo, cambiamo subito unita senza nuove fetch.
      // In caso contrario lasciamo semplicemente salvata la preferenza per il prossimo render.
      if (hasRenderedWeather) {
        renderCurrentWeather();
      }
    });
  }

  if (geolocationButton) {
    geolocationButton.addEventListener('click', () => {
      void handleGeolocationSelection();
    });
  }
}

async function bootstrapApp() {
  try {
    assertBootstrapReady();
    temperatureUnit = loadSavedTemperatureUnit();
    favoritePlaces = loadFavoritePlaces();
    updateSearchButtonLabel();
    updateUnitToggle();
    renderSidebarPanels();
    bindEventListeners();
    await loadInitialWeather();
  } catch (err) {
    console.error(err);

    if (root) {
      renderError(root, getUserErrorMessage(err), null, getUserErrorTitle(err));
    }
  }
}

bootstrapApp();
