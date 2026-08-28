/**
 * R3E money helpers — integer cents only. No floats as persisted truth.
 */

import {
  JOB_PAYMENT_CURRENCY,
  JOB_PAYMENT_MIN_AMOUNT_CENTS,
  type CompanyPaymentDepositMode,
  type JobPaymentKind,
} from "@/app/lib/jobPaymentTypes";

export function isUsdCurrency(value: unknown): value is "usd" {
  return value === JOB_PAYMENT_CURRENCY;
}

export function isPositiveIntCents(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function formatUsdFromCents(cents: number): string {
  const safe = Number.isInteger(cents) ? cents : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(safe / 100);
}

export function parseUsdInputToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/[$,]/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  const cents =
    Number.parseInt(dollars, 10) * 100 +
    Number.parseInt((fraction + "00").slice(0, 2), 10);
  if (!Number.isInteger(cents) || cents < 0) return null;
  return cents;
}

export function remainingAcceptedCents(input: {
  acceptedTotalCents: number;
  netPaidCents: number;
}): number {
  const accepted = Number.isInteger(input.acceptedTotalCents)
    ? input.acceptedTotalCents
    : 0;
  const paid = Number.isInteger(input.netPaidCents) ? input.netPaidCents : 0;
  return Math.max(0, accepted - paid);
}

export function prefillDepositCents(input: {
  mode: CompanyPaymentDepositMode;
  percentBps: number | null;
  fixedCents: number | null;
  acceptedTotalCents: number;
  remainingCents: number;
}): number | null {
  const remaining = Math.max(0, input.remainingCents);
  if (remaining < JOB_PAYMENT_MIN_AMOUNT_CENTS) return null;

  let pref = 0;
  if (input.mode === "percent") {
    const bps = input.percentBps;
    if (!Number.isInteger(bps) || bps == null || bps < 1 || bps > 10000) {
      return null;
    }
    pref = Math.floor((input.acceptedTotalCents * bps) / 10000);
  } else if (input.mode === "fixed") {
    const fixed = input.fixedCents;
    if (!Number.isInteger(fixed) || fixed == null || fixed < JOB_PAYMENT_MIN_AMOUNT_CENTS) {
      return null;
    }
    pref = fixed;
  } else {
    return null;
  }

  const capped = Math.min(pref, remaining);
  if (capped < JOB_PAYMENT_MIN_AMOUNT_CENTS) return null;
  return capped;
}

export function checkoutLineLabel(kind: JobPaymentKind): string {
  if (kind === "deposit") return "Deposit";
  if (kind === "progress") return "Progress payment";
  return "Remaining balance";
}

export function parseCollectFixedAmountToCents(raw: string): number | null {
  return parseUsdInputToCents(raw);
}

export function collectPercentageAmountCents(input: {
  contractTotalCents: number;
  percentageBps: number;
}): number | null {
  if (
    !Number.isInteger(input.contractTotalCents) ||
    input.contractTotalCents < 0 ||
    !Number.isInteger(input.percentageBps) ||
    input.percentageBps < 1 ||
    input.percentageBps > 10000
  ) {
    return null;
  }
  return Math.floor((input.contractTotalCents * input.percentageBps) / 10000);
}

export function deriveCollectRequestKind(input: {
  jobComplete: boolean;
  amountCents: number;
  collectibleCents: number;
}): Exclude<JobPaymentKind, "deposit"> {
  if (!input.jobComplete) return "progress";
  if (input.amountCents === input.collectibleCents) return "balance";
  return "progress";
}

export function isValidPaymentAmountCents(
  amountCents: number,
  remainingCents: number
): boolean {
  return (
    Number.isInteger(amountCents) &&
    amountCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS &&
    Number.isInteger(remainingCents) &&
    amountCents <= remainingCents
  );
}
