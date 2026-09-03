/**
 * Pure company setup readiness for Jobs Board first-run chrome.
 * Four company-wide steps remain as system readiness truth for proposals.
 * Jobs Board banner is identity-only (company name) — not homework for
 * pricing / Catalog / Templates (those surface in proposal context later).
 */

export type CompanySetupStepId =
  | "company_profile"
  | "pricing_rules"
  | "price_book"
  | "proposal_templates";

export type CompanySetupStepStatus = "complete" | "incomplete" | "unknown";

export type CompanySetupStepDefinition = {
  id: CompanySetupStepId;
  label: string;
  href: string;
};

export type CompanySetupStep = CompanySetupStepDefinition & {
  status: CompanySetupStepStatus;
};

export type CompanySetupReadinessInput = {
  loading: boolean;
  companyProfileComplete: boolean | null;
  pricingRulesConfigured: boolean | null;
  priceBookReady: boolean | null;
  proposalTemplatesReady: boolean | null;
};

export type CompanySetupReadinessResult = {
  steps: CompanySetupStep[];
  completeCount: number;
  totalCount: number;
  isComplete: boolean;
  showBanner: boolean;
  loading: boolean;
  primaryHref: string | null;
};

export const COMPANY_SETUP_STEP_DEFINITIONS: readonly CompanySetupStepDefinition[] = [
  { id: "company_profile", label: "Company profile", href: "/tools/settings" },
  { id: "pricing_rules", label: "Pricing rules", href: "/tools/settings/pricing" },
  { id: "price_book", label: "Catalog", href: "/tools/roofing/catalog" },
  { id: "proposal_templates", label: "Templates", href: "/tools/roofing/templates" },
] as const;

function stepStatus(value: boolean | null): CompanySetupStepStatus {
  if (value === true) return "complete";
  if (value === false) return "incomplete";
  return "unknown";
}

function isStepComplete(status: CompanySetupStepStatus): boolean {
  return status === "complete";
}

/**
 * Derive setup banner state from loaded readiness signals.
 * Unknown steps after load are treated as incomplete for banner visibility only.
 */
export function deriveCompanySetupReadiness(
  input: CompanySetupReadinessInput
): CompanySetupReadinessResult {
  const valueById: Record<CompanySetupStepId, boolean | null> = {
    company_profile: input.companyProfileComplete,
    pricing_rules: input.pricingRulesConfigured,
    price_book: input.priceBookReady,
    proposal_templates: input.proposalTemplatesReady,
  };

  const steps: CompanySetupStep[] = COMPANY_SETUP_STEP_DEFINITIONS.map((def) => ({
    ...def,
    status: input.loading ? "unknown" : stepStatus(valueById[def.id]),
  }));

  const completeCount = steps.filter((step) => isStepComplete(step.status)).length;
  const totalCount = steps.length;

  const isComplete =
    !input.loading &&
    input.companyProfileComplete === true &&
    input.pricingRulesConfigured === true &&
    input.priceBookReady === true &&
    input.proposalTemplatesReady === true;

  // First-run board chrome: ask only when company name is known-missing.
  // Catalog / pricing / templates incompleteness stays in steps/isComplete
  // but must not dominate the Jobs Board before a real Job exists.
  const showBanner =
    !input.loading && input.companyProfileComplete === false;

  const companyProfileStep = steps.find((step) => step.id === "company_profile");
  const firstIncomplete = showBanner
    ? companyProfileStep
    : steps.find((step) => step.status === "incomplete" || step.status === "unknown");

  return {
    steps,
    completeCount,
    totalCount,
    isComplete,
    showBanner,
    loading: input.loading,
    primaryHref: firstIncomplete?.href ?? null,
  };
}
