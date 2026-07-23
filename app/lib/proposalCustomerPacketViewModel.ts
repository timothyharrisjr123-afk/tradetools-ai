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

export type ProposalCustomerPacketComparisonOptionViewModel = {
  optionKey: string;
  label: string;
  description: string;
  bullets: string[];
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

export type ProposalCustomerPacketViewModel = {
  cover: ProposalCustomerPacketCoverViewModel;
  estimate: ProposalCustomerPacketEstimateViewModel | null;
  comparison: ProposalCustomerPacketComparisonViewModel | null;
  upgrades: ProposalCustomerPacketUpgradesViewModel | null;
  details: ProposalCustomerPacketDetailsViewModel | null;
  contact: ProposalCustomerPacketContactViewModel | null;
  footerMetadata: ProposalCustomerPacketFooterMetadataViewModel | null;
};

export const PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL = "Your roofing proposal";

export const PROPOSAL_CUSTOMER_PACKET_COVER_CONFIDENCE =
  "Prepared for your home.";

export const PROPOSAL_CUSTOMER_PACKET_ESTIMATE_CONFIDENCE =
  "Here is the roofing package we recommend for your home.";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL = "Recommended roofing package";

export const PROPOSAL_CUSTOMER_PACKET_KEY_HIGHLIGHTS_LABEL = "Package highlights";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL = "Your investment";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY =
  "Based on the recommended package shown above.";

export const PROPOSAL_CUSTOMER_PACKET_TOTAL_FOOTNOTE =
  "Includes the recommended package and any selected upgrades.";

export const PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL = "What is included";

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
  "Choose the right level of protection for your home.";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE = "Recommended";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING = "Selected upgrades";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE1 =
  "Included in your investment total.";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE2 =
  "Other available upgrades stay optional unless selected.";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_FOOTNOTE =
  "Only selected upgrades are part of this proposal.";

export const PROPOSAL_CUSTOMER_PACKET_DETAILS_HEADING = "Warranty, notes & terms";

export const PROPOSAL_CUSTOMER_PACKET_DETAILS_INTRO =
  "Warranty, notes, and related details.";

export const PROPOSAL_CUSTOMER_PACKET_CONTACT_HEADING = "Ready to move forward?";

export const PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE =
  "Review the proposal, ask questions, and confirm details when you're ready.";

/** Soft, non-binding customer package interest — not accept / approve / sign / pay. */
export const PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA = "Request this package";

export const PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA = "Ask a question";

export const PROPOSAL_CUSTOMER_PACKET_DISCUSS_OPTIONS_CTA = "Discuss package options";

export const PROPOSAL_CUSTOMER_PACKET_CONFIRM_DETAILS_NOTE =
  "We'll confirm details before work begins.";

/** R3B2 — non-binding package request modal copy. */
export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_TITLE = "Request this package";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_SUBMIT_CTA = "Send request";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_TITLE = "Request received";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_BODY =
  "Request received. The contractor will review the package and contact you about next steps.";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_NEXT =
  "This request is non-binding.";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_LABEL = "Message (optional)";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_PLACEHOLDER =
  "Anything the contractor should know before confirming details?";

export const PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_MAX = 2000;

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