/**
 * R17C4 Phase 4B — Pure helpers for job-specific estimate page display settings.
 *
 * Persists via proposal_pages.settings_json only — not templates, line items, or pricing.
 */

import type { ProposalPageSettings, ProposalPageType } from "@/app/lib/proposalPageTypes";
import {
  DEFAULT_ESTIMATE_PAGE_SETTINGS,
  mergeEstimatePageSettings,
  parseEstimatePageSettings,
  validateEstimatePageSettingsPatch,
  type EstimatePageSettingsPatch,
} from "@/app/lib/proposalTemplateEstimateSettings";

export const ESTIMATE_DISPLAY_SETTINGS_PAGE_TYPE = "estimate" as const satisfies ProposalPageType;

export const PROPOSAL_ESTIMATE_DISPLAY_SETTINGS_HELP =
  "Controls what the customer sees in Preview. Contractor pricing and workbench detail stay unchanged.";

export function canEditProposalPageEstimateSettings(
  pageType: ProposalPageType | string | null | undefined
): boolean {
  return pageType === ESTIMATE_DISPLAY_SETTINGS_PAGE_TYPE;
}

export function readProposalPageEstimateSettings(
  settingsJson: Record<string, unknown> | ProposalPageSettings | null | undefined
): ProposalPageSettings {
  return parseEstimatePageSettings(settingsJson ?? {}, DEFAULT_ESTIMATE_PAGE_SETTINGS);
}

/**
 * Merge a settings patch onto persisted settings_json, preserving unrelated keys.
 */
export function mergeProposalPageSettingsJson(
  existing: Record<string, unknown> | null | undefined,
  patch: EstimatePageSettingsPatch
): ProposalPageSettings {
  const validation = validateEstimatePageSettingsPatch(patch);
  if (!validation.valid) {
    return readProposalPageEstimateSettings(existing);
  }

  const base =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};

  const current = parseEstimatePageSettings(base, DEFAULT_ESTIMATE_PAGE_SETTINGS);
  const merged = mergeEstimatePageSettings(current, patch);
  return { ...base, ...merged };
}

export function estimatePageSettingsChanged(
  current: Record<string, unknown> | null | undefined,
  patch: EstimatePageSettingsPatch
): boolean {
  const validation = validateEstimatePageSettingsPatch(patch);
  if (!validation.valid) return false;

  const before = readProposalPageEstimateSettings(current);
  const after = mergeProposalPageSettingsJson(current, patch);

  return (
    before.show_line_prices !== after.show_line_prices ||
    before.show_option_totals !== after.show_option_totals ||
    before.show_section_headings !== after.show_section_headings
  );
}
