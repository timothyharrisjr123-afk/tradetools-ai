/**
 * FieldDive Proposal Document Token Registry (R13).
 *
 * Canonical list of document merge-field tokens and their frozen source paths.
 * Pure data — no resolution, I/O, or UI.
 */

import type {
  ProposalDocumentTokenName,
  ProposalDocumentTokenRegistryEntry,
} from "@/app/lib/proposalDocumentTokenTypes";

export const PROPOSAL_DOCUMENT_TOKEN_REGISTRY: readonly ProposalDocumentTokenRegistryEntry[] =
  [
    {
      name: "company_name",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.company_name",
    },
    {
      name: "company_logo_url",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.company_logo_url",
    },
    {
      name: "company_phone",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.company_phone",
    },
    {
      name: "company_email",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.company_email",
    },
    {
      name: "company_license",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.company_license",
    },
    {
      name: "company_address",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.company_address",
    },
    {
      name: "company_website",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.company_website",
    },
    {
      name: "brand_primary_color",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.brand_primary_color",
    },
    {
      name: "brand_secondary_color",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.brand_secondary_color",
    },
    {
      name: "show_license_on_cover",
      domain: "company",
      availability: "available",
      sourcePath: "context_echo.show_license_on_cover",
    },
    {
      name: "customer_name",
      domain: "customer",
      availability: "available",
      sourcePath: "context_echo.customer_name",
    },
    {
      name: "customer_email",
      domain: "customer",
      availability: "available",
      sourcePath: "context_echo.customer_email",
    },
    {
      name: "customer_phone",
      domain: "customer",
      availability: "available",
      sourcePath: "context_echo.customer_phone",
    },
    {
      name: "customer_address",
      domain: "customer",
      availability: "available",
      sourcePath: "context_echo.customer_address",
    },
    {
      name: "job_name",
      domain: "job",
      availability: "available",
      sourcePath: "context_echo.job_name",
    },
    {
      name: "job_address",
      domain: "job",
      availability: "available",
      sourcePath: "context_echo.address_formatted",
    },
    {
      name: "measurement_summary",
      domain: "measurement",
      availability: "available",
      sourcePath: "context_echo.measurement_quantities_display",
    },
    {
      name: "proposal_number",
      domain: "proposal",
      availability: "available",
      sourcePath: "proposals.proposal_number",
    },
    {
      name: "proposal_title",
      domain: "proposal",
      availability: "available",
      sourcePath: "proposals.title",
    },
    {
      name: "template_name",
      domain: "proposal",
      availability: "available",
      sourcePath: "context_echo.template_name",
    },
    {
      name: "proposal_created_date",
      domain: "proposal",
      availability: "available",
      sourcePath: "proposal_versions.created_at",
    },
    {
      name: "selected_package_name",
      domain: "selected_package",
      availability: "available",
      sourcePath: "proposal_options.customer_label (selected runtime option)",
    },
    {
      name: "selected_package_total",
      domain: "pricing",
      availability: "available",
      sourcePath: "proposal_options.customer_total_cents (selected runtime option)",
    },
    {
      name: "proposal_total",
      domain: "pricing",
      availability: "available",
      sourcePath: "alias: selected_package_total",
    },
  ] as const;

export const PROPOSAL_DOCUMENT_TOKEN_NAMES: readonly ProposalDocumentTokenName[] =
  PROPOSAL_DOCUMENT_TOKEN_REGISTRY.map((entry) => entry.name);

const REGISTRY_BY_NAME = new Map(
  PROPOSAL_DOCUMENT_TOKEN_REGISTRY.map((entry) => [entry.name, entry] as const)
);

export function getProposalDocumentTokenRegistryEntry(
  name: string
): ProposalDocumentTokenRegistryEntry | null {
  const normalized = (name ?? "").trim();
  if (!normalized) return null;
  return REGISTRY_BY_NAME.get(normalized as ProposalDocumentTokenName) ?? null;
}

export function isAvailableProposalDocumentToken(name: string): boolean {
  const entry = getProposalDocumentTokenRegistryEntry(name);
  return entry?.availability === "available";
}
