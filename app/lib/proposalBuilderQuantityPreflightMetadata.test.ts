/**
 * Block A — Builder-internal quantity preflight metadata tests.
 *
 * Run: npx tsx --test app/lib/proposalBuilderQuantityPreflightMetadata.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { MeasurementRecord } from "./measurementTypes";
import {
  resolveProposalBuilderQuantityPreflightMetadata,
  toProposalBuilderQuantityPreflightMetadata,
} from "./proposalBuilderQuantityPreflightMetadata";
import type {
  ProposalDraftGraph,
  ProposalLineItemRow,
  ProposalOptionRow,
  ProposalRecord,
  ProposalVersionRow,
} from "./proposalRecordStore";
import { buildProposalQuantityPreviewContextFromPersistedMeasurement } from "./proposalQuantityResolutionPreflightLoad";
import { buildLineItemSnapshots } from "./proposalSnapshotBuilder";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT = "77777777-7777-4777-8777-777777777777";
const RUNTIME_OPT = "99999999-9999-4999-8999-999999999999";
const TI_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAT_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const LINE_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function matchingEcho(squares: number): Record<string, unknown> {
  return {
    quantity_mode: "adjusted_measurement",
    source_measurement_key: "adjusted_roof_squares",
    source_measurement_value: squares,
    coverage_rate_used: null,
    waste_pct_used: null,
    rounding_mode_used: "exact",
    resolved_purchase_quantity: squares,
  };
}

function catalog(id: string): CatalogItem {
  return {
    company_id: COMPANY_ID,
    id,
    name: id,
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
  };
}

function templateItem(id: string, catalogItemId: string): ProposalTemplateItem {
  return {
    id,
    template_id: TEMPLATE_ID,
    option_id: TEMPLATE_OPT,
    section_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    catalog_item_id: catalogItemId,
    item_role: "standard",
  };
}

function measurement(squares: number): MeasurementRecord {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    status: "verified",
    is_selected: true,
    source_type: "manual",
    is_verified: true,
    adjusted_roof_squares: squares,
    roof_squares: squares,
    roof_area_sqft: squares * 100,
    waste_percent: 10,
    pitch_label: "6/12",
    stories: "1",
  };
}

function proposal(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    customer_id: null,
    template_id: TEMPLATE_ID,
    status: "draft",
    current_draft_version_id: VERSION_ID,
    latest_sent_version_id: null,
    signed_version_id: null,
    selected_option_id: RUNTIME_OPT,
    measurement_record_id: null,
    pricing_policy_id: null,
    proposal_number: null,
    title: "Draft",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    draft_content_changed_at: "2026-06-06T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function lineRow(overrides: Partial<ProposalLineItemRow> = {}): ProposalLineItemRow {
  return {
    id: LINE_A,
    company_id: COMPANY_ID,
    proposal_option_id: RUNTIME_OPT,
    source_template_item_id: TI_A,
    catalog_item_id: CAT_A,
    catalog_seed_key: null,
    section_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    page_id: null,
    sort_order: 0,
    customer_name: "Shingles",
    description: null,
    role: null,
    quantity: 24,
    quantity_display_label: "24 SQ",
    quantity_source_label: "Measurement",
    unit: "SQ",
    customer_unit_price_cents: 500,
    customer_line_total_cents: 12000,
    pricing_status: "priced",
    visible_to_customer: true,
    measurement_quantity_key: null,
    quantity_resolution_echo: matchingEcho(24),
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function draftGraph(overrides: Partial<ProposalDraftGraph> = {}): ProposalDraftGraph {
  const version: ProposalVersionRow = {
    id: VERSION_ID,
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    version_number: 1,
    version_kind: "draft",
    parent_version_id: null,
    frozen_at: null,
    context_echo: {},
    policy_echo: {},
    created_by: null,
    created_at: "2026-06-06T00:00:00.000Z",
  };
  const option: ProposalOptionRow = {
    id: RUNTIME_OPT,
    company_id: COMPANY_ID,
    proposal_version_id: VERSION_ID,
    source_template_option_id: TEMPLATE_OPT,
    name: "Standard",
    customer_label: "Standard",
    description: null,
    sort_order: 0,
    is_default: true,
    visible_to_customer: true,
    customer_subtotal_cents: 12000,
    discount_cents: 0,
    sales_tax_cents: 0,
    customer_total_cents: 12000,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "pass",
    selected_at: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
  };
  return {
    proposal: proposal(),
    version,
    pages: [],
    options: [option],
    lineItems: [lineRow()],
    internalSummaries: [],
    scopeDecisions: [],
    ...overrides,
  };
}

function quantityContext(squares: number) {
  return buildProposalQuantityPreviewContextFromPersistedMeasurement(
    measurement(squares)
  );
}

describe("resolveProposalBuilderQuantityPreflightMetadata", () => {
  test("1. Builder/internal load can access quantity preflight metadata for a draft", () => {
    const meta = resolveProposalBuilderQuantityPreflightMetadata({
      draftGraph: draftGraph(),
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });
    assert.ok(meta);
    assert.equal(meta!.status, "current");
    assert.equal(meta!.currentCount, 1);
    assert.equal(meta!.staleCount, 0);
    assert.equal(meta!.unknownCount, 0);
  });

  test("2. matching live-style adjusted echo reports current", () => {
    const meta = resolveProposalBuilderQuantityPreflightMetadata({
      draftGraph: draftGraph({
        lineItems: [lineRow({ quantity_resolution_echo: matchingEcho(27.5) , quantity: 27.5 })],
      }),
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(27.5),
    });
    assert.equal(meta?.status, "current");
  });

  test("3. missing historical echo reports unknown", () => {
    const meta = resolveProposalBuilderQuantityPreflightMetadata({
      draftGraph: draftGraph({
        lineItems: [lineRow({ quantity_resolution_echo: null })],
      }),
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });
    assert.equal(meta?.status, "unknown");
    assert.equal(meta?.unknownCount, 1);
    assert.equal(meta?.staleCount, 0);
  });

  test("4. mismatched echo reports stale", () => {
    const meta = resolveProposalBuilderQuantityPreflightMetadata({
      draftGraph: draftGraph({
        lineItems: [lineRow({ quantity_resolution_echo: matchingEcho(20) })],
      }),
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });
    assert.equal(meta?.status, "stale");
    assert.equal(meta?.staleCount, 1);
  });

  test("5. Builder still resolves null/unknown when draft missing or deps absent", () => {
    assert.equal(
      resolveProposalBuilderQuantityPreflightMetadata({
        draftGraph: null,
        templateItems: [templateItem(TI_A, CAT_A)],
        catalogItems: [catalog(CAT_A)],
        quantityContext: quantityContext(24),
      }),
      null
    );

    const unknown = resolveProposalBuilderQuantityPreflightMetadata({
      draftGraph: draftGraph(),
      templateItems: null,
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });
    assert.equal(unknown?.status, "unknown");

    assert.equal(
      resolveProposalBuilderQuantityPreflightMetadata({
        draftGraph: draftGraph({
          proposal: proposal({ status: "sent" }),
        }),
        templateItems: [templateItem(TI_A, CAT_A)],
        catalogItems: [catalog(CAT_A)],
        quantityContext: quantityContext(24),
      }),
      null
    );
  });

  test("6. quantities/totals remain unchanged by metadata resolve", () => {
    const line = lineRow({
      quantity: 24,
      customer_line_total_cents: 12000,
      quantity_resolution_echo: matchingEcho(20),
    });
    const graph = draftGraph({ lineItems: [line] });
    const before = {
      quantity: line.quantity,
      customer_line_total_cents: line.customer_line_total_cents,
    };
    resolveProposalBuilderQuantityPreflightMetadata({
      draftGraph: graph,
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });
    assert.equal(graph.lineItems[0]!.quantity, before.quantity);
    assert.equal(
      graph.lineItems[0]!.customer_line_total_cents,
      before.customer_line_total_cents
    );
  });

  test("7. no customer/public DTO includes quantity preflight metadata", () => {
    const customerLines = buildLineItemSnapshots({
      company_id: COMPANY_ID,
      lines: [
        {
          source_template_item_id: TI_A,
          catalog_item_id: CAT_A,
          catalog_seed_key: null,
          section_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          sort_order: 0,
          customer_name: "Shingles",
          description: null,
          role: null,
          quantity: 24,
          quantity_display_label: "24 SQ",
          quantity_source_label: "Measurement",
          unit: "SQ",
          customer_unit_price_cents: 500,
          customer_line_total_cents: 12000,
          pricing_status: "priced",
          visible_to_customer: true,
          measurement_quantity_key: null,
          quantity_resolution_echo: matchingEcho(24),
        },
      ],
    });
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        customerLines[0],
        "quantity_resolution_echo"
      ),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(customerLines[0], "quantityPreflight"),
      false
    );

    const customerPreviewSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalCustomerPreviewViewModel.ts"),
      "utf8"
    );
    const adapterSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalDraftGraphAdapter.ts"),
      "utf8"
    );
    assert.equal(
      customerPreviewSrc.includes("proposalBuilderQuantityPreflightMetadata"),
      false
    );
    assert.equal(
      customerPreviewSrc.includes("quantityPreflight"),
      false
    );
    assert.equal(
      adapterSrc.includes("proposalBuilderQuantityPreflightMetadata"),
      false
    );
  });

  test("8. no auto-refresh / DB write behavior in metadata module", () => {
    const src = readFileSync(
      path.join(
        process.cwd(),
        "app/lib/proposalBuilderQuantityPreflightMetadata.ts"
      ),
      "utf8"
    );
    assert.match(src, /No UI|Invisible by default|no auto-refresh/i);
    assert.equal(src.includes("refreshDraftPricing"), false);
    assert.equal(src.includes(".insert("), false);
    assert.equal(src.includes(".update("), false);
    assert.equal(src.includes("from \"@/app/lib/supabase"), false);
  });

  test("9. raw/whole echo under default adjusted policy is flagged stale", () => {
    const meta = resolveProposalBuilderQuantityPreflightMetadata({
      draftGraph: draftGraph({
        lineItems: [
          lineRow({
            quantity_resolution_echo: {
              ...matchingEcho(24),
              quantity_mode: "raw_plus_waste",
              rounding_mode_used: "whole",
              waste_pct_used: 10,
            },
          }),
        ],
      }),
      templateItems: [templateItem(TI_A, CAT_A)],
      catalogItems: [catalog(CAT_A)],
      quantityContext: quantityContext(24),
    });
    assert.equal(meta?.status, "stale");
    assert.equal(meta?.staleCount, 1);
  });
});

describe("toProposalBuilderQuantityPreflightMetadata", () => {
  test("maps orchestrator result and null", () => {
    assert.equal(toProposalBuilderQuantityPreflightMetadata(null), null);
    assert.deepEqual(
      toProposalBuilderQuantityPreflightMetadata({
        status: "current",
        staleCount: 0,
        unknownCount: 0,
        currentCount: 2,
        byLineId: {},
        identity: null,
      }),
      {
        status: "current",
        staleCount: 0,
        unknownCount: 0,
        currentCount: 2,
      }
    );
  });
});
