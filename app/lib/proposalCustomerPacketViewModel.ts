/**
 * R18E — Shared customer proposal packet view model contract.
 *
 * Single customer-facing packet shape for Public and (future) Preview routes.
 * Pure types only — no React, DB, or pricing math.
 */

import type { PackageAccent } from "@/app/lib/proposalPackagePresentation";

export type ProposalCustomerPacketCompanyIdentity = {
  companyName: string | null;
  preparedByLabel: string | null;
  logoUrl: string | null;
  logoMonogram: string | null;
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
};

export type ProposalCustomerPacketCoverViewModel = {
  proposalLabel: string;
  headline: string | null;
  confidenceCopy: string;
  /** Real cover/job photo URL when available; null uses branded gradient fallback. */
  coverMediaUrl: string | null;
  company: ProposalCustomerPacketCompanyIdentity;
  preparedFor: {
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    hasAnyField: boolean;
  };
  project: {
    jobName: string | null;
    propertyAddress: string | null;
    hasAnyField: boolean;
  };
};

export type ProposalCustomerPacketEstimateLineViewModel = {
  name: string;
  valueLabel: string | null;
  kind: "priced" | "included" | "informational";
};

export type ProposalCustomerPacketScopeGroupViewModel = {
  title: string;
  lines: ProposalCustomerPacketEstimateLineViewModel[];
};

export type ProposalCustomerPacketScopeGroupSummaryViewModel = {
  title: string;
  itemCount: number;
  previewLabel: string;
};

export type ProposalCustomerPacketEstimateViewModel = {
  optionKey: string;
  label: string;
  description: string;
  bullets: string[];
  accent: PackageAccent;
  /** Single primary money moment — only prominent total on the packet. */
  totalInvestmentLabel: string | null;
  confidenceCopy: string;
  scopeGroupSummaries: ProposalCustomerPacketScopeGroupSummaryViewModel[];
  includedDetails: ProposalCustomerPacketScopeGroupViewModel[];
};

export type ProposalCustomerPacketComparisonAvailability = "included" | "available" | "not_included";

export type ProposalCustomerPacketComparisonDimensionViewModel = {
  label: string;
};

export type ProposalCustomerPacketComparisonCellViewModel = {
  valueLabel: string;
  availability: ProposalCustomerPacketComparisonAvailability;
};

export type ProposalCustomerPacketComparisonOptionViewModel = {
  optionKey: string;
  label: string;
  description: string;
  bullets: string[];
  cells: ProposalCustomerPacketComparisonCellViewModel[];
  totalInvestmentLabel: string | null;
  accent: PackageAccent;
  isCurrent: boolean;
};

export type ProposalCustomerPacketFooterMetadataViewModel = {
  proposalDateLabel: string | null;
  proposalReferenceLabel: string | null;
  licenseLabel: string | null;
  insuredLabel: string | null;
  hasAnyField: boolean;
};

export type ProposalCustomerPacketComparisonViewModel = {
  dimensions: ProposalCustomerPacketComparisonDimensionViewModel[];
  options: ProposalCustomerPacketComparisonOptionViewModel[];
};

export type ProposalCustomerPacketUpgradeItemViewModel = {
  name: string;
  valueLabel: string | null;
};

export type ProposalCustomerPacketUpgradesViewModel = {
  items: ProposalCustomerPacketUpgradeItemViewModel[];
};

export type ProposalCustomerPacketDetailTabViewModel = {
  id: string;
  title: string;
  body: string;
  isEmpty: boolean;
};

export type ProposalCustomerPacketDetailsViewModel = {
  tabs: ProposalCustomerPacketDetailTabViewModel[];
};

export type ProposalCustomerPacketContactViewModel = {
  supportMessage: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license: string | null;
  address: string | null;
};

export type ProposalCustomerPacketAcceptanceViewModel = {
  status: "open" | "accepted" | "signed";
  acceptedOnLabel: string | null;
  signedOnLabel?: string | null;
  signerDisplayName?: string | null;
};

export type ProposalCustomerPacketViewModel = {
  cover: ProposalCustomerPacketCoverViewModel;
  estimate: ProposalCustomerPacketEstimateViewModel | null;
  comparison: ProposalCustomerPacketComparisonViewModel | null;
  upgrades: ProposalCustomerPacketUpgradesViewModel | null;
  details: ProposalCustomerPacketDetailsViewModel | null;
  contact: ProposalCustomerPacketContactViewModel | null;
  footerMetadata: ProposalCustomerPacketFooterMetadataViewModel | null;
  acceptance: ProposalCustomerPacketAcceptanceViewModel;
};

export const PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL = "Your roofing proposal";

export const PROPOSAL_CUSTOMER_PACKET_COVER_CONFIDENCE =
  "Prepared for your home.";

export const PROPOSAL_CUSTOMER_PACKET_ESTIMATE_CONFIDENCE = "";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL = "Selected package";

export const PROPOSAL_CUSTOMER_PACKET_KEY_HIGHLIGHTS_LABEL = "Package highlights";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL = "Your investment";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY =
  "Based on the selected package shown above.";

export const PROPOSAL_CUSTOMER_PACKET_TOTAL_FOOTNOTE =
  "Includes the selected package and any selected upgrades.";

export const PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL = "Included work";

export const PROPOSAL_CUSTOMER_PACKET_TOTAL_INVESTMENT_LABEL = "Your investment";

export const PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_HEADING = "About these packages";

export const PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_LINES = [
  "Every package includes professional installation, cleanup, and disposal.",
  "Materials carry manufacturer coverage; we confirm workmanship coverage with you.",
  "Permit and administrative fees are included where shown in your package.",
] as const;

export const PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_PRICING_FALLBACK =
  "Package prices reflect the scope shown for your home.";

export const PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE =
  "Trusted. Local. Built to Protect.";

export const PROPOSAL_CUSTOMER_PACKET_HEADER_SAVE_PDF_LABEL = "Save PDF";

export const PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL = "Share proposal";

export const PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_HEADING = "What happens next";

export const PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_ITEMS = [
  "Review your proposal",
  "Ask any questions",
  "Confirm details when you are ready",
  "We get to work",
] as const;

export const PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_FOOTNOTE =
  "We will walk you through confirmation when you are ready.";

export const PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING = "Compare packages";

export const PROPOSAL_CUSTOMER_PACKET_COMPARE_INTRO =
  "See what you get as protection increases."

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE = "Selected";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING = "Selected upgrades";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE1 =
  "Included in your investment total.";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE2 =
  "Other optional upgrades stay optional unless selected.";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_FOOTNOTE =
  "Only selected upgrades are part of this proposal.";

export const PROPOSAL_CUSTOMER_PACKET_DETAILS_HEADING = "Warranty, notes & terms";

export const PROPOSAL_CUSTOMER_PACKET_DETAILS_INTRO =
  "Warranty, notes, and related details.";

export const PROPOSAL_CUSTOMER_PACKET_CONTACT_HEADING = "Ready to move forward?";

export const PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE =
  "Review the proposal, ask questions, and confirm details when you're ready.";

/**
 * Soft customer package interest CTAs.
 * Request remains interest-only (not accept / approve / sign / pay).
 */
export const PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA = "Request this package";

export const PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA = "Ask a question";

/** R3C — explicit formal acceptance. Distinct from Request this package. */
export const PROPOSAL_CUSTOMER_PACKET_ACCEPT_PROPOSAL_CTA = "Accept proposal";

export const PROPOSAL_CUSTOMER_PACKET_ACCEPT_MODAL_TITLE = "Accept this proposal?";

export const PROPOSAL_CUSTOMER_PACKET_ACCEPT_MODAL_ACK =
  "You are accepting this proposal as shown, including the selected package and total.";

export const PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_TITLE = "Proposal accepted";

export const PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_NEXT =
  "The contractor has your acceptance.";

export function formatProposalCustomerAcceptedOnLabel(
  acceptedAt: string | null | undefined
): string | null {
  const raw = (acceptedAt ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatProposalCustomerAcceptedOnSentence(
  acceptedOnLabel: string | null | undefined
): string {
  const label = (acceptedOnLabel ?? "").trim();
  return label ? `Accepted on ${label}` : "Proposal accepted";
}

export const PROPOSAL_CUSTOMER_PACKET_DISCUSS_OPTIONS_CTA = "Discuss package options";

/** @deprecated Hero/closeout helper removed in V2D3 — confirmation lives on request success. */
export const PROPOSAL_CUSTOMER_PACKET_CONFIRM_DETAILS_NOTE = "";

/** V2D3 — professional package request modal copy (interest, not acceptance). */
export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_TITLE = "Request this package";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_INTRO =
  "Tell the contractor you're interested in this package.";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_SUBMIT_CTA = "Send request";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_TITLE = "Request sent";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_NEXT =
  "They'll follow up to confirm details.";

/** API/JSON success message — short, professional, no legal caveat. */
export const PROPOSAL_CUSTOMER_PACKET_REQUEST_API_SUCCESS_MESSAGE =
  "Request sent. They'll follow up to confirm details.";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_LABEL = "Message (optional)";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_PLACEHOLDER =
  "Anything you'd like them to know?";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_MAX = 2000;

/** Success body: company received interest in the named package. */
export function proposalCustomerPacketRequestSuccessBody(
  companyName: string | null | undefined,
  packageLabel: string | null | undefined
): string {
  const company = (companyName ?? "").trim() || "The contractor";
  const pkg = (packageLabel ?? "").trim();
  if (!pkg) {
    return `${company} received your interest.`;
  }
  return `${company} received your interest in the ${pkg} package.`;
}

export function proposalCustomerPacketAskAboutPackageCta(packageLabel: string): string {
  const label = packageLabel.trim();
  return label ? `Ask about ${label}` : "Ask about this package";
}

export function proposalCustomerPacketReadyWithPackageHeading(packageLabel: string): string {
  const label = packageLabel.trim();
  return label ? `Ready to move forward with ${label}?` : PROPOSAL_CUSTOMER_PACKET_CONTACT_HEADING;
}

export function proposalCustomerPacketContactCompanyCta(companyName: string | null | undefined): string {
  const name = (companyName ?? "").trim();
  return name ? `Contact ${name}` : "Contact contractor";
}