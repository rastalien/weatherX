export function createFavoritesController({
  favoritesRoot,
  mobileFavoritesRoot,
  loadFavoritePlaces,
  saveFavoritePlaces,
  isFavoritePlace,
  toggleFavoritePlace,
  getCurrentPlace,
  onSelect,
  onChange,
  showFeedback
}) {
  let favoritePlaces = [];

  function isCurrentPlace(place) {
    const currentPlace = getCurrentPlace();

    return Boolean(
      currentPlace
      && currentPlace.label === place.label
      && currentPlace.lat === place.lat
      && currentPlace.lon === place.lon
    );
  }

  function createSidebarButton(place, extraClassName = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sidebar-place-button${extraClassName ? ` ${extraClassName}` : ''}`;
    button.textContent = place.label;
    button.setAttribute('aria-label', `Mostra il meteo per ${place.label}`);

    if (isCurrentPlace(place)) {
      button.classList.add('is-active');
    }

    button.addEventListener('click', () => {
      void onSelect(place);
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
    favoritePlaces.forEach((place) => {
      list.appendChild(createSidebarButton(place));
    });
    targetRoot.appendChild(list);
  }

  function render() {
    renderFavoriteList(
      favoritesRoot,
      'Salva una localita dalla card meteo per ritrovarla qui.'
    );
    renderFavoriteList(
      mobileFavoritesRoot,
      'Salva una localita dalla card meteo per ritrovarla anche qui su mobile.'
    );
  }

  function persist(nextFavorites) {
    favoritePlaces = nextFavorites;
    saveFavoritePlaces(favoritePlaces);
    render();
    onChange();
  }

  function toggleCurrentPlace() {
    const currentPlace = getCurrentPlace();

    if (!currentPlace) {
      return;
    }

    const wasFavorite = isFavoritePlace(currentPlace, favoritePlaces);
    persist(toggleFavoritePlace(currentPlace, favoritePlaces));
    showFeedback(
      wasFavorite
        ? `${currentPlace.label} rimossa dai preferiti.`
        : `${currentPlace.label} aggiunta ai preferiti.`
    );
  }

  function init() {
    favoritePlaces = loadFavoritePlaces();
    render();
  }

  function includes(place) {
    return isFavoritePlace(place, favoritePlaces);
  }

  function getPlaces() {
    return favoritePlaces;
  }

  return {
    init,
    render,
    toggleCurrentPlace,
    includes,
    getPlaces
  };
}
