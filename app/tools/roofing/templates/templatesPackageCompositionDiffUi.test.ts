/**
 * V2E2A — Templates step-up UI wiring goldens.
 *
 * Run: npx tsx --test app/tools/roofing/templates/templatesPackageCompositionDiffUi.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { buildPreparedIncludedWorkPresentation } from "./templatesIncludedWorkPresentation";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

const ROOT = process.cwd();

describe("Templates V2E2A step-up UI wiring", () => {
  test("20–22. base card simple; non-base compact step-up; details collapsed", () => {
    const review = readFileSync(
      path.join(ROOT, "app/tools/roofing/templates/TemplatesQuoteSetupReview.tsx"),
      "utf8"
    );
    assert.match(review, /TemplatesPackageStepUpSummary/);
    assert.match(review, /buildTemplatePackageStepUpChain/);
    assert.match(review, /expandedStepUpOptionId/);
    assert.match(review, /View changes|onToggle/);
    assert.doesNotMatch(review, /data-templates-composition-diff-panel/);
    assert.doesNotMatch(review, /V2E2B/);
  });

  test("23. expanded detail only shows non-empty groups; no always-open panel", () => {
    const panel = readFileSync(
      path.join(ROOT, "app/tools/roofing/templates/TemplatesPackageCompositionDiff.tsx"),
      "utf8"
    );
    assert.match(panel, /groupCompositionDiffForDisplay/);
    assert.match(panel, /Base package/);
    assert.match(panel, /View changes/);
    assert.match(panel, /group\.label/);
    assert.match(panel, /group\.note/);
    assert.doesNotMatch(panel, /project total|estimated total/i);
    assert.doesNotMatch(panel, /Same Catalog product — customer label only\. No product change/);
  });

  test("24. Adjust included work shows dual Catalog identity", () => {
    const manager = readFileSync(
      path.join(ROOT, "app/tools/roofing/templates/TemplatesIncludedItemsManager.tsx"),
      "utf8"
    );
    assert.match(manager, /showCatalogProduct/);
    assert.match(manager, /data-templates-catalog-product-identity/);
    assert.match(manager, /data-templates-quantity-toggle/);
    assert.match(manager, /Use Catalog quantity/);
    assert.doesNotMatch(manager, /quantity_rule|stale override|matrix/i);
    assert.doesNotMatch(manager, /Catalog product:/);
  });

  test("adjust included work keeps quantity and identity compact", () => {
    const manager = readFileSync(
      path.join(ROOT, "app/tools/roofing/templates/TemplatesIncludedItemsManager.tsx"),
      "utf8"
    );
    assert.match(manager, /quantityItemId/);
    assert.match(manager, /data-templates-quantity-open/);
    assert.match(manager, /quantityOpen && onSaveItemQuantity/);
    assert.match(manager, />\s*Replace\s*</);
    assert.match(manager, />\s*Quantity\s*</);
    assert.match(manager, />\s*Remove\s*</);
    assert.match(manager, /Use Catalog quantity/);
    assert.match(manager, /Fixed quantity/);
    assert.doesNotMatch(manager, /<select[\s\S]*Use Catalog quantity/);
    assert.doesNotMatch(manager, /Replace item/);
    assert.doesNotMatch(manager, /Remove from this setup/);
  });

  test("25. 390px avoids bulky always-open analysis", () => {
    const review = readFileSync(
      path.join(ROOT, "app/tools/roofing/templates/TemplatesQuoteSetupReview.tsx"),
      "utf8"
    );
    const panel = readFileSync(
      path.join(ROOT, "app/tools/roofing/templates/TemplatesPackageCompositionDiff.tsx"),
      "utf8"
    );
    assert.doesNotMatch(review, /data-templates-composition-diff-panel/);
    assert.match(panel, /expanded \? "Hide changes" : "View changes"/);
    assert.match(review, /key=\{row\.optionId\}\r?\n\s+role="tab"/);
  });

  test("replace picker stays product-oriented and does not leak role/slot codes", () => {
    const picker = readFileSync(
      path.join(ROOT, "app/tools/roofing/templates/TemplatesCatalogItemPickerModal.tsx"),
      "utf8"
    );
    assert.match(picker, /These products can replace this item\./);
    assert.match(picker, /Browse all catalog products/);
    assert.match(picker, /compositionRoleDisplayLabel/);
    assert.match(picker, /Use this product here\?/);
    assert.doesNotMatch(picker, /roof_covering|composition_slot_key|ice_water\.eaves/);
  });

  test("prepared included work carries dual identity fields", () => {
    const catalog: CatalogItem = {
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
      unit_price_cents: 25_000,
    };
    const optionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const sectionId = "ssssssss-ssss-4sss-8sss-ssssssssssss";
    const graph = {
      template: {
        id: "tttttttt-tttt-4ttt-8ttt-tttttttttttt",
        company_id: catalog.company_id,
        name: "T",
        status: "active",
        active: true,
      },
      options: [
        {
          id: optionId,
          template_id: "tttttttt-tttt-4ttt-8ttt-tttttttttttt",
          name: "Premium",
          customer_label: "Premium",
          is_default: true,
          sort_order: 10,
        },
      ],
      sections: [
        {
          id: sectionId,
          template_id: "tttttttt-tttt-4ttt-8ttt-tttttttttttt",
          option_id: optionId,
          kind: "line_items",
          name: "Scope",
          sort_order: 10,
          customer_visibility: "customer_visible",
        },
      ],
      items: [
        {
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
          template_id: "tttttttt-tttt-4ttt-8ttt-tttttttttttt",
          option_id: optionId,
          section_id: sectionId,
          catalog_item_id: catalog.id,
          catalog_seed_key: "roofing.architectural_shingles",
          item_role: "standard",
          customer_name_override: "Premium shingle package",
          sort_order: 10,
        },
      ],
    } as ProposalTemplateGraph;

    const prepared = buildPreparedIncludedWorkPresentation({
      graph,
      optionId,
      catalogItems: [catalog],
    });
    const row = prepared.groups[0]?.items[0];
    assert.equal(row?.name, "Premium shingle package");
    assert.equal(row?.catalogProductName, "Architectural shingles");
    assert.equal(row?.showCatalogProduct, true);
  });
});
