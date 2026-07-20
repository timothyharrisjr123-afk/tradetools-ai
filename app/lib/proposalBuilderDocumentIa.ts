/**
 * R16A — Proposal Builder document IA: page order, shared copy, chrome vs document surfaces.
 * Pure module — no React, no pricing math, no lifecycle enablement.
 */

import type { ProposalPageType } from "@/app/lib/proposalPageTypes";

/** Customer-logical page strip order (visible items; Preview is modeled separately and stays locked). */
export const PROPOSAL_BUILDER_STRIP_ORDER = [
  "cover",
  "project_overview",
  "estimate",
  "terms",
  "warranty",
  "photos",
  "add_page",
] as const;

export type ProposalBuilderStripSlotId = (typeof PROPOSAL_BUILDER_STRIP_ORDER)[number];

/** Default Builder landing — contractor workflow (pricing/package work). */
export const BUILDER_DEFAULT_LANDING_PAGE_CONTEXT = "estimate" as const;

/** Contractor workspace header kicker (chrome, not document truth). */
export const BUILDER_HEADER_WORKSPACE_KICKER = "Proposal workspace";

/** Subtle note under live job context in the header. */
export const BUILDER_HEADER_WORKSPACE_CONTEXT_NOTE =
  "Same job as the Job Card — draft pages use the saved proposal snapshot";

/** Standard read-only footer on customer document body pages (view mode). */
export const BUILDER_DOCUMENT_READ_ONLY_FOOTER =
  "Read-only view of saved draft content.";

/** R16B — helper when editing job-specific page body text. */
export const BUILDER_PAGE_EDIT_HELPER_COPY =
  "Changes apply to this proposal only — not the master template. Use Insert field for dynamic values. Saved text keeps field placeholders.";

/** R16C2 — token picker trigger label in page editor chrome. */
export const BUILDER_TOKEN_PICKER_TRIGGER_LABEL = "Insert field";

/** R16C2 — aria label for token picker trigger. */
export const BUILDER_TOKEN_PICKER_ARIA_LABEL = "Insert field";

/** R16C2 — token picker menu heading. */
export const BUILDER_TOKEN_PICKER_HEADING = "Document fields";

/** R16C3 — contractor banner when page is hidden from future customer preview. */
export const BUILDER_PAGE_HIDDEN_FROM_CUSTOMER_BANNER =
  "This page is hidden from the future customer preview.";

/** R16C3 — visibility toggle labels. */
export const BUILDER_PAGE_VISIBILITY_VISIBLE_LABEL = "Visible to customer";
export const BUILDER_PAGE_VISIBILITY_HIDDEN_LABEL = "Hidden from customer";
export const BUILDER_PAGE_VISIBILITY_REQUIRED_NOTICE =
  "Required on the customer proposal.";

/** R16B — confirm when navigating away from a dirty page edit session. */
export const BUILDER_UNSAVED_PAGE_EDIT_CONFIRM =
  "You have unsaved changes on this page. Discard them and leave?";

/** R16C1 — overflow menu trigger when no overflow page is active. */
export const BUILDER_OVERFLOW_MENU_LABEL = "More pages";

/** R16C1 — aria label for the overflow pages menu control. */
export const BUILDER_OVERFLOW_MENU_ARIA_LABEL = "More proposal pages";

/** R16C1 — menu heading when listing overflow pages. */
export const BUILDER_OVERFLOW_MENU_HEADING = "Additional pages";

/** R16B — optional label for display-only merge preview under the editor. */
export const BUILDER_PAGE_EDIT_MERGE_PREVIEW_LABEL = "Customer preview (display only)";

/** Customer-safe draft note on the Cover page (no lifecycle wording). */
export const BUILDER_COVER_DRAFT_NOTE = "Draft proposal — not sent to customer.";

/** R17B — contractor Preview chrome (authenticated, not sent). */
export const CUSTOMER_PREVIEW_PAGE_TITLE = "Customer proposal preview";
export const CUSTOMER_PREVIEW_DRAFT_NOTICE =
  "Draft preview — not sent to customer.";
export const CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL = "Back to Builder";
export const CUSTOMER_PREVIEW_SEND_SHARING_LABEL = "Send / sharing";

/** Lifecycle actions remain disabled in R16A and later roadmap phases until explicitly enabled. */
export const BUILDER_LIFECYCLE_ACTIONS_LOCKED = true;

export const BUILDER_ADD_PAGE_STRIP_POLICY = {
  enabled: false,
  showSoon: true,
  status: "soon" as const,
};

export const BUILDER_PREVIEW_STRIP_POLICY = {
  enabled: false,
  showSoon: true,
  status: "locked" as const,
};

export type ProposalBuilderPlaceholderSlot = {
  id: string;
  label: string;
  pageType: ProposalPageType;
  stripSlot: ProposalBuilderStripSlotId;
};

/** Placeholder slots before Estimate in the customer-logical strip. */
export const PROPOSAL_BUILDER_PLACEHOLDERS_BEFORE_ESTIMATE: readonly ProposalBuilderPlaceholderSlot[] =
  [
    {
      id: "placeholder:about",
      label: "Project overview",
      pageType: "project_overview",
      stripSlot: "project_overview",
    },
  ] as const;

/** Placeholder slots after Estimate in the customer-logical strip. */
export const PROPOSAL_BUILDER_PLACEHOLDERS_AFTER_ESTIMATE: readonly ProposalBuilderPlaceholderSlot[] =
  [
    {
      id: "placeholder:terms",
      label: "Terms",
      pageType: "terms",
      stripSlot: "terms",
    },
    {
      id: "placeholder:warranty",
      label: "Warranty",
      pageType: "warranty",
      stripSlot: "warranty",
    },
    {
      id: "placeholder:photos",
      label: "Project Photos",
      pageType: "photos",
      stripSlot: "photos",
    },
  ] as const;

/** All placeholder slots in strip order (for context-id → page_type resolution). */
export const PROPOSAL_BUILDER_ALL_PLACEHOLDER_SLOTS: readonly ProposalBuilderPlaceholderSlot[] =
  [
    ...PROPOSAL_BUILDER_PLACEHOLDERS_BEFORE_ESTIMATE,
    ...PROPOSAL_BUILDER_PLACEHOLDERS_AFTER_ESTIMATE,
  ] as const;

export function isChromeSurface(surface: "chrome" | "document"): boolean {
  return surface === "chrome";
}

export function isDocumentSurface(surface: "chrome" | "document"): boolean {
  return surface === "document";
}

/** Visible strip item ids in customer-logical order (excludes locked Preview). */
export function visibleProposalBuilderStripItemIds(): ProposalBuilderStripSlotId[] {
  return [...PROPOSAL_BUILDER_STRIP_ORDER];
}
