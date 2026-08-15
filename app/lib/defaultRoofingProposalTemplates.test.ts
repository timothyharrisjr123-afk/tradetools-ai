/**
 * Run: npx tsx --test app/lib/defaultRoofingProposalTemplates.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS,
  OPTIONAL_UPGRADE_TRUTH_VERSION,
  ROOF_REPLACEMENT_CORE_LINE_ITEMS,
} from "./defaultRoofingProposalTemplates";
import {
  buildDefaultDefinitionRepairPlan,
  detectDefaultDefinitionCatalogCollisions,
  hasUnapprovedSameOptionCatalogCollisions,
} from "./proposalTemplateUpgradeTruthRepair";

function findOption(name: string) {
  const template = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0];
  const option = template?.options?.find((row) => row.name === name);
  assert.ok(option, `missing option ${name}`);
  return option;
}

function sectionItems(optionName: string, kind: "line_items" | "upgrade_group") {
  const option = findOption(optionName);
  const section = option.sections?.find((row) => row.kind === kind);
  return section?.items ?? [];
}

describe("default roofing proposal templates — Optional Upgrade Truth v2", () => {
  test("stamps optional_upgrade_truth_version on template metadata", () => {
    const template = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0];
    assert.equal(template?.metadata?.optional_upgrade_truth_version, OPTIONAL_UPGRADE_TRUTH_VERSION);
    assert.equal(OPTIONAL_UPGRADE_TRUTH_VERSION, 2);
  });

  test("does not mutate shared ROOF_REPLACEMENT_CORE_LINE_ITEMS via option overrides", () => {
    const before = ROOF_REPLACEMENT_CORE_LINE_ITEMS.map((item) => ({
      catalog_seed_key: item.catalog_seed_key,
      customer_name_override: item.customer_name_override ?? null,
      description_override: item.description_override ?? null,
    }));

    const enhancedLines = sectionItems("Enhanced", "line_items");
    const underlayment = enhancedLines.find(
      (item) => item.catalog_seed_key === "roofing.premium_synthetic_underlayment"
    );
    assert.equal(underlayment?.customer_name_override, "Upgraded underlayment");

    const after = ROOF_REPLACEMENT_CORE_LINE_ITEMS.map((item) => ({
      catalog_seed_key: item.catalog_seed_key,
      customer_name_override: item.customer_name_override ?? null,
      description_override: item.description_override ?? null,
    }));
    assert.deepEqual(after, before);
    assert.equal(
      ROOF_REPLACEMENT_CORE_LINE_ITEMS.find(
        (item) => item.catalog_seed_key === "roofing.synthetic_underlayment"
      )?.customer_name_override,
      undefined
    );
  });

  test("Standard has empty upgrade_group items", () => {
    assert.deepEqual(sectionItems("Standard", "upgrade_group"), []);
  });

  test("Enhanced package upgrades underlayment and adds eaves ice-water; only vent is optional", () => {
    const lines = sectionItems("Enhanced", "line_items");
    const underlayment = lines.find(
      (item) => item.catalog_seed_key === "roofing.premium_synthetic_underlayment"
    );
    const eaves = lines.find((item) => item.catalog_seed_key === "roofing.ice_water_eaves");
    const valleys = lines.find((item) => item.catalog_seed_key === "roofing.ice_water_valley");
    assert.equal(underlayment?.composition_slot_key, "underlayment");
    assert.equal(eaves?.composition_slot_key, "ice_water.eaves");
    assert.equal(valleys?.composition_slot_key, "ice_water.valleys");
    assert.ok(!lines.some((item) => item.catalog_seed_key === "roofing.synthetic_underlayment"));

    const upgrades = sectionItems("Enhanced", "upgrade_group");
    assert.equal(upgrades.length, 1);
    assert.equal(upgrades[0]?.catalog_seed_key, "roofing.roof_vent");
    assert.equal(upgrades[0]?.item_role, "optional_addon");
    assert.equal(upgrades[0]?.upgrade_effect, "additive");
    assert.equal(upgrades[0]?.default_selected, false);
    assert.equal(upgrades[0]?.customer_name_override, "Additional roof ventilation");
    assert.deepEqual(upgrades[0]?.quantity_rule, {
      mode: "fixed",
      fixed_quantity: 1,
      allow_manual_override: true,
    });
    assert.ok(
      !upgrades.some((item) => item.catalog_seed_key === "roofing.premium_synthetic_underlayment")
    );
  });

  test("Premium replaces roof covering and keeps Enhanced protection upgrades", () => {
    const lines = sectionItems("Premium", "line_items");
    assert.equal(
      lines.find((item) => item.catalog_seed_key === "roofing.designer_shingles")
        ?.composition_slot_key,
      "roof_covering"
    );
    assert.ok(!lines.some((item) => item.catalog_seed_key === "roofing.architectural_shingles"));
    assert.equal(
      lines.find((item) => item.catalog_seed_key === "roofing.premium_synthetic_underlayment")
        ?.composition_slot_key,
      "underlayment"
    );
    assert.ok(lines.some((item) => item.catalog_seed_key === "roofing.ice_water_eaves"));

    const upgrades = sectionItems("Premium", "upgrade_group");
    assert.equal(upgrades.length, 1);
    assert.equal(upgrades[0]?.catalog_seed_key, "roofing.roof_vent");
    assert.equal(upgrades[0]?.upgrade_effect, "additive");
    assert.equal(upgrades[0]?.default_selected, false);
  });

  test("no unapproved same-option catalog collisions in default definition", () => {
    const template = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0]!;
    const collisions = detectDefaultDefinitionCatalogCollisions(template);
    assert.equal(hasUnapprovedSameOptionCatalogCollisions(collisions), false);

    const ventCollisions = collisions.filter(
      (row) => row.catalogKey === "roofing.roof_vent"
    );
    assert.equal(ventCollisions.length, 2);
    assert.ok(ventCollisions.every((row) => row.severity === "approved_incremental"));

    const plan = buildDefaultDefinitionRepairPlan(template);
    assert.equal(plan.sentSnapshotsMustNotBeMutated, true);
    assert.equal(plan.unapprovedCollisionCount, 0);
    assert.match(plan.sentSnapshotGuardrail, /must not be mutated/i);
  });
});
