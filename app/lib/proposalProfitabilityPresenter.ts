/**
 * 3I-3C — Internal profitability presenter (pure, no React/Supabase/engine).
 *
 * Formats contractor-only Builder rail labels from already-computed pricing fields.
 * No pricing math — display derivation only.
 */

export type ProposalProfitabilityPresenterInput = {
  internalCostCents: number | null;
  internalProfitCents: number | null;
  effectiveMarginPct: number | null;
  pricingPolicyConfigured: boolean;
  pricingPolicyLoadComplete: boolean;
  hasBlockingIssues: boolean;
};

export type ProposalProfitabilityPresenterOutput = {
  shouldShowInternalNumbers: boolean;
  statusLabel: string;
  costDisplay: string;
  profitDisplay: string;
  marginDisplay: string;
  warningCopy: string | null;
};

/** Contractor-only copy — never use on customer document surfaces. */
export const INTERNAL_PROFITABILITY_CHECKING_COPY =
  "Checking company pricing policy…";

export const INTERNAL_PROFITABILITY_PLACEHOLDER_WARNING =
  "Placeholder pricing — internal profitability unavailable. Configure company pricing in Settings → Pricing.";

export const INTERNAL_PROFITABILITY_BLOCKED_WARNING =
  "Resolve blocking pricing issues before viewing internal profitability.";

export const INTERNAL_PROFITABILITY_STATUS_CONFIGURED =
  "From company pricing (contractor-only)";

export const INTERNAL_PROFITABILITY_NOT_AVAILABLE = "Not available";

function formatUsdCents(cents: number): string {
  const dollars = (Math.round(cents) / 100).toFixed(2);
  const [whole, dec] = dollars.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${dec}`;
}

function formatCentsField(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) {
    return INTERNAL_PROFITABILITY_NOT_AVAILABLE;
  }
  return formatUsdCents(cents);
}

function formatMarginField(marginPct: number | null): string {
  if (marginPct == null || !Number.isFinite(marginPct)) {
    return INTERNAL_PROFITABILITY_NOT_AVAILABLE;
  }
  return `${marginPct.toFixed(1)}%`;
}

/**
 * Derive contractor-only internal profitability rail display from preview fields.
 */
export function presentProposalInternalProfitability(
  input: ProposalProfitabilityPresenterInput
): ProposalProfitabilityPresenterOutput {
  const {
    internalCostCents,
    internalProfitCents,
    effectiveMarginPct,
    pricingPolicyConfigured,
    pricingPolicyLoadComplete,
    hasBlockingIssues,
  } = input;

  if (!pricingPolicyLoadComplete) {
    return {
      shouldShowInternalNumbers: false,
      statusLabel: "Checking…",
      costDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      profitDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      marginDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      warningCopy: INTERNAL_PROFITABILITY_CHECKING_COPY,
    };
  }

  if (!pricingPolicyConfigured) {
    return {
      shouldShowInternalNumbers: false,
      statusLabel: "Unavailable",
      costDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      profitDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      marginDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      warningCopy: INTERNAL_PROFITABILITY_PLACEHOLDER_WARNING,
    };
  }

  if (hasBlockingIssues) {
    return {
      shouldShowInternalNumbers: false,
      statusLabel: "Incomplete",
      costDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      profitDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      marginDisplay: INTERNAL_PROFITABILITY_NOT_AVAILABLE,
      warningCopy: INTERNAL_PROFITABILITY_BLOCKED_WARNING,
    };
  }

  return {
    shouldShowInternalNumbers: true,
    statusLabel: INTERNAL_PROFITABILITY_STATUS_CONFIGURED,
    costDisplay: formatCentsField(internalCostCents),
    profitDisplay: formatCentsField(internalProfitCents),
    marginDisplay: formatMarginField(effectiveMarginPct),
    warningCopy: null,
  };
}
