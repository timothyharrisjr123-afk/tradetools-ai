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
  "A clear roof replacement proposal prepared for your home. Review the current package, compare available options, and see optional add-ons included for review.";

export const PROPOSAL_CUSTOMER_PACKET_ESTIMATE_CONFIDENCE =
  "This proposal was prepared to give your home reliable protection with quality materials, professional installation, and a clear project scope.";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL = "Current package";

export const PROPOSAL_CUSTOMER_PACKET_KEY_HIGHLIGHTS_LABEL = "Key highlights";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL = "Current proposal total";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY =
  "Based on the current package shown above.";

export const PROPOSAL_CUSTOMER_PACKET_TOTAL_FOOTNOTE =
  "Package and add-on selection will be available in a later approval step.";

export const PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL = "Includes";

export const PROPOSAL_CUSTOMER_PACKET_TOTAL_INVESTMENT_LABEL = "Total investment";

export const PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_HEADING = "About the packages";

export const PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_LINES = [
  "All packages include professional installation, cleanup, and disposal.",
  "All materials are backed by manufacturer warranties.",
  "Permit fees are included in all packages.",
] as const;

export const PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_PRICING_FALLBACK =
  "Pricing details are based on the proposal shown.";

export const PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE =
  "Built on integrity. Backed by quality.";

export const PROPOSAL_CUSTOMER_PACKET_HEADER_SAVE_PDF_LABEL = "Save PDF";

export const PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL = "Share proposal";

export const PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_HEADING = "What happens next?";

export const PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_ITEMS = [
  "Review your proposal",
  "Ask any questions",
  "Confirm details when enabled",
  "We get to work",
] as const;

export const PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_FOOTNOTE =
  "Final approval options will appear when enabled.";

export const PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING = "Compare packages";

export const PROPOSAL_CUSTOMER_PACKET_COMPARE_INTRO =
  "Your contractor's current package is highlighted. Other packages are shown for comparison.";

export const PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE = "Current";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE1 =
  "Available upgrades your contractor included for review.";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE2 =
  "These are optional and not required for the current package.";

export const PROPOSAL_CUSTOMER_PACKET_UPGRADES_FOOTNOTE =
  "Add-ons will be available during the approval step.";

export const PROPOSAL_CUSTOMER_PACKET_DETAILS_HEADING = "Proposal details";

export const PROPOSAL_CUSTOMER_PACKET_CONTACT_HEADING = "Questions or ready to move forward?";

export const PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE =
  "We're here to help. Reach out anytime.";
