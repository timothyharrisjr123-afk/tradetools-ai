/**
 * Pure estimate page display settings for master templates (R10a).
 *
 * Uses ProposalPageSettings — not company pricing policy or margin math.
 * Stored on line_items section metadata (per package option) with optional
 * template-level defaults in template.metadata.
 */

import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplate, ProposalTemplateSection } from "@/app/lib/proposalTemplateTypes";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";

export const ESTIMATE_PAGE_SETTINGS_METADATA_KEY = "estimate_page_settings";

export const DEFAULT_ESTIMATE_PAGE_SETTINGS: Readonly<Required<ProposalPageSettings>> = {
  show_line_prices: true,
  show_option_totals: true,
  show_section_headings: true,
  show_customer_package_comparison: false,
};

const SETTINGS_KEYS: (keyof ProposalPageSettings)[] = [
  "show_line_prices",
  "show_option_totals",
  "show_section_headings",
  "show_customer_package_comparison",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function parseBooleanSetting(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

/**
 * Parse raw metadata/settings object into ProposalPageSettings with defaults applied.
 */
export function parseEstimatePageSettings(
  raw: unknown,
  defaults: ProposalPageSettings = DEFAULT_ESTIMATE_PAGE_SETTINGS
): ProposalPageSettings {
  const base: ProposalPageSettings = { ...defaults };
  if (!isPlainObject(raw)) return base;

  const next: ProposalPageSettings = { ...base };
  for (const key of SETTINGS_KEYS) {
    const parsed = parseBooleanSetting(raw[key]);
    if (parsed !== undefined) {
      next[key] = parsed;
    }
  }
  return next;
}

/**
 * Read estimate display settings from template.metadata (template-wide defaults).
 */
export function readEstimatePageSettingsFromTemplate(
  template: ProposalTemplate
): ProposalPageSettings {
  const metadata = template.metadata;
  if (!isPlainObject(metadata)) {
    return { ...DEFAULT_ESTIMATE_PAGE_SETTINGS };
  }
  return parseEstimatePageSettings(metadata[ESTIMATE_PAGE_SETTINGS_METADATA_KEY]);
}

/**
 * Read estimate display settings from a line_items section metadata.
 */
export function readEstimatePageSettingsFromSection(
  section: ProposalTemplateSection
): ProposalPageSettings | null {
  if (section.kind !== "line_items") return null;
  const metadata = section.metadata;
  if (!isPlainObject(metadata)) {
    return null;
  }
  if (!(ESTIMATE_PAGE_SETTINGS_METADATA_KEY in metadata)) {
    return null;
  }
  return parseEstimatePageSettings(metadata[ESTIMATE_PAGE_SETTINGS_METADATA_KEY], {});
}

/**
 * Resolve settings for a package option: section metadata overrides template defaults.
 */
export function resolveEstimatePageSettingsForOption(
  graph: ProposalTemplateGraph,
  optionId: string
): ProposalPageSettings {
  const templateDefaults = readEstimatePageSettingsFromTemplate(graph.template);
  const lineItemsSection = graph.sections.find(
    (section) => section.option_id === optionId && section.kind === "line_items"
  );

  if (!lineItemsSection) {
    return templateDefaults;
  }

  const sectionSettings = readEstimatePageSettingsFromSection(lineItemsSection);
  if (!sectionSettings) {
    return templateDefaults;
  }

  return {
    ...templateDefaults,
    ...sectionSettings,
  };
}

export type EstimatePageSettingsPatch = Partial<ProposalPageSettings>;

/**
 * Validate a settings patch contains only known boolean toggles.
 */
export function validateEstimatePageSettingsPatch(
  patch: EstimatePageSettingsPatch
): { valid: true } | { valid: false; reason: string } {
  if (!isPlainObject(patch)) {
    return { valid: false, reason: "Settings patch must be an object." };
  }

  for (const [key, value] of Object.entries(patch)) {
    if (!(SETTINGS_KEYS as string[]).includes(key)) {
      return { valid: false, reason: `Unknown estimate setting: ${key}` };
    }
    if (value !== undefined && typeof value !== "boolean") {
      return { valid: false, reason: `Estimate setting "${key}" must be a boolean.` };
    }
  }

  return { valid: true };
}

/**
 * Merge a patch onto existing settings without dropping unspecified toggles.
 */
export function mergeEstimatePageSettings(
  existing: ProposalPageSettings,
  patch: EstimatePageSettingsPatch
): ProposalPageSettings {
  const validation = validateEstimatePageSettingsPatch(patch);
  if (!validation.valid) {
    return { ...existing };
  }

  const next: ProposalPageSettings = { ...existing };
  for (const key of SETTINGS_KEYS) {
    if (patch[key] !== undefined) {
      next[key] = patch[key];
    }
  }
  return next;
}

/**
 * Build a metadata object patch preserving unrelated metadata keys.
 */
export function buildEstimatePageSettingsMetadataPatch(
  existingMetadata: Record<string, unknown> | null | undefined,
  settingsPatch: EstimatePageSettingsPatch,
  existingSettings?: ProposalPageSettings
): Record<string, unknown> {
  const base = isPlainObject(existingMetadata) ? { ...existingMetadata } : {};
  const currentSettings = parseEstimatePageSettings(
    base[ESTIMATE_PAGE_SETTINGS_METADATA_KEY],
    existingSettings ?? DEFAULT_ESTIMATE_PAGE_SETTINGS
  );
  const merged = mergeEstimatePageSettings(currentSettings, settingsPatch);

  return {
    ...base,
    [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: merged,
  };
}

/**
 * Build section.metadata patch for a line_items section.
 */
export function buildLineItemsSectionEstimateSettingsPatch(
  section: ProposalTemplateSection,
  settingsPatch: EstimatePageSettingsPatch
): Record<string, unknown> | null {
  if (section.kind !== "line_items") return null;
  const existing = isPlainObject(section.metadata) ? section.metadata : {};
  const current = readEstimatePageSettingsFromSection(section) ?? {};
  return buildEstimatePageSettingsMetadataPatch(existing, settingsPatch, {
    ...DEFAULT_ESTIMATE_PAGE_SETTINGS,
    ...current,
  });
}

/**
 * Build template.metadata patch for template-wide estimate defaults.
 */
export function buildTemplateEstimateSettingsPatch(
  template: ProposalTemplate,
  settingsPatch: EstimatePageSettingsPatch
): Record<string, unknown> {
  const existing = isPlainObject(template.metadata) ? template.metadata : {};
  const current = readEstimatePageSettingsFromTemplate(template);
  return buildEstimatePageSettingsMetadataPatch(existing, settingsPatch, current);
}
