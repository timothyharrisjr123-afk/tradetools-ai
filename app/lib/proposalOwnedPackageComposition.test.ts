/**
 * Run: npx tsx --test app/lib/proposalOwnedPackageComposition.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ProposalLineItemRow, ProposalOptionRow } from "./proposalRecordStore";
import type { ProposalSendFreezeOptionPersistPayload } from "./proposalSendFreezePersistence";
import {
  adaptDraftGraphToPackageCompositions,
  buildProposalOwnedCustomerFactLinesFromDraft,
  buildProposalOwnedCustomerFactLinesFromFreeze,
} from "./proposalOwnedPackageComposition";

const OPT_STD = "11111111-1111-4111-8111-111111111111";
const OPT_ENH = "22222222-2222-4222-8222-222222222222";
const OPT_PREM = "33333333-3333-4333-8333-333333333333";
const SRC_STD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SRC_ENH = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SRC_PREM = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CAT_ARCH = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CAT_DESIGNER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CAT_SYN = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const CAT_PREM_SYN = "99999999-9999-4999-8999-999999999999";
const CAT_EAVES = "88888888-8888-4888-8888-888888888888";
const CAT_VENT = "77777777-7777-4777-8777-777777777777";

function option(
  id: string,
  sourceId: string,
  name: string,
  sortOrder: number
): ProposalOptionRow {
  return {
    id,
    company_id: "co",
    proposal_version_id: "ver",
    source_template_option_id: sourceId,
    name,
    customer_label: name,
    description: `${name} authored description`,
    sort_order: sortOrder,
    is_default: name === "Standard",
    visible_to_customer: true,
    customer_subtotal_cents: 1000,
    discount_cents: 0,
    sales_tax_cents: 0,
    customer_total_cents: 1000,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "allow",
    selected_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function line(input: {
  id: string;
  optionId: string;
  name: string;
  catalogId: string;
  role?: string;
  compositionRole: string;
  compositionSlotKey: string;
  seed: string;
}): ProposalLineItemRow {
  return {
    id: input.id,
    company_id: "co",
    proposal_option_id: input.optionId,
    source_template_item_id: input.id,
    catalog_item_id: input.catalogId,
    catalog_seed_key: input.seed,
    composition_role: input.compositionRole,
    composition_slot_key: input.compositionSlotKey,
    section_id: null,
    page_id: null,
    sort_order: 10,
    customer_name: input.name,
    description: null,
    role: input.role ?? "standard",
    quantity: 1,
    quantity_display_label: "1",
    quantity_source_label: null,
    unit: "EA",
    customer_unit_price_cents: 100,
    customer_line_total_cents: 100,
    pricing_status: "priced",
    visible_to_customer: true,
    measurement_quantity_key: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function draftGraph() {
  return {
    options: [
      option(OPT_STD, SRC_STD, "Standard", 10),
      option(OPT_ENH, SRC_ENH, "Enhanced", 20),
      option(OPT_PREM, SRC_PREM, "Premium", 30),
    ],
    lineItems: [
      line({
        id: "l-std-shingle",
        optionId: OPT_STD,
        name: "Architectural shingles",
        catalogId: CAT_ARCH,
        compositionRole: "roof_covering",
        compositionSlotKey: "roof_covering",
        seed: "seed.shingle",
      }),
      line({
        id: "l-std-under",
        optionId: OPT_STD,
        name: "Synthetic underlayment",
        catalogId: CAT_SYN,
        compositionRole: "underlayment",
        compositionSlotKey: "underlayment",
        seed: "seed.underlayment",
      }),
      line({
        id: "l-enh-shingle",
        optionId: OPT_ENH,
        name: "Architectural shingles",
        catalogId: CAT_ARCH,
        compositionRole: "roof_covering",
        compositionSlotKey: "roof_covering",
        seed: "seed.shingle",
      }),
      line({
        id: "l-enh-under",
        optionId: OPT_ENH,
        name: "Premium synthetic underlayment",
        catalogId: CAT_PREM_SYN,
        compositionRole: "underlayment",
        compositionSlotKey: "underlayment",
        seed: "seed.underlayment.premium",
      }),
      line({
        id: "l-enh-eaves",
        optionId: OPT_ENH,
        name: "Ice & water protection at eaves",
        catalogId: CAT_EAVES,
        compositionRole: "ice_water",
        compositionSlotKey: "ice_water.eaves",
        seed: "seed.eaves",
      }),
      line({
        id: "l-enh-vent",
        optionId: OPT_ENH,
        name: "Additional roof ventilation",
        catalogId: CAT_VENT,
        role: "upgrade",
        compositionRole: "ventilation",
        compositionSlotKey: "ventilation.additional",
        seed: "seed.vent",
      }),
      line({
        id: "l-prem-shingle",
        optionId: OPT_PREM,
        name: "Designer architectural shingles",
        catalogId: CAT_DESIGNER,
        compositionRole: "roof_covering",
        compositionSlotKey: "roof_covering",
        seed: "seed.shingle.designer",
      }),
      line({
        id: "l-prem-under",
        optionId: OPT_PREM,
        name: "Premium synthetic underlayment",
        catalogId: CAT_PREM_SYN,
        compositionRole: "underlayment",
        compositionSlotKey: "underlayment",
        seed: "seed.underlayment.premium",
      }),
      line({
        id: "l-prem-eaves",
        optionId: OPT_PREM,
        name: "Ice & water protection at eaves",
        catalogId: CAT_EAVES,
        compositionRole: "ice_water",
        compositionSlotKey: "ice_water.eaves",
        seed: "seed.eaves",
      }),
      line({
        id: "l-prem-vent",
        optionId: OPT_PREM,
        name: "Additional roof ventilation",
        catalogId: CAT_VENT,
        role: "upgrade",
        compositionRole: "ventilation",
        compositionSlotKey: "ventilation.additional",
        seed: "seed.vent",
      }),
    ],
  };
}

function freezeOptionsFromDraft(): ProposalSendFreezeOptionPersistPayload[] {
  const graph = draftGraph();
  return graph.options.map((opt) => ({
    source_template_option_id: opt.source_template_option_id!,
    name: opt.name,
    customer_label: opt.customer_label,
    description: opt.description,
    sort_order: opt.sort_order,
    is_default: opt.is_default,
    visible_to_customer: opt.visible_to_customer,
    customer_subtotal_cents: opt.customer_subtotal_cents,
    discount_cents: opt.discount_cents,
    sales_tax_cents: opt.sales_tax_cents,
    customer_total_cents: opt.customer_total_cents,
    pricing_complete: opt.pricing_complete,
    blocking_line_count: opt.blocking_line_count,
    guardrail_outcome: opt.guardrail_outcome,
    selected_at: opt.selected_at,
    internal_summary: null,
    upgrade_choices: [],
    line_items: graph.lineItems
      .filter((row) => row.proposal_option_id === opt.id)
      .map((row) => ({
        source_template_item_id: row.source_template_item_id,
        catalog_item_id: row.catalog_item_id,
        catalog_seed_key: row.catalog_seed_key,
        composition_role: row.composition_role ?? null,
        composition_slot_key: row.composition_slot_key ?? null,
        section_id: row.section_id,
        page_id: row.page_id,
        sort_order: row.sort_order,
        customer_name: row.customer_name,
        description: row.description,
        role: row.role,
        quantity: row.quantity,
        quantity_display_label: row.quantity_display_label,
        quantity_source_label: row.quantity_source_label,
        unit: row.unit,
        customer_unit_price_cents: row.customer_unit_price_cents,
        customer_line_total_cents: row.customer_line_total_cents,
        pricing_status: row.pricing_status,
        visible_to_customer: row.visible_to_customer,
        measurement_quantity_key: row.measurement_quantity_key,
        upgrade_selection_state: null,
        upgrade_effect: null,
        replaces_source_template_item_id: null,
      })),
  }));
}

describe("proposalOwnedPackageComposition", () => {
  test("base package has no comparison fact lines", () => {
    const facts = buildProposalOwnedCustomerFactLinesFromDraft(draftGraph());
    assert.deepEqual(facts.get(SRC_STD), []);
  });

  test("draft composition produces customer-safe Enhanced facts", () => {
    const facts = buildProposalOwnedCustomerFactLinesFromDraft(draftGraph());
    const enhanced = facts.get(SRC_ENH) ?? [];
    assert.ok(enhanced.some((line) => /Premium synthetic underlayment/i.test(line)));
    assert.ok(enhanced.some((line) => /Added Ice & water protection at eaves/i.test(line)));
    assert.ok(enhanced.some((line) => /Optional: Additional roof ventilation/i.test(line)));
    assert.equal(
      enhanced.some((line) => /Architectural shingles/i.test(line) && /replace/i.test(line)),
      false
    );
    for (const line of enhanced) {
      assert.doesNotMatch(line, /composition_role|composition_slot_key|PRODUCT_REPLACEMENT/);
    }
  });

  test("Premium replacement fact is truthful and omits internals", () => {
    const facts = buildProposalOwnedCustomerFactLinesFromDraft(draftGraph());
    const premium = facts.get(SRC_PREM) ?? [];
    assert.ok(premium.includes("Designer architectural shingles"));
    assert.equal(premium.some((line) => /LABEL_ONLY|UNCHANGED/.test(line)), false);
  });

  test("live Template rows are not required — adapter reads proposal-owned lines only", () => {
    const packages = adaptDraftGraphToPackageCompositions(draftGraph());
    assert.equal(packages.length, 3);
    assert.equal(packages[0]?.packageId, SRC_STD);
    assert.ok(packages[1]?.included.some((row) => row.compositionSlotKey === "ice_water.eaves"));
  });

  test("frozen composition produces the same customer-safe facts as draft", () => {
    const draftFacts = buildProposalOwnedCustomerFactLinesFromDraft(draftGraph());
    const frozenFacts = buildProposalOwnedCustomerFactLinesFromFreeze(freezeOptionsFromDraft());
    assert.deepEqual(frozenFacts.get(SRC_STD), []);
    assert.deepEqual(frozenFacts.get(SRC_ENH), draftFacts.get(SRC_ENH));
    assert.deepEqual(frozenFacts.get(SRC_PREM), draftFacts.get(SRC_PREM));
    const premium = frozenFacts.get(SRC_PREM) ?? [];
    assert.ok(premium.includes("Designer architectural shingles"));
    for (const line of [...(frozenFacts.get(SRC_ENH) ?? []), ...premium]) {
      assert.doesNotMatch(line, /composition_role|composition_slot_key|catalog_seed/);
    }
  });
});
