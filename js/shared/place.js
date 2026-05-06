export function formatPlace(geoHit) {
  // Crea un'etichetta leggibile del luogo usando solo i campi disponibili.
  // L'ordine scelto (nome, regione/provincia, paese) e lo stesso che poi
  // l'utente vede nella lista risultati e nella card finale.
  if (!geoHit) return 'Posizione sconosciuta';
  const parts = [geoHit.name, geoHit.admin1, geoHit.country].filter(Boolean);
  return parts.join(', ');
}

export function formatReversePlace(reverseHit) {
  if (!reverseHit || typeof reverseHit !== 'object') {
    return 'La tua posizione';
  }

  const address = reverseHit.address || {};
  // I reverse geocoder possono usare chiavi diverse in base alla dimensione
  // del centro abitato: prendiamo il nome piu specifico disponibile.
  const locality = [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.county,
    address.state,
    address.region
  ].find(Boolean);
  const region = address.state || address.region;
  const parts = [locality, region, address.country].filter((part, index, list) => {
    return part && list.indexOf(part) === index;
  });

  if (parts.length > 0) {
    return parts.join(', ');
  }

  if (typeof reverseHit.display_name === 'string' && reverseHit.display_name.trim()) {
    // Ultimo tentativo: display_name e molto dettagliato, quindi ne teniamo
    // solo l'inizio per evitare label troppo lunghe nella UI.
    return reverseHit.display_name.split(',').slice(0, 3).map((part) => part.trim()).filter(Boolean).join(', ');
  }

  return 'La tua posizione';
}

/**
 * Rimuove risultati duplicati o quasi duplicati dal geocoder prima del rendering.
 * La deduplica tiene conto sia della label visibile sia di coordinate molto simili.
 *
 * @param {Array<object>} places Lista grezza di risultati restituiti dal geocoder.
 * @returns {Array<object>} Lista filtrata senza doppioni visivi o geografici.
 *
 * @example
 * const uniquePlaces = dedupePlaces(geo.results);
 */
export function dedupePlaces(places) {
  if (!Array.isArray(places)) return [];

  const seenLabels = new Set();
  const seenCoordinates = new Set();

  return places.filter((place) => {
    // Deduplichiamo sia per label mostrata all'utente sia per coordinate
    // arrotondate: in questo modo eliminiamo risultati quasi identici
    // senza dover dipendere da un id stabile del geocoder.
    const labelKey = formatPlace(place).trim().toLowerCase();
    const coordinateKey = [
      normalizeCoordinate(place?.latitude),
      normalizeCoordinate(place?.longitude)
    ].join('|');

    if (seenLabels.has(labelKey) || seenCoordinates.has(coordinateKey)) {
      return false;
    }

    seenLabels.add(labelKey);
    seenCoordinates.add(coordinateKey);
    return true;
  });
}

function normalizeCoordinate(value) {
  // Arrotondare rende piu robusta la deduplica quando il geocoder restituisce
  // coordinate quasi uguali per la stessa localita.
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return value.toFixed(3);
}
