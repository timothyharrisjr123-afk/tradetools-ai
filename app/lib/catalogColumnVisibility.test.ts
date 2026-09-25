/**
 * Run: npx tsx --test app/lib/catalogColumnVisibility.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CATALOG_OPTIONAL_COLUMNS,
  CATALOG_REQUIRED_COLUMN_IDS,
  countVisibleOptionalCatalogColumns,
  defaultCatalogOptionalColumnVisibility,
  isCatalogOptionalColumnVisible,
  normalizeCatalogOptionalColumnVisibility,
  parseCatalogOptionalColumnVisibilityJson,
  serializeCatalogOptionalColumnVisibility,
} from "./catalogColumnVisibility";

describe("catalogColumnVisibility", () => {
  test("required columns are select, name, actions", () => {
    assert.deepEqual([...CATALOG_REQUIRED_COLUMN_IDS], ["select", "name", "actions"]);
  });

  test("defaults lead with selling columns and subordinate admin columns", () => {
    const defaults = defaultCatalogOptionalColumnVisibility();
    assert.deepEqual(
      CATALOG_OPTIONAL_COLUMNS.map((c) => c.id),
      ["unit_price", "unit", "measurement", "status", "unit_cost", "type", "proposal"]
    );
    assert.equal(defaults.unit_price, true);
    assert.equal(defaults.unit, true);
    assert.equal(defaults.measurement, true);
    assert.equal(defaults.status, true);
    assert.equal(defaults.unit_cost, true);
    assert.equal(defaults.type, false);
    assert.equal(defaults.proposal, false);
    assert.equal(countVisibleOptionalCatalogColumns(defaults), 5);
  });

  test("normalize toggles optional columns and ignores unknown keys", () => {
    const normalized = normalizeCatalogOptionalColumnVisibility({
      type: false,
      unit_cost: false,
      unknown: true,
      proposal: true,
    });
    assert.equal(normalized.type, false);
    assert.equal(normalized.unit_cost, false);
    assert.equal(normalized.proposal, true);
    assert.equal(normalized.measurement, true);
    assert.equal("unknown" in normalized, false);
  });

  test("parse recovers from invalid JSON", () => {
    const parsed = parseCatalogOptionalColumnVisibilityJson("{not-json");
    assert.deepEqual(parsed, defaultCatalogOptionalColumnVisibility());
  });

  test("serialize round-trips visibility", () => {
    const next = {
      ...defaultCatalogOptionalColumnVisibility(),
      type: false,
      status: false,
    };
    const again = parseCatalogOptionalColumnVisibilityJson(
      serializeCatalogOptionalColumnVisibility(next)
    );
    assert.equal(again.type, false);
    assert.equal(again.status, false);
    assert.equal(again.unit_price, true);
  });

  test("isCatalogOptionalColumnVisible respects toggles", () => {
    const visibility = defaultCatalogOptionalColumnVisibility();
    visibility.unit = false;
    assert.equal(isCatalogOptionalColumnVisible(visibility, "unit"), false);
    assert.equal(isCatalogOptionalColumnVisible(visibility, "type"), false);
    assert.equal(isCatalogOptionalColumnVisible(visibility, "unit_price"), true);
  });
});
