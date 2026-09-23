/**
 * Astra G5 — Entry and first/second proposal activation (pure helpers + copy).
 * No onboarding model, no second job creator, no invented economics.
 */

/** Canonical first-job intake (packet → createJob). */
export const ASTRA_G5_FIRST_JOB_HREF = "/tools/roofing?entry=packet" as const;

/** Company-level usual-roof prep (starter catalog + template; no fake job). */
export const ASTRA_G5_USUAL_ROOF_HREF = "/tools/roofing/usual-roof" as const;

export const ASTRA_G5_FIRST_JOB_LABEL = "Start my first job" as const;
export const ASTRA_G5_USUAL_ROOF_LABEL = "Set up my usual roof" as const;

export const ASTRA_G5_FIRST_JOB_HINT =
  "Create a job, enter what you charge for the offered package, and send a real proposal." as const;

export const ASTRA_G5_USUAL_ROOF_HINT =
  "Install your starter catalog and proposal setup once — without creating a job. Prices stay yours; FieldDive does not invent them." as const;

export const ASTRA_G5_NO_INVENTED_PRICES =
  "FieldDive does not invent prices." as const;

/** Contractor mental model for first-use pricing (Prepare). */
export type AstraG5PricingMethod = "direct_price" | "cost_based";

export const ASTRA_G5_PRICING_METHOD_DIRECT = "direct_price" as const;
export const ASTRA_G5_PRICING_METHOD_COST = "cost_based" as const;

export const ASTRA_G5_PRICING_METHOD_DIRECT_LABEL =
  "I enter selling prices directly" as const;
export const ASTRA_G5_PRICING_METHOD_COST_LABEL = "I price from cost" as const;

export const ASTRA_G5_TEMPLATE_PREVIEW_TITLE =
  "What the customer will see" as const;
export const ASTRA_G5_TEMPLATE_PREVIEW_HINT =
  "Starter roofing proposal structure — same customer-facing language as Customer Preview. Company identity may appear; customer, property, measurements, and prices are filled when you create a real proposal." as const;

/**
 * Resume Prepare from durable Job Card state (no progress tracker).
 * Opens canonical Job Card with prepare=1 so Prepare derives remaining facts.
 */
export function buildFirstProposalResumeHref(jobId: string): string {
  const id = String(jobId ?? "").trim();
  return `/tools/roofing?entry=job-card&job=${encodeURIComponent(id)}&tab=proposals&prepare=1`;
}

/** Soften global homework language — next missing fact only. */
export function formatScopedNextSetupFact(input: {
  needsCatalogStructure: boolean;
  needsTemplateStructure: boolean;
  needsLinkedPrices: boolean;
  needsPricingRules: boolean;
}): string | null {
  if (input.needsCatalogStructure) {
    return "Install starter catalog items for this proposal.";
  }
  if (input.needsTemplateStructure) {
    return "Install the starter proposal setup.";
  }
  if (input.needsPricingRules) {
    return "Say how you price work and sales tax.";
  }
  if (input.needsLinkedPrices) {
    return "Enter selling prices for items on the offered package.";
  }
  return null;
}

/**
 * After first proposal send, second proposal should skip repeated setup
 * when company catalog prices + pricing policy + starter template exist.
 */
export function resolveSecondProposalSkipsRepeatedSetup(input: {
  pricingPolicyConfigured: boolean;
  linkedLinesNeedPrice: boolean;
  hasStarterOrPreferredTemplate: boolean;
}): boolean {
  return (
    input.pricingPolicyConfigured &&
    !input.linkedLinesNeedPrice &&
    input.hasStarterOrPreferredTemplate
  );
}
