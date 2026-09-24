/**
 * Astra G9 — contract total helpers + stale-basis / financial conflict messaging.
 * Does not invent alternate pricing math: cents only, additive rollup.
 */

import {
  JOB_SCOPE_CHANGE_ERROR_LABELS,
  type JobScopeChangeErrorCode,
} from "@/app/lib/jobScopeChangeTypes";

export type JobContractTotalParts = {
  baseAcceptanceCents: number;
  authorizedDeltasSum: number;
};

export function jobContractTotalFromParts(
  parts: JobContractTotalParts
): number {
  const base = Number(parts.baseAcceptanceCents) || 0;
  const deltas = Number(parts.authorizedDeltasSum) || 0;
  return base + deltas;
}

export type ScopeChangeTotalsDisplayInput = {
  originalAgreementCents: number;
  previouslyAuthorizedDeltasCents: number;
  thisChangeDeltaCents: number;
};

export type ScopeChangeTotalsDisplay = {
  originalAgreementCents: number;
  previouslyAuthorizedDeltasCents: number;
  currentContractCents: number;
  thisChangeDeltaCents: number;
  proposedNewTotalCents: number;
};

export function buildScopeChangeTotalsDisplay(
  input: ScopeChangeTotalsDisplayInput
): ScopeChangeTotalsDisplay {
  const originalAgreementCents = Number(input.originalAgreementCents) || 0;
  const previouslyAuthorizedDeltasCents =
    Number(input.previouslyAuthorizedDeltasCents) || 0;
  const thisChangeDeltaCents = Number(input.thisChangeDeltaCents) || 0;
  const currentContractCents = jobContractTotalFromParts({
    baseAcceptanceCents: originalAgreementCents,
    authorizedDeltasSum: previouslyAuthorizedDeltasCents,
  });
  return {
    originalAgreementCents,
    previouslyAuthorizedDeltasCents,
    currentContractCents,
    thisChangeDeltaCents,
    proposedNewTotalCents: currentContractCents + thisChangeDeltaCents,
  };
}

export function isStaleBasis(
  basisContractTotalCents: number,
  liveContractTotalCents: number
): boolean {
  return (
    Number(basisContractTotalCents) !== Number(liveContractTotalCents)
  );
}

export type FinancialConflictReason =
  | "negative_contract_total"
  | "below_collected_gross"
  | "below_open_payment_requests";

export type FinancialConflictContext = {
  reason?: FinancialConflictReason | string | null;
  live_contract_total_cents?: number | null;
  price_delta_cents?: number | null;
  proposed_new_total_cents?: number | null;
  gross_received_cents?: number | null;
  open_payment_request_cents?: number | null;
};

export function financialConflictHeadline(): string {
  return "Financial review required";
}

export function financialConflictDetail(
  ctx: FinancialConflictContext | null | undefined
): string {
  const reason = String(ctx?.reason ?? "");
  if (reason === "below_collected_gross") {
    return "This reduction would put the contract total below amount already collected.";
  }
  if (reason === "below_open_payment_requests") {
    return "This reduction would put the contract total below open payment requests.";
  }
  if (reason === "negative_contract_total") {
    return "This change would make the contract total negative.";
  }
  return JOB_SCOPE_CHANGE_ERROR_LABELS.financial_conflict;
}

export function staleBasisDetail(input: {
  basisContractTotalCents?: number | null;
  liveContractTotalCents?: number | null;
}): string {
  const basis = input.basisContractTotalCents;
  const live = input.liveContractTotalCents;
  if (
    typeof basis === "number" &&
    typeof live === "number" &&
    Number.isFinite(basis) &&
    Number.isFinite(live)
  ) {
    return `Contract total is now ${formatCentsPlain(live)} (was ${formatCentsPlain(basis)} when this change was prepared). Review and rebase before proposing or authorizing.`;
  }
  return JOB_SCOPE_CHANGE_ERROR_LABELS.stale_basis;
}

export function scopeChangeFailureMessage(
  code: string | null | undefined,
  extras?: FinancialConflictContext & {
    basis_contract_total_cents?: number | null;
    live_contract_total_cents?: number | null;
  }
): string {
  if (code === "stale_basis") {
    return staleBasisDetail({
      basisContractTotalCents: extras?.basis_contract_total_cents,
      liveContractTotalCents: extras?.live_contract_total_cents,
    });
  }
  if (code === "financial_conflict") {
    return `${financialConflictHeadline()}. ${financialConflictDetail(extras)}`;
  }
  if (code && code in JOB_SCOPE_CHANGE_ERROR_LABELS) {
    return JOB_SCOPE_CHANGE_ERROR_LABELS[code as JobScopeChangeErrorCode];
  }
  return "Scope change failed.";
}

function formatCentsPlain(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
}
