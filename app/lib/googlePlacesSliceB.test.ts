import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  movePlacesActiveIndex,
  placesQueryIsEligible,
} from "../tools/roofing/usePlacesAddressAssist";

const read = (path: string) => readFileSync(path, "utf8");

describe("Google Places Slice B interaction contract", () => {
  test("starts only at three meaningful characters and supports standard list navigation", () => {
    assert.equal(placesQueryIsEligible("12"), false);
    assert.equal(placesQueryIsEligible(" 123 "), true);
    assert.equal(movePlacesActiveIndex(-1, 5, "ArrowDown"), 0);
    assert.equal(movePlacesActiveIndex(0, 5, "ArrowUp"), 4);
    assert.equal(movePlacesActiveIndex(2, 5, "Home"), 0);
    assert.equal(movePlacesActiveIndex(2, 5, "End"), 4);
  });

  test("combobox exposes keyboard, pointer, attribution, and fallback states", () => {
    const source = read("app/tools/roofing/JobPacketAddressCombobox.tsx");
    for (const expected of [
      'role="combobox"',
      'aria-autocomplete="list"',
      "aria-activedescendant",
      'role="listbox"',
      'role="option"',
      "aria-selected",
      'aria-live="polite"',
      'translate="no"',
      "Google Maps",
      "No matching addresses",
      "Address suggestions are unavailable. Enter the address manually.",
      "Enter address manually",
      "ArrowDown",
      "ArrowUp",
      "Home",
      "End",
      "Escape",
      "Tab",
      "onPointerDown",
      "scrollIntoView",
      "min-h-11",
    ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("session is stable, bounded, cancelable, and retired by Details", () => {
    const source = read("app/tools/roofing/usePlacesAddressAssist.ts");
    assert.match(source, /PLACES_DEBOUNCE_MS = 280/);
    assert.match(source, /crypto\.randomUUID\(\)/);
    assert.match(source, /sessionTokenRef\.current/);
    assert.match(source, /controller\.abort\(\)/);
    assert.match(source, /requestSequence !== requestSequenceRef\.current/);
    assert.match(source, /PLACES_SESSION_IDLE_MS/);
    assert.match(source, /finally[\s\S]*sessionTokenRef\.current = null/);
  });

  test("selection retains Place ID only in form memory and gates FieldDive reuse", () => {
    const source = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(source, /selectedPlacesAddress/);
    assert.match(source, /setSelectedPlacesAddress\(resolved\)/);
    assert.match(source, /addressEntryMode === "manual" \|\| Boolean\(selectedPlacesAddress\)/);
    assert.match(source, /jobAddress2/);
    assert.doesNotMatch(source, /provider_place_id:\s*selectedPlacesAddress/);
  });

  test("SEARCHING hides structured fields and cannot mix stale locality into create", () => {
    const source = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(source, /clearStructuredAddressFields/);
    assert.match(source, /packetAddressResolved/);
    assert.match(
      source,
      /getPacketMinimumFieldsComplete\(packetFieldSnapshot\) && packetAddressResolved/
    );
    assert.match(
      source,
      /addressEntryMode === "search" && !selectedPlacesAddress && !selectedPropertyId/
    );
    assert.match(
      source,
      /Select an address from suggestions or enter the address manually/
    );
    assert.match(source, /if \(addressEntryMode === "search"\)/);
    assert.ok(source.includes("clearStructuredAddressFields()"));
    assert.ok(
      /addressEntryMode === "manual"[\s\S]{0,120}selectedPlacesAddress[\s\S]{0,120}selectedPropertyId/.test(
        source
      ),
      "structured fields gated to MANUAL / SELECTED / existing property"
    );
  });

  test("matching property display may collapse identical rows; Slice C owns durable dedupe", () => {
    const source = read("app/tools/roofing/JobPacketPropertyCandidates.tsx");
    assert.match(source, /dedupePropertyCandidatesForDisplay/);
    assert.match(source, /Slice C atomic resolver\/dedupe/);
  });
});
