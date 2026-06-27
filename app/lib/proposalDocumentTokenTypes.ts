/**
 * FieldDive Proposal Document Token — type contract (R13).
 *
 * Types only for the frozen document token registry, context DTO, and resolver.
 * No DB, stores, React, pricing engine, or UI.
 */

import type {
  ProposalCompanyContext,
  ProposalCustomerContext,
} from "@/app/lib/proposalDraftGraphAdapter";

/** Token domain grouping for registry and future authoring UI. */
export type ProposalDocumentTokenDomain =
  | "company"
  | "customer"
  | "job"
  | "measurement"
  | "proposal"
  | "selected_package"
  | "pricing";

/** Registry availability — only `available` tokens resolve in R13. */
export type ProposalDocumentTokenAvailability = "available" | "later" | "forbidden";

/** Stable product-facing token names (without `{{` `}}` wrappers). */
export type ProposalDocumentTokenName =
  | "company_name"
  | "company_logo_url"
  | "company_phone"
  | "company_email"
  | "company_license"
  | "company_address"
  | "company_website"
  | "brand_primary_color"
  | "brand_secondary_color"
  | "show_license_on_cover"
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "customer_address"
  | "job_name"
  | "job_address"
  | "measurement_summary"
  | "proposal_number"
  | "proposal_title"
  | "template_name"
  | "proposal_created_date"
  | "selected_package_name"
  | "selected_package_total"
  | "proposal_total";

export type ProposalDocumentTokenRegistryEntry = {
  name: ProposalDocumentTokenName;
  domain: ProposalDocumentTokenDomain;
  availability: ProposalDocumentTokenAvailability;
  /** Documented frozen source path for audits and tests. */
  sourcePath: string;
};

/** Selected runtime option snapshot slice for document tokens. */
export type ProposalSelectedPackageContext = {
  runtimeOptionId: string | null;
  packageName: string | null;
  customerTotalCents: number | null;
};

/**
 * Frozen proposal document context — built exclusively from persisted graph rows.
 * All customer-facing token resolution reads this DTO only.
 */
export type ProposalDocumentContext = {
  company: ProposalCompanyContext;
  customer: ProposalCustomerContext;
  jobName: string | null;
  /** Job/site address — `context_echo.address_formatted`, not customer mailing. */
  jobAddress: string | null;
  /** Customer-safe measurement labels — `context_echo.measurement_quantities_display`. */
  measurementSummary: string | null;
  proposalNumber: string | null;
  proposalTitle: string | null;
  templateName: string | null;
  /** ISO timestamp from `proposal_versions.created_at`. */
  proposalCreatedDateIso: string | null;
  selectedPackage: ProposalSelectedPackageContext;
};

export type ProposalDocumentTokenResolutionResult = {
  tokenName: string;
  value: string;
  /** True when the token is known and resolved (including intentional empty/false). */
  resolved: boolean;
};
