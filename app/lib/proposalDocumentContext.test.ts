/**
 * R13 — proposalDocumentContext tests.
 *
 * Run: npx tsx --test app/lib/proposalDocumentContext.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type {
  ProposalDraftGraph,
  ProposalInternalSummaryRow,
  ProposalLineItemRow,
  ProposalOptionRow,
  ProposalPageRow,
  ProposalVersionRow,
} from "./proposalRecordStore";
import type { ProposalRecord } from "./proposalRecordTypes";
import {
  buildProposalDocumentContextFromDraftGraph,
  resolveSelectedRuntimeOptionFromGraph,
} from "./proposalDocumentContext";
import { pickProposalIdentityEchoSnapshot } from "./proposalIdentityEcho";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "55555555-5555-4555-8555-555555555555";
const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
const TEMPLATE_OPT_A = "77777777-7777-4777-8777-777777777777";
const TEMPLATE_OPT_B = "88888888-8888-4888-8888-888888888888";
const RUNTIME_OPT_A = "99999999-9999-4999-8999-999999999999";
const RUNTIME_OPT_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
    selected_option_id: RUNTIME_OPT_B,
    measurement_record_id: null,
    pricing_policy_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    proposal_number: "P-2026-0042",
    title: "Roof replacement proposal",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function versionRow(overrides: Partial<ProposalVersionRow> = {}): ProposalVersionRow {
  return {
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
    created_at: "2026-06-10T12:00:00.000Z",
    ...overrides,
  };
}

function optionRow(overrides: Partial<ProposalOptionRow> = {}): ProposalOptionRow {
  return {
    id: RUNTIME_OPT_A,
    company_id: COMPANY_ID,
    proposal_version_id: VERSION_ID,
    source_template_option_id: TEMPLATE_OPT_A,
    name: "Option A internal",
    customer_label: "Good",
    description: null,
    sort_order: 0,
    is_default: true,
    visible_to_customer: true,
    customer_subtotal_cents: 10000,
    discount_cents: 0,
    sales_tax_cents: 800,
    customer_total_cents: 10800,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "pass",
    selected_at: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function draftGraph(overrides: Partial<ProposalDraftGraph> = {}): ProposalDraftGraph {
  return {
    proposal: proposal(),
    version: versionRow(),
    pages: [] as ProposalPageRow[],
    options: [
      optionRow(),
      optionRow({
        id: RUNTIME_OPT_B,
        source_template_option_id: TEMPLATE_OPT_B,
        name: "Option B internal",
        customer_label: "Better",
        description: null,
        sort_order: 1,
        is_default: false,
        customer_total_cents: 22450,
      }),
    ],
    lineItems: [] as ProposalLineItemRow[],
    internalSummaries: [] as ProposalInternalSummaryRow[],
    scopeDecisions: [],
    ...overrides,
  };
}

describe("proposalDocumentContext", () => {
  test("company and customer slices source from context_echo only", () => {
    const context = buildProposalDocumentContextFromDraftGraph(
      draftGraph({
        version: versionRow({
          context_echo: {
            company_name: "Summit Roofing",
            company_phone: "918-555-0100",
            company_email: "office@summit.com",
            company_address: "500 HQ Blvd",
            customer_name: "Jane Smith",
            customer_email: "jane@example.com",
            customer_address: "99 Mailing Ln",
            address_formatted: "1 Main St, Tulsa OK",
            job_name: "Jones roof",
            measurement_quantities_display: "24 SQ",
            template_name: "Standard roof",
          },
        }),
      })
    );

    assert.equal(context.company.companyName, "Summit Roofing");
    assert.equal(context.company.companyPhone, "918-555-0100");
    assert.equal(context.company.companyEmail, "office@summit.com");
    assert.equal(context.company.companyAddress, "500 HQ Blvd");
    assert.equal(context.customer.customerName, "Jane Smith");
    assert.equal(context.customer.customerEmail, "jane@example.com");
    assert.equal(context.customer.customerAddress, "99 Mailing Ln");
    assert.equal(context.jobAddress, "1 Main St, Tulsa OK");
    assert.equal(context.jobName, "Jones roof");
    assert.equal(context.measurementSummary, "24 SQ");
    assert.equal(context.templateName, "Standard roof");
    assert.notEqual(context.customer.customerAddress, context.jobAddress);

    const identitySnapshot = pickProposalIdentityEchoSnapshot(
      draftGraph({
        version: versionRow({
          context_echo: {
            company_name: "Summit Roofing",
            company_email: "office@summit.com",
            company_address: "500 HQ Blvd",
            measurement_quantities_display: "24 SQ",
          },
        }),
      }).version.context_echo
    );
    assert.equal(identitySnapshot.company_email, "office@summit.com");
    assert.equal(identitySnapshot.company_address, "500 HQ Blvd");
    assert.equal("measurement_quantities_display" in identitySnapshot, false);
  });

  test("selected package uses persisted selected_option_id and snapshot cents", () => {
    const context = buildProposalDocumentContextFromDraftGraph(draftGraph());
    assert.equal(context.selectedPackage.runtimeOptionId, RUNTIME_OPT_B);
    assert.equal(context.selectedPackage.packageName, "Better");
    assert.equal(context.selectedPackage.customerTotalCents, 22450);
  });

  test("selected package falls back to default option when selected_option_id missing", () => {
    const context = buildProposalDocumentContextFromDraftGraph(
      draftGraph({
        proposal: proposal({ selected_option_id: null }),
      })
    );
    assert.equal(context.selectedPackage.runtimeOptionId, RUNTIME_OPT_A);
    assert.equal(context.selectedPackage.packageName, "Good");
    assert.equal(context.selectedPackage.customerTotalCents, 10800);
  });

  test("selected package name falls back to option.name when customer_label empty", () => {
    const context = buildProposalDocumentContextFromDraftGraph(
      draftGraph({
        proposal: proposal({ selected_option_id: RUNTIME_OPT_A }),
        options: [
          optionRow({ customer_label: null, name: "Fallback Name" }),
        ],
      })
    );
    assert.equal(context.selectedPackage.packageName, "Fallback Name");
  });

  test("proposal metadata comes from proposal and version rows", () => {
    const context = buildProposalDocumentContextFromDraftGraph(draftGraph());
    assert.equal(context.proposalNumber, "P-2026-0042");
    assert.equal(context.proposalTitle, "Roof replacement proposal");
    assert.equal(context.proposalCreatedDateIso, "2026-06-10T12:00:00.000Z");
  });

  test("old draft with missing echo keys does not throw", () => {
    const context = buildProposalDocumentContextFromDraftGraph(
      draftGraph({
        version: versionRow({ context_echo: {} }),
        proposal: proposal({ proposal_number: null, title: null, selected_option_id: null }),
        options: [],
      })
    );
    assert.equal(context.company.companyName, null);
    assert.equal(context.customer.customerName, null);
    assert.equal(context.jobAddress, null);
    assert.equal(context.measurementSummary, null);
    assert.equal(context.selectedPackage.runtimeOptionId, null);
    assert.equal(context.selectedPackage.packageName, null);
    assert.equal(context.selectedPackage.customerTotalCents, null);
  });

  test("resolveSelectedRuntimeOptionFromGraph picks first by sort when no default", () => {
    const graph = draftGraph({
      proposal: proposal({ selected_option_id: null }),
      options: [
        optionRow({ id: RUNTIME_OPT_B, sort_order: 5, is_default: false }),
        optionRow({ id: RUNTIME_OPT_A, sort_order: 1, is_default: false }),
      ],
    });
    assert.equal(resolveSelectedRuntimeOptionFromGraph(graph)?.id, RUNTIME_OPT_A);
  });

  test("context module has no forbidden imports", () => {
    const source = readFileSync(
      new URL("./proposalDocumentContext.ts", import.meta.url),
      "utf8"
    );
    assert.equal(/from\s+["']@\/app\/lib\/proposalPricingEngine/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/supabaseClient/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/estimateStore/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/companyBrandingProfileStore/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/proposalCustomerContext/.test(source), false);
    assert.equal(/loadProposalCustomerContextFromDatabase/.test(source), false);
    assert.equal(/loadProposalCompanyContextFromDatabase/.test(source), false);
    assert.equal(/localStorage\./.test(source), false);
  });
});
