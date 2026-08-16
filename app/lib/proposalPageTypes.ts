/**
 * FieldDive Proposal Page — type contract (3J0b).
 *
 * Runtime pages for a proposal version (Cover, Estimate, Terms, …).
 * Instantiated copy-on-create from template sections (§6Z M5).
 *
 * Types only — no DB, store, React, or page routing (3J4+).
 */

// ---------------------------------------------------------------------------
// Page types
// ---------------------------------------------------------------------------

export type ProposalPageType =
  | "cover"
  | "estimate"
  | "terms"
  | "warranty"
  | "project_overview"
  | "photos"
  | "pdf_attachment"
  | "custom_text"
  | "payment_schedule"
  | "signature";

export const PROPOSAL_PAGE_TYPES: readonly ProposalPageType[] = [
  "cover",
  "estimate",
  "terms",
  "warranty",
  "project_overview",
  "photos",
  "pdf_attachment",
  "custom_text",
  "payment_schedule",
  "signature",
] as const;

/** Page types planned but not enabled until 3K+ slices. */
export const PROPOSAL_DEFERRED_PAGE_TYPES: readonly ProposalPageType[] = [
  "payment_schedule",
  "signature",
] as const;

// ---------------------------------------------------------------------------
// Page content / settings (JSONB)
// ---------------------------------------------------------------------------

export type ProposalPageMediaRef = {
  storage_key: string;
  caption?: string | null;
  sort_order?: number;
};

export type ProposalPageContent = {
  body_markdown?: string | null;
  media_refs?: ProposalPageMediaRef[];
  pdf_attachment_key?: string | null;
};

/** Estimate-page and layout flags — not customer pricing math. */
export type ProposalPageSettings = {
  show_line_prices?: boolean;
  show_option_totals?: boolean;
  show_section_headings?: boolean;
  /** When true, customer Public may show package comparison derived from frozen composition. */
  show_customer_package_comparison?: boolean;
};

// ---------------------------------------------------------------------------
// Page row
// ---------------------------------------------------------------------------

export type ProposalPage = {
  id: string;
  company_id: string;
  proposal_version_id: string;

  page_type: ProposalPageType;
  sort_order: number;

  title: string;
  customer_title: string | null;
  visible_to_customer: boolean;

  /** Traceability to template section at instantiate; nullable after detach. */
  source_template_section_id: string | null;

  content_json: ProposalPageContent;
  settings_json: ProposalPageSettings;

  created_at: string;
  updated_at: string;
};

export type ProposalPageCreateInput = {
  company_id: string;
  proposal_version_id: string;
  page_type: ProposalPageType;
  sort_order: number;
  title: string;
  customer_title?: string | null;
  visible_to_customer?: boolean;
  source_template_section_id?: string | null;
  content_json?: ProposalPageContent;
  settings_json?: ProposalPageSettings;
};

export function formatProposalPageTypeLabel(pageType: ProposalPageType): string {
  switch (pageType) {
    case "cover":
      return "Cover";
    case "estimate":
      return "Estimate";
    case "terms":
      return "Terms";
    case "warranty":
      return "Warranty";
    case "project_overview":
      return "Project overview";
    case "photos":
      return "Photos";
    case "pdf_attachment":
      return "PDF attachment";
    case "custom_text":
      return "Custom text";
    case "payment_schedule":
      return "Payment schedule";
    case "signature":
      return "Signature";
    default:
      return pageType;
  }
}
