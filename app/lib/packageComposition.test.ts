/**
 * V2E2A — Generic package composition domain goldens.
 *
 * Run: npx tsx --test app/lib/packageComposition.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  PACKAGE_COMPOSITION_MATCHING_LIMITATION,
  buildPackageStepUpChain,
  comparePackageCompositions,
  formatStepUpChangeSummary,
  groupCompositionDiffForDisplay,
  inheritCatalogQuantity,
  orderPackageCompositions,
  resolveStartingDefaultPackageId,
  resolveStepUpBasePackageId,
  type CompositionEntry,
  type CompositionQuantityConfig,
  type PackageComposition,
} from "./packageComposition";

const QTY_INHERIT = inheritCatalogQuantity();
const QTY_FIXED_4: CompositionQuantityConfig = {
  mode: "fixed",
  summary: "Fixed quantity 4",
  fingerprint: "fixed:4",
};

function entry(
  overrides: Partial<CompositionEntry> & Pick<CompositionEntry, "entryId" | "packageId">
): CompositionEntry {
  return {
    role: "included",
    productId: "prod-a",
    provenanceKey: "scope.shingles",
    customerLabel: "Shingles",
    productName: "Architectural shingles",
    quantity: QTY_INHERIT,
    unitPriceCents: 25_000,
    ...overrides,
  };
}

function pkg(
  overrides: Partial<PackageComposition> & Pick<PackageComposition, "packageId" | "customerLabel" | "order">
): PackageComposition {
  return {
    included: [],
    optionalUpgrades: [],
    ...overrides,
  };
}

describe("comparePackageCompositions", () => {
  test("1. engine is pure/deterministic", () => {
    const base = pkg({
      packageId: "p1",
      customerLabel: "Alpha",
      order: 10,
      included: [entry({ entryId: "a1", packageId: "p1" })],
    });
    const target = pkg({
      packageId: "p2",
      customerLabel: "Bravo",
      order: 20,
      included: [
        entry({
          entryId: "b1",
          packageId: "p2",
          customerLabel: "Premium shingles",
        }),
      ],
    });
    const first = comparePackageCompositions(base, target);
    const second = comparePackageCompositions(base, target);
    assert.deepEqual(first, second);
    assert.equal(first.counts.labelOnly, 1);
  });

  test("2–3. arbitrary names and counts; 4. arbitrary A↔B", () => {
    const a = pkg({
      packageId: "west",
      customerLabel: "West Slope",
      order: 5,
      included: [entry({ entryId: "w1", packageId: "west" })],
    });
    const b = pkg({
      packageId: "east",
      customerLabel: "East Slope",
      order: 1,
      included: [
        entry({
          entryId: "e1",
          packageId: "east",
          productId: "prod-b",
          unitPriceCents: 32_000,
        }),
      ],
    });
    const eastVsWest = comparePackageCompositions(a, b);
    assert.equal(eastVsWest.baseLabel, "West Slope");
    assert.equal(eastVsWest.targetLabel, "East Slope");
    assert.equal(eastVsWest.counts.productReplacement, 1);
    assert.equal(eastVsWest.entries[0]?.unitPriceDeltaCents, 7_000);
    const westVsEast = comparePackageCompositions(b, a);
    assert.equal(westVsEast.baseLabel, "East Slope");
    assert.equal(westVsEast.counts.productReplacement, 1);
  });

  test("5–6. ordered step-up chain; no Standard/Enhanced/Premium assumptions", () => {
    const packages = [
      pkg({
        packageId: "d",
        customerLabel: "Delta",
        order: 40,
        included: [entry({ entryId: "d1", packageId: "d", customerLabel: "Delta shingles" })],
      }),
      pkg({
        packageId: "a",
        customerLabel: "Alpha",
        order: 10,
        isStartingDefault: true,
        included: [entry({ entryId: "a1", packageId: "a" })],
      }),
      pkg({
        packageId: "c",
        customerLabel: "Charlie",
        order: 30,
        included: [entry({ entryId: "c1", packageId: "c" })],
      }),
      pkg({
        packageId: "b",
        customerLabel: "Bravo",
        order: 20,
        included: [entry({ entryId: "b1", packageId: "b", customerLabel: "Bravo shingles" })],
      }),
    ];
    assert.deepEqual(
      orderPackageCompositions(packages).map((p) => p.customerLabel),
      ["Alpha", "Bravo", "Charlie", "Delta"]
    );
    assert.equal(resolveStepUpBasePackageId(packages), "a");
    const chain = buildPackageStepUpChain(packages);
    assert.equal(chain[0]?.previous, null);
    assert.equal(chain[0]?.diff.isComparison, false);
    assert.equal(chain[1]?.previous?.packageId, "a");
    assert.equal(chain[1]?.diff.baseLabel, "Alpha");
    assert.equal(chain[1]?.diff.counts.labelOnly, 1);
    assert.equal(chain[2]?.previous?.packageId, "b");
    assert.equal(chain[2]?.diff.baseLabel, "Bravo");
    assert.equal(chain[3]?.previous?.packageId, "c");
    assert.doesNotMatch(JSON.stringify(chain), /Standard|Enhanced|Premium/);
  });

  test("7. label-only detection", () => {
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [entry({ entryId: "a", packageId: "p1" })],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b",
            packageId: "p2",
            customerLabel: "Premium shingle package",
          }),
        ],
      })
    );
    assert.equal(diff.counts.labelOnly, 1);
    assert.equal(diff.entries[0]?.kind, "LABEL_ONLY");
    assert.equal(diff.entries[0]?.sameProduct, true);
  });

  test("8. product replacement when provenance identity supports it", () => {
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [entry({ entryId: "a", packageId: "p1", productId: "prod-a" })],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b",
            packageId: "p2",
            productId: "prod-b",
            productName: "Designer architectural shingles",
            unitPriceCents: 32_000,
          }),
        ],
      })
    );
    assert.equal(diff.counts.productReplacement, 1);
    assert.equal(diff.entries[0]?.kind, "PRODUCT_REPLACEMENT");
    assert.equal(diff.entries[0]?.unitPriceDeltaCents, 7_000);
  });

  test("9. product replacement NOT guessed without shared identity", () => {
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [
          entry({
            entryId: "a",
            packageId: "p1",
            productId: "prod-a",
            provenanceKey: "roofing.architectural_shingles",
          }),
        ],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b",
            packageId: "p2",
            productId: "prod-b",
            provenanceKey: "roofing.designer_shingles",
            productName: "Designer architectural shingles",
            customerLabel: "Designer shingles",
          }),
        ],
      })
    );
    assert.equal(diff.counts.productReplacement, 0);
    assert.equal(diff.counts.removedIncluded, 1);
    assert.equal(diff.counts.addedIncluded, 1);
    assert.match(PACKAGE_COMPOSITION_MATCHING_LIMITATION, /no invented semantic/i);
  });

  test("same group+slot + different product is PRODUCT_REPLACEMENT even without shared provenance", () => {
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [
          entry({
            entryId: "a",
            packageId: "p1",
            productId: "prod-a",
            provenanceKey: "roofing.architectural_shingles",
            compositionRole: "roof_covering",
            compositionSlotKey: "roof_covering",
          }),
        ],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b",
            packageId: "p2",
            productId: "prod-b",
            provenanceKey: "roofing.designer_shingles",
            productName: "Designer shingles",
            customerLabel: "Designer shingles",
            compositionRole: "roof_covering",
            compositionSlotKey: "roof_covering",
            unitPriceCents: 32_000,
          }),
        ],
      })
    );
    assert.equal(diff.counts.productReplacement, 1);
    assert.equal(diff.counts.removedIncluded, 0);
    assert.equal(diff.counts.addedIncluded, 0);
    assert.equal(diff.entries[0]?.kind, "PRODUCT_REPLACEMENT");
  });

  test("same group+slot + same product + qty/label diffs", () => {
    const qtyDiff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [
          entry({
            entryId: "a",
            packageId: "p1",
            compositionSlotKey: "ventilation",
            provenanceKey: "other-seed",
          }),
        ],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b",
            packageId: "p2",
            compositionSlotKey: "ventilation",
            provenanceKey: "other-seed",
            quantity: QTY_FIXED_4,
          }),
        ],
      })
    );
    assert.equal(qtyDiff.counts.quantityChange, 1);

    const labelDiff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [
          entry({
            entryId: "a",
            packageId: "p1",
            compositionSlotKey: "underlayment",
            provenanceKey: "seed-x",
          }),
        ],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b",
            packageId: "p2",
            compositionSlotKey: "underlayment",
            provenanceKey: "seed-y",
            customerLabel: "Enhanced underlayment",
          }),
        ],
      })
    );
    assert.equal(labelDiff.counts.labelOnly, 1);
  });

  test("duplicate group+slot is not an arbitrary PRODUCT_REPLACEMENT", () => {
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [
          entry({
            entryId: "a1",
            packageId: "p1",
            productId: "prod-a",
            provenanceKey: "seed-a",
            compositionSlotKey: "ventilation",
          }),
          entry({
            entryId: "a2",
            packageId: "p1",
            productId: "prod-a2",
            provenanceKey: "seed-a2",
            compositionSlotKey: "ventilation",
            customerLabel: "Second vent",
          }),
        ],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b1",
            packageId: "p2",
            productId: "prod-b",
            provenanceKey: "seed-b",
            compositionSlotKey: "ventilation",
            productName: "Premium vent",
            customerLabel: "Premium vent",
          }),
        ],
      })
    );
    assert.equal(diff.counts.productReplacement, 0);
    assert.ok(diff.slotAmbiguities.some((row) => row.compositionSlotKey === "ventilation"));
    assert.equal(diff.slotAmbiguities[0]?.baseEntryIds.length, 2);
  });

  test("included vs optional same slot do not collide", () => {
    const included = (packageId: string, entryId: string) =>
      entry({
        entryId,
        packageId,
        compositionSlotKey: "ventilation",
        provenanceKey: "roofing.roof_vent",
        customerLabel: "Roof vent",
      });
    const optional = (packageId: string, entryId: string) =>
      entry({
        entryId,
        packageId,
        role: "optional_upgrade",
        compositionSlotKey: "ventilation",
        provenanceKey: "roofing.roof_vent",
        customerLabel: "Additional roof ventilation",
        quantity: QTY_FIXED_4,
      });
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [included("p1", "inc1")],
        optionalUpgrades: [optional("p1", "opt1")],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [included("p2", "inc2")],
        optionalUpgrades: [optional("p2", "opt2")],
      })
    );
    assert.equal(diff.counts.productReplacement, 0);
    assert.equal(diff.counts.addedIncluded, 0);
    assert.equal(diff.counts.removedIncluded, 0);
    assert.equal(diff.counts.upgradeAdded, 0);
    assert.equal(diff.counts.upgradeRemoved, 0);
    assert.equal(diff.changeCount, 0);
  });

  test("10. quantity difference", () => {
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [entry({ entryId: "a", packageId: "p1", provenanceKey: "vent" })],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b",
            packageId: "p2",
            provenanceKey: "vent",
            quantity: QTY_FIXED_4,
          }),
        ],
      })
    );
    assert.equal(diff.counts.quantityChange, 1);
    assert.match(diff.entries[0]?.detail ?? "", /Fixed quantity 4/);
  });

  test("11. added/removed included scope", () => {
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [
          entry({ entryId: "a1", packageId: "p1", provenanceKey: "shingles" }),
          entry({
            entryId: "a2",
            packageId: "p1",
            provenanceKey: "underlayment",
            productId: "under",
            customerLabel: "Underlayment",
          }),
        ],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({ entryId: "b1", packageId: "p2", provenanceKey: "shingles" }),
          entry({
            entryId: "b2",
            packageId: "p2",
            provenanceKey: "vent",
            productId: "vent",
            customerLabel: "Roof vent",
          }),
        ],
      })
    );
    assert.equal(diff.counts.removedIncluded, 1);
    assert.equal(diff.counts.addedIncluded, 1);
  });

  test("12. upgrade added/removed/changed", () => {
    const added = comparePackageCompositions(
      pkg({ packageId: "p1", customerLabel: "A", order: 10 }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        optionalUpgrades: [
          entry({
            entryId: "u2",
            packageId: "p2",
            role: "optional_upgrade",
            provenanceKey: "vent",
            customerLabel: "Additional roof ventilation",
          }),
        ],
      })
    );
    assert.equal(added.counts.upgradeAdded, 1);
    assert.match(added.entries[0]?.detail ?? "", /Optional upgrade available/);

    const removed = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        optionalUpgrades: [
          entry({
            entryId: "u1",
            packageId: "p1",
            role: "optional_upgrade",
            provenanceKey: "vent",
            customerLabel: "Additional roof ventilation",
          }),
        ],
      }),
      pkg({ packageId: "p2", customerLabel: "B", order: 20 })
    );
    assert.equal(removed.counts.upgradeRemoved, 1);

    const changed = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        optionalUpgrades: [
          entry({
            entryId: "u1",
            packageId: "p1",
            role: "optional_upgrade",
            provenanceKey: "vent",
            customerLabel: "Additional roof ventilation",
          }),
        ],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        optionalUpgrades: [
          entry({
            entryId: "u2",
            packageId: "p2",
            role: "optional_upgrade",
            provenanceKey: "vent",
            quantity: QTY_FIXED_4,
            customerLabel: "Additional roof ventilation",
          }),
        ],
      })
    );
    assert.equal(changed.counts.upgradeChanged, 1);
  });

  test("13. input not mutated", () => {
    const base = pkg({
      packageId: "p1",
      customerLabel: "A",
      order: 10,
      included: [entry({ entryId: "a", packageId: "p1" })],
    });
    const target = pkg({
      packageId: "p2",
      customerLabel: "B",
      order: 20,
      included: [entry({ entryId: "b", packageId: "p2", customerLabel: "Renamed" })],
    });
    const before = JSON.stringify({ base, target });
    comparePackageCompositions(base, target);
    buildPackageStepUpChain([base, target]);
    assert.equal(JSON.stringify({ base, target }), before);
  });

  test("14. no proposal-total calculation", () => {
    const diff = comparePackageCompositions(
      pkg({
        packageId: "p1",
        customerLabel: "A",
        order: 10,
        included: [entry({ entryId: "a", packageId: "p1" })],
      }),
      pkg({
        packageId: "p2",
        customerLabel: "B",
        order: 20,
        included: [
          entry({
            entryId: "b",
            packageId: "p2",
            productId: "prod-b",
            unitPriceCents: 32_000,
          }),
        ],
      })
    );
    const json = JSON.stringify(diff);
    assert.doesNotMatch(json, /project total|package total|estimated total|% premium/i);
    assert.equal(diff.entries[0]?.unitPriceDeltaCents, 7_000);
  });

  test("starting default is not the step-up base when it is not first", () => {
    const packages = [
      pkg({ packageId: "first", customerLabel: "First", order: 10 }),
      pkg({
        packageId: "start",
        customerLabel: "Starting later",
        order: 20,
        isStartingDefault: true,
      }),
    ];
    assert.equal(resolveStepUpBasePackageId(packages), "first");
    assert.equal(resolveStartingDefaultPackageId(packages), "start");
  });

  test("display groups omit empty categories; wording note once", () => {
    const groups = groupCompositionDiffForDisplay([
      {
        kind: "LABEL_ONLY",
        title: "X",
        base: null,
        target: null,
        detail: "d",
        unitPriceDeltaCents: null,
        sameProduct: true,
      },
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.id, "wording");
    assert.match(groups[0]?.note ?? "", /wording differs/i);
    assert.equal(formatStepUpChangeSummary({
      basePackageId: "a",
      baseLabel: "Alpha",
      targetPackageId: "b",
      targetLabel: "Bravo",
      isComparison: true,
      counts: {
        unchanged: 0,
        labelOnly: 2,
        productReplacement: 0,
        quantityChange: 0,
        addedIncluded: 0,
        removedIncluded: 0,
        upgradeAdded: 1,
        upgradeRemoved: 0,
        upgradeChanged: 0,
      },
      entries: [],
      changeCount: 3,
      matchingLimitation: PACKAGE_COMPOSITION_MATCHING_LIMITATION,
      slotAmbiguities: [],
    }), "3 changes from Alpha");
  });
});
