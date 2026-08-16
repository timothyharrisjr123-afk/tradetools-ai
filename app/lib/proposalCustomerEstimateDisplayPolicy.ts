/**
 * R17C4 Phase 4A — Pure customer estimate display policy resolver.
 *
 * Resolves estimate page display flags from persisted `proposal_pages.settings_json`
 * (copied from template at draft create). Display-only — does not affect pricing math.
 */

import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import {
  parseEstimatePageSettings,
} from "@/app/lib/proposalTemplateEstimateSettings";

export type ResolvedCustomerPreviewEstimateDisplayPolicy = {
  showLinePrices: boolean;
  showOptionTotals: boolean;
  showSectionHeadings: boolean;
  /**
   * Customer package comparison preference from frozen/draft estimate page settings.
   * undefined = legacy pre-V2G graphs — comparison allowed when multiple packages exist.
   */
  showCustomerPackageComparison?: boolean;
};

const PROPOSAL_ESTIMATE_DISPLAY_DEFAULTS: ProposalPageSettings = {
  show_line_prices: true,
  show_option_totals: true,
  show_section_headings: true,
};

/**
 * Resolve customer Preview display policy with FieldDive defaults applied.
 */
export function resolveCustomerPreviewEstimateDisplayPolicy(
  settings: ProposalPageSettings | null | undefined
): ResolvedCustomerPreviewEstimateDisplayPolicy {
  const parsed = parseEstimatePageSettings(settings ?? {}, PROPOSAL_ESTIMATE_DISPLAY_DEFAULTS);
  return {
    showLinePrices: parsed.show_line_prices !== false,
    showOptionTotals: parsed.show_option_totals !== false,
    showSectionHeadings: parsed.show_section_headings !== false,
    showCustomerPackageComparison: parsed.show_customer_package_comparison,
  };
}

/**
 * Whether customer-facing package comparison should render for this policy.
 * Legacy graphs without an explicit flag preserve pre-V2G multi-package comparison.
 */
export function resolveCustomerPackageComparisonVisible(
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy,
  visiblePackageCount: number
): boolean {
  if (visiblePackageCount < 2) {
    return false;
  }
  if (displayPolicy.showCustomerPackageComparison === false) {
    return false;
  }
  return true;
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
  // Frozen/draft page reads must not apply the template-authoring default for
  // show_customer_package_comparison. Pre-V2G pages omit the key; absent means
  // legacy Public comparison remains allowed when multiple packages exist.
  return parseEstimatePageSettings(settingsJson, PROPOSAL_ESTIMATE_DISPLAY_DEFAULTS);
}
