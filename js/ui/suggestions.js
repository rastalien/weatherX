import { formatPlace } from '../shared/place.js';

export function renderSuggestions(container, places, activeIndex, onSelect) {
  if (!container) return;

  container.innerHTML = '';

  if (!Array.isArray(places) || places.length === 0) {
    container.hidden = true;
    return;
  }

  const list = document.createElement('div');
  list.className = 'suggestions-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suggerimenti localita');

  places.forEach((place, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-button';
    button.textContent = formatPlace(place);
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(index === activeIndex));

    if (index === activeIndex) {
      button.classList.add('is-active');
    }

    // `mousedown` evita che il blur dell'input chiuda la lista prima della selezione.
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      onSelect(place);
    });

    list.appendChild(button);
  });

  container.appendChild(list);
  container.hidden = false;
}

export function clearSuggestions(container) {
  if (!container) return;
  // Nascondere il contenitore evita che screen reader e tastiera continuino
  // a percepire una lista suggestioni che in realta non e piu disponibile.
  container.innerHTML = '';
  container.hidden = true;
}
