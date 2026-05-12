const DEFAULT_MIN_CHARS = 2;
const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_DESKTOP_SUGGESTION_MEDIA_QUERY = '(min-width: 721px)';

export function createAutocompleteController({
  input,
  suggestionsRoot,
  geocodeLocation,
  dedupePlaces,
  renderSuggestions,
  clearSuggestions,
  onSelect,
  minChars = DEFAULT_MIN_CHARS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  desktopSuggestionMediaQuery = DEFAULT_DESKTOP_SUGGESTION_MEDIA_QUERY
}) {
  let autocompleteTimer = null;
  let activeAutocompleteId = 0;
  let suggestionPlaces = [];
  let activeSuggestionIndex = -1;

  function updateInputSuggestionState() {
    if (!input) return;

    const hasSuggestions = suggestionPlaces.length > 0;
    input.setAttribute('aria-expanded', String(hasSuggestions));

    if (activeSuggestionIndex >= 0) {
      input.setAttribute('aria-activedescendant', `suggestion-${activeSuggestionIndex}`);
    } else {
      input.removeAttribute('aria-activedescendant');
    }

    if (document.body) {
      const shouldHideFavorites = hasSuggestions && window.matchMedia(desktopSuggestionMediaQuery).matches;
      document.body.classList.toggle('is-searching-desktop', shouldHideFavorites);
    }
  }

  function tagSuggestionOptions() {
    if (!suggestionsRoot) return;

    suggestionsRoot.querySelectorAll('[role="option"]').forEach((element, index) => {
      element.id = `suggestion-${index}`;
    });
  }

  function rerenderSuggestions() {
    renderSuggestions(suggestionsRoot, suggestionPlaces, activeSuggestionIndex, onSelect);
    tagSuggestionOptions();
    updateInputSuggestionState();
  }

  function reset() {
    suggestionPlaces = [];
    activeSuggestionIndex = -1;
    clearSuggestions(suggestionsRoot);
    updateInputSuggestionState();
  }

  function show(places) {
    suggestionPlaces = places;
    activeSuggestionIndex = -1;
    rerenderSuggestions();
  }

  function createAutocompleteId() {
    activeAutocompleteId += 1;
    return activeAutocompleteId;
  }

  function isStaleAutocomplete(autocompleteId) {
    return autocompleteId !== activeAutocompleteId;
  }

  async function load(query, autocompleteId) {
    const geo = await geocodeLocation(query);
    if (isStaleAutocomplete(autocompleteId)) return;

    const places = dedupePlaces(geo?.results);
    if (places.length === 0) {
      reset();
      return;
    }

    show(places.slice(0, 5));
  }

  function schedule() {
    if (!input) return;

    const query = input.value.trim();
    if (autocompleteTimer) {
      window.clearTimeout(autocompleteTimer);
      autocompleteTimer = null;
    }

    if (query.length < minChars) {
      createAutocompleteId();
      reset();
      return;
    }

    const autocompleteId = createAutocompleteId();
    autocompleteTimer = window.setTimeout(async () => {
      try {
        await load(query, autocompleteId);
      } catch (err) {
        if (!isStaleAutocomplete(autocompleteId)) {
          reset();
        }
      }
    }, debounceMs);
  }

  function handleKeydown(event) {
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
      reset();
      return;
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      onSelect(suggestionPlaces[activeSuggestionIndex]);
    }
  }

  function handleBlur() {
    window.setTimeout(() => {
      reset();
    }, 120);
  }

  return {
    reset,
    schedule,
    handleKeydown,
    handleBlur
  };
}
