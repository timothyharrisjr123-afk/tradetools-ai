/**
 * R16C3 — Pure helpers for job-specific proposal page customer visibility.
 *
 * Persists via proposal_pages.visible_to_customer only — not content_json or templates.
 * No DB, React, pricing, or lifecycle mutation.
 */

import type { ProposalPageType } from "@/app/lib/proposalPageTypes";

/** Page types contractors may hide from future customer Preview in R16C3. */
export const TOGGLEABLE_PROPOSAL_PAGE_TYPES = [
  "project_overview",
  "terms",
  "warranty",
  "custom_text",
  "photos",
  "pdf_attachment",
] as const;

export type ToggleableProposalPageType = (typeof TOGGLEABLE_PROPOSAL_PAGE_TYPES)[number];

/** Page types that must always remain customer-visible. */
export const REQUIRED_CUSTOMER_PROPOSAL_PAGE_TYPES = ["cover", "estimate"] as const;

/** Lifecycle page types — toggle UI deferred until R19/R20. */
export const DEFERRED_VISIBILITY_TOGGLE_PAGE_TYPES = ["signature", "payment_schedule"] as const;

const TOGGLEABLE_PAGE_TYPE_SET = new Set<string>(TOGGLEABLE_PROPOSAL_PAGE_TYPES);
const REQUIRED_PAGE_TYPE_SET = new Set<string>(REQUIRED_CUSTOMER_PROPOSAL_PAGE_TYPES);

export const PROPOSAL_PAGE_VISIBILITY_VISIBLE_LABEL = "Visible to customer";
export const PROPOSAL_PAGE_VISIBILITY_HIDDEN_LABEL = "Hidden from customer";
export const PROPOSAL_PAGE_HIDDEN_FROM_CUSTOMER_BANNER =
  "This page is hidden from the future customer preview.";
export const PROPOSAL_PAGE_VISIBILITY_REQUIRED_NOTICE =
  "Required on the customer proposal.";

export type ProposalPageVisibilityInput = {
  page_type: ProposalPageType | string;
  visible_to_customer: boolean;
  title?: string | null;
  customer_title?: string | null;
};

export type ProposalPageVisibilityState = {
  visibleToCustomer: boolean;
  toggleLabel: string;
  bannerText: string | null;
  canToggle: boolean;
  requiredNotice: string | null;
};

export function canToggleProposalPageVisibility(
  pageType: ProposalPageType | string | null | undefined
): pageType is ToggleableProposalPageType {
  if (pageType == null) return false;
  return TOGGLEABLE_PAGE_TYPE_SET.has(String(pageType));
}

export function isRequiredCustomerProposalPageType(
  pageType: ProposalPageType | string | null | undefined
): boolean {
  if (pageType == null) return false;
  return REQUIRED_PAGE_TYPE_SET.has(String(pageType));
}

export function resolveProposalPageDisplayTitle(
  page: Pick<ProposalPageVisibilityInput, "customer_title" | "title" | "page_type">
): string {
  const customer = (page.customer_title ?? "").trim();
  if (customer) return customer;
  const title = (page.title ?? "").trim();
  if (title) return title;
  return String(page.page_type);
}

export function getProposalPageVisibilityState(
  page: ProposalPageVisibilityInput | null | undefined
): ProposalPageVisibilityState {
  if (!page) {
    return {
      visibleToCustomer: true,
      toggleLabel: PROPOSAL_PAGE_VISIBILITY_VISIBLE_LABEL,
      bannerText: null,
      canToggle: false,
      requiredNotice: null,
    };
  }

  const pageType = page.page_type;
  const visibleToCustomer = page.visible_to_customer !== false;

  if (isRequiredCustomerProposalPageType(pageType)) {
    return {
      visibleToCustomer: true,
      toggleLabel: PROPOSAL_PAGE_VISIBILITY_VISIBLE_LABEL,
      bannerText: null,
      canToggle: false,
      requiredNotice: PROPOSAL_PAGE_VISIBILITY_REQUIRED_NOTICE,
    };
  }

  if (!canToggleProposalPageVisibility(pageType)) {
    return {
      visibleToCustomer,
      toggleLabel: visibleToCustomer
        ? PROPOSAL_PAGE_VISIBILITY_VISIBLE_LABEL
        : PROPOSAL_PAGE_VISIBILITY_HIDDEN_LABEL,
      bannerText: visibleToCustomer ? null : PROPOSAL_PAGE_HIDDEN_FROM_CUSTOMER_BANNER,
      canToggle: false,
      requiredNotice: null,
    };
  }

  return {
    visibleToCustomer,
    toggleLabel: visibleToCustomer
      ? PROPOSAL_PAGE_VISIBILITY_VISIBLE_LABEL
      : PROPOSAL_PAGE_VISIBILITY_HIDDEN_LABEL,
    bannerText: visibleToCustomer ? null : PROPOSAL_PAGE_HIDDEN_FROM_CUSTOMER_BANNER,
    canToggle: true,
    requiredNotice: null,
  };
}

/** True when the next visibility value differs from persisted current value. */
export function proposalPageVisibilityChanged(
  current: boolean | null | undefined,
  next: boolean
): boolean {
  return Boolean(current) !== next;
}

/** R17 contract helper — filter pages for future customer Preview (not used in Builder). */
export function getCustomerPreviewPages<T extends { visible_to_customer: boolean; sort_order: number; id: string }>(
  pages: readonly T[]
): T[] {
  return [...pages]
    .filter((page) => page.visible_to_customer === true)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}
