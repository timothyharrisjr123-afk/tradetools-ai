/**
 * Wave B — Google Places (New) server config.
 * Server-only. Never expose the key to the browser.
 */

export function getGooglePlacesApiKey(): string | null {
  const key =
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    "";
  return key.length > 0 ? key : null;
}

export function isGooglePlacesConfigured(): boolean {
  return getGooglePlacesApiKey() != null;
}
