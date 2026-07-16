/**
 * Slice A — Builder-internal quantity preflight trust composer.
 *
 * Sibling to measurement/pricing staleness (`deriveProposalPricingStale`).
 * Does not merge detectors. Invisible / non-blocking: no banner, no Send gate,
 * no auto-refresh, no customer/public DTO exposure.
 */

import type { ProposalBuilderQuantityPreflightMetadata } from "@/app/lib/proposalBuilderQuantityPreflightMetadata";

export type QuantityPreflightTrustStatus = "current" | "unknown" | "stale";
export type QuantityPreflightTrustSeverity = "ok" | "neutral" | "needs_review";

export type QuantityPreflightTrustSignal = {
  status: QuantityPreflightTrustStatus;
  severity: QuantityPreflightTrustSeverity;
  reasonCodes: string[];
  /** Slice A: always false — informational only. */
  shouldBlock: false;
  /** Slice A: always false — manual refresh only when a later UI slice approves. */
  shouldAutoRefresh: false;
  /** Slice A: always false — Builder-internal metadata only. */
  customerVisible: false;
};

export type ProposalBuilderInternalTrustSignals = {
  quantityPreflightTrust: QuantityPreflightTrustSignal | null;
};

export type ComposeQuantityPreflightTrustInput = {
  quantityPreflight: ProposalBuilderQuantityPreflightMetadata | null | undefined;
};

/**
 * Map Builder quantity preflight metadata to an internal trust signal.
 *
 * - current → ok
 * - unknown / missing → neutral (not stale)
 * - stale → needs_review (internal only; never blocks or auto-refreshes)
 */
export function composeQuantityPreflightTrustSignal(
  input: ComposeQuantityPreflightTrustInput
): QuantityPreflightTrustSignal | null {
  const preflight = input.quantityPreflight;
  if (preflight == null) {
    return {
      status: "unknown",
      severity: "neutral",
      reasonCodes: ["quantity_preflight_unavailable"],
      shouldBlock: false,
      shouldAutoRefresh: false,
      customerVisible: false,
    };
  }

  if (preflight.status === "current") {
    return {
      status: "current",
      severity: "ok",
      reasonCodes: [],
      shouldBlock: false,
      shouldAutoRefresh: false,
      customerVisible: false,
    };
  }

  if (preflight.status === "unknown") {
    return {
      status: "unknown",
      severity: "neutral",
      reasonCodes: ["quantity_preflight_unknown"],
      shouldBlock: false,
      shouldAutoRefresh: false,
      customerVisible: false,
    };
  }

  // stale
  return {
    status: "stale",
    severity: "needs_review",
    reasonCodes: ["quantity_preflight_stale"],
    shouldBlock: false,
    shouldAutoRefresh: false,
    customerVisible: false,
  };
}

/**
 * Compose Builder-internal trust signals. Quantity preflight remains a sibling
 * to measurement/pricing staleness — this helper does not call or alter
 * `deriveProposalPricingStale`.
 */
export function composeProposalBuilderInternalTrustSignals(
  input: ComposeQuantityPreflightTrustInput
): ProposalBuilderInternalTrustSignals {
  return {
    quantityPreflightTrust: composeQuantityPreflightTrustSignal(input),
  };
}
