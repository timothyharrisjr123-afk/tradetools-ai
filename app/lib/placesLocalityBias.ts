/**
 * Quiet locality bias for Places autocomplete — uses already-entered city/state/ZIP
 * so street-only queries do not rank distant same-named streets first.
 * Does not redesign geocoding; selection still resolves via Place Details.
 */

export type PlacesLocalityBias = {
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export function composePlacesAutocompleteInput(
  street: string,
  locality?: PlacesLocalityBias | null
): string {
  const q = street.trim();
  if (!q) return "";

  const city = String(locality?.city ?? "").trim();
  const state = String(locality?.state ?? "").trim();
  const zip = String(locality?.zip ?? "").trim();
  if (!city && !state && !zip) return q;

  const hay = q.toLowerCase();
  if (city && hay.includes(city.toLowerCase())) return q;
  if (zip && hay.includes(zip)) return q;

  const stateZip = [state, zip].filter(Boolean).join(" ");
  const localityPart = [city, stateZip].filter(Boolean).join(", ");
  return localityPart ? `${q}, ${localityPart}` : q;
}

export function scorePlacesSuggestionLocality(
  suggestion: { secondaryText?: string | null; fullText?: string | null },
  locality?: PlacesLocalityBias | null
): number {
  if (!locality) return 0;
  const hay = `${suggestion.secondaryText ?? ""} ${suggestion.fullText ?? ""}`.toLowerCase();
  if (!hay.trim()) return 0;

  let score = 0;
  const zip = String(locality.zip ?? "").trim();
  const state = String(locality.state ?? "").trim().toLowerCase();
  const city = String(locality.city ?? "").trim().toLowerCase();

  if (zip && hay.includes(zip.toLowerCase())) score += 4;
  if (state) {
    const stateToken = state.length === 2 ? state : state;
    if (
      hay.includes(`, ${stateToken}`) ||
      hay.includes(` ${stateToken} `) ||
      hay.endsWith(` ${stateToken}`) ||
      hay.includes(`${stateToken} `)
    ) {
      score += 2;
    }
  }
  if (city && hay.includes(city)) score += 1;
  return score;
}

export function rankPlacesSuggestionsByLocality<
  T extends { secondaryText?: string | null; fullText?: string | null },
>(suggestions: T[], locality?: PlacesLocalityBias | null): T[] {
  const city = String(locality?.city ?? "").trim();
  const state = String(locality?.state ?? "").trim();
  const zip = String(locality?.zip ?? "").trim();
  if (!city && !state && !zip) return suggestions;
  return [...suggestions].sort(
    (a, b) =>
      scorePlacesSuggestionLocality(b, locality) - scorePlacesSuggestionLocality(a, locality)
  );
}
