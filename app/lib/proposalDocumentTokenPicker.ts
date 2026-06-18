/**
 * R16C2 — Pure proposal document token picker model.
 *
 * Registry-driven presentation metadata and text insertion helpers for the R16B editor.
 * Inserts canonical raw `{{token_name}}` placeholders only — never resolved values.
 * No DB, React, pricing math, or template mutation.
 */

import {
  PROPOSAL_DOCUMENT_TOKEN_REGISTRY,
  isAvailableProposalDocumentToken,
} from "@/app/lib/proposalDocumentTokenRegistry";
import type {
  ProposalDocumentTokenDomain,
  ProposalDocumentTokenName,
} from "@/app/lib/proposalDocumentTokenTypes";

export type ProposalDocumentTokenPickerSurface = "body_text";

/** Cover/styling tokens excluded from body-text picker surfaces. */
export const BODY_TEXT_EXCLUDED_TOKENS: Readonly<
  Record<
    Extract<
      ProposalDocumentTokenName,
      | "company_logo_url"
      | "brand_primary_color"
      | "brand_secondary_color"
      | "show_license_on_cover"
    >,
    string
  >
> = {
  company_logo_url: "cover_styling",
  brand_primary_color: "cover_styling",
  brand_secondary_color: "cover_styling",
  show_license_on_cover: "cover_styling",
};

const PRICING_TOKEN_NAMES = new Set<ProposalDocumentTokenName>([
  "proposal_total",
  "selected_package_total",
]);

export const PROPOSAL_DOCUMENT_TOKEN_PICKER_DOMAIN_ORDER: readonly ProposalDocumentTokenDomain[] =
  [
    "company",
    "customer",
    "job",
    "measurement",
    "proposal",
    "selected_package",
    "pricing",
  ] as const;

export const PROPOSAL_DOCUMENT_TOKEN_PICKER_DOMAIN_LABELS: Readonly<
  Record<ProposalDocumentTokenDomain, string>
> = {
  company: "Company",
  customer: "Customer",
  job: "Job",
  measurement: "Measurement",
  proposal: "Proposal",
  selected_package: "Selected package",
  pricing: "Pricing",
};

export const PROPOSAL_DOCUMENT_TOKEN_PICKER_PRICING_HINT =
  "Preview hidden until pricing is complete.";

type PickerPresentation = {
  label: string;
  description: string;
  surfaces: readonly ProposalDocumentTokenPickerSurface[];
};

const PICKER_PRESENTATION: Readonly<Record<ProposalDocumentTokenName, PickerPresentation>> = {
  company_name: {
    label: "Company name",
    description: "Contractor company name from proposal context",
    surfaces: ["body_text"],
  },
  company_logo_url: {
    label: "Company logo URL",
    description: "Cover branding asset URL",
    surfaces: [],
  },
  company_phone: {
    label: "Company phone",
    description: "Contractor phone from proposal context",
    surfaces: ["body_text"],
  },
  company_license: {
    label: "Company license",
    description: "Contractor license number",
    surfaces: ["body_text"],
  },
  company_address: {
    label: "Company address",
    description: "Contractor business address",
    surfaces: ["body_text"],
  },
  company_website: {
    label: "Company website",
    description: "Contractor website URL",
    surfaces: ["body_text"],
  },
  brand_primary_color: {
    label: "Brand primary color",
    description: "Cover branding color",
    surfaces: [],
  },
  brand_secondary_color: {
    label: "Brand secondary color",
    description: "Cover branding color",
    surfaces: [],
  },
  show_license_on_cover: {
    label: "Show license on cover",
    description: "Cover display flag",
    surfaces: [],
  },
  customer_name: {
    label: "Customer name",
    description: "Customer name from proposal context",
    surfaces: ["body_text"],
  },
  customer_email: {
    label: "Customer email",
    description: "Customer email from proposal context",
    surfaces: ["body_text"],
  },
  customer_phone: {
    label: "Customer phone",
    description: "Customer phone from proposal context",
    surfaces: ["body_text"],
  },
  customer_address: {
    label: "Customer address",
    description: "Customer mailing address",
    surfaces: ["body_text"],
  },
  job_name: {
    label: "Job name",
    description: "Job name from proposal context",
    surfaces: ["body_text"],
  },
  job_address: {
    label: "Job address",
    description: "Job site address from proposal context",
    surfaces: ["body_text"],
  },
  measurement_summary: {
    label: "Measurement summary",
    description: "Customer-safe measurement labels",
    surfaces: ["body_text"],
  },
  proposal_number: {
    label: "Proposal number",
    description: "Persisted proposal number",
    surfaces: ["body_text"],
  },
  proposal_title: {
    label: "Proposal title",
    description: "Persisted proposal title",
    surfaces: ["body_text"],
  },
  template_name: {
    label: "Template name",
    description: "Installed template name from context",
    surfaces: ["body_text"],
  },
  proposal_created_date: {
    label: "Proposal created date",
    description: "Draft version created date",
    surfaces: ["body_text"],
  },
  selected_package_name: {
    label: "Selected package name",
    description: "Currently selected package label",
    surfaces: ["body_text"],
  },
  selected_package_total: {
    label: "Selected package total",
    description: "Selected package customer total",
    surfaces: ["body_text"],
  },
  proposal_total: {
    label: "Proposal total",
    description: "Alias of selected package total",
    surfaces: ["body_text"],
  },
};

export type ProposalDocumentTokenPickerItem = {
  name: ProposalDocumentTokenName;
  domain: ProposalDocumentTokenDomain;
  label: string;
  description: string;
  placeholder: string;
  pricingHint: string | null;
};

export type ProposalDocumentTokenPickerGroup = {
  domain: ProposalDocumentTokenDomain;
  label: string;
  items: ProposalDocumentTokenPickerItem[];
};

export type BuildProposalDocumentTokenPickerModelOptions = {
  surface: ProposalDocumentTokenPickerSurface;
  pricingComplete: boolean;
};

/** Canonical raw placeholder for a registry token name. */
export function formatProposalDocumentTokenPlaceholder(
  name: ProposalDocumentTokenName
): string {
  return `{{${name}}}`;
}

function isTokenIncludedForSurface(
  name: ProposalDocumentTokenName,
  surface: ProposalDocumentTokenPickerSurface
): boolean {
  const presentation = PICKER_PRESENTATION[name];
  return presentation.surfaces.includes(surface);
}

function buildPickerItem(
  name: ProposalDocumentTokenName,
  domain: ProposalDocumentTokenDomain,
  pricingComplete: boolean
): ProposalDocumentTokenPickerItem {
  const presentation = PICKER_PRESENTATION[name];
  const requiresPricing = PRICING_TOKEN_NAMES.has(name);

  return {
    name,
    domain,
    label: presentation.label,
    description: presentation.description,
    placeholder: formatProposalDocumentTokenPlaceholder(name),
    pricingHint:
      requiresPricing && !pricingComplete
        ? PROPOSAL_DOCUMENT_TOKEN_PICKER_PRICING_HINT
        : null,
  };
}

/**
 * Build grouped picker model from the R13 registry for a target surface.
 * Only `availability: "available"` tokens are included.
 */
export function buildProposalDocumentTokenPickerModel(
  options: BuildProposalDocumentTokenPickerModelOptions
): ProposalDocumentTokenPickerGroup[] {
  const { surface, pricingComplete } = options;
  const itemsByDomain = new Map<ProposalDocumentTokenDomain, ProposalDocumentTokenPickerItem[]>();

  for (const entry of PROPOSAL_DOCUMENT_TOKEN_REGISTRY) {
    if (entry.availability !== "available") continue;
    if (!isTokenIncludedForSurface(entry.name, surface)) continue;

    const item = buildPickerItem(entry.name, entry.domain, pricingComplete);
    const group = itemsByDomain.get(entry.domain) ?? [];
    group.push(item);
    itemsByDomain.set(entry.domain, group);
  }

  return PROPOSAL_DOCUMENT_TOKEN_PICKER_DOMAIN_ORDER.flatMap((domain) => {
    const items = itemsByDomain.get(domain);
    if (!items || items.length === 0) return [];
    return [
      {
        domain,
        label: PROPOSAL_DOCUMENT_TOKEN_PICKER_DOMAIN_LABELS[domain],
        items,
      },
    ];
  });
}

/** Flat list of body-text picker items — useful for tests and search later. */
export function listBodyTextPickerItems(
  pricingComplete: boolean
): ProposalDocumentTokenPickerItem[] {
  return buildProposalDocumentTokenPickerModel({
    surface: "body_text",
    pricingComplete,
  }).flatMap((group) => group.items);
}

export type InsertTextAtCursorInput = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  insertText: string;
};

export type InsertTextAtCursorResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function clampIndex(value: string, index: number): number {
  if (!Number.isFinite(index)) return value.length;
  return Math.max(0, Math.min(index, value.length));
}

/**
 * Insert text at the current selection, replacing any selected range.
 * Cursor lands immediately after the inserted text.
 */
export function insertTextAtCursor(input: InsertTextAtCursorInput): InsertTextAtCursorResult {
  const { value, insertText } = input;
  const start = clampIndex(value, input.selectionStart);
  const end = clampIndex(value, input.selectionEnd);
  const nextValue = value.slice(0, start) + insertText + value.slice(end);
  const cursor = start + insertText.length;

  return {
    value: nextValue,
    selectionStart: cursor,
    selectionEnd: cursor,
  };
}

/** Resolve textarea selection for insertion — uses end when unfocused. */
export function resolveTextareaInsertionSelection(
  value: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined,
  isFocused: boolean
): { selectionStart: number; selectionEnd: number } {
  if (!isFocused) {
    const end = value.length;
    return { selectionStart: end, selectionEnd: end };
  }

  return {
    selectionStart: clampIndex(value, selectionStart ?? value.length),
    selectionEnd: clampIndex(value, selectionEnd ?? value.length),
  };
}

/** Guard that a token name is available in the registry before formatting placeholder. */
export function assertInsertableDocumentToken(name: string): ProposalDocumentTokenName | null {
  if (!isAvailableProposalDocumentToken(name)) return null;
  if (!isTokenIncludedForSurface(name as ProposalDocumentTokenName, "body_text")) return null;
  return name as ProposalDocumentTokenName;
}
