/** Google Places (New) server configuration. Never import from client code. */

export function getGooglePlacesApiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
  return key.length > 0 ? key : null;
}

export function isGooglePlacesConfigured(): boolean {
  return getGooglePlacesApiKey() != null;
}
