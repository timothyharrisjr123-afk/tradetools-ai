/**
 * Places locality bias — New Job address autocomplete context.
 * Run: npx tsx --test app/lib/placesLocalityBias.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  composePlacesAutocompleteInput,
  rankPlacesSuggestionsByLocality,
  scorePlacesSuggestionLocality,
} from "./placesLocalityBias";

describe("composePlacesAutocompleteInput", () => {
  test("street alone when locality empty", () => {
    assert.equal(composePlacesAutocompleteInput("1842 Oak Ridge Dr"), "1842 Oak Ridge Dr");
    assert.equal(
      composePlacesAutocompleteInput("1842 Oak Ridge Dr", { city: "", state: "", zip: "" }),
      "1842 Oak Ridge Dr"
    );
  });

  test("appends city/state/ZIP when present", () => {
    assert.equal(
      composePlacesAutocompleteInput("1842 Oak Ridge Dr", {
        city: "Austin",
        state: "TX",
        zip: "78704",
      }),
      "1842 Oak Ridge Dr, Austin, TX 78704"
    );
  });

  test("does not double-append when street already includes city", () => {
    assert.equal(
      composePlacesAutocompleteInput("1842 Oak Ridge Dr, Austin", {
        city: "Austin",
        state: "TX",
        zip: "78704",
      }),
      "1842 Oak Ridge Dr, Austin"
    );
  });
});

describe("rankPlacesSuggestionsByLocality", () => {
  test("prefers suggestions matching known TX locality over distant states", () => {
    const ranked = rankPlacesSuggestionsByLocality(
      [
        {
          placeId: "mo",
          primaryText: "1842 Oak Ridge Dr",
          secondaryText: "Springfield, MO, USA",
          fullText: "1842 Oak Ridge Dr, Springfield, MO, USA",
        },
        {
          placeId: "tx",
          primaryText: "1842 Oak Ridge Dr",
          secondaryText: "Austin, TX 78704, USA",
          fullText: "1842 Oak Ridge Dr, Austin, TX 78704, USA",
        },
        {
          placeId: "ok",
          primaryText: "1842 Oak Ridge Dr",
          secondaryText: "Oklahoma City, OK, USA",
          fullText: "1842 Oak Ridge Dr, Oklahoma City, OK, USA",
        },
      ],
      { city: "Austin", state: "TX", zip: "78704" }
    );
    assert.equal(ranked[0]?.placeId, "tx");
    assert.ok(
      scorePlacesSuggestionLocality(ranked[0]!, { city: "Austin", state: "TX", zip: "78704" }) >
        scorePlacesSuggestionLocality(ranked[1]!, { city: "Austin", state: "TX", zip: "78704" })
    );
  });
});
