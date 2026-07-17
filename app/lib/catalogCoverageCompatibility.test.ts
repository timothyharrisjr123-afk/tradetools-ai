/**
 * Run: npx tsx --test app/lib/catalogCoverageCompatibility.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  catalogCoverageCompatibilityBlocksRawModeSwitch,
  catalogCoverageCompatibilityLabel,
  classifyCatalogCoverageCompatibility,
  coverageBasisCategoryForQuantitySource,
} from "./catalogCoverageCompatibility";

describe("classifyCatalogCoverageCompatibility", () => {
  test("null coverage is not_applicable (1:1)", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_squares",
        unit: "bundle",
        coverage_rate: null,
        coverage_basis: "roof_square",
      }),
      "not_applicable"
    );
  });

  test("non-null coverage + null basis is not_verified", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_area_sqft",
        unit: "bundle",
        coverage_rate: 33.3,
        coverage_basis: null,
        waste_applies: true,
        waste_pct: 10,
      }),
      "not_verified"
    );
  });

  test("coverage on fixed quantity source is incompatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "fixed",
        unit: "each",
        coverage_rate: 5,
        coverage_basis: "each",
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
        coverage_basis: "roof_square",
      }),
      "incompatible"
    );
  });

  test("roof_squares + roof_square is compatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_squares",
        unit: "bundle",
        coverage_rate: 5,
        coverage_basis: "roof_square",
      }),
      "compatible"
    );
  });

  test("tear_off_squares + roof_square is compatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "tear_off_squares",
        unit: "bundle",
        coverage_rate: 5,
        coverage_basis: "roof_square",
      }),
      "compatible"
    );
  });

  test("adjusted_roof_squares + roof_square is compatible via approved raw remap", () => {
    assert.equal(
      coverageBasisCategoryForQuantitySource("adjusted_roof_squares"),
      "roof_square"
    );
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "adjusted_roof_squares",
        unit: "bundle",
        coverage_rate: 5,
        coverage_basis: "roof_square",
      }),
      "compatible"
    );
  });

  test("roof_area_sqft + square_feet is compatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_area_sqft",
        unit: "bundle",
        coverage_rate: 33.3,
        coverage_basis: "square_feet",
      }),
      "compatible"
    );
  });

  test("*_lf + linear_feet is compatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "eaves_lf",
        unit: "linear_foot",
        coverage_rate: 10,
        coverage_basis: "linear_feet",
      }),
      "compatible"
    );
  });

  test("*_count + each is compatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "pipe_boots_count",
        unit: "each",
        coverage_rate: 1,
        coverage_basis: "each",
      }),
      "compatible"
    );
  });

  test("debris_tons + tons is compatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "debris_tons",
        unit: "each",
        coverage_rate: 1,
        coverage_basis: "tons",
      }),
      "compatible"
    );
  });

  test("mismatched basis/source is incompatible", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "roof_squares",
        unit: "bundle",
        coverage_rate: 5,
        coverage_basis: "square_feet",
      }),
      "incompatible"
    );
  });

  test("custom and labor_multiplier stay not_verified until mapped", () => {
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "custom",
        unit: "each",
        coverage_rate: 2,
        coverage_basis: "each",
      }),
      "not_verified"
    );
    assert.equal(
      classifyCatalogCoverageCompatibility({
        quantity_source: "labor_multiplier",
        unit: "hour",
        coverage_rate: 2,
        coverage_basis: "each",
      }),
      "not_verified"
    );
  });

  test("raw mode switch stays blocked for not_verified and incompatible", () => {
    assert.equal(catalogCoverageCompatibilityBlocksRawModeSwitch("not_verified"), true);
    assert.equal(catalogCoverageCompatibilityBlocksRawModeSwitch("incompatible"), true);
    assert.equal(catalogCoverageCompatibilityBlocksRawModeSwitch("not_applicable"), false);
    assert.equal(catalogCoverageCompatibilityBlocksRawModeSwitch("compatible"), false);
  });

  test("contractor status labels omit not_applicable", () => {
    assert.equal(catalogCoverageCompatibilityLabel("compatible"), "Compatible");
    assert.equal(catalogCoverageCompatibilityLabel("not_verified"), "Not verified");
    assert.equal(catalogCoverageCompatibilityLabel("incompatible"), "Incompatible");
    assert.equal(catalogCoverageCompatibilityLabel("not_applicable"), null);
  });
});
