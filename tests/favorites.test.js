import { describe, expect, it } from 'vitest';
import { __test__, isFavoritePlace, toggleFavoritePlace } from '../js/shared/favorites.js';

describe('favorite places helpers', () => {
  it('normalizza e deduplica le localita preferite', () => {
    const result = __test__.dedupeFavorites([
      { lat: 45.4642, lon: 9.19, label: 'Milano, Lombardia, Italia' },
      { lat: '45.4642', lon: '9.19', label: 'Milano, Lombardia, Italia' },
      { lat: 41.9028, lon: 12.4964, label: 'Roma, Lazio, Italia' }
    ]);

    expect(result).toEqual([
      { lat: 45.4642, lon: 9.19, label: 'Milano, Lombardia, Italia' },
      { lat: 41.9028, lon: 12.4964, label: 'Roma, Lazio, Italia' }
    ]);
  });

  it('aggiunge e rimuove una localita dalla lista preferiti', () => {
    const place = { lat: 41.9028, lon: 12.4964, label: 'Roma, Lazio, Italia' };
    const favorites = toggleFavoritePlace(place, []);

    expect(isFavoritePlace(place, favorites)).toBe(true);
    expect(toggleFavoritePlace(place, favorites)).toEqual([]);
  });
});
