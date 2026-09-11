import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { getGooglePlacesApiKey, isGooglePlacesConfigured } from "./placesConfig";
import {
  buildPlacesAutocompleteBody,
  fetchPlacesAutocomplete,
  fetchPlacesDetails,
  PLACES_AUTOCOMPLETE_FIELD_MASK,
  PLACES_AUTOCOMPLETE_TIMEOUT_MS,
  PLACES_DETAILS_FIELD_MASK,
  PLACES_DETAILS_TIMEOUT_MS,
} from "./placesClient";
import { checkPlacesRateLimit, type PlacesRateLimitCounterStore } from "./placesRateLimit";
import {
  isValidPlacesPlaceId,
  isValidPlacesSessionToken,
  parsePlacesAutocompleteRequest,
  parsePlacesDetailsRequest,
} from "./placesRequestContract";

const ROOT = process.cwd();
const VALID_TOKEN = "123e4567-e89b-42d3-a456-426614174000";
const ORIGINAL_KEY = process.env.GOOGLE_PLACES_API_KEY;
const ORIGINAL_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ERROR = console.error;

test.afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_MAPS_KEY === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = ORIGINAL_MAPS_KEY;
  globalThis.fetch = ORIGINAL_FETCH;
  console.error = ORIGINAL_ERROR;
});

test("configuration uses only the dedicated server credential", () => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY = "must-not-be-used";
  assert.equal(getGooglePlacesApiKey(), null);
  assert.equal(isGooglePlacesConfigured(), false);
  process.env.GOOGLE_PLACES_API_KEY = "dedicated-key";
  assert.equal(getGooglePlacesApiKey(), "dedicated-key");
  assert.equal(isGooglePlacesConfigured(), true);
  assert.doesNotMatch(readFileSync(join(ROOT, "app/lib/placesConfig.ts"), "utf8"), /GOOGLE_MAPS_API_KEY/);
});

test("missing configuration returns a manual-fallback-safe result", async () => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  const autocomplete = await fetchPlacesAutocomplete("123 Main Street");
  const details = await fetchPlacesDetails("ChIJ_test");
  assert.deepEqual(autocomplete, { available: false, suggestions: [] });
  assert.deepEqual(details, { available: false, address: null });
});

test("autocomplete body is server-owned, address-oriented, and US-only", () => {
  assert.deepEqual(buildPlacesAutocompleteBody("123 Main", VALID_TOKEN, { city: "Tulsa", state: "OK" }), {
    input: "123 Main, Tulsa, OK",
    includedRegionCodes: ["us"],
    regionCode: "us",
    languageCode: "en-US",
    includedPrimaryTypes: ["geocode"],
    includeQueryPredictions: false,
    sessionToken: VALID_TOKEN,
  });
  assert.equal(PLACES_AUTOCOMPLETE_FIELD_MASK,
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat");
  assert.equal(PLACES_DETAILS_FIELD_MASK, "id,formattedAddress,addressComponents");
  assert.equal(PLACES_AUTOCOMPLETE_TIMEOUT_MS, 2_500);
  assert.equal(PLACES_DETAILS_TIMEOUT_MS, 4_000);
});

test("request contract rejects arbitrary parameters and malformed identifiers", () => {
  const valid = parsePlacesAutocompleteRequest(new NextRequest(
    `http://localhost/api/places/autocomplete?q=123%20Main&sessionToken=${VALID_TOKEN}&city=Tulsa&state=OK&zip=74104`
  ));
  assert.equal(valid.ok, true);
  assert.equal(parsePlacesAutocompleteRequest(new NextRequest(
    "http://localhost/api/places/autocomplete?q=123&locationBias=attacker-controlled"
  )).ok, false);
  assert.equal(parsePlacesAutocompleteRequest(new NextRequest(
    "http://localhost/api/places/autocomplete?q=123&sessionToken=oversized-or-invalid"
  )).ok, false);
  assert.equal(parsePlacesDetailsRequest(new NextRequest(
    `http://localhost/api/places/details?placeId=ChIJ_test&sessionToken=${VALID_TOKEN}`
  )).ok, true);
  assert.equal(parsePlacesDetailsRequest(new NextRequest(
    "http://localhost/api/places/details?placeId=../../secret"
  )).ok, false);
  assert.equal(isValidPlacesSessionToken(VALID_TOKEN), true);
  assert.equal(isValidPlacesSessionToken("not-a-token"), false);
  assert.equal(isValidPlacesPlaceId("places/ChIJ_test"), true);
});

test("autocomplete normalizes output, caps five, and never logs provider bodies or keys", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "secret-never-log";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (_url, init) => {
    requestInit = init;
    return Response.json({
      suggestions: Array.from({ length: 7 }, (_, index) => ({
        placePrediction: {
          placeId: `place_${index}`,
          text: { text: `${index} Main Street, Tulsa, OK` },
          structuredFormat: { mainText: { text: `${index} Main Street` }, secondaryText: { text: "Tulsa, OK" } },
        },
      })),
    });
  };
  const result = await fetchPlacesAutocomplete("123 Main", VALID_TOKEN);
  assert.equal(result.available, true);
  assert.equal(result.suggestions.length, 5);
  assert.equal(result.suggestions[0]?.primaryText, "0 Main Street");
  assert.equal(new Headers(requestInit?.headers).get("X-Goog-FieldMask"), PLACES_AUTOCOMPLETE_FIELD_MASK);

  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => { logged.push(args); };
  globalThis.fetch = async () => new Response("sensitive provider address and secret-never-log", { status: 429 });
  const failure = await fetchPlacesAutocomplete("123 Main", VALID_TOKEN);
  assert.equal(failure.error, "provider_error");
  const serialized = JSON.stringify(logged);
  assert.doesNotMatch(serialized, /sensitive provider address|secret-never-log/);
  assert.match(serialized, /google_places|autocomplete|provider_error|429/);
});

test("details verifies identity and returns only normalized address fields", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "dedicated-key";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (_url, init) => {
    requestInit = init;
    return Response.json({
      id: "ChIJ_test",
      formattedAddress: "123 Main St, Tulsa, OK 74104, USA",
      addressComponents: [
        { longText: "123", types: ["street_number"] },
        { longText: "Main Street", types: ["route"] },
        { longText: "Tulsa", types: ["locality"] },
        { longText: "Oklahoma", shortText: "OK", types: ["administrative_area_level_1"] },
        { longText: "74104", shortText: "74104", types: ["postal_code"] },
        { longText: "United States", shortText: "US", types: ["country"] },
      ],
      reviews: [{ text: "must not leak" }],
    });
  };
  const result = await fetchPlacesDetails("ChIJ_test", VALID_TOKEN);
  assert.deepEqual(result.address, {
    formatted: "123 Main St, Tulsa, OK 74104, USA",
    line1: "123 Main Street",
    city: "Tulsa",
    state: "OK",
    zip: "74104",
    country: "US",
  });
  assert.equal(new Headers(requestInit?.headers).get("X-Goog-FieldMask"), PLACES_DETAILS_FIELD_MASK);
  assert.equal("reviews" in (result.address ?? {}), false);
});

test("details maps subpremise into address line2", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "dedicated-key";
  globalThis.fetch = async () =>
    Response.json({
      id: "ChIJ_unit",
      formattedAddress: "123 Main St Unit 4, Tulsa, OK 74104, USA",
      addressComponents: [
        { longText: "123", types: ["street_number"] },
        { longText: "Main Street", types: ["route"] },
        { longText: "4", types: ["subpremise"] },
        { longText: "Tulsa", types: ["locality"] },
        { longText: "Oklahoma", shortText: "OK", types: ["administrative_area_level_1"] },
        { longText: "74104", shortText: "74104", types: ["postal_code"] },
        { longText: "United States", shortText: "US", types: ["country"] },
      ],
    });
  const result = await fetchPlacesDetails("ChIJ_unit", VALID_TOKEN);
  assert.equal(result.address?.line2, "4");
  assert.equal(result.address?.line1, "123 Main Street");
});

test("timeout and malformed responses are safely classified", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "dedicated-key";
  console.error = () => undefined;
  globalThis.fetch = async () => { throw new DOMException("aborted", "AbortError"); };
  assert.equal((await fetchPlacesAutocomplete("123 Main", VALID_TOKEN)).error, "timeout");
  globalThis.fetch = async () => new Response("not json", { status: 200 });
  assert.equal((await fetchPlacesAutocomplete("123 Main", VALID_TOKEN)).error, "malformed_response");
});

test("rate limits are scoped by opaque user and company identities", async () => {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  const store: PlacesRateLimitCounterStore = {
    async increment(key) {
      keys.push(key);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count;
    },
  };
  for (let index = 0; index < 90; index += 1) {
    assert.equal((await checkPlacesRateLimit({
      operation: "autocomplete", userId: "user-a", companyId: "company-a", store,
    })).allowed, true);
  }
  assert.deepEqual(await checkPlacesRateLimit({
    operation: "autocomplete", userId: "user-a", companyId: "company-a", store,
  }), { allowed: false, reason: "rate_limited" });
  assert.equal((await checkPlacesRateLimit({
    operation: "autocomplete", userId: "user-b", companyId: "company-b", store,
  })).allowed, true);
  assert.equal(keys.some((key) => key.includes("user-a") || key.includes("company-a")), false);
  assert.equal(new Set(keys.filter((key) => key.includes(":user:"))).size, 2);
  assert.equal(new Set(keys.filter((key) => key.includes(":company:"))).size, 2);

  const companyLimitedStore: PlacesRateLimitCounterStore = {
    async increment(key) {
      return key.includes(":company:") ? 601 : 1;
    },
  };
  assert.deepEqual(await checkPlacesRateLimit({
    operation: "autocomplete", userId: "fresh-user", companyId: "busy-company",
    store: companyLimitedStore,
  }), { allowed: false, reason: "rate_limited" });

  const unavailableStore: PlacesRateLimitCounterStore = {
    async increment() { throw new Error("store unavailable"); },
  };
  assert.deepEqual(await checkPlacesRateLimit({
    operation: "details", userId: "user", companyId: "company", store: unavailableStore,
  }), { allowed: false, reason: "unavailable" });
});

test("Places routes retain authentication, company membership, and fail-closed responses", () => {
  for (const relative of ["app/api/places/autocomplete/route.ts", "app/api/places/details/route.ts"]) {
    const source = readFileSync(join(ROOT, relative), "utf8");
    assert.match(source, /supabase\.auth\.getUser\(\)/);
    assert.match(source, /getUserCompanyId\(supabase, user\.id\)/);
    assert.match(source, /checkPlacesRateLimit/);
    assert.match(source, /temporarily_unavailable/);
    assert.doesNotMatch(source, /companyId\s*=\s*req\./);
  }
});
