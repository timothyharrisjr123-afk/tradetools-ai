/**
 * R14 — proposalDocumentBodyRenderer tests.
 *
 * Run: npx tsx --test app/lib/proposalDocumentBodyRenderer.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { ProposalDocumentContext } from "./proposalDocumentTokenTypes";
import {
  proposalDocumentBodyContractorNotice,
  renderProposalDocumentPageBody,
} from "./proposalDocumentBodyRenderer";

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

describe("proposalDocumentBodyRenderer", () => {
  test("substitutes known tokens from frozen proposalDocumentContext", () => {
    const raw = "Hello {{customer_name}} at {{job_address}}.";
    const result = renderProposalDocumentPageBody(raw, fullContext(), { pricingComplete: true });
    assert.equal(result.displayText, "Hello Jane Smith at 1 Main St, Tulsa OK.");
    assert.deepEqual(result.diagnostics.tokensFound, ["customer_name", "job_address"]);
  });

  test("output contains no raw supported token placeholders", () => {
    const raw =
      "Dear {{customer_name}}, total {{proposal_total}} at {{job_address}}. Unknown: {{proposal_expires_date}}.";
    const result = renderProposalDocumentPageBody(raw, fullContext(), { pricingComplete: true });
    assert.equal(result.displayText.includes("{{"), false);
    assert.equal(result.displayText, "Dear Jane Smith, total $224.50 at 1 Main St, Tulsa OK. Unknown: .");
  });

  test("unknown token is removed and not leaked", () => {
    const raw = "Expires {{proposal_expires_date}} soon.";
    const result = renderProposalDocumentPageBody(raw, fullContext());
    assert.equal(result.displayText, "Expires  soon.");
    assert.deepEqual(result.diagnostics.unknownTokensRemoved, ["proposal_expires_date"]);
  });

  test("missing echo fields produce empty substitutions without throw", () => {
    const raw = "Customer: {{customer_name}} Email: {{customer_email}}.";
    const result = renderProposalDocumentPageBody(
      raw,
      fullContext({
        customer: {
          customerId: null,
          customerName: null,
          customerEmail: null,
          customerPhone: null,
          customerAddress: null,
        },
      })
    );
    assert.equal(result.displayText, "Customer:  Email: .");
  });

  test("repeated tokens resolve consistently", () => {
    const raw = "{{customer_name}} — again {{customer_name}}.";
    const result = renderProposalDocumentPageBody(raw, fullContext());
    assert.equal(result.displayText, "Jane Smith — again Jane Smith.");
  });

  test("tokens in paragraphs and bullet lines resolve", () => {
    const raw = "Prepared for {{customer_name}}.\n\n- Site: {{job_address}}\n- Mailing: {{customer_address}}";
    const result = renderProposalDocumentPageBody(raw, fullContext());
    assert.equal(result.displayText.includes("Jane Smith"), true);
    assert.equal(result.displayText.includes("1 Main St, Tulsa OK"), true);
    assert.equal(result.displayText.includes("99 Mailing Ln"), true);
    assert.equal(result.displayText.includes("{{"), false);
  });

  test("does not mutate input raw markdown string", () => {
    const raw = "Hello {{customer_name}}.";
    const copy = raw;
    renderProposalDocumentPageBody(raw, fullContext());
    assert.equal(raw, copy);
  });

  test("money tokens render when pricingComplete is true", () => {
    const raw = "Total: {{proposal_total}} Package: {{selected_package_total}}.";
    const result = renderProposalDocumentPageBody(raw, fullContext(), { pricingComplete: true });
    assert.equal(result.displayText, "Total: $224.50 Package: $224.50.");
    assert.equal(result.diagnostics.moneyTokensSuppressed, 0);
  });

  test("money tokens are empty when pricingComplete is false", () => {
    const raw = "Total: {{proposal_total}} Package: {{selected_package_total}}.";
    const result = renderProposalDocumentPageBody(raw, fullContext(), { pricingComplete: false });
    assert.equal(result.displayText, "Total:  Package: .");
    assert.equal(result.diagnostics.moneyTokensSuppressed, 2);
  });

  test("customer_address and job_address resolve independently", () => {
    const raw = "Mail: {{customer_address}} Site: {{job_address}}.";
    const result = renderProposalDocumentPageBody(raw, fullContext());
    assert.equal(result.displayText, "Mail: 99 Mailing Ln Site: 1 Main St, Tulsa OK.");
  });

  test("malformed placeholders may remain in output", () => {
    const raw = "Bad {{ customer_name }} and {{CUSTOMER_NAME}}.";
    const result = renderProposalDocumentPageBody(raw, fullContext());
    assert.equal(result.displayText.includes("{{ customer_name }}"), true);
    assert.equal(result.diagnostics.hasMalformedPlaceholders, true);
  });

  test("contractor notice for suppressed money and unknown tokens", () => {
    const raw = "Total {{proposal_total}} {{proposal_expires_date}}.";
    const result = renderProposalDocumentPageBody(raw, fullContext(), { pricingComplete: false });
    const notice = proposalDocumentBodyContractorNotice(result.diagnostics);
    assert.ok(notice?.includes("Pricing totals"));
    assert.ok(notice?.includes("Unsupported"));
  });

  test("module has no forbidden imports", () => {
    const source = readFileSync(
      new URL("./proposalDocumentBodyRenderer.ts", import.meta.url),
      "utf8"
    );
    assert.equal(/from\s+["']@\/app\/lib\/proposalPricingEngine/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/supabaseClient/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/estimateStore/.test(source), false);
    assert.equal(/import.*JobRecord/.test(source), false);
    assert.equal(/from\s+["']@\/app\/tools\/roofing\/RoofingClient/.test(source), false);
    assert.equal(/localStorage\./.test(source), false);
  });
});
