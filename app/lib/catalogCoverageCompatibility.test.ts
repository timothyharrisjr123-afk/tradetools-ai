/**
 * Run: npx tsx --test app/lib/catalogCoverageCompatibility.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  catalogCoverageCompatibilityBlocksRawModeSwitch,
  classifyCatalogCoverageCompatibility,
} from "./catalogCoverageCompatibility";

describe("classifyCatalogCoverageCompatibility", () => {
  test("null coverage is not_applicable (1:1)", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_squares",
        unit: "bundle",
        coverage_rate: null,
      }),
      "not_applicable"
    );
  });

  test("non-null coverage is not_verified — schema cannot prove dimensional match", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_area_sqft",
        unit: "bundle",
        coverage_rate: 33.3,
        waste_applies: true,
        waste_pct: 10,
      }),
      "not_verified"
    );
  });

  test("never returns compatible without coverage_basis", () => {
    const statuses = [
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_squares",
        unit: "square",
        coverage_rate: 1,
      }),
      classifyCatalogCoverageCompatibility({
        quantity_source: "adjusted_roof_squares",
        unit: "bundle",
        coverage_rate: 5,
      }),
    ];
    assert.ok(statuses.every((status) => status !== "compatible"));
  });

  test("coverage on fixed quantity source is incompatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "fixed",
        unit: "each",
        coverage_rate: 5,
      }),
      "incompatible"
    );
  });

  test("non-positive coverage is incompatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_squares",
        unit: "bundle",
        coverage_rate: 0,
      }),
      "incompatible"
    );
  });

  test("raw mode switch stays blocked for not_verified and incompatible", () => {
    assert.equal(catalogCoverageCompatibilityBlocksRawModeSwitch("not_verified"), true);
    assert.equal(catalogCoverageCompatibilityBlocksRawModeSwitch("incompatible"), true);
    assert.equal(catalogCoverageCompatibilityBlocksRawModeSwitch("not_applicable"), false);
    assert.equal(catalogCoverageCompatibilityBlocksRawModeSwitch("compatible"), false);
  });
});
