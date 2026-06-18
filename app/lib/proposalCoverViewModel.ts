/**
 * FieldDive Proposal Cover view model (R15).
 *
 * Pure cover DTO from frozen ProposalDocumentContext + R13 token resolver.
 * No Supabase, stores, JobRecord, pricing engine, or live reads.
 */

import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import { resolveProposalDocumentToken } from "@/app/lib/proposalDocumentTokenResolver";

/** FieldDive default accent when brand colors are missing from context_echo. */
export const PROPOSAL_COVER_DEFAULT_BRAND_ACCENT = "#3b82f6";

export type ProposalCoverCompanyBlock = {
  companyName: string | null;
  logoUrl: string | null;
  logoMonogram: string | null;
  phone: string | null;
  license: string | null;
  address: string | null;
  website: string | null;
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
  hasAnyField: boolean;
};

export type ProposalCoverCustomerBlock = {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** Omitted when identical to job/site address (see mailingAddressDeduped). */
  customerAddress: string | null;
  /** True when mailing address matches site address and was hidden from Prepared for. */
  mailingAddressDeduped: boolean;
  hasAnyField: boolean;
};

export type ProposalCoverProjectBlock = {
  jobName: string | null;
  jobAddress: string | null;
  hasAnyField: boolean;
};

export type ProposalCoverMetaBlock = {
  proposalNumber: string | null;
  proposalCreatedDate: string | null;
  templateName: string | null;
  hasAnyField: boolean;
};

export type ProposalCoverPackageSummaryBlock = {
  packageName: string | null;
  totalDisplay: string | null;
  pricingComplete: boolean;
  pricingIncompleteMessage: string | null;
};

export type ProposalCoverViewModel = {
  headline: string;
  company: ProposalCoverCompanyBlock;
  customer: ProposalCoverCustomerBlock;
  project: ProposalCoverProjectBlock;
  meta: ProposalCoverMetaBlock;
  packageSummary: ProposalCoverPackageSummaryBlock;
  measurementSummary: string | null;
  documentIdentityIncomplete: boolean;
  documentIdentityIncompleteMessage: string | null;
};

export type BuildProposalCoverViewModelOptions = {
  /** When false, totalDisplay is suppressed — no fabricated totals. */
  pricingComplete?: boolean;
};

function tokenValue(context: ProposalDocumentContext, name: string): string {
  return resolveProposalDocumentToken(name, context).value;
}

function nonEmpty(value: string): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasAnyNonEmpty(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => (v ?? "").trim().length > 0);
}

function monogramFromCompanyName(name: string | null): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  const monogram = (first + last).toUpperCase();
  return monogram.length > 0 ? monogram : null;
}

/** Case-insensitive trimmed comparison for mailing vs site address dedupe. */
export function proposalCoverAddressesMatch(
  mailingAddress: string | null,
  siteAddress: string | null
): boolean {
  const mailing = (mailingAddress ?? "").trim();
  const site = (siteAddress ?? "").trim();
  if (!mailing || !site) return false;
  return mailing.toLowerCase() === site.toLowerCase();
}

/**
 * Build a read-only cover view model from frozen proposal document context.
 */
export function buildProposalCoverViewModel(
  context: ProposalDocumentContext,
  options?: BuildProposalCoverViewModelOptions
): ProposalCoverViewModel {
  const pricingComplete = options?.pricingComplete ?? false;

  const companyName = nonEmpty(tokenValue(context, "company_name"));
  const logoUrl = nonEmpty(tokenValue(context, "company_logo_url"));
  const companyPhone = nonEmpty(tokenValue(context, "company_phone"));
  const companyAddress = nonEmpty(tokenValue(context, "company_address"));
  const companyWebsite = nonEmpty(tokenValue(context, "company_website"));
  const brandPrimaryColor = nonEmpty(tokenValue(context, "brand_primary_color"));
  const brandSecondaryColor = nonEmpty(tokenValue(context, "brand_secondary_color"));

  const showLicenseOnCover = tokenValue(context, "show_license_on_cover") === "true";
  const rawLicense = nonEmpty(tokenValue(context, "company_license"));
  const companyLicense = showLicenseOnCover && rawLicense ? rawLicense : null;

  const customerName = nonEmpty(tokenValue(context, "customer_name"));
  const customerEmail = nonEmpty(tokenValue(context, "customer_email"));
  const customerPhone = nonEmpty(tokenValue(context, "customer_phone"));
  const rawCustomerAddress = nonEmpty(tokenValue(context, "customer_address"));

  const jobName = nonEmpty(tokenValue(context, "job_name"));
  const jobAddress = nonEmpty(tokenValue(context, "job_address"));

  const mailingAddressDeduped = proposalCoverAddressesMatch(rawCustomerAddress, jobAddress);
  const customerAddress =
    rawCustomerAddress && !mailingAddressDeduped ? rawCustomerAddress : null;

  const proposalNumber = nonEmpty(tokenValue(context, "proposal_number"));
  const proposalTitle = nonEmpty(tokenValue(context, "proposal_title"));
  const proposalCreatedDate = nonEmpty(tokenValue(context, "proposal_created_date"));
  const templateName = nonEmpty(tokenValue(context, "template_name"));
  const measurementSummary = nonEmpty(tokenValue(context, "measurement_summary"));

  const packageName = nonEmpty(tokenValue(context, "selected_package_name"));
  const totalDisplay = pricingComplete ? nonEmpty(tokenValue(context, "proposal_total")) : null;

  const headline = proposalTitle ?? jobName ?? "Proposal";

  const documentIdentityIncomplete = !companyName && !customerName;

  return {
    headline,
    company: {
      companyName,
      logoUrl,
      logoMonogram: logoUrl ? null : monogramFromCompanyName(companyName),
      phone: companyPhone,
      license: companyLicense,
      address: companyAddress,
      website: companyWebsite,
      brandPrimaryColor,
      brandSecondaryColor,
      hasAnyField: hasAnyNonEmpty(
        companyName,
        logoUrl,
        companyPhone,
        companyLicense,
        companyAddress,
        companyWebsite
      ),
    },
    customer: {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      mailingAddressDeduped,
      hasAnyField: hasAnyNonEmpty(customerName, customerEmail, customerPhone, customerAddress),
    },
    project: {
      jobName,
      jobAddress,
      hasAnyField: hasAnyNonEmpty(jobName, jobAddress),
    },
    meta: {
      proposalNumber,
      proposalCreatedDate,
      templateName,
      hasAnyField: hasAnyNonEmpty(proposalNumber, proposalCreatedDate, templateName),
    },
    packageSummary: {
      packageName,
      totalDisplay,
      pricingComplete,
      pricingIncompleteMessage: pricingComplete
        ? null
        : "Pricing incomplete — total will appear when all line items are priced.",
    },
    measurementSummary,
    documentIdentityIncomplete,
    documentIdentityIncompleteMessage: documentIdentityIncomplete
      ? "Document identity incomplete — stamped company or customer fields are missing on this draft."
      : null,
  };
}
