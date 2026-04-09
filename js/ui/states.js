import { formatPlace } from '../shared/place.js';

export function renderLocationChoices(root, places, onSelect) {
  // Mostriamo una lista di scelte quando il nome cercato e ambiguo.
  root.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card';
  card.setAttribute('aria-label', 'Selezione localita');

  const title = document.createElement('h2');
  title.className = 'choices-title';
  title.textContent = 'Scegli la localita giusta';

  const subtitle = document.createElement('p');
  subtitle.className = 'small';
  subtitle.textContent = 'Ho trovato piu risultati con questo nome.';

  const list = document.createElement('div');
  list.className = 'choices-list';

  places.forEach((place) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = formatPlace(place);

    // Quando l'utente sceglie una voce, richiamiamo la callback passata da app.js.
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      list.querySelectorAll('button').forEach((item) => {
        item.disabled = true;
      });
      await onSelect(place);
    });
    list.appendChild(button);
  });

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(list);
  root.appendChild(card);

  const firstChoice = list.querySelector('button');
  if (firstChoice) {
    // Spostiamo il focus sulla prima scelta per aiutare tastiera e screen reader
    // quando la ricerca produce piu localita ambigue.
    firstChoice.focus();
  }
}

export function renderError(root, message, onRetry) {
  root.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card';
  card.setAttribute('role', 'alert');

  const title = document.createElement('h2');
  title.className = 'error-title';
  title.textContent = 'Qualcosa e andato storto';

  const text = document.createElement('p');
  text.className = 'small';
  text.textContent = message;

  card.appendChild(title);
  card.appendChild(text);

  if (onRetry) {
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Riprova';
    retryButton.addEventListener('click', onRetry);
    card.appendChild(retryButton);
  }

  root.appendChild(card);
}

export function renderLoading(root, message = 'Caricamento...') {
  root.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card small';
  card.setAttribute('role', 'status');
  card.textContent = message;
  root.appendChild(card);
}
