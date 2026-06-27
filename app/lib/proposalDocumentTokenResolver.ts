/**
 * FieldDive Proposal Document Token Resolver (R13).
 *
 * Pure resolution from ProposalDocumentContext — no I/O, stores, or pricing math.
 */

import type {
  ProposalDocumentContext,
  ProposalDocumentTokenName,
  ProposalDocumentTokenResolutionResult,
} from "@/app/lib/proposalDocumentTokenTypes";
import {
  PROPOSAL_DOCUMENT_TOKEN_NAMES,
  getProposalDocumentTokenRegistryEntry,
  isAvailableProposalDocumentToken,
} from "@/app/lib/proposalDocumentTokenRegistry";

/** Matches `{{token_name}}` placeholders in future document text. */
const TOKEN_SUBSTITUTION_PATTERN = /\{\{([a-z][a-z0-9_]*)\}\}/g;

function emptyOrString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** Display money from persisted cents — no repricing. */
export function formatProposalDocumentMoneyCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  const rounded = Math.round(cents);
  const dollars = (rounded / 100).toFixed(2);
  const [whole, dec] = dollars.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${dec}`;
}

/** Stable UTC calendar date for document surfaces. */
export function formatProposalDocumentDate(iso: string | null | undefined): string {
  const trimmed = (iso ?? "").trim();
  if (!trimmed) return "";
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function resolveAvailableTokenValue(
  name: ProposalDocumentTokenName,
  context: ProposalDocumentContext
): string {
  switch (name) {
    case "company_name":
      return emptyOrString(context.company.companyName);
    case "company_logo_url":
      return emptyOrString(context.company.companyLogoUrl);
    case "company_phone":
      return emptyOrString(context.company.companyPhone);
    case "company_email":
      return emptyOrString(context.company.companyEmail);
    case "company_license":
      return emptyOrString(context.company.companyLicense);
    case "company_address":
      return emptyOrString(context.company.companyAddress);
    case "company_website":
      return emptyOrString(context.company.companyWebsite);
    case "brand_primary_color":
      return emptyOrString(context.company.brandPrimaryColor);
    case "brand_secondary_color":
      return emptyOrString(context.company.brandSecondaryColor);
    case "show_license_on_cover":
      return context.company.showLicenseOnCover ? "true" : "false";
    case "customer_name":
      return emptyOrString(context.customer.customerName);
    case "customer_email":
      return emptyOrString(context.customer.customerEmail);
    case "customer_phone":
      return emptyOrString(context.customer.customerPhone);
    case "customer_address":
      return emptyOrString(context.customer.customerAddress);
    case "job_name":
      return emptyOrString(context.jobName);
    case "job_address":
      return emptyOrString(context.jobAddress);
    case "measurement_summary":
      return emptyOrString(context.measurementSummary);
    case "proposal_number":
      return emptyOrString(context.proposalNumber);
    case "proposal_title":
      return emptyOrString(context.proposalTitle);
    case "template_name":
      return emptyOrString(context.templateName);
    case "proposal_created_date":
      return formatProposalDocumentDate(context.proposalCreatedDateIso);
    case "selected_package_name":
      return emptyOrString(context.selectedPackage.packageName);
    case "selected_package_total":
      return formatProposalDocumentMoneyCents(context.selectedPackage.customerTotalCents);
    case "proposal_total":
      return formatProposalDocumentMoneyCents(context.selectedPackage.customerTotalCents);
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

/**
 * Resolve a single document token from frozen context.
 * Unknown or unavailable tokens return empty string and `resolved: false`.
 */
export function resolveProposalDocumentToken(
  tokenName: string,
  context: ProposalDocumentContext
): ProposalDocumentTokenResolutionResult {
  const normalized = (tokenName ?? "").trim();
  if (!normalized) {
    return { tokenName: normalized, value: "", resolved: false };
  }

  const entry = getProposalDocumentTokenRegistryEntry(normalized);
  if (!entry || entry.availability !== "available") {
    return { tokenName: normalized, value: "", resolved: false };
  }

  const value = resolveAvailableTokenValue(entry.name, context);
  return { tokenName: normalized, value, resolved: true };
}

/** Resolve all available registry tokens into a name → value map. */
export function resolveAllProposalDocumentTokens(
  context: ProposalDocumentContext
): Record<ProposalDocumentTokenName, string> {
  const out = {} as Record<ProposalDocumentTokenName, string>;
  for (const name of PROPOSAL_DOCUMENT_TOKEN_NAMES) {
    out[name] = resolveProposalDocumentToken(name, context).value;
  }
  return out;
}

/**
 * Replace `{{token_name}}` placeholders in text using frozen context.
 * Unresolved tokens become empty strings — raw placeholders never leak.
 */
export function substituteProposalDocumentTokens(
  text: string,
  context: ProposalDocumentContext
): string {
  return text.replace(TOKEN_SUBSTITUTION_PATTERN, (_match, rawName: string) => {
    if (!isAvailableProposalDocumentToken(rawName)) {
      return "";
    }
    return resolveProposalDocumentToken(rawName, context).value;
  });
}
