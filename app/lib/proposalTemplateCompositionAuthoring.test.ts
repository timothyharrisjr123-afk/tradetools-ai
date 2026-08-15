/**
 * Run: npx tsx --test app/lib/proposalTemplateCompositionAuthoring.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import {
  assignCompositionSlotKey,
  catalogProductFitsSlot,
  overrideMisrepresentsProduct,
  planAddIncludedProduct,
  planQuantityRule,
  planReplaceProduct,
  summarizeQuantityRule,
} from "./proposalTemplateCompositionAuthoring";

const CAT_A: CatalogItem = {
  id: "11111111-1111-4111-8111-111111111111",
  company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Architectural shingles",
  customer_name: "Shingles",
  item_type: "material",
  unit: "square",
  quantity_source: "adjusted_roof_squares",
  pricing_basis: "unit_price",
  customer_visibility: "customer_visible",
  active: true,
  composition_role: "roof_covering",
  metadata: { seed_key: "roofing.architectural_shingles" },
};

const CAT_B: CatalogItem = {
  ...CAT_A,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Designer architectural shingles",
  customer_name: "Designer shingles",
  composition_role: "roof_covering",
  metadata: { seed_key: "roofing.designer_shingles" },
};

const CAT_UNDER: CatalogItem = {
  ...CAT_A,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Synthetic underlayment",
  customer_name: "Underlayment",
  composition_role: "underlayment",
  metadata: { seed_key: "roofing.synthetic_underlayment" },
};

describe("composition authoring", () => {
  test("add copies catalog role and uses role as first slot", () => {
    const draft = planAddIncludedProduct({
      catalogItem: CAT_A,
      optionId: "opt",
      sectionId: "sec",
      itemRole: "standard",
      existingItems: [],
      sortOrder: 10,
    });
    assert.equal(draft.composition_role, "roof_covering");
    assert.equal(draft.composition_slot_key, "roof_covering");
    assert.equal(draft.quantity_rule?.mode, "inherit_catalog");
    assert.equal(draft.catalog_seed_key, "roofing.architectural_shingles");
  });

  test("add generates a unique instance slot when the role slot is taken", () => {
    const draft = planAddIncludedProduct({
      catalogItem: CAT_A,
      optionId: "opt",
      sectionId: "sec",
      itemRole: "standard",
      existingItems: [
        {
          id: "existing",
          option_id: "opt",
          section_id: "sec",
          catalog_item_id: CAT_A.id,
          catalog_seed_key: "roofing.architectural_shingles",
          composition_role: "roof_covering",
          composition_slot_key: "roof_covering",
          item_role: "standard",
          customer_name_override: null,
          description_override: null,
          quantity_rule: { mode: "inherit_catalog" },
        },
      ],
      sortOrder: 20,
    });
    assert.equal(draft.composition_role, "roof_covering");
    assert.match(String(draft.composition_slot_key), /^roof_covering\.[a-f0-9]{32}$/);
    assert.notEqual(draft.composition_slot_key, "roof_covering");
  });

  test("replace preserves role/slot and clears stale product wording", () => {
    const planned = planReplaceProduct({
      existingItem: {
        id: "item",
        option_id: "opt",
        section_id: "sec",
        catalog_item_id: CAT_A.id,
        catalog_seed_key: "roofing.architectural_shingles",
        composition_role: "roof_covering",
        composition_slot_key: "roof_covering",
        item_role: "standard",
        customer_name_override: "Premium shingle package",
        description_override: "Old marketing copy",
        quantity_rule: { mode: "inherit_catalog" },
      },
      catalogItem: CAT_B,
    });
    assert.equal(planned.compatible, true);
    assert.equal(planned.patch.catalog_item_id, CAT_B.id);
    assert.equal(planned.patch.catalog_seed_key, "roofing.designer_shingles");
    assert.equal(planned.patch.customer_name_override, null);
    assert.equal(planned.patch.description_override, null);
    assert.equal("composition_role" in planned.patch, false);
    assert.equal("composition_slot_key" in planned.patch, false);
  });

  test("incompatible product is detected and still preserves slot on replace", () => {
    assert.equal(catalogProductFitsSlot(CAT_UNDER, "roof_covering"), false);
    const planned = planReplaceProduct({
      existingItem: {
        id: "item",
        option_id: "opt",
        section_id: "sec",
        catalog_item_id: CAT_A.id,
        catalog_seed_key: "roofing.architectural_shingles",
        composition_role: "roof_covering",
        composition_slot_key: "roof_covering",
        item_role: "standard",
        customer_name_override: "Shingles",
        description_override: null,
        quantity_rule: { mode: "inherit_catalog" },
      },
      catalogItem: CAT_UNDER,
    });
    assert.equal(planned.compatible, false);
    assert.equal("composition_slot_key" in planned.patch, false);
  });

  test("override matching the new product is kept", () => {
    assert.equal(overrideMisrepresentsProduct("Designer shingles", CAT_B), false);
    assert.equal(overrideMisrepresentsProduct("Premium shingle package", CAT_B), true);
  });

  test("quantity rule planner stays lightweight", () => {
    assert.equal(planQuantityRule({ mode: "inherit_catalog" }).mode, "inherit_catalog");
    assert.equal(planQuantityRule({ mode: "fixed", fixedQuantity: 4 }).fixed_quantity, 4);
    assert.equal(summarizeQuantityRule({ mode: "inherit_catalog" }), "Uses Catalog quantity");
    assert.equal(summarizeQuantityRule({ mode: "fixed", fixed_quantity: 2 }), "Fixed qty 2");
  });

  test("assignCompositionSlotKey never reuses a taken slot", () => {
    const used = new Set(["ventilation", "ventilation.additional"]);
    const slot = assignCompositionSlotKey({
      compositionRole: "ventilation",
      group: "included",
      usedSlots: used,
    });
    assert.ok(slot);
    assert.equal(used.has(slot!), false);
    assert.match(String(slot), /^ventilation\.[a-f0-9]{32}$/);
  });
});
