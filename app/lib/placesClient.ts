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

export async function fetchPlacesAutocomplete(
  input: string,
  sessionToken?: string | null,
  locality?: PlacesLocalityBias | null
): Promise<{ available: boolean; suggestions: PlacesAutocompleteSuggestion[]; error?: string }> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return { available: false, suggestions: [] };
  }

  const street = input.trim();
  if (street.length < 3) {
    return { available: true, suggestions: [] };
  }

  const q = composePlacesAutocompleteInput(street, locality);

  try {
    const body: Record<string, unknown> = {
      input: q,
      includedRegionCodes: ["us"],
      languageCode: "en",
    };
    const token = String(sessionToken ?? "").trim();
    if (token) body.sessionToken = token;

    const res = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: placesHeaders(
        apiKey,
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat"
      ),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[places] autocomplete failed", res.status, errBody.slice(0, 300));
      return { available: true, suggestions: [], error: "provider_error" };
    }

    const json = (await res.json()) as {
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
    };

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
  } catch (err) {
    console.error("[places] autocomplete error", err);
    return { available: true, suggestions: [], error: "network_error" };
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
): Promise<{ available: boolean; address: PlacesResolvedAddress | null; error?: string }> {
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
    const res = await fetch(url, {
      method: "GET",
      headers: placesHeaders(apiKey, "formattedAddress,addressComponents"),
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[places] details failed", res.status, errBody.slice(0, 300));
      return { available: true, address: null, error: "provider_error" };
    }

    const json = (await res.json()) as {
      formattedAddress?: string;
      addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    };

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
  } catch (err) {
    console.error("[places] details error", err);
    return { available: true, address: null, error: "network_error" };
  }
}
