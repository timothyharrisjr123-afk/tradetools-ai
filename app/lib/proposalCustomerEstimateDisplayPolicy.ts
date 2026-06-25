/**
 * R17C4 Phase 4A — Pure customer estimate display policy resolver.
 *
 * Resolves estimate page display flags from persisted `proposal_pages.settings_json`
 * (copied from template at draft create). Display-only — does not affect pricing math.
 */

import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import {
  DEFAULT_ESTIMATE_PAGE_SETTINGS,
  parseEstimatePageSettings,
} from "@/app/lib/proposalTemplateEstimateSettings";

export type ResolvedCustomerPreviewEstimateDisplayPolicy = {
  showLinePrices: boolean;
  showOptionTotals: boolean;
  showSectionHeadings: boolean;
};

/**
 * Resolve customer Preview display policy with FieldDive defaults applied.
 */
export function resolveCustomerPreviewEstimateDisplayPolicy(
  settings: ProposalPageSettings | null | undefined
): ResolvedCustomerPreviewEstimateDisplayPolicy {
  const parsed = parseEstimatePageSettings(settings ?? {}, DEFAULT_ESTIMATE_PAGE_SETTINGS);
  return {
    showLinePrices: parsed.show_line_prices !== false,
    showOptionTotals: parsed.show_option_totals !== false,
    showSectionHeadings: parsed.show_section_headings !== false,
  };
}

/**
 * Read estimate page settings from a persisted proposal page row payload.
 */
export function readEstimatePageSettingsFromProposalPage(
  settingsJson: Record<string, unknown> | null | undefined
): ProposalPageSettings | null {
  if (settingsJson == null || typeof settingsJson !== "object" || Array.isArray(settingsJson)) {
    return null;
  }
  return parseEstimatePageSettings(settingsJson);
}
