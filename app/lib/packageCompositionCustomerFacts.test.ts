/**
 * Run: npx tsx --test app/lib/packageCompositionCustomerFacts.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  inheritCatalogQuantity,
  type CompositionDiffEntry,
  type CompositionEntry,
} from "./packageComposition";
import {
  assertCustomerFactLineSafe,
  formatCustomerCompositionFact,
  formatCustomerCompositionFacts,
} from "./packageCompositionCustomerFacts";

function entry(
  overrides: Partial<CompositionEntry> & Pick<CompositionEntry, "entryId" | "packageId" | "customerLabel">
): CompositionEntry {
  return {
    role: "included",
    compositionRole: "roof_covering",
    compositionSlotKey: "roof_covering",
    productId: "prod-a",
    provenanceKey: "seed.a",
    productName: overrides.customerLabel,
    quantity: inheritCatalogQuantity(),
    unitPriceCents: null,
    ...overrides,
  };
}

function diff(
  kind: CompositionDiffEntry["kind"],
  target: CompositionEntry | null,
  base: CompositionEntry | null = null
): CompositionDiffEntry {
  return {
    kind,
    title: target?.customerLabel ?? base?.customerLabel ?? "Line",
    base,
    target,
    detail: `${kind} detail`,
    unitPriceDeltaCents: null,
    sameProduct: false,
  };
}

describe("packageCompositionCustomerFacts", () => {
  test("PRODUCT_REPLACEMENT uses the replacement product label only", () => {
    const line = formatCustomerCompositionFact(
      diff(
        "PRODUCT_REPLACEMENT",
        entry({
          entryId: "t",
          packageId: "p2",
          customerLabel: "Designer architectural shingles",
          productId: "prod-b",
        }),
        entry({
          entryId: "b",
          packageId: "p1",
          customerLabel: "Architectural shingles",
        })
      )
    );
    assert.equal(line, "Designer architectural shingles");
  });

  test("ADDED_INCLUDED_SCOPE is a truthful added line", () => {
    const line = formatCustomerCompositionFact(
      diff(
        "ADDED_INCLUDED_SCOPE",
        entry({
          entryId: "t",
          packageId: "p2",
          customerLabel: "Ice & water protection at eaves",
          compositionSlotKey: "ice_water.eaves",
        })
      )
    );
    assert.equal(line, "Added Ice & water protection at eaves");
  });

  test("OPTIONAL_UPGRADE_ADDED is a truthful optional line", () => {
    const line = formatCustomerCompositionFact(
      diff(
        "OPTIONAL_UPGRADE_ADDED",
        entry({
          entryId: "t",
          packageId: "p2",
          role: "optional_upgrade",
          customerLabel: "Additional roof ventilation",
          compositionRole: "ventilation",
          compositionSlotKey: "ventilation.additional",
        })
      )
    );
    assert.equal(line, "Optional: Additional roof ventilation");
  });

  test("LABEL_ONLY may surface a customer-safe label when useful", () => {
    assert.equal(
      formatCustomerCompositionFact(
        diff(
          "LABEL_ONLY",
          entry({ entryId: "t", packageId: "p2", customerLabel: "Shingles" }),
          entry({ entryId: "b", packageId: "p1", customerLabel: "Roof shingles", productId: "prod-a" })
        )
      ),
      "Shingles"
    );
  });

  test("UNCHANGED is omitted", () => {
    const same = entry({ entryId: "t", packageId: "p2", customerLabel: "Tear-off" });
    assert.equal(formatCustomerCompositionFact(diff("UNCHANGED", same, same)), null);
  });

  test("customer facts omit internals and classification names", () => {
    const lines = formatCustomerCompositionFacts([
      diff(
        "PRODUCT_REPLACEMENT",
        entry({
          entryId: "t",
          packageId: "p2",
          customerLabel: "Designer architectural shingles",
        }),
        entry({
          entryId: "b",
          packageId: "p1",
          customerLabel: "Architectural shingles",
        })
      ),
      diff(
        "ADDED_INCLUDED_SCOPE",
        entry({
          entryId: "u",
          packageId: "p2",
          customerLabel: "catalog_seed_key.hidden",
        })
      ),
    ]);
    assert.deepEqual(lines, ["Designer architectural shingles"]);
    for (const line of lines) {
      assertCustomerFactLineSafe(line);
      assert.doesNotMatch(line, /composition_role|composition_slot|PRODUCT_REPLACEMENT/);
    }
  });
});
