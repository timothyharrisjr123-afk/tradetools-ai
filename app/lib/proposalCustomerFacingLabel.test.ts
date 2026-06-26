/**
 * Run: npx tsx --test app/lib/proposalCustomerFacingLabel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  formatCustomerFacingLineLabel,
  formatCustomerFacingUnit,
  looksLikeInternalCatalogKey,
} from "./proposalCustomerFacingLabel";

describe("formatCustomerFacingLineLabel", () => {
  test("transforms dotted catalog keys", () => {
    assert.equal(formatCustomerFacingLineLabel("roofing.architectural_shingles"), "Architectural Shingles");
    assert.equal(formatCustomerFacingLineLabel("roofing.synthetic_underlayment"), "Synthetic Underlayment");
    assert.equal(formatCustomerFacingLineLabel("roofing.ice_and_water_shield"), "Ice And Water Shield");
    assert.equal(formatCustomerFacingLineLabel("roofing.ridge_vent"), "Ridge Vent");
  });

  test("transforms snake_case labels", () => {
    assert.equal(formatCustomerFacingLineLabel("ice_and_water_shield"), "Ice And Water Shield");
  });

  test("preserves already human labels", () => {
    assert.equal(formatCustomerFacingLineLabel("Shingles"), "Shingles");
    assert.equal(formatCustomerFacingLineLabel("Roofing installation"), "Roofing installation");
  });
});

describe("formatCustomerFacingUnit", () => {
  test("maps common units", () => {
    assert.equal(formatCustomerFacingUnit("SQ"), "Squares");
    assert.equal(formatCustomerFacingUnit("EA"), "Each");
    assert.equal(formatCustomerFacingUnit("LF"), "Linear feet");
  });
});

describe("looksLikeInternalCatalogKey", () => {
  test("detects internal-style keys", () => {
    assert.equal(looksLikeInternalCatalogKey("roofing.architectural_shingles"), true);
    assert.equal(looksLikeInternalCatalogKey("Shingles"), false);
  });
});
