/**
 * Wave B — Google Places (New) server helpers.
 * Autocomplete + place details only. No maps, routes, or property enrichment.
 *
 * Session token: one UUID per autocomplete→details selection session so Google
 * bills the pair as a session (required cost/correctness behavior for Places New).
 */

import { getGooglePlacesApiKey } from "@/app/lib/placesConfig";
import {
  composePlacesAutocompleteInput,
  type PlacesLocalityBias,
} from "@/app/lib/placesLocalityBias";

export type PlacesAutocompleteSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
};

export type PlacesResolvedAddress = {
  formatted: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
export const PLACES_AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat";
export const PLACES_DETAILS_FIELD_MASK = "id,formattedAddress,addressComponents";
export const PLACES_AUTOCOMPLETE_TIMEOUT_MS = 2_500;
export const PLACES_DETAILS_TIMEOUT_MS = 4_000;
export const PLACES_AUTOCOMPLETE_TYPES = [
  "street_address",
  "premise",
  "subpremise",
  "route",
  "plus_code",
] as const;

export type PlacesProviderError =
  | "timeout"
  | "network_error"
  | "provider_error"
  | "malformed_response";

type PlacesProviderResult<T> = { available: boolean; error?: PlacesProviderError } & T;

/** Normalize Place ID / resource name to the id segment used by Places Details. */
export function normalizePlacesPlaceId(placeId: string): string {
  const raw = String(placeId ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("places/") ? raw.slice("places/".length) : raw;
}

function placesHeaders(apiKey: string, fieldMask: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": fieldMask,
  };
}

function logPlacesFailure(
  operation: "autocomplete" | "details",
  classification: PlacesProviderError,
  status?: number
): void {
  console.error("[google_places] request failed", {
    provider: "google_places",
    operation,
    classification,
    ...(status == null ? {} : { status }),
    environment: process.env.NODE_ENV ?? "unknown",
  });
}

async function providerFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function buildPlacesAutocompleteBody(
  input: string,
  sessionToken?: string | null,
  locality?: PlacesLocalityBias | null
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    input: composePlacesAutocompleteInput(input.trim(), locality),
    includedRegionCodes: ["us"],
    regionCode: "us",
    languageCode: "en-US",
    includedPrimaryTypes: [...PLACES_AUTOCOMPLETE_TYPES],
    includeQueryPredictions: false,
  };
  const token = String(sessionToken ?? "").trim();
  if (token) body.sessionToken = token;
  return body;
}

export async function fetchPlacesAutocomplete(
  input: string,
  sessionToken?: string | null,
  locality?: PlacesLocalityBias | null
): Promise<PlacesProviderResult<{ suggestions: PlacesAutocompleteSuggestion[] }>> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return { available: false, suggestions: [] };
  }

  const street = input.trim();
  if (street.length < 3) {
    return { available: true, suggestions: [] };
  }

  try {
    const res = await providerFetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: placesHeaders(apiKey, PLACES_AUTOCOMPLETE_FIELD_MASK),
      body: JSON.stringify(buildPlacesAutocompleteBody(street, sessionToken, locality)),
      cache: "no-store",
    }, PLACES_AUTOCOMPLETE_TIMEOUT_MS);

    if (!res.ok) {
      logPlacesFailure("autocomplete", "provider_error", res.status);
      return { available: false, suggestions: [], error: "provider_error" };
    }

    const json = await res.json().catch(() => null) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    } | null;
    if (!json || (json.suggestions != null && !Array.isArray(json.suggestions))) {
      logPlacesFailure("autocomplete", "malformed_response");
      return { available: false, suggestions: [], error: "malformed_response" };
    }

    const suggestions: PlacesAutocompleteSuggestion[] = [];
    for (const item of json.suggestions ?? []) {
      const pred = item.placePrediction;
      const placeId = normalizePlacesPlaceId(String(pred?.placeId ?? ""));
      if (!placeId) continue;
      const primaryText = String(pred?.structuredFormat?.mainText?.text ?? "").trim();
      const secondaryText = String(pred?.structuredFormat?.secondaryText?.text ?? "").trim();
      const fullText =
        String(pred?.text?.text ?? "").trim() ||
        [primaryText, secondaryText].filter(Boolean).join(", ");
      suggestions.push({
        placeId,
        primaryText: primaryText || fullText,
        secondaryText,
        fullText,
      });
      if (suggestions.length >= 5) break;
    }

    return { available: true, suggestions };
  } catch (error) {
    const classification = error instanceof DOMException && error.name === "AbortError"
      ? "timeout"
      : "network_error";
    logPlacesFailure("autocomplete", classification);
    return { available: false, suggestions: [], error: classification };
  }
}

function component(
  components: Array<{ longText?: string; shortText?: string; types?: string[] }>,
  type: string,
  preferShort = false
): string {
  const hit = components.find((c) => (c.types ?? []).includes(type));
  if (!hit) return "";
  return String((preferShort ? hit.shortText : hit.longText) || hit.longText || hit.shortText || "").trim();
}

export async function fetchPlacesDetails(
  placeId: string,
  sessionToken?: string | null
): Promise<PlacesProviderResult<{ address: PlacesResolvedAddress | null }>> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return { available: false, address: null };
  }

  const id = normalizePlacesPlaceId(placeId);
  if (!id) {
    return { available: true, address: null };
  }

  try {
    const params = new URLSearchParams();
    const token = String(sessionToken ?? "").trim();
    if (token) params.set("sessionToken", token);
    const qs = params.toString();
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
    const res = await providerFetch(url, {
      method: "GET",
      headers: placesHeaders(apiKey, PLACES_DETAILS_FIELD_MASK),
      cache: "no-store",
    }, PLACES_DETAILS_TIMEOUT_MS);

    if (!res.ok) {
      logPlacesFailure("details", "provider_error", res.status);
      return { available: false, address: null, error: "provider_error" };
    }

    const json = await res.json().catch(() => null) as {
      id?: string;
      formattedAddress?: string;
      addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    } | null;
    if (
      !json || normalizePlacesPlaceId(String(json.id ?? "")) !== id ||
      !Array.isArray(json.addressComponents)
    ) {
      logPlacesFailure("details", "malformed_response");
      return { available: false, address: null, error: "malformed_response" };
    }

    const comps = Array.isArray(json.addressComponents) ? json.addressComponents : [];
    const streetNumber = component(comps, "street_number");
    const route = component(comps, "route");
    const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
    const city =
      component(comps, "locality") ||
      component(comps, "sublocality") ||
      component(comps, "postal_town") ||
      component(comps, "administrative_area_level_3");
    const state = component(comps, "administrative_area_level_1", true);
    const zip = component(comps, "postal_code", true);
    const country = component(comps, "country", true) || "US";
    const formatted = String(json.formattedAddress ?? "").trim();

    if (!line1 && !formatted) {
      return { available: true, address: null };
    }

    return {
      available: true,
      address: {
        formatted: formatted || [line1, city, state, zip].filter(Boolean).join(", "),
        line1: line1 || formatted,
        city,
        state,
        zip,
        country,
      },
    };
  } catch (error) {
    const classification = error instanceof DOMException && error.name === "AbortError"
      ? "timeout"
      : "network_error";
    logPlacesFailure("details", classification);
    return { available: false, address: null, error: classification };
  }
}
