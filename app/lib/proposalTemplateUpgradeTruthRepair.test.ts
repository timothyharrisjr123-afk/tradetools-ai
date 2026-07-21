/**
 * Run: npx tsx --test app/lib/proposalTemplateUpgradeTruthRepair.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  SENT_SNAPSHOT_MUTATION_FORBIDDEN,
  buildInstalledTemplateRepairPlan,
  classifySameOptionCatalogCollision,
  detectInstalledTemplateCatalogCollisions,
  hasUnapprovedSameOptionCatalogCollisions,
} from "./proposalTemplateUpgradeTruthRepair";

describe("proposalTemplateUpgradeTruthRepair", () => {
  test("documents that sent snapshots must not be mutated", () => {
    assert.match(SENT_SNAPSHOT_MUTATION_FORBIDDEN, /must not be mutated/i);
    assert.match(SENT_SNAPSHOT_MUTATION_FORBIDDEN, /revised draft/i);
  });

  test("classifies inherit_catalog duplicate as unapproved", () => {
    assert.equal(
      classifySameOptionCatalogCollision({
        upgradeEffect: "additive",
        quantityRule: { mode: "inherit_catalog" },
      }),
      "unapproved"
    );
  });

  test("classifies additive fixed quantity as approved incremental", () => {
    assert.equal(
      classifySameOptionCatalogCollision({
        upgradeEffect: "additive",
        quantityRule: { mode: "fixed", fixed_quantity: 1, allow_manual_override: true },
      }),
      "approved_incremental"
    );
  });

  test("detects unapproved installed collisions and recommends repair actions", () => {
    const graph = {
      template: { id: "t1", name: "Legacy roof" },
      options: [{ id: "opt-enhanced", name: "Enhanced" }],
      sections: [
        { id: "lines", option_id: "opt-enhanced", kind: "line_items" },
        { id: "upgrades", option_id: "opt-enhanced", kind: "upgrade_group" },
      ],
      items: [
        {
          id: "i-underlay-base",
          option_id: "opt-enhanced",
          section_id: "lines",
          catalog_seed_key: "roofing.synthetic_underlayment",
          item_role: "standard",
        },
        {
          id: "i-underlay-upgrade",
          option_id: "opt-enhanced",
          section_id: "upgrades",
          catalog_seed_key: "roofing.synthetic_underlayment",
          item_role: "optional_addon",
          quantity_rule: { mode: "inherit_catalog" },
        },
        {
          id: "i-vent-base",
          option_id: "opt-enhanced",
          section_id: "lines",
          catalog_seed_key: "roofing.roof_vent",
          item_role: "standard",
        },
        {
          id: "i-vent-upgrade",
          option_id: "opt-enhanced",
          section_id: "upgrades",
          catalog_seed_key: "roofing.roof_vent",
          item_role: "optional_addon",
          upgrade_effect: "additive",
          quantity_rule: { mode: "fixed", fixed_quantity: 1, allow_manual_override: true },
        },
      ],
    } as never;

    const collisions = detectInstalledTemplateCatalogCollisions({ graph });
    assert.equal(collisions.length, 2);
    assert.equal(hasUnapprovedSameOptionCatalogCollisions(collisions), true);

    const underlay = collisions.find(
      (row) => row.catalogKey === "roofing.synthetic_underlayment"
    );
    const vent = collisions.find((row) => row.catalogKey === "roofing.roof_vent");
    assert.equal(underlay?.severity, "unapproved");
    assert.equal(vent?.severity, "approved_incremental");

    const plan = buildInstalledTemplateRepairPlan({ graph });
    assert.equal(plan.sentSnapshotsMustNotBeMutated, true);
    assert.equal(plan.unapprovedCollisionCount, 1);
    assert.equal(
      plan.recommendations.find((row) => row.catalogKey === "roofing.synthetic_underlayment")
        ?.recommendedAction,
      "move_package_enhancement_to_line_items"
    );
    assert.equal(
      plan.recommendations.find((row) => row.catalogKey === "roofing.roof_vent")
        ?.recommendedAction,
      "leave_approved_incremental"
    );
  });
});
