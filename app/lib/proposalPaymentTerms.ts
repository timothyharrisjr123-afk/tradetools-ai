/**
 * Proposal payment terms — drafts initialize to none; sent versions freeze.
 * FieldDive owns obligation language. Stripe owns payment-method presentation.
 */

import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import {
  JOB_PAYMENT_MIN_AMOUNT_CENTS,
  type CompanyPaymentDepositMode,
} from "@/app/lib/jobPaymentTypes";

export const PROPOSAL_PAYMENT_DEPOSIT_MODES = ["none", "percent", "fixed"] as const;
export type ProposalPaymentDepositMode = (typeof PROPOSAL_PAYMENT_DEPOSIT_MODES)[number];

export const PROPOSAL_PAYMENT_DEPOSIT_DUE_TRIGGER = "on_acceptance" as const;
export const PROPOSAL_PAYMENT_BALANCE_DUE_TRIGGER = "on_completion" as const;

export const PROPOSAL_PAYMENT_COLLECTION_ONLINE_STRIPE = "online_stripe" as const;

export const UPSERT_DRAFT_PROPOSAL_PAYMENT_TERMS_RPC_V1 =
  "upsert_draft_proposal_payment_terms_v1";
export const OPEN_JOB_DEPOSIT_FROM_ACCEPTANCE_RPC_V1 =
  "open_job_deposit_from_acceptance_v1";
export const JOB_PAYMENT_NET_RECEIVED_CENTS_RPC_V1 =
  "job_payment_net_received_cents_v1";

export type ProposalPaymentTerms = {
  depositMode: ProposalPaymentDepositMode;
  depositPercentBps: number | null;
  depositFixedCents: number | null;
  depositDueTrigger: typeof PROPOSAL_PAYMENT_DEPOSIT_DUE_TRIGGER;
  balanceDueTrigger: typeof PROPOSAL_PAYMENT_BALANCE_DUE_TRIGGER;
};

export const DEFAULT_PROPOSAL_PAYMENT_TERMS: ProposalPaymentTerms = {
  depositMode: "none",
  depositPercentBps: null,
  depositFixedCents: null,
  depositDueTrigger: PROPOSAL_PAYMENT_DEPOSIT_DUE_TRIGGER,
  balanceDueTrigger: PROPOSAL_PAYMENT_BALANCE_DUE_TRIGGER,
};

export const PAYMENT_TERMS_SECTION_LABEL = "Payment terms";
export const PAYMENT_TERMS_BALANCE_ON_COMPLETION =
  "Remaining balance due upon completion";
export const PAYMENT_TERMS_NO_DEPOSIT = "No deposit required";
export const PAYMENT_TERMS_NO_DEPOSIT_WAS_REQUIRED = "No deposit was required.";
export const PAYMENT_TERMS_ORIGINAL_HEADING = "Original proposal terms";
export const SEND_GATE_PAYMENTS_SETUP_LABEL = "Payments setup required";
export const SEND_GATE_PAYMENTS_SETUP_BODY =
  "Connect payments before sending a proposal that collects a deposit online.";
export const SEND_GATE_CONNECT_PAYMENTS_CTA = "Connect payments";
export const SEND_GATE_CONNECT_PAYMENTS_HREF = "/tools/settings/payments";
export const SETTINGS_PAYMENTS_STRIPE_COPY =
  "Accept payments securely through Stripe Checkout. FieldDive does not take a fee and does not hold customer funds.";
export const PUBLIC_PAY_DEPOSIT_CTA = "Pay deposit";
export const PUBLIC_PAY_REMAINING_BALANCE_CTA = "Pay remaining balance";

export function isProposalPaymentDepositMode(
  value: unknown
): value is ProposalPaymentDepositMode {
  return (
    value === "none" || value === "percent" || value === "fixed"
  );
}

export function termsRequireOnlineDeposit(terms: ProposalPaymentTerms): boolean {
  return terms.depositMode === "percent" || terms.depositMode === "fixed";
}

export function resolveDepositObligationCents(input: {
  mode: CompanyPaymentDepositMode | ProposalPaymentDepositMode;
  percentBps: number | null;
  fixedCents: number | null;
  acceptedTotalCents: number;
}): number {
  const total = Number.isInteger(input.acceptedTotalCents)
    ? Math.max(0, input.acceptedTotalCents)
    : 0;
  if (input.mode === "percent") {
    const bps = input.percentBps;
    if (!Number.isInteger(bps) || bps == null || bps < 1 || bps > 10000) {
      return 0;
    }
    return Math.floor((total * bps) / 10000);
  }
  if (input.mode === "fixed") {
    const fixed = input.fixedCents;
    if (!Number.isInteger(fixed) || fixed == null || fixed < JOB_PAYMENT_MIN_AMOUNT_CENTS) {
      return 0;
    }
    return fixed;
  }
  return 0;
}

/**
 * Durable revision rule:
 * Additional deposit = max(0, current-terms deposit cents − job net received),
 * capped to remaining contractual total. Already-received money counts toward
 * V2's deposit. Uncovered slice ≥ $1.00 becomes the deposit request.
 * If V2 deposit is none, additional is 0 (remainder is balance, Stage 2).
 */
export function additionalDepositCents(input: {
  terms: ProposalPaymentTerms;
  acceptedTotalCents: number;
  netReceivedCents: number;
}): number {
  const obligation = resolveDepositObligationCents({
    mode: input.terms.depositMode,
    percentBps: input.terms.depositPercentBps,
    fixedCents: input.terms.depositFixedCents,
    acceptedTotalCents: input.acceptedTotalCents,
  });
  const net = Number.isInteger(input.netReceivedCents)
    ? Math.max(0, input.netReceivedCents)
    : 0;
  const remaining = Math.max(0, input.acceptedTotalCents - net);
  const uncovered = Math.max(0, obligation - net);
  const additional = Math.min(uncovered, remaining);
  if (additional < JOB_PAYMENT_MIN_AMOUNT_CENTS) return 0;
  return additional;
}

export function formatPaymentTermsCustomerCopy(
  terms: ProposalPaymentTerms,
  selectedTotalCents?: number | null
): { depositLine: string; balanceLine: string } {
  const balanceLine = PAYMENT_TERMS_BALANCE_ON_COMPLETION;
  if (terms.depositMode === "none") {
    return { depositLine: PAYMENT_TERMS_NO_DEPOSIT, balanceLine };
  }
  if (terms.depositMode === "percent") {
    const pct = terms.depositPercentBps != null ? terms.depositPercentBps / 100 : 0;
    const pctLabel = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, "");
    if (
      selectedTotalCents != null &&
      Number.isInteger(selectedTotalCents) &&
      selectedTotalCents > 0
    ) {
      const cents = resolveDepositObligationCents({
        mode: "percent",
        percentBps: terms.depositPercentBps,
        fixedCents: null,
        acceptedTotalCents: selectedTotalCents,
      });
      if (cents >= JOB_PAYMENT_MIN_AMOUNT_CENTS) {
        return {
          depositLine: `${pctLabel}% deposit (${formatUsdFromCents(cents)}) due upon agreement`,
          balanceLine,
        };
      }
    }
    return {
      depositLine: `${pctLabel}% deposit due upon agreement`,
      balanceLine,
    };
  }
  const amount =
    terms.depositFixedCents != null
      ? formatUsdFromCents(terms.depositFixedCents)
      : "$0.00";
  return {
    depositLine: `${amount} deposit due upon agreement`,
    balanceLine,
  };
}

/**
 * Frozen terms as contract history — never competing live-due copy.
 * Amounts stay on the current request block, not in this demoted block.
 */
export function formatOriginalProposalTermsCopy(
  terms: ProposalPaymentTerms,
  input: { hideBalanceLine?: boolean } = {}
): { heading: string; depositLine: string; balanceLine: string | null } {
  const live = formatPaymentTermsCustomerCopy(terms, null);
  return {
    heading: PAYMENT_TERMS_ORIGINAL_HEADING,
    depositLine:
      terms.depositMode === "none"
        ? PAYMENT_TERMS_NO_DEPOSIT_WAS_REQUIRED
        : live.depositLine,
    balanceLine: input.hideBalanceLine ? null : live.balanceLine,
  };
}

export function parseProposalPaymentTermsRow(row: {
  deposit_mode?: string | null;
  deposit_percent_bps?: number | null;
  deposit_fixed_cents?: number | null;
  deposit_due_trigger?: string | null;
  balance_due_trigger?: string | null;
} | null): ProposalPaymentTerms {
  if (!row) return { ...DEFAULT_PROPOSAL_PAYMENT_TERMS };
  const mode = isProposalPaymentDepositMode(row.deposit_mode)
    ? row.deposit_mode
    : "none";
  return {
    depositMode: mode,
    depositPercentBps: mode === "percent" ? row.deposit_percent_bps ?? null : null,
    depositFixedCents: mode === "fixed" ? row.deposit_fixed_cents ?? null : null,
    depositDueTrigger: PROPOSAL_PAYMENT_DEPOSIT_DUE_TRIGGER,
    balanceDueTrigger: PROPOSAL_PAYMENT_BALANCE_DUE_TRIGGER,
  };
}

export function jobPaymentGrossReceivedCents(
  captures: readonly { kind: string; status: string; amount_cents: number }[]
): number {
  return captures
    .filter((row) => row.kind === "capture" && row.status === "succeeded")
    .reduce((sum, row) => sum + Math.max(0, row.amount_cents), 0);
}

export function jobPaymentRefundedCents(
  refunds: readonly { kind: string; status: string; amount_cents: number }[]
): number {
  return refunds
    .filter((row) => row.kind === "refund" && row.status === "refunded")
    .reduce((sum, row) => sum + Math.max(0, row.amount_cents), 0);
}

export function jobPaymentNetReceivedCents(input: {
  transactions: readonly { kind: string; status: string; amount_cents: number }[];
}): number {
  return Math.max(
    0,
    jobPaymentGrossReceivedCents(input.transactions) -
      jobPaymentRefundedCents(input.transactions)
  );
}

export function jobPaymentRemainingCents(input: {
  contractualTotalCents: number;
  netReceivedCents: number;
}): number {
  const total = Number.isInteger(input.contractualTotalCents)
    ? input.contractualTotalCents
    : 0;
  const net = Number.isInteger(input.netReceivedCents)
    ? input.netReceivedCents
    : 0;
  return Math.max(0, total - net);
}
