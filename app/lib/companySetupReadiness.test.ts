/**
 * Run: npx tsx --test app/lib/companySetupReadiness.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deriveCompanySetupReadiness, COMPANY_SETUP_STEP_DEFINITIONS } from "./companySetupReadiness";

describe("deriveCompanySetupReadiness", () => {
  test("setup step definitions use Catalog label for catalog route", () => {
    const catalogStep = COMPANY_SETUP_STEP_DEFINITIONS.find((step) => step.id === "price_book");
    assert.ok(catalogStep);
    assert.equal(catalogStep.label, "Catalog");
    assert.equal(catalogStep.href, "/tools/roofing/catalog");
    assert.ok(!COMPANY_SETUP_STEP_DEFINITIONS.some((step) => step.label === "Price book"));
  });

  test("loading hides completion and banner", () => {
    const result = deriveCompanySetupReadiness({
      loading: true,
      companyProfileComplete: false,
      pricingRulesConfigured: false,
      priceBookReady: false,
      proposalTemplatesReady: false,
    });
    assert.equal(result.loading, true);
    assert.equal(result.showBanner, false);
    assert.equal(result.isComplete, false);
    assert.ok(result.steps.every((step) => step.status === "unknown"));
  });

  test("all complete hides banner", () => {
    const result = deriveCompanySetupReadiness({
      loading: false,
      companyProfileComplete: true,
      pricingRulesConfigured: true,
      priceBookReady: true,
      proposalTemplatesReady: true,
    });
    assert.equal(result.isComplete, true);
    assert.equal(result.showBanner, false);
    assert.equal(result.completeCount, 4);
  });

  test("company name missing shows identity banner only", () => {
    const result = deriveCompanySetupReadiness({
      loading: false,
      companyProfileComplete: false,
      pricingRulesConfigured: false,
      priceBookReady: false,
      proposalTemplatesReady: false,
    });
    assert.equal(result.showBanner, true);
    assert.equal(result.isComplete, false);
    assert.equal(result.primaryHref, "/tools/settings");
    assert.equal(result.completeCount, 0);
  });

  test("catalog/pricing/templates incomplete does not dominate Jobs Board banner", () => {
    const result = deriveCompanySetupReadiness({
      loading: false,
      companyProfileComplete: true,
      pricingRulesConfigured: false,
      priceBookReady: false,
      proposalTemplatesReady: false,
    });
    assert.equal(result.showBanner, false);
    assert.equal(result.isComplete, false);
    assert.equal(result.completeCount, 1);
    assert.ok(result.steps.some((step) => step.id === "price_book" && step.status === "incomplete"));
    assert.ok(
      result.steps.some((step) => step.id === "proposal_templates" && step.status === "incomplete")
    );
  });

  test("unknown company profile after load stays quiet on board", () => {
    const result = deriveCompanySetupReadiness({
      loading: false,
      companyProfileComplete: null,
      pricingRulesConfigured: true,
      priceBookReady: true,
      proposalTemplatesReady: true,
    });
    assert.equal(result.showBanner, false);
    assert.equal(result.isComplete, false);
    assert.equal(result.steps[0]?.status, "unknown");
  });
});
