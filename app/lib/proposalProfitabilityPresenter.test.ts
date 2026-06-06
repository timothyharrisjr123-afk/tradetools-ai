/**
 * 3I-3C — Programmatic tests for proposalProfitabilityPresenter.ts.
 *
 * Run: npx tsx --test app/lib/proposalProfitabilityPresenter.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  INTERNAL_PROFITABILITY_BLOCKED_WARNING,
  INTERNAL_PROFITABILITY_CHECKING_COPY,
  INTERNAL_PROFITABILITY_NOT_AVAILABLE,
  INTERNAL_PROFITABILITY_PLACEHOLDER_WARNING,
  INTERNAL_PROFITABILITY_STATUS_CONFIGURED,
  presentProposalInternalProfitability,
  type ProposalProfitabilityPresenterInput,
} from "./proposalProfitabilityPresenter";

function baseInput(
  overrides: Partial<ProposalProfitabilityPresenterInput> = {}
): ProposalProfitabilityPresenterInput {
  return {
    internalCostCents: 50_000,
    internalProfitCents: 25_000,
    effectiveMarginPct: 33.3,
    pricingPolicyConfigured: true,
    pricingPolicyLoadComplete: true,
    hasBlockingIssues: false,
    ...overrides,
  };
}

describe("proposalProfitabilityPresenter", () => {
  test("configured policy shows internal cost, profit, and margin", () => {
    const out = presentProposalInternalProfitability(baseInput());

    assert.equal(out.shouldShowInternalNumbers, true);
    assert.equal(out.statusLabel, INTERNAL_PROFITABILITY_STATUS_CONFIGURED);
    assert.equal(out.costDisplay, "$500.00");
    assert.equal(out.profitDisplay, "$250.00");
    assert.equal(out.marginDisplay, "33.3%");
    assert.equal(out.warningCopy, null);
  });

  test("missing policy hides internal values and shows placeholder warning", () => {
    const out = presentProposalInternalProfitability(
      baseInput({ pricingPolicyConfigured: false })
    );

    assert.equal(out.shouldShowInternalNumbers, false);
    assert.equal(out.costDisplay, INTERNAL_PROFITABILITY_NOT_AVAILABLE);
    assert.equal(out.profitDisplay, INTERNAL_PROFITABILITY_NOT_AVAILABLE);
    assert.equal(out.marginDisplay, INTERNAL_PROFITABILITY_NOT_AVAILABLE);
    assert.ok(out.warningCopy?.includes("Placeholder pricing"));
    assert.equal(out.warningCopy, INTERNAL_PROFITABILITY_PLACEHOLDER_WARNING);
  });

  test("loading policy hides internal values and marks checking", () => {
    const out = presentProposalInternalProfitability(
      baseInput({ pricingPolicyLoadComplete: false })
    );

    assert.equal(out.shouldShowInternalNumbers, false);
    assert.equal(out.statusLabel, "Checking…");
    assert.equal(out.warningCopy, INTERNAL_PROFITABILITY_CHECKING_COPY);
  });

  test("blocking pricing does not show misleading internal values", () => {
    const out = presentProposalInternalProfitability(
      baseInput({ hasBlockingIssues: true })
    );

    assert.equal(out.shouldShowInternalNumbers, false);
    assert.equal(out.statusLabel, "Incomplete");
    assert.equal(out.costDisplay, INTERNAL_PROFITABILITY_NOT_AVAILABLE);
    assert.equal(out.warningCopy, INTERNAL_PROFITABILITY_BLOCKED_WARNING);
  });

  test("null cents and margin show Not available when otherwise eligible", () => {
    const out = presentProposalInternalProfitability(
      baseInput({
        internalCostCents: null,
        internalProfitCents: null,
        effectiveMarginPct: null,
      })
    );

    assert.equal(out.shouldShowInternalNumbers, true);
    assert.equal(out.costDisplay, INTERNAL_PROFITABILITY_NOT_AVAILABLE);
    assert.equal(out.profitDisplay, INTERNAL_PROFITABILITY_NOT_AVAILABLE);
    assert.equal(out.marginDisplay, INTERNAL_PROFITABILITY_NOT_AVAILABLE);
  });

  test("formats cents with grouping", () => {
    const out = presentProposalInternalProfitability(
      baseInput({ internalCostCents: 1_234_567, internalProfitCents: 99 })
    );

    assert.equal(out.costDisplay, "$12,345.67");
    assert.equal(out.profitDisplay, "$0.99");
  });

  test("formats margin percent to one decimal", () => {
    const out = presentProposalInternalProfitability(
      baseInput({ effectiveMarginPct: 45 })
    );

    assert.equal(out.marginDisplay, "45.0%");
  });

  test("copy is contractor-only — no customer document phrases", () => {
    const configured = presentProposalInternalProfitability(baseInput());
    const placeholder = presentProposalInternalProfitability(
      baseInput({ pricingPolicyConfigured: false })
    );

    assert.ok(configured.statusLabel.includes("contractor-only"));
    assert.ok(!configured.statusLabel.toLowerCase().includes("customer quote"));
    assert.ok(placeholder.warningCopy?.includes("internal profitability unavailable"));
    assert.ok(!placeholder.warningCopy?.toLowerCase().includes("pdf"));
  });
});
