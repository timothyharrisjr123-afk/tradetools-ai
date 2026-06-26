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
  totalInvestmentLabel: string | null;
  accent: PackageAccent;
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
};

export const PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL = "Your roofing proposal";

export const PROPOSAL_CUSTOMER_PACKET_COVER_CONFIDENCE =
  "A clear roof replacement proposal prepared for your home, including the selected package, project scope, and total investment.";

export const PROPOSAL_CUSTOMER_PACKET_ESTIMATE_CONFIDENCE =
  "This proposal was prepared to give your home reliable protection with quality materials, professional installation, and a clear project scope.";

export const PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE =
  "We're here to help. Reach out anytime.";
