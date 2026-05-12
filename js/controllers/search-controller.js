export function createSearchController({
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
  getTemperatureUnit,
  favoritesController,
  autocompleteController,
  showFeedback,
  updateSearchButtonLabel
}) {
  let lastSearchQuery = '';
  let activeSearchId = 0;
  let lastResolvedPlace = null;
  let latestWeatherData = null;
  let latestPlaceLabel = '';
  let hasRenderedWeather = false;

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

  function handleError(err, retryAction = null) {
    console.error(err);
    const canRetry = retryAction && err?.canRetry !== false;
    renderError(root, getUserErrorMessage(err), canRetry ? retryAction : null, getUserErrorTitle(err));
  }

  function setBusy(isBusy) {
    if (!root || !form) {
      return;
    }

    root.setAttribute('aria-busy', String(isBusy));
    form.querySelectorAll('input, button').forEach((element) => {
      element.disabled = isBusy;
    });
  }

  function createSearchId() {
    activeSearchId += 1;
    return activeSearchId;
  }

  function isStaleSearch(searchId) {
    return searchId !== activeSearchId;
  }

  function getCurrentPosition() {
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

  async function resolveGeolocationLabel(lat, lon) {
    try {
      return formatReversePlace(await reverseGeocodeCoords(lat, lon));
    } catch (err) {
      console.warn('Reverse geocoding non disponibile, uso label generica.', err);
      return 'La tua posizione';
    }
  }

  function setLastResolvedPlace(lat, lon, label) {
    lastResolvedPlace = { lat, lon, label };
    saveResolvedPlace(lastResolvedPlace);
    favoritesController.render();
    updateSearchButtonLabel();
  }

  function renderCurrentWeather() {
    if (!root || !latestWeatherData || !latestPlaceLabel) {
      return;
    }

    renderWeather(root, latestWeatherData, latestPlaceLabel, {
      temperatureUnit: getTemperatureUnit(),
      isFavorite: lastResolvedPlace ? favoritesController.includes(lastResolvedPlace) : false,
      onToggleFavorite: lastResolvedPlace ? favoritesController.toggleCurrentPlace : null
    });
    hasRenderedWeather = true;
  }

  async function showWeatherForPlace(lat, lon, placeLabel, searchId) {
    renderLoading(root);
    const data = await fetchWeatherByCoords(lat, lon);
    if (isStaleSearch(searchId)) return;

    setLastResolvedPlace(lat, lon, placeLabel);
    latestWeatherData = data;
    latestPlaceLabel = placeLabel;
    renderWeather(root, latestWeatherData, latestPlaceLabel, {
      temperatureUnit: getTemperatureUnit(),
      isFavorite: favoritesController.includes({ lat, lon, label: placeLabel }),
      onToggleFavorite: favoritesController.toggleCurrentPlace,
      focusOnRender: true
    });
    hasRenderedWeather = true;
  }

  async function handlePlaceSelection(place) {
    const searchId = createSearchId();
    setBusy(true);

    try {
      autocompleteController.reset();
      input.value = '';
      lastSearchQuery = place.label;
      await showWeatherForPlace(place.lat, place.lon, place.label, searchId);
      updateSearchButtonLabel();
    } catch (err) {
      if (!isStaleSearch(searchId)) {
        handleError(err, () => handlePlaceSelection(place));
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
      autocompleteController.reset();
      input.value = '';
      lastSearchQuery = '';
      showFeedback('Cerco la tua posizione...');
      const position = await getCurrentPosition();
      if (isStaleSearch(searchId)) return;

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const placeLabel = await resolveGeolocationLabel(lat, lon);
      if (isStaleSearch(searchId)) return;
      await showWeatherForPlace(lat, lon, placeLabel, searchId);
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

  async function handleSuggestionSelection(place) {
    autocompleteController.reset();
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

  async function handleSearch(searchId) {
    const q = input.value.trim();
    if (!q) return;

    lastSearchQuery = q;
    autocompleteController.reset();
    renderLoading(root);

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
    const savedPlace = loadSavedResolvedPlace();

    if (!savedPlace) {
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
      autocompleteController.schedule();
    });
    input.addEventListener('keydown', autocompleteController.handleKeydown);
    input.addEventListener('blur', autocompleteController.handleBlur);

    if (geolocationButton) {
      geolocationButton.addEventListener('click', () => {
        void handleGeolocationSelection();
      });
    }
  }

  function getCurrentPlace() {
    return lastResolvedPlace;
  }

  function hasWeather() {
    return hasRenderedWeather;
  }

  return {
    bindEventListeners,
    loadInitialWeather,
    handlePlaceSelection,
    handleSuggestionSelection,
    renderCurrentWeather,
    getCurrentPlace,
    hasWeather
  };
}
