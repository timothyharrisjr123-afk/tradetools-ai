/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesIncludedWorkPresentation.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildPreparedAvailableUpgradesPresentation,
  buildPreparedIncludedWorkPresentation,
  buildPreparedPackageScopePresentation,
} from "./templatesIncludedWorkPresentation";

function catalogItem(
  id: string,
  name: string,
  itemType: "material" | "labor" | "service" | "fee" | "discount",
  active = true
) {
  return {
    id,
    company_id: "co",
    name,
    item_type: itemType,
    unit: "each",
    quantity_source: "fixed",
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active,
  } as never;
}

const catalogItems = [
  catalogItem("c-material", "Architectural shingles", "material"),
  catalogItem("c-labor", "Installation labor", "labor"),
  catalogItem("c-service", "Site cleanup", "service"),
  catalogItem("c-fee", "Permit fee", "fee"),
  catalogItem("c-upgrade", "Additional roof ventilation", "material"),
  catalogItem("c-other", "Seasonal adjustment", "discount"),
  catalogItem("c-inactive", "Unavailable flashing", "material", false),
] as never;

function graph() {
  return {
    template: { id: "t1", name: "Roof replacement" },
    options: [
      { id: "standard", name: "Standard" },
      { id: "premium", name: "Premium" },
    ],
    sections: [
      { id: "standard-lines", option_id: "standard", kind: "line_items" },
      { id: "standard-upgrades", option_id: "standard", kind: "upgrade_group" },
      { id: "premium-lines", option_id: "premium", kind: "line_items" },
      { id: "premium-upgrades", option_id: "premium", kind: "upgrade_group" },
    ],
    items: [
      {
        id: "i-material",
        option_id: "standard",
        section_id: "standard-lines",
        catalog_item_id: "c-material",
        sort_order: 10,
      },
      {
        id: "i-labor",
        option_id: "standard",
        section_id: "standard-lines",
        catalog_item_id: "c-labor",
        sort_order: 20,
      },
      {
        id: "i-service",
        option_id: "standard",
        section_id: "standard-lines",
        catalog_item_id: "c-service",
        sort_order: 30,
      },
      {
        id: "i-fee",
        option_id: "standard",
        section_id: "standard-lines",
        catalog_item_id: "c-fee",
        sort_order: 40,
      },
      {
        id: "i-upgrade",
        option_id: "standard",
        section_id: "standard-upgrades",
        catalog_item_id: "c-upgrade",
        sort_order: 50,
        customer_name_override: "Additional roof ventilation",
      },
      {
        id: "i-other",
        option_id: "standard",
        section_id: "standard-lines",
        catalog_item_id: "c-other",
        sort_order: 60,
      },
      {
        id: "i-inactive",
        option_id: "standard",
        section_id: "standard-lines",
        catalog_item_id: "c-inactive",
        sort_order: 70,
      },
      {
        id: "i-missing",
        option_id: "standard",
        section_id: "standard-lines",
        catalog_item_id: null,
        customer_name_override: "Custom roof work",
        sort_order: 80,
      },
      {
        id: "i-premium",
        option_id: "premium",
        section_id: "premium-lines",
        catalog_item_id: "c-material",
        sort_order: 10,
      },
      {
        id: "i-premium-upgrade",
        option_id: "premium",
        section_id: "premium-upgrades",
        catalog_item_id: "c-upgrade",
        sort_order: 10,
      },
    ],
  } as never;
}

describe("prepared included-work presentation", () => {
  test("groups line_items only into Materials / Labor / Fees / Other", () => {
    const presentation = buildPreparedIncludedWorkPresentation({
      graph: graph(),
      optionId: "standard",
      catalogItems,
    });

    assert.deepEqual(
      presentation.groups.map((group) => group.label),
      ["Materials", "Labor / services", "Fees", "Other"]
    );
    assert.equal(
      presentation.groups.find((group) => group.id === "materials")?.itemCount,
      2
    );
    assert.equal(
      presentation.groups.find((group) => group.id === "labor_services")?.itemCount,
      2
    );
    assert.equal(presentation.groups.find((group) => group.id === "fees")?.itemCount, 1);
    assert.equal(presentation.groups.find((group) => group.id === "other")?.itemCount, 2);
    assert.ok(!presentation.groups.some((group) => group.id === ("optional_upgrades" as never)));
    assert.equal(presentation.totalItemCount, 7);
    assert.ok(
      !presentation.groups
        .flatMap((group) => group.items)
        .some((item) => item.templateItemId === "i-upgrade")
    );
  });

  test("filters included groups and counts to the selected package", () => {
    const standard = buildPreparedIncludedWorkPresentation({
      graph: graph(),
      optionId: "standard",
      catalogItems,
    });
    const premium = buildPreparedIncludedWorkPresentation({
      graph: graph(),
      optionId: "premium",
      catalogItems,
    });

    assert.equal(standard.totalItemCount, 7);
    assert.equal(premium.totalItemCount, 1);
    assert.deepEqual(premium.groups.map((group) => group.label), ["Materials"]);
    assert.equal(premium.groups[0]?.items[0]?.name, "Architectural shingles");
  });

  test("keeps missing and inactive items local with quiet issue copy", () => {
    const presentation = buildPreparedIncludedWorkPresentation({
      graph: graph(),
      optionId: "standard",
      catalogItems,
    });
    const items = presentation.groups.flatMap((group) => group.items);
    const inactive = items.find((item) => item.templateItemId === "i-inactive");
    const missing = items.find((item) => item.templateItemId === "i-missing");

    assert.equal(presentation.issueCount, 2);
    assert.equal(inactive?.issueLabel, "Catalog item unavailable");
    assert.equal(missing?.issueLabel, "Needs Catalog attention");
    assert.doesNotMatch(missing?.name ?? "", /missing_id|section kind|visibility override/i);
  });

  test("unknown item types use Other without exposing raw internal keys", () => {
    const presentation = buildPreparedIncludedWorkPresentation({
      graph: graph(),
      optionId: "standard",
      catalogItems,
    });
    const other = presentation.groups.find((group) => group.id === "other");

    assert.equal(other?.label, "Other");
    assert.ok(other?.items.some((item) => item.name === "Seasonal adjustment"));
    assert.doesNotMatch(
      presentation.groups.map((group) => group.label).join(" "),
      /labor_services|upgrade_group|optional_upgrades/
    );
  });
});

describe("prepared available upgrades presentation", () => {
  test("lists upgrade_group rows separately from included work counts", () => {
    const scope = buildPreparedPackageScopePresentation({
      graph: graph(),
      optionId: "standard",
      catalogItems,
    });

    assert.equal(scope.includedWork.totalItemCount, 7);
    assert.equal(scope.availableUpgrades.totalItemCount, 1);
    assert.equal(scope.availableUpgrades.items[0]?.name, "Additional roof ventilation");
    assert.equal(scope.availableUpgrades.items[0]?.templateItemId, "i-upgrade");
  });

  test("premium package keeps its own available upgrade count", () => {
    const upgrades = buildPreparedAvailableUpgradesPresentation({
      graph: graph(),
      optionId: "premium",
      catalogItems,
    });
    assert.equal(upgrades.totalItemCount, 1);
    assert.equal(upgrades.items[0]?.templateItemId, "i-premium-upgrade");
  });
});
