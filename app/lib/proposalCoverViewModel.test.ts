/**
 * R15 — proposalCoverViewModel tests.
 *
 * Run: npx tsx --test app/lib/proposalCoverViewModel.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { ProposalDocumentContext } from "./proposalDocumentTokenTypes";
import {
  PROPOSAL_COVER_DEFAULT_BRAND_ACCENT,
  buildProposalCoverViewModel,
} from "./proposalCoverViewModel";

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

describe("proposalCoverViewModel", () => {
  test("builds company/customer/job fields from token resolver output", () => {
    const vm = buildProposalCoverViewModel(fullContext(), { pricingComplete: true });
    assert.equal(vm.company.companyName, "Summit Roofing");
    assert.equal(vm.customer.customerName, "Jane Smith");
    assert.equal(vm.customer.customerAddress, "99 Mailing Ln");
    assert.equal(vm.project.jobAddress, "1 Main St, Tulsa OK");
    assert.notEqual(vm.customer.customerAddress, vm.project.jobAddress);
    assert.equal(vm.headline, "Roof replacement proposal");
  });

  test("proposal total matches persisted cents formatting when pricing complete", () => {
    const vm = buildProposalCoverViewModel(fullContext(), { pricingComplete: true });
    assert.equal(vm.packageSummary.totalDisplay, "$224.50");
    assert.equal(vm.packageSummary.pricingComplete, true);
    assert.equal(vm.packageSummary.pricingIncompleteMessage, null);
  });

  test("incomplete pricing suppresses fake total", () => {
    const vm = buildProposalCoverViewModel(fullContext(), { pricingComplete: false });
    assert.equal(vm.packageSummary.totalDisplay, null);
    assert.equal(vm.packageSummary.pricingComplete, false);
    assert.ok(vm.packageSummary.pricingIncompleteMessage?.includes("Pricing incomplete"));
  });

  test("show_license_on_cover false hides license even when company_license exists", () => {
    const vm = buildProposalCoverViewModel(
      fullContext({
        company: {
          ...fullContext().company,
          showLicenseOnCover: false,
          companyLicense: "OK-12345",
        },
      })
    );
    assert.equal(vm.company.license, null);
  });

  test("show_license_on_cover true shows license", () => {
    const vm = buildProposalCoverViewModel(fullContext());
    assert.equal(vm.company.license, "OK-12345");
  });

  test("null logo yields monogram fallback", () => {
    const vm = buildProposalCoverViewModel(
      fullContext({
        company: {
          ...fullContext().company,
          companyLogoUrl: null,
        },
      })
    );
    assert.equal(vm.company.logoUrl, null);
    assert.equal(vm.company.logoMonogram, "SR");
  });

  test("missing echo keys collapse without throw", () => {
    const vm = buildProposalCoverViewModel(
      fullContext({
        company: {
          companyName: null,
          companyLogoUrl: null,
          companyPhone: null,
          companyLicense: null,
          companyAddress: null,
          companyWebsite: null,
          brandPrimaryColor: null,
          brandSecondaryColor: null,
          showLicenseOnCover: false,
        },
        customer: {
          customerId: null,
          customerName: null,
          customerEmail: null,
          customerPhone: null,
          customerAddress: null,
        },
        jobName: null,
        jobAddress: null,
        measurementSummary: null,
        proposalNumber: null,
        proposalTitle: null,
        templateName: null,
        proposalCreatedDateIso: null,
        selectedPackage: {
          runtimeOptionId: null,
          packageName: null,
          customerTotalCents: null,
        },
      })
    );
    assert.equal(vm.company.hasAnyField, false);
    assert.equal(vm.customer.hasAnyField, false);
    assert.equal(vm.project.hasAnyField, false);
    assert.equal(vm.headline, "Proposal");
    assert.equal(vm.documentIdentityIncomplete, true);
  });

  test("different mailing and site addresses render both", () => {
    const vm = buildProposalCoverViewModel(fullContext(), { pricingComplete: true });
    assert.equal(vm.customer.customerAddress, "99 Mailing Ln");
    assert.equal(vm.project.jobAddress, "1 Main St, Tulsa OK");
    assert.equal(vm.customer.mailingAddressDeduped, false);
  });

  test("identical mailing and site address hides mailing from customer block", () => {
    const shared = "1 Main St, Tulsa OK";
    const vm = buildProposalCoverViewModel(
      fullContext({
        customer: { ...fullContext().customer, customerAddress: shared },
        jobAddress: shared,
      })
    );
    assert.equal(vm.customer.customerAddress, null);
    assert.equal(vm.customer.mailingAddressDeduped, true);
    assert.equal(vm.project.jobAddress, shared);
    assert.equal(vm.customer.customerEmail, "jane@example.com");
    assert.equal(vm.customer.customerPhone, "918-555-0200");
    assert.equal(vm.customer.hasAnyField, true);
  });

  test("case-insensitive identical addresses dedupe mailing", () => {
    const vm = buildProposalCoverViewModel(
      fullContext({
        customer: { ...fullContext().customer, customerAddress: " 1 MAIN ST, Tulsa OK " },
        jobAddress: "1 main st, tulsa ok",
      })
    );
    assert.equal(vm.customer.customerAddress, null);
    assert.equal(vm.customer.mailingAddressDeduped, true);
    assert.equal(vm.project.jobAddress, "1 main st, tulsa ok");
  });

  test("email and phone remain when mailing address is deduped", () => {
    const addr = "99 Same Place";
    const vm = buildProposalCoverViewModel(
      fullContext({
        customer: {
          ...fullContext().customer,
          customerAddress: addr,
          customerName: null,
        },
        jobAddress: addr,
      })
    );
    assert.equal(vm.customer.customerAddress, null);
    assert.equal(vm.customer.customerEmail, "jane@example.com");
    assert.equal(vm.customer.customerPhone, "918-555-0200");
    assert.equal(vm.customer.hasAnyField, true);
  });

  test("default brand accent constant is defined", () => {
    assert.equal(typeof PROPOSAL_COVER_DEFAULT_BRAND_ACCENT, "string");
    assert.ok(PROPOSAL_COVER_DEFAULT_BRAND_ACCENT.startsWith("#"));
  });

  test("module has no forbidden imports", () => {
    const source = readFileSync(new URL("./proposalCoverViewModel.ts", import.meta.url), "utf8");
    assert.equal(/from\s+["']@\/app\/lib\/proposalPricingEngine/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/supabaseClient/.test(source), false);
    assert.equal(/from\s+["']@\/app\/lib\/estimateStore/.test(source), false);
    assert.equal(/import.*JobRecord/.test(source), false);
    assert.equal(/from\s+["']@\/app\/tools\/roofing\/RoofingClient/.test(source), false);
    assert.equal(/localStorage\./.test(source), false);
  });
});
