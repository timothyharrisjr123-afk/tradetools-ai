/**
 * V2F — runtime revision change summary goldens.
 * Run: npx tsx --test app/lib/proposalRevisionChangeSummary.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ProposalRecord } from "./proposalRecordTypes";
import type {
  ProposalLineItemRow,
  ProposalOptionRow,
  ProposalPageRow,
} from "./proposalRecordStore";
import {
  REVISION_CHANGE_SUMMARY_PREVIEW_TITLE,
  REVISION_CHANGE_SUMMARY_SENT_RECORD_TITLE,
  REVISION_CHANGE_SUMMARY_UNCHANGED_LABEL,
  REVISION_CHANGE_SUMMARY_WORDING_COMPACT,
  buildRevisionChangeSummary,
  revisionChangeSummaryHasInternalLeak,
  type RevisionChangeSummaryGraph,
} from "./proposalRevisionChangeSummary";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const PROPOSAL = "22222222-2222-4222-8222-222222222222";
const STANDARD_OPT = "33333333-3333-4333-8333-333333333333";
const ENHANCED_OPT = "44444444-4444-4444-8444-444444444444";
const TEMPLATE_STANDARD = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_ENHANCED = "66666666-6666-4666-8666-666666666666";
const SHINGLE_SLOT = "scope.shingles";
const ICE_SLOT = "scope.ice_water";
const VENT_SLOT = "upgrade.ventilation";

function proposal(selectedOptionId: string): ProposalRecord {
  return {
    id: PROPOSAL,
    company_id: COMPANY,
    job_id: "77777777-7777-4777-8777-777777777777",
    customer_id: null,
    template_id: "66666666-6666-4666-8666-666666666666",
    status: "draft",
    current_draft_version_id: null,
    latest_sent_version_id: null,
    signed_version_id: null,
    selected_option_id: selectedOptionId,
    measurement_record_id: null,
    pricing_policy_id: null,
    proposal_number: "P-1",
    title: "Roof replacement",
    created_by: null,
    updated_by: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-23T12:00:00.000Z",
    archived_at: null,
    deleted_at: null,
  };
}

function option(input: {
  id: string;
  templateId: string;
  label: string;
  total: number;
  description?: string;
}): ProposalOptionRow {
  return {
    id: input.id,
    company_id: COMPANY,
    proposal_version_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    source_template_option_id: input.templateId,
    name: input.label,
    customer_label: input.label,
    description: input.description ?? `${input.label} system`,
    sort_order: 0,
    is_default: true,
    visible_to_customer: true,
    customer_subtotal_cents: input.total,
    discount_cents: 0,
    sales_tax_cents: 0,
    customer_total_cents: input.total,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "pass",
    selected_at: "2026-07-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

function line(input: {
  id: string;
  optionId: string;
  name: string;
  slot: string;
  productId: string;
  qty?: string;
  role?: string | null;
}): ProposalLineItemRow {
  return {
    id: input.id,
    company_id: COMPANY,
    proposal_option_id: input.optionId,
    source_template_item_id: input.slot,
    catalog_item_id: input.productId,
    catalog_seed_key: input.slot,
    composition_role: "coverage",
    composition_slot_key: input.slot,
    section_id: null,
    page_id: null,
    sort_order: 0,
    customer_name: input.name,
    description: null,
    role: input.role ?? null,
    quantity: 28,
    quantity_display_label: input.qty ?? "28 SQ",
    quantity_source_label: "Measurement",
    unit: "SQ",
    customer_unit_price_cents: 65000,
    customer_line_total_cents: 1820000,
    pricing_status: "priced",
    visible_to_customer: true,
    measurement_quantity_key: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

function page(input: {
  id: string;
  type: ProposalPageRow["page_type"];
  body: string;
}): ProposalPageRow {
  return {
    id: input.id,
    company_id: COMPANY,
    proposal_version_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    page_type: input.type,
    sort_order: input.type === "project_overview" ? 10 : 20,
    title: input.type,
    customer_title: input.type === "terms" ? "Terms" : "Project Overview",
    visible_to_customer: true,
    source_template_section_id: input.type,
    content_json: { body_markdown: input.body },
    settings_json: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

function graph(input: {
  option: ProposalOptionRow;
  lines: ProposalLineItemRow[];
  pages?: ProposalPageRow[];
}): RevisionChangeSummaryGraph {
  return {
    proposal: proposal(input.option.id),
    options: [input.option],
    lineItems: input.lines,
    pages: input.pages ?? [
      page({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "project_overview",
        body: "Complete roof replacement.",
      }),
    ],
  };
}

const ARCH_SHINGLES = "88888888-8888-4888-8888-888888888888";
const DESIGNER_SHINGLES = "99999999-9999-4999-8999-999999999999";
const ICE_PRODUCT = "abababab-abab-4aba-8aba-abababababab";
const VENT_PRODUCT = "cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd";

const standardBase = graph({
  option: option({
    id: STANDARD_OPT,
    templateId: TEMPLATE_STANDARD,
    label: "Standard",
    total: 1_845_000,
  }),
  lines: [
    line({
      id: "12121212-1212-4212-8212-121212121212",
      optionId: STANDARD_OPT,
      name: "Architectural shingles",
      slot: SHINGLE_SLOT,
      productId: ARCH_SHINGLES,
    }),
  ],
});

describe("buildRevisionChangeSummary", () => {
  test("first-send / missing previous returns null", () => {
    assert.equal(
      buildRevisionChangeSummary({
        mode: "revision_preview",
        current: standardBase,
        previous: null,
      }),
      null
    );
  });

  test("unchanged graphs produce a compact empty summary", () => {
    const summary = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: standardBase,
      previous: standardBase,
    });
    assert.ok(summary);
    assert.equal(summary.hasChanges, false);
    assert.equal(summary.countLabel, REVISION_CHANGE_SUMMARY_UNCHANGED_LABEL);
    assert.equal(summary.title, REVISION_CHANGE_SUMMARY_PREVIEW_TITLE);
    assert.deepEqual(summary.facts, []);
  });

  test("package change", () => {
    const enhanced = graph({
      option: option({
        id: ENHANCED_OPT,
        templateId: TEMPLATE_ENHANCED,
        label: "Enhanced",
        total: 2_017_500,
      }),
      lines: [
        line({
          id: "13131313-1313-4313-8313-131313131313",
          optionId: ENHANCED_OPT,
          name: "Architectural shingles",
          slot: SHINGLE_SLOT,
          productId: ARCH_SHINGLES,
        }),
      ],
    });
    const summary = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: enhanced,
      previous: standardBase,
    });
    assert.ok(summary?.facts.some((fact) => fact.text.includes("Standard to Enhanced")));
    assert.ok(summary?.facts.some((fact) => fact.kind === "total"));
  });

  test("product replacement", () => {
    const revised = graph({
      option: option({
        id: STANDARD_OPT,
        templateId: TEMPLATE_STANDARD,
        label: "Standard",
        total: 1_845_000,
      }),
      lines: [
        line({
          id: "14141414-1414-4414-8414-141414141414",
          optionId: STANDARD_OPT,
          name: "Designer shingles",
          slot: SHINGLE_SLOT,
          productId: DESIGNER_SHINGLES,
        }),
      ],
    });
    const summary = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: revised,
      previous: standardBase,
    });
    assert.ok(
      summary?.facts.some((fact) =>
        /Designer shingles replace Architectural shingles/i.test(fact.text)
      )
    );
  });

  test("quantity change", () => {
    const revised = graph({
      option: option({
        id: STANDARD_OPT,
        templateId: TEMPLATE_STANDARD,
        label: "Standard",
        total: 1_845_000,
      }),
      lines: [
        line({
          id: "15151515-1515-4515-8515-151515151515",
          optionId: STANDARD_OPT,
          name: "Architectural shingles",
          slot: SHINGLE_SLOT,
          productId: ARCH_SHINGLES,
          qty: "32 SQ",
        }),
      ],
    });
    const summary = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: revised,
      previous: standardBase,
    });
    assert.ok(
      summary?.facts.some((fact) =>
        /Architectural shingles changed from 28 SQ to 32 SQ/.test(fact.text)
      )
    );
  });

  test("added and removed included scope", () => {
    const withIce = graph({
      option: option({
        id: STANDARD_OPT,
        templateId: TEMPLATE_STANDARD,
        label: "Standard",
        total: 1_900_000,
      }),
      lines: [
        line({
          id: "16161616-1616-4616-8616-161616161616",
          optionId: STANDARD_OPT,
          name: "Architectural shingles",
          slot: SHINGLE_SLOT,
          productId: ARCH_SHINGLES,
        }),
        line({
          id: "17171717-1717-4717-8717-171717171717",
          optionId: STANDARD_OPT,
          name: "Eaves ice & water protection",
          slot: ICE_SLOT,
          productId: ICE_PRODUCT,
          qty: "120 LF",
        }),
      ],
    });
    const added = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: withIce,
      previous: standardBase,
    });
    assert.ok(added?.facts.some((fact) => fact.text === "Eaves ice & water protection added"));

    const removed = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: standardBase,
      previous: withIce,
    });
    assert.ok(removed?.facts.some((fact) => fact.text === "Eaves ice & water protection removed"));
  });

  test("optional upgrade added, removed, and changed", () => {
    const withVent = graph({
      option: option({
        id: STANDARD_OPT,
        templateId: TEMPLATE_STANDARD,
        label: "Standard",
        total: 1_900_000,
      }),
      lines: [
        ...standardBase.lineItems,
        line({
          id: "18181818-1818-4818-8818-181818181818",
          optionId: STANDARD_OPT,
          name: "Extra ventilation",
          slot: VENT_SLOT,
          productId: VENT_PRODUCT,
          qty: "1",
          role: "upgrade",
        }),
      ],
    });
    const added = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: withVent,
      previous: standardBase,
    });
    assert.ok(added?.facts.some((fact) => fact.text === "Extra ventilation selected"));

    const removed = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: standardBase,
      previous: withVent,
    });
    assert.ok(removed?.facts.some((fact) => fact.text === "Extra ventilation removed"));

    const changedVent = graph({
      option: option({
        id: STANDARD_OPT,
        templateId: TEMPLATE_STANDARD,
        label: "Standard",
        total: 1_920_000,
      }),
      lines: [
        ...standardBase.lineItems,
        line({
          id: "19191919-1919-4919-8919-191919191919",
          optionId: STANDARD_OPT,
          name: "Ridge ventilation",
          slot: VENT_SLOT,
          productId: "dededede-dede-4ded-8ded-dededededede",
          qty: "1",
          role: "upgrade",
        }),
      ],
    });
    const changed = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: changedVent,
      previous: withVent,
    });
    assert.ok(
      changed?.facts.some((fact) => /Ridge ventilation replace Extra ventilation/.test(fact.text))
    );
  });

  test("wording-only change stays compact", () => {
    const revised = {
      ...standardBase,
      pages: [
        page({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "project_overview",
          body: "Updated overview for this job.",
        }),
        page({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          type: "terms",
          body: "Updated terms.",
        }),
      ],
    };
    const summary = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: revised,
      previous: {
        ...standardBase,
        pages: [
          page({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            type: "project_overview",
            body: "Complete roof replacement.",
          }),
          page({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            type: "terms",
            body: "Original terms.",
          }),
        ],
      },
    });
    assert.deepEqual(summary?.facts, [
      { kind: "wording", text: REVISION_CHANGE_SUMMARY_WORDING_COMPACT },
    ]);
  });

  test("total-only change", () => {
    const revised = graph({
      option: option({
        id: STANDARD_OPT,
        templateId: TEMPLATE_STANDARD,
        label: "Standard",
        total: 2_017_500,
      }),
      lines: standardBase.lineItems,
    });
    const summary = buildRevisionChangeSummary({
      mode: "sent_record",
      current: revised,
      previous: standardBase,
    });
    assert.equal(summary?.title, REVISION_CHANGE_SUMMARY_SENT_RECORD_TITLE);
    assert.deepEqual(summary?.facts, [
      {
        kind: "total",
        text: "Total updated from $18,450.00 to $20,175.00",
      },
    ]);
  });

  test("multiple changes stay factual and leak-free", () => {
    const revised = graph({
      option: option({
        id: ENHANCED_OPT,
        templateId: TEMPLATE_ENHANCED,
        label: "Enhanced",
        total: 2_017_500,
      }),
      lines: [
        line({
          id: "20202020-2020-4202-8202-202020202020",
          optionId: ENHANCED_OPT,
          name: "Designer shingles",
          slot: SHINGLE_SLOT,
          productId: DESIGNER_SHINGLES,
        }),
        line({
          id: "21212121-2121-4212-8212-212121212121",
          optionId: ENHANCED_OPT,
          name: "Extra ventilation",
          slot: VENT_SLOT,
          productId: VENT_PRODUCT,
          role: "upgrade",
        }),
      ],
    });
    const summary = buildRevisionChangeSummary({
      mode: "revision_preview",
      current: revised,
      previous: standardBase,
    });
    assert.ok(summary && summary.facts.length >= 3);
    assert.match(summary.countLabel, /^\d+ changes$/);
    for (const fact of summary.facts) {
      assert.equal(revisionChangeSummaryHasInternalLeak(fact.text), false);
      assert.doesNotMatch(fact.text, /composition_slot|catalog_item|version_id/i);
    }
  });
});
