/**
 * Run: npx tsx --test app/lib/companySetupReadiness.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { deriveCompanySetupReadiness } from "./companySetupReadiness";

describe("deriveCompanySetupReadiness", () => {
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

  test("partial setup shows banner with first incomplete href", () => {
    const result = deriveCompanySetupReadiness({
      loading: false,
      companyProfileComplete: true,
      pricingRulesConfigured: false,
      priceBookReady: false,
      proposalTemplatesReady: false,
    });
    assert.equal(result.showBanner, true);
    assert.equal(result.completeCount, 1);
    assert.equal(result.primaryHref, "/tools/settings/pricing");
  });

  test("unknown values after load count as incomplete for banner", () => {
    const result = deriveCompanySetupReadiness({
      loading: false,
      companyProfileComplete: null,
      pricingRulesConfigured: true,
      priceBookReady: true,
      proposalTemplatesReady: true,
    });
    assert.equal(result.showBanner, true);
    assert.equal(result.steps[0]?.status, "unknown");
  });
});
