import { describe, expect, it } from 'vitest';
import { dedupePlaces, formatPlace } from '../js/shared/place.js';

describe('place helpers', () => {
  it('formatPlace compone correttamente la label della localita', () => {
    expect(formatPlace({
      name: 'Roma',
      admin1: 'Lazio',
      country: 'Italia'
    })).toBe('Roma, Lazio, Italia');
  });

  it('dedupePlaces rimuove risultati duplicati per label e coordinate simili', () => {
    const result = dedupePlaces([
      { name: 'Roma', admin1: 'Lazio', country: 'Italia', latitude: 41.9, longitude: 12.5 },
      { name: 'Roma', admin1: 'Lazio', country: 'Italia', latitude: 41.9002, longitude: 12.5002 },
      { name: 'Milano', admin1: 'Lombardia', country: 'Italia', latitude: 45.46, longitude: 9.19 }
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => formatPlace(item))).toEqual([
      'Roma, Lazio, Italia',
      'Milano, Lombardia, Italia'
    ]);
  });
});
