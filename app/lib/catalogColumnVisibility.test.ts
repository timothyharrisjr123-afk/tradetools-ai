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

  test("defaults show all optional columns", () => {
    const defaults = defaultCatalogOptionalColumnVisibility();
    for (const col of CATALOG_OPTIONAL_COLUMNS) {
      assert.equal(defaults[col.id], true);
    }
    assert.equal(
      countVisibleOptionalCatalogColumns(defaults),
      CATALOG_OPTIONAL_COLUMNS.length
    );
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
    assert.equal(isCatalogOptionalColumnVisible(visibility, "type"), true);
  });
});
