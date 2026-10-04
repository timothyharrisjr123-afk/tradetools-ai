/**
 * Core Flow 1 / Slice 1 (H) — new proposal lines carry the configured Catalog name,
 * never an internal seed key ("Ice Water Valley" for roofing.ice_water_valley).
 * Run: npx tsx --test app/lib/proposalLineCustomerNameTruth.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  formatCustomerFacingLineLabel,
  looksLikeInternalCatalogKey,
  resolveTemplateLineCustomerName,
} from "./proposalCustomerFacingLabel";
import { templateItemToLineInput } from "./proposalSnapshotBuilder";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

function item(overrides: Partial<ProposalTemplateItem> = {}): ProposalTemplateItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    template_id: "22222222-2222-4222-8222-222222222222",
    option_id: "33333333-3333-4333-8333-333333333333",
    section_id: "44444444-4444-4444-8444-444444444444",
    catalog_item_id: "55555555-5555-4555-8555-555555555555",
    catalog_seed_key: "roofing.ice_water_valley",
    item_role: "standard",
    sort_order: 0,
    ...overrides,
  } as ProposalTemplateItem;
}

const priced = { engineStatus: "priced" as const, customerVisibility: "customer_visible" as const };

describe("resolveTemplateLineCustomerName", () => {
  test("override, then catalog customer name, then catalog name", () => {
    const catalog = { name: "Ice & water shield (valleys)", customer_name: "Valley leak barrier" };
    assert.equal(resolveTemplateLineCustomerName({ customer_name_override: " Custom " }, catalog), "Custom");
    assert.equal(resolveTemplateLineCustomerName({ customer_name_override: null }, catalog), "Valley leak barrier");
    assert.equal(
      resolveTemplateLineCustomerName({ customer_name_override: "" }, { name: "Ice & water shield (valleys)", customer_name: " " }),
      "Ice & water shield (valleys)"
    );
  });

  test("never falls back to the seed key", () => {
    assert.equal(resolveTemplateLineCustomerName(item({ customer_name_override: null }), null), "Line item");
  });
});

describe("templateItemToLineInput writer", () => {
  test("uses the linked Catalog item's configured name", () => {
    const line = templateItemToLineInput(item({ customer_name_override: null }), {
      ...priced,
      catalogItem: { name: "Ice & water shield (valleys)", customer_name: null },
    });
    assert.equal(line.customer_name, "Ice & water shield (valleys)");
    assert.equal(looksLikeInternalCatalogKey(line.customer_name), false);
    // Lineage is preserved separately; only the customer name changes.
    assert.equal(line.catalog_seed_key, "roofing.ice_water_valley");
  });

  test("missing catalog does not write the seed key", () => {
    const line = templateItemToLineInput(item({ customer_name_override: null }), priced);
    assert.equal(line.customer_name, "Line item");
    assert.notEqual(formatCustomerFacingLineLabel(line.customer_name), "Ice Water Valley");
  });

  test("explicit customerName still wins (frozen / manual names)", () => {
    const line = templateItemToLineInput(item(), { ...priced, customerName: "As sent" });
    assert.equal(line.customer_name, "As sent");
  });
});

describe("writer call sites pass the Catalog item", () => {
  test("proposal create + scope-decision rebuilds", () => {
    const record = read("app/lib/proposalRecordStore.ts");
    const merge = read("app/lib/proposalScopeDecisionMerge.ts");
    const countIn = (src: string) => (src.match(/templateItemToLineInput\(templateItem, \{[\s\S]{0,260}catalogItem: catalog \?\? null/g) ?? []).length;
    assert.equal(countIn(record), 1);
    assert.equal(countIn(merge), 2);
  });

  test("preview uses the same resolver (no seed fallback)", () => {
    const preview = read("app/lib/proposalBuilderPreview.ts");
    assert.match(preview, /resolveTemplateLineCustomerName\(templateItem, catalog\)/);
    assert.doesNotMatch(preview, /if \(seed\) return seed/);
  });
});

describe("frozen history is display-only", () => {
  test("already-stored legacy keys still render via display formatting, unmodified in data", () => {
    // Sent/accepted snapshots are not rewritten; the display formatter is unchanged.
    assert.equal(formatCustomerFacingLineLabel("roofing.ice_water_valley"), "Ice Water Valley");
  });
});
