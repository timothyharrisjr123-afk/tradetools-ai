/**
 * R13 — proposalDocumentTokenResolver tests.
 *
 * Run: npx tsx --test app/lib/proposalDocumentTokenResolver.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { buildProposalDocumentContextFromDraftGraph } from "./proposalDocumentContext";
import type { ProposalDocumentContext } from "./proposalDocumentTokenTypes";
import {
  formatProposalDocumentDate,
  formatProposalDocumentMoneyCents,
  resolveAllProposalDocumentTokens,
  resolveProposalDocumentToken,
  substituteProposalDocumentTokens,
} from "./proposalDocumentTokenResolver";

function fullContext(overrides: Partial<ProposalDocumentContext> = {}): ProposalDocumentContext {
  const base: ProposalDocumentContext = {
    company: {
      companyName: "Summit Roofing",
      companyLogoUrl: "https://cdn.example/logo.png",
      companyPhone: "918-555-0100",
      companyLicense: "OK-12345",
      companyAddress: "456 HQ Blvd",
      companyWebsite: "https://summitroofing.com",
      brandPrimaryColor: "#112233",
      brandSecondaryColor: "#445566",
      showLicenseOnCover: true,
    },
    customer: {
      customerId: "55555555-5555-4555-8555-555555555555",
      customerName: "Jane Smith",
      customerEmail: "jane@example.com",
      customerPhone: "918-555-0200",
      customerAddress: "99 Mailing Ln",
    },
    jobName: "Jones roof",
    jobAddress: "1 Main St, Tulsa OK",
    measurementSummary: "24 SQ",
    proposalNumber: "P-2026-0042",
    proposalTitle: "Roof replacement proposal",
    templateName: "Standard roof",
    proposalCreatedDateIso: "2026-06-10T12:00:00.000Z",
    selectedPackage: {
      runtimeOptionId: "99999999-9999-4999-8999-999999999999",
      packageName: "Better",
      customerTotalCents: 22450,
    },
  };

  return {
    ...base,
    ...overrides,
    company: { ...base.company, ...overrides.company },
    customer: { ...base.customer, ...overrides.customer },
    selectedPackage: { ...base.selectedPackage, ...overrides.selectedPackage },
  };
}

describe("proposalDocumentTokenResolver", () => {
  test("resolves company and customer tokens", () => {
    const context = fullContext();
    assert.equal(resolveProposalDocumentToken("company_name", context).value, "Summit Roofing");
    assert.equal(resolveProposalDocumentToken("customer_name", context).value, "Jane Smith");
    assert.equal(resolveProposalDocumentToken("customer_address", context).value, "99 Mailing Ln");
    assert.equal(resolveProposalDocumentToken("job_address", context).value, "1 Main St, Tulsa OK");
  });

  test("missing string values become empty strings", () => {
    const context = fullContext({
      company: { ...fullContext().company, companyName: null },
      customer: { ...fullContext().customer, customerEmail: "   " },
    });
    assert.equal(resolveProposalDocumentToken("company_name", context).value, "");
    assert.equal(resolveProposalDocumentToken("customer_email", context).value, "");
    assert.equal(resolveProposalDocumentToken("company_name", context).resolved, true);
  });

  test("missing show_license_on_cover becomes false string", () => {
    const context = fullContext({
      company: { ...fullContext().company, showLicenseOnCover: false },
    });
    assert.equal(resolveProposalDocumentToken("show_license_on_cover", context).value, "false");

    const missingContext = fullContext({
      company: { ...fullContext().company, showLicenseOnCover: false },
    });
    assert.equal(
      resolveProposalDocumentToken("show_license_on_cover", missingContext).value,
      "false"
    );
  });

  test("money formatting uses persisted cents", () => {
    assert.equal(formatProposalDocumentMoneyCents(22450), "$224.50");
    assert.equal(formatProposalDocumentMoneyCents(10800), "$108.00");
    assert.equal(formatProposalDocumentMoneyCents(1000000), "$10,000.00");
    assert.equal(formatProposalDocumentMoneyCents(null), "");
    assert.equal(
      resolveProposalDocumentToken("selected_package_total", fullContext()).value,
      "$224.50"
    );
    assert.equal(
      resolveProposalDocumentToken("proposal_total", fullContext()).value,
      "$224.50"
    );
  });

  test("date formatting is stable UTC", () => {
    assert.equal(formatProposalDocumentDate("2026-06-10T12:00:00.000Z"), "June 10, 2026");
    assert.equal(formatProposalDocumentDate(null), "");
    assert.equal(
      resolveProposalDocumentToken("proposal_created_date", fullContext()).value,
      "June 10, 2026"
    );
  });

  test("unknown token is safe and unresolved", () => {
    const result = resolveProposalDocumentToken("proposal_expires_date", fullContext());
    assert.equal(result.value, "");
    assert.equal(result.resolved, false);
  });

  test("resolveAllProposalDocumentTokens includes registry tokens", () => {
    const all = resolveAllProposalDocumentTokens(fullContext());
    assert.equal(all.company_name, "Summit Roofing");
    assert.equal(all.measurement_summary, "24 SQ");
    assert.equal(all.proposal_total, "$224.50");
  });

  test("substituteProposalDocumentTokens replaces placeholders without leaking raw tokens", () => {
    const text =
      "Hello {{customer_name}} at {{job_address}}. Total: {{proposal_total}}. Missing: {{proposal_expires_date}}.";
    const out = substituteProposalDocumentTokens(text, fullContext());
    assert.equal(
      out,
      "Hello Jane Smith at 1 Main St, Tulsa OK. Total: $224.50. Missing: ."
    );
    assert.equal(out.includes("{{"), false);
  });

  test("resolver integrates with context builder from graph fixtures", () => {
    const graph = {
      proposal: {
        id: "33333333-3333-4333-8333-333333333333",
        company_id: "11111111-1111-4111-8111-111111111111",
        job_id: "22222222-2222-4222-8222-222222222222",
        customer_id: null,
        template_id: "66666666-6666-4666-8666-666666666666",
        status: "draft" as const,
        current_draft_version_id: "55555555-5555-4555-8555-555555555555",
        latest_sent_version_id: null,
        signed_version_id: null,
        selected_option_id: "99999999-9999-4999-8999-999999999999",
        measurement_record_id: null,
        pricing_policy_id: null,
        proposal_number: "P-1",
        title: "Title",
        created_by: null,
        updated_by: null,
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z",
        archived_at: null,
        deleted_at: null,
      },
      version: {
        id: "55555555-5555-4555-8555-555555555555",
        company_id: "11111111-1111-4111-8111-111111111111",
        proposal_id: "33333333-3333-4333-8333-333333333333",
        version_number: 1,
        version_kind: "draft",
        parent_version_id: null,
        frozen_at: null,
        context_echo: { customer_name: "Mike Jones", address_formatted: "Site addr" },
        policy_echo: {},
        created_by: null,
        created_at: "2026-06-10T00:00:00.000Z",
      },
      pages: [],
      options: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          company_id: "11111111-1111-4111-8111-111111111111",
          proposal_version_id: "55555555-5555-4555-8555-555555555555",
          source_template_option_id: "77777777-7777-4777-8777-777777777777",
          name: "Opt",
          customer_label: "Good",
          description: null,
          sort_order: 0,
          is_default: true,
          visible_to_customer: true,
          customer_subtotal_cents: 5000,
          discount_cents: 0,
          sales_tax_cents: 0,
          customer_total_cents: 5000,
          pricing_complete: true,
          blocking_line_count: 0,
          guardrail_outcome: "pass",
          selected_at: null,
          created_at: "2026-06-06T00:00:00.000Z",
          updated_at: "2026-06-06T00:00:00.000Z",
        },
      ],
      lineItems: [],
      internalSummaries: [],
      scopeDecisions: [],
    };

    const context = buildProposalDocumentContextFromDraftGraph(graph);
    assert.equal(resolveProposalDocumentToken("customer_name", context).value, "Mike Jones");
    assert.equal(resolveProposalDocumentToken("job_address", context).value, "Site addr");
    assert.equal(resolveProposalDocumentToken("selected_package_total", context).value, "$50.00");
  });

  test("resolver module has no forbidden imports", () => {
    const source = readFileSync(
      new URL("./proposalDocumentTokenResolver.ts", import.meta.url),
      "utf8"
    );
    assert.equal(/from\s+["']@\/app\/lib\/proposalPricingEngine/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/supabaseClient/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/estimateStore/.test(source), false);
    assert.equal(/from\s+["']@\/app\/tools\/roofing\/RoofingClient/.test(source), false);
    assert.equal(/localStorage\./.test(source), false);
  });
});
