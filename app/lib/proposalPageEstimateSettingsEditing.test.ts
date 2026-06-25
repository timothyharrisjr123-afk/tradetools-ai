/**
 * R17C4 Phase 4B — estimate page display settings editing tests.
 *
 * Run: npx tsx --test app/lib/proposalPageEstimateSettingsEditing.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  canEditProposalPageEstimateSettings,
  estimatePageSettingsChanged,
  mergeProposalPageSettingsJson,
  readProposalPageEstimateSettings,
} from "./proposalPageEstimateSettingsEditing";

describe("proposalPageEstimateSettingsEditing", () => {
  test("canEditProposalPageEstimateSettings allows estimate only", () => {
    assert.equal(canEditProposalPageEstimateSettings("estimate"), true);
    assert.equal(canEditProposalPageEstimateSettings("terms"), false);
  });

  test("readProposalPageEstimateSettings applies defaults", () => {
    const settings = readProposalPageEstimateSettings({});
    assert.equal(settings.show_line_prices, true);
    assert.equal(settings.show_option_totals, true);
    assert.equal(settings.show_section_headings, true);
  });

  test("mergeProposalPageSettingsJson preserves unrelated keys", () => {
    const merged = mergeProposalPageSettingsJson(
      { show_line_prices: true, future_flag: "keep" },
      { show_line_prices: false }
    );
    assert.equal(merged.show_line_prices, false);
    assert.equal((merged as Record<string, unknown>).future_flag, "keep");
  });

  test("estimatePageSettingsChanged detects toggle changes", () => {
    assert.equal(
      estimatePageSettingsChanged({ show_line_prices: true }, { show_line_prices: false }),
      true
    );
    assert.equal(
      estimatePageSettingsChanged({ show_line_prices: true }, { show_line_prices: true }),
      false
    );
  });
});
