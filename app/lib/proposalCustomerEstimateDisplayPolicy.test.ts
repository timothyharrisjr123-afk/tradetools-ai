/**
 * R17C4 Phase 4A — Customer estimate display policy resolver tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerEstimateDisplayPolicy.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  readEstimatePageSettingsFromProposalPage,
  resolveCustomerPreviewEstimateDisplayPolicy,
} from "./proposalCustomerEstimateDisplayPolicy";

describe("resolveCustomerPreviewEstimateDisplayPolicy", () => {
  test("defaults all flags to true when settings are null", () => {
    const policy = resolveCustomerPreviewEstimateDisplayPolicy(null);
    assert.equal(policy.showLinePrices, true);
    assert.equal(policy.showOptionTotals, true);
    assert.equal(policy.showSectionHeadings, true);
  });

  test("defaults all flags to true when settings are undefined", () => {
    const policy = resolveCustomerPreviewEstimateDisplayPolicy(undefined);
    assert.equal(policy.showLinePrices, true);
    assert.equal(policy.showOptionTotals, true);
    assert.equal(policy.showSectionHeadings, true);
  });

  test("partial settings fall back to defaults for unspecified toggles", () => {
    const policy = resolveCustomerPreviewEstimateDisplayPolicy({
      show_line_prices: false,
    });
    assert.equal(policy.showLinePrices, false);
    assert.equal(policy.showOptionTotals, true);
    assert.equal(policy.showSectionHeadings, true);
  });

  test("explicit false toggles resolve to false", () => {
    const policy = resolveCustomerPreviewEstimateDisplayPolicy({
      show_line_prices: false,
      show_option_totals: false,
      show_section_headings: false,
    });
    assert.equal(policy.showLinePrices, false);
    assert.equal(policy.showOptionTotals, false);
    assert.equal(policy.showSectionHeadings, false);
  });
});

describe("readEstimatePageSettingsFromProposalPage", () => {
  test("returns null for invalid settings_json", () => {
    assert.equal(readEstimatePageSettingsFromProposalPage(null), null);
    assert.equal(readEstimatePageSettingsFromProposalPage([] as unknown as Record<string, unknown>), null);
  });

  test("parses valid settings_json object", () => {
    const settings = readEstimatePageSettingsFromProposalPage({
      show_line_prices: false,
      show_option_totals: true,
    });
    assert.equal(settings?.show_line_prices, false);
    assert.equal(settings?.show_option_totals, true);
    assert.equal(settings?.show_section_headings, true);
  });
});
