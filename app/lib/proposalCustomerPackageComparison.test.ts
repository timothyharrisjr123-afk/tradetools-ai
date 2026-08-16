/**
 * Customer package comparison matrix tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerPackageComparison.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { inheritCatalogQuantity, type CompositionEntry, type PackageComposition } from "./packageComposition";
import {
  buildCustomerPackageComparisonMatrix,
  comparisonAttributesForPackage,
  includedComparisonValueLabels,
} from "./proposalCustomerPackageComparison";

function entry(
  overrides: Partial<CompositionEntry> & Pick<CompositionEntry, "entryId" | "packageId" | "customerLabel">
): CompositionEntry {
  return {
    role: "included",
    compositionRole: "roof_covering",
    compositionSlotKey: "roof_covering",
    productId: overrides.entryId,
    provenanceKey: overrides.entryId,
    productName: overrides.customerLabel,
    quantity: inheritCatalogQuantity(),
    unitPriceCents: null,
    ...overrides,
  };
}

function pkg(
  packageId: string,
  customerLabel: string,
  order: number,
  included: CompositionEntry[],
  optionalUpgrades: CompositionEntry[] = []
): PackageComposition {
  return {
    packageId,
    customerLabel,
    order,
    included,
    optionalUpgrades,
  };
}

const STANDARD = pkg("std", "Standard", 0, [
  entry({
    entryId: "std-shingle",
    packageId: "std",
    customerLabel: "Architectural shingles",
  }),
  entry({
    entryId: "std-under",
    packageId: "std",
    customerLabel: "Synthetic underlayment",
    compositionRole: "underlayment",
    compositionSlotKey: "underlayment",
  }),
  entry({
    entryId: "std-ice",
    packageId: "std",
    customerLabel: "Ice & water protection at valleys",
    compositionRole: "ice_water",
    compositionSlotKey: "ice_water.valleys",
  }),
  entry({
    entryId: "std-labor",
    packageId: "std",
    customerLabel: "Professional installation",
    compositionRole: null,
    compositionSlotKey: null,
  }),
], [
  entry({
    entryId: "std-vent",
    packageId: "std",
    role: "optional_upgrade",
    customerLabel: "Ridge vent",
    compositionRole: "ventilation",
    compositionSlotKey: "ventilation.ridge",
  }),
]);

const ENHANCED = pkg("enh", "Enhanced", 1, [
  entry({
    entryId: "enh-shingle",
    packageId: "enh",
    customerLabel: "Architectural shingles",
  }),
  entry({
    entryId: "enh-under",
    packageId: "enh",
    customerLabel: "Premium underlayment",
    compositionRole: "underlayment",
    compositionSlotKey: "underlayment",
  }),
  entry({
    entryId: "enh-ice",
    packageId: "enh",
    customerLabel: "Ice & water protection at eaves and valleys",
    compositionRole: "ice_water",
    compositionSlotKey: "ice_water.eaves_valleys",
  }),
], [
  entry({
    entryId: "enh-vent",
    packageId: "enh",
    role: "optional_upgrade",
    customerLabel: "Ridge vent",
    compositionRole: "ventilation",
    compositionSlotKey: "ventilation.ridge",
  }),
]);

const PREMIUM = pkg("prem", "Premium", 2, [
  entry({
    entryId: "prem-shingle",
    packageId: "prem",
    customerLabel: "Designer shingles",
    productId: "prod-designer",
  }),
  entry({
    entryId: "prem-under",
    packageId: "prem",
    customerLabel: "Premium underlayment",
    compositionRole: "underlayment",
    compositionSlotKey: "underlayment",
  }),
  entry({
    entryId: "prem-ice",
    packageId: "prem",
    customerLabel: "Ice & water protection at eaves and valleys",
    compositionRole: "ice_water",
    compositionSlotKey: "ice_water.eaves_valleys",
  }),
], [
  entry({
    entryId: "prem-vent",
    packageId: "prem",
    role: "optional_upgrade",
    customerLabel: "Ridge vent",
    compositionRole: "ventilation",
    compositionSlotKey: "ventilation.ridge",
  }),
]);

describe("buildCustomerPackageComparisonMatrix", () => {
  test("uses the same customer-facing dimensions across packages", () => {
    const matrix = buildCustomerPackageComparisonMatrix([STANDARD, ENHANCED, PREMIUM]);
    assert.deepEqual(
      matrix.dimensions.map((dimension) => dimension.label),
      ["Shingle system", "Underlayment", "Ice & water protection", "Ventilation"]
    );
    assert.equal(matrix.cellsByPackageId.std?.length, 4);
    assert.equal(matrix.cellsByPackageId.enh?.length, 4);
    assert.equal(matrix.cellsByPackageId.prem?.length, 4);
  });

  test("baseline package keeps its included facts instead of empty diffs", () => {
    const matrix = buildCustomerPackageComparisonMatrix([STANDARD, ENHANCED, PREMIUM]);
    const standard = comparisonAttributesForPackage(matrix, "std");
    assert.deepEqual(
      includedComparisonValueLabels(standard),
      [
        "Architectural shingles",
        "Synthetic underlayment",
        "Ice & water protection at valleys",
      ]
    );
  });

  test("step-up packages make material differences obvious without Removed language", () => {
    const matrix = buildCustomerPackageComparisonMatrix([STANDARD, ENHANCED, PREMIUM]);
    const enhanced = comparisonAttributesForPackage(matrix, "enh");
    const premium = comparisonAttributesForPackage(matrix, "prem");
    assert.equal(enhanced[0]?.value_label, "Architectural shingles");
    assert.equal(enhanced[1]?.value_label, "Premium underlayment");
    assert.equal(enhanced[2]?.value_label, "Ice & water protection at eaves and valleys");
    assert.equal(premium[0]?.value_label, "Designer shingles");
    const serialized = JSON.stringify(matrix);
    assert.doesNotMatch(serialized, /\bAdded\b|\bRemoved\b/);
    assert.doesNotMatch(serialized, /composition_role|composition_slot_key|std-shingle/);
  });

  test("optional upgrades are available, not included package facts", () => {
    const matrix = buildCustomerPackageComparisonMatrix([STANDARD, ENHANCED, PREMIUM]);
    for (const packageId of ["std", "enh", "prem"]) {
      const vent = comparisonAttributesForPackage(matrix, packageId).find(
        (attribute) => attribute.dimension_label === "Ventilation"
      );
      assert.equal(vent?.availability, "available");
      assert.equal(vent?.value_label, "Available");
    }
    const included = includedComparisonValueLabels(comparisonAttributesForPackage(matrix, "prem"));
    assert.equal(included.includes("Ridge vent"), false);
  });

  test("arbitrary package names and two-package counts still align", () => {
    const essential = { ...STANDARD, packageId: "ess", customerLabel: "Essential Care" };
    const signature = { ...PREMIUM, packageId: "sig", customerLabel: "Signature Series" };
    const matrix = buildCustomerPackageComparisonMatrix([essential, signature]);
    assert.equal(matrix.dimensions.length, 4);
    assert.equal(comparisonAttributesForPackage(matrix, "ess")[0]?.value_label, "Architectural shingles");
    assert.equal(comparisonAttributesForPackage(matrix, "sig")[0]?.value_label, "Designer shingles");
  });

  test("hidden/unlabeled shared labor is omitted from comparison dimensions", () => {
    const matrix = buildCustomerPackageComparisonMatrix([STANDARD, ENHANCED, PREMIUM]);
    const serialized = JSON.stringify(matrix);
    assert.doesNotMatch(serialized, /Professional installation/i);
  });

  test("catalog-key labels are humanized and aligned on inferred families", () => {
    const standard = pkg("std", "Standard", 0, [
      entry({
        entryId: "std-shingle",
        packageId: "std",
        customerLabel: "roofing.architectural_shingles",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: "roofing.architectural_shingles",
      }),
      entry({
        entryId: "std-under",
        packageId: "std",
        customerLabel: "roofing.synthetic_underlayment",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: "roofing.synthetic_underlayment",
      }),
    ]);
    const premium = pkg("prem", "Premium", 1, [
      entry({
        entryId: "prem-shingle",
        packageId: "prem",
        customerLabel: "roofing.designer_shingles",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: "roofing.designer_shingles",
      }),
      entry({
        entryId: "prem-under",
        packageId: "prem",
        customerLabel: "roofing.synthetic_underlayment",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: "roofing.synthetic_underlayment",
      }),
    ]);
    const matrix = buildCustomerPackageComparisonMatrix([standard, premium]);
    assert.deepEqual(
      matrix.dimensions.map((dimension) => dimension.label),
      ["Shingle system", "Underlayment"]
    );
    assert.equal(matrix.cellsByPackageId.std?.[0]?.valueLabel, "Architectural Shingles");
    assert.equal(matrix.cellsByPackageId.prem?.[0]?.valueLabel, "Designer Shingles");
    const serialized = JSON.stringify(matrix);
    assert.doesNotMatch(serialized, /roofing\./);
  });

  test("included roof vent stays distinct from selected additional ventilation", () => {
    const includedVent = (packageId: string, entryId: string) =>
      entry({
        entryId,
        packageId,
        customerLabel: "roofing.roof_vent",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: "roofing.roof_vent",
      });
    const additionalVent = (packageId: string, entryId: string) =>
      entry({
        entryId,
        packageId,
        role: "optional_upgrade",
        customerLabel: "Additional roof ventilation",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: "roofing.roof_vent",
      });
    const standard = pkg("std", "Standard", 0, [includedVent("std", "std-vent")]);
    const enhanced = pkg("enh", "Enhanced", 1, [includedVent("enh", "enh-vent")], [
      additionalVent("enh", "enh-extra-vent"),
    ]);
    const premium = pkg("prem", "Premium", 2, [includedVent("prem", "prem-vent")], [
      additionalVent("prem", "prem-extra-vent"),
    ]);
    const matrix = buildCustomerPackageComparisonMatrix([standard, enhanced, premium]);
    assert.deepEqual(
      matrix.dimensions.map((dimension) => dimension.label),
      ["Ventilation"]
    );
    for (const packageId of ["std", "enh", "prem"]) {
      assert.equal(matrix.cellsByPackageId[packageId]?.[0]?.valueLabel, "Roof Vent");
      assert.equal(matrix.cellsByPackageId[packageId]?.[0]?.availability, "included");
    }
    const serialized = JSON.stringify(matrix);
    assert.doesNotMatch(serialized, /Additional roof ventilation/i);
    assert.doesNotMatch(serialized, /roofing\./);
  });

  test("frozen customer label is preferred over catalog seed leaf", () => {
    const premium = pkg("prem", "Premium", 0, [
      entry({
        entryId: "prem-shingle",
        packageId: "prem",
        customerLabel: "Premium shingle package",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: "roofing.architectural_shingles",
      }),
    ]);
    const matrix = buildCustomerPackageComparisonMatrix([premium]);
    assert.equal(matrix.cellsByPackageId.prem?.[0]?.valueLabel, "Premium shingle package");
    assert.doesNotMatch(JSON.stringify(matrix), /Architectural Shingles|roofing\./);
  });

  test("missing composition_role degrades via frozen seed and omits unlabeled lines", () => {
    const standard = pkg("std", "Standard", 0, [
      entry({
        entryId: "std-shingle",
        packageId: "std",
        customerLabel: "roofing.architectural_shingles",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: "roofing.architectural_shingles",
      }),
      entry({
        entryId: "std-blank",
        packageId: "std",
        customerLabel: "",
        productName: null,
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: null,
      }),
    ]);
    const matrix = buildCustomerPackageComparisonMatrix([standard]);
    assert.deepEqual(
      matrix.dimensions.map((dimension) => dimension.label),
      ["Shingle system"]
    );
    const serialized = JSON.stringify(matrix);
    assert.doesNotMatch(serialized, /Included protection/);
    assert.doesNotMatch(serialized, /roofing\./);
    assert.doesNotMatch(serialized, /std-blank|composition_role|roof_covering/);
  });

  test("low-confidence vent substring does not invent a ventilation dimension", () => {
    const standard = pkg("std", "Standard", 0, [
      entry({
        entryId: "std-coat",
        packageId: "std",
        customerLabel: "Preventative coating",
        compositionRole: null,
        compositionSlotKey: null,
        provenanceKey: null,
      }),
    ]);
    const matrix = buildCustomerPackageComparisonMatrix([standard]);
    assert.equal(
      matrix.dimensions.some((dimension) => dimension.label === "Ventilation"),
      false
    );
    assert.equal(matrix.cellsByPackageId.std?.[0]?.valueLabel, "Preventative coating");
  });

  test("module does not import pricing engines or live catalog lookup", () => {
    const source = readFileSync(new URL("./proposalCustomerPackageComparison.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /proposalPricingEngine|proposalPricingInputMapper|proposalQuantityResolver/);
    assert.doesNotMatch(source, /proposalSnapshotBuilder|getSupabaseClient|catalogItems/);
  });
});
