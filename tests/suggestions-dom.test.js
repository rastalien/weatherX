// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSuggestions, renderSuggestions } from '../js/ui/suggestions.js';

const samplePlaces = [
  { name: 'Roma', admin1: 'Lazio', country: 'Italia' },
  { name: 'Milano', admin1: 'Lombardia', country: 'Italia' }
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('suggestions DOM rendering', () => {
  it('renderizza una lista di suggerimenti cliccabili', () => {
    const container = document.createElement('div');
    const onSelect = vi.fn();
    document.body.appendChild(container);

    renderSuggestions(container, samplePlaces, 1, onSelect);

    const buttons = container.querySelectorAll('.suggestion-button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe('Roma, Lazio, Italia');
    expect(buttons[1].classList.contains('is-active')).toBe(true);

    buttons[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(samplePlaces[0]);
  });

  it('svuota e nasconde il contenitore quando non ci sono suggerimenti', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderSuggestions(container, samplePlaces, -1, () => {});
    expect(container.hidden).toBe(false);

    clearSuggestions(container);
    expect(container.hidden).toBe(true);
    expect(container.innerHTML).toBe('');
  });
});
