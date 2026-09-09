import type { NextRequest } from "next/server";
import type { PlacesLocalityBias } from "@/app/lib/placesLocalityBias";

const SESSION_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACE_ID = /^[A-Za-z0-9_-]{3,512}$/;
const LOCALITY = /^[\p{L}\p{N} .'-]+$/u;

export const PLACES_AUTOCOMPLETE_QUERY_KEYS = new Set([
  "q", "sessionToken", "city", "state", "zip",
]);
export const PLACES_DETAILS_QUERY_KEYS = new Set(["placeId", "sessionToken"]);

export type PlacesRequestValidation<T> =
  | { ok: true; value: T }
  | { ok: false; code: "invalid_request" };

function hasOnlyAllowedParams(req: NextRequest, allowed: Set<string>): boolean {
  return [...req.nextUrl.searchParams.keys()].every((key) => allowed.has(key));
}

export function isValidPlacesSessionToken(value: string | null | undefined): boolean {
  return value == null || value === "" || SESSION_TOKEN.test(value);
}

export function isValidPlacesPlaceId(value: string): boolean {
  const normalized = value.startsWith("places/") ? value.slice("places/".length) : value;
  return PLACE_ID.test(normalized);
}

function optionalLocality(value: string | null, maxLength: number): string | null | undefined {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > maxLength || !LOCALITY.test(normalized)) return undefined;
  return normalized;
}

export function parsePlacesAutocompleteRequest(
  req: NextRequest
): PlacesRequestValidation<{
  query: string;
  sessionToken: string | null;
  locality: PlacesLocalityBias | null;
}> {
  if (!hasOnlyAllowedParams(req, PLACES_AUTOCOMPLETE_QUERY_KEYS)) {
    return { ok: false, code: "invalid_request" };
  }
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sessionToken = (req.nextUrl.searchParams.get("sessionToken") ?? "").trim() || null;
  const city = optionalLocality(req.nextUrl.searchParams.get("city"), 80);
  const state = optionalLocality(req.nextUrl.searchParams.get("state"), 2);
  const zip = (req.nextUrl.searchParams.get("zip") ?? "").trim() || null;
  if (
    query.length > 160 || !isValidPlacesSessionToken(sessionToken) || city === undefined ||
    state === undefined || (state != null && !/^[A-Za-z]{2}$/.test(state)) ||
    (zip != null && !/^\d{1,5}$/.test(zip))
  ) {
    return { ok: false, code: "invalid_request" };
  }
  return {
    ok: true,
    value: { query, sessionToken, locality: city || state || zip ? { city, state, zip } : null },
  };
}

export function parsePlacesDetailsRequest(
  req: NextRequest
): PlacesRequestValidation<{ placeId: string; sessionToken: string | null }> {
  if (!hasOnlyAllowedParams(req, PLACES_DETAILS_QUERY_KEYS)) {
    return { ok: false, code: "invalid_request" };
  }
  const placeId = (req.nextUrl.searchParams.get("placeId") ?? "").trim();
  const sessionToken = (req.nextUrl.searchParams.get("sessionToken") ?? "").trim() || null;
  if (!isValidPlacesPlaceId(placeId) || !isValidPlacesSessionToken(sessionToken)) {
    return { ok: false, code: "invalid_request" };
  }
  return { ok: true, value: { placeId, sessionToken } };
}
