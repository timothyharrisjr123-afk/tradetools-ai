/**
 * Payment Stage 2A — canonical Job Card Payments read model.
 *
 * Contract total: 053 customer-chosen cents when present, else accepted_total.
 * Received: canonical gross (one contribution per PaymentIntent / 053 identity).
 * Collectible remaining: max(0, contract − gross). Refunds do not reopen due.
 * Cash net: max(0, gross − refunded) — internal, not Remaining.
 *
 * UI states are derived. No new DB statuses.
 */

import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import {
  JOB_CARD_PAYMENTS_CONNECT_HREF,
  JOB_PAYMENT_MIN_AMOUNT_CENTS,
  JOB_PAYMENT_PROVIDER,
  type JobPaymentKind,
  type JobPaymentRequestStatus,
} from "@/app/lib/jobPaymentTypes";
import type {
  CompanyPaymentAccountRow,
  JobPaymentRequestRow,
  JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";
import {
  DEFAULT_PROPOSAL_PAYMENT_TERMS,
  termsRequireOnlineDeposit,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";

export const JOB_PAYMENT_WORKSPACE_CONNECT_HREF = JOB_CARD_PAYMENTS_CONNECT_HREF;

export type JobPaymentWorkspaceState =
  | "no_payment_required"
  | "setup_required"
  | "deposit_due"
  | "deposit_processing"
  | "deposit_received"
  | "payment_failed"
  | "partially_paid"
  | "balance_not_yet_due"
  | "balance_due"
  | "balance_requested"
  | "balance_processing"
  | "progress_requested"
  | "progress_processing"
  | "paid_in_full";

export type JobPaymentWorkspaceTimelineType =
  | "requested"
  | "received"
  | "failed"
  | "cancelled"
  | "refund";

export type JobPaymentHistoryTone = "default" | "settled" | "muted";

export type JobPaymentWorkspaceRequest = Pick<
  JobPaymentRequestRow,
  | "id"
  | "kind"
  | "status"
  | "amount_cents"
  | "requested_at"
  | "paid_at"
  | "settled_payment_method_label"
> & {
  cancelled_at?: string | null;
};

export type JobPaymentWorkspaceTransaction = Pick<
  JobPaymentTransactionRow,
  | "id"
  | "payment_request_id"
  | "kind"
  | "status"
  | "amount_cents"
  | "occurred_at"
  | "provider_event_id"
> & {
  provider_payment_intent_id?: string | null;
};

export type JobPaymentWorkspaceTimelineEvent = {
  id: string;
  type: JobPaymentWorkspaceTimelineType;
  title: string;
  subtitle: string | null;
  amountCents: number;
  methodLabel: string | null;
  occurredAt: string;
  occurredAtLabel: string | null;
  occurredAtTimeLabel: string | null;
  settled: boolean;
  tone: JobPaymentHistoryTone;
  disclosure: {
    providerEventId: string | null;
    paymentIntentId: string | null;
  } | null;
};

export type JobPaymentHistoryGroup = {
  heading: string;
  events: JobPaymentWorkspaceTimelineEvent[];
};

export type JobPaymentWorkspaceCurrentRequest = {
  id: string;
  kind: JobPaymentKind;
  status: JobPaymentRequestStatus;
  amountCents: number;
};

export type JobPaymentWorkspaceNextStep = {
  label: string;
  detail: string | null;
  connectHref: string | null;
};

export type JobPaymentWorkspaceView = {
  contractTotalCents: number | null;
  receivedGrossCents: number;
  refundedCents: number;
  cashNetCents: number;
  collectibleRemainingCents: number;
  state: JobPaymentWorkspaceState;
  statusLabel: string;
  overviewStatusLabel: string | null;
  nextStep: JobPaymentWorkspaceNextStep | null;
  connected: boolean;
  chargesEnabled: boolean;
  accepted: boolean;
  depositRequired: boolean;
  jobComplete: boolean;
  depositNotReceived: boolean;
  currentRequest: JobPaymentWorkspaceCurrentRequest | null;
  canCollectRemainingBalance: boolean;
  canCollectPayment: boolean;
  timeline: JobPaymentWorkspaceTimelineEvent[];
  summaryRows: JobPaymentWorkspaceSummaryRow[];
};

export type JobPaymentWorkspaceSummaryRow = {
  label: "Contract" | "Received" | "Remaining" | "Refunded";
  cents: number | null;
};

export type CanonicalCaptureContribution = {
  identity: string;
  amountCents: number;
  occurredAt: string;
  paymentRequestId: string;
  providerPaymentIntentId: string | null;
  providerEventId: string | null;
};

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

export function proposalAcceptanceContractTotalCents(input: {
  customerChosenTotalCents?: number | null;
  acceptedTotalCents?: number | null;
}): number | null {
  const chosen = asNonNegativeInt(input.customerChosenTotalCents);
  if (chosen != null) return chosen;
  return asNonNegativeInt(input.acceptedTotalCents);
}

export function jobPaymentCanonicalCaptureIdentity(input: {
  provider?: string | null;
  providerPaymentIntentId?: string | null;
  providerEventId?: string | null;
}): string {
  const provider =
    (input.provider ?? JOB_PAYMENT_PROVIDER).trim() || JOB_PAYMENT_PROVIDER;
  const pi = (input.providerPaymentIntentId ?? "").trim();
  if (pi) return `pi:${provider}:${pi}`;
  const eventId = (input.providerEventId ?? "").trim();
  return `evt:${provider}:${eventId}`;
}

function sortByOccurredAt<T extends { occurredAt?: string; occurred_at?: string; id: string }>(
  rows: readonly T[]
): T[] {
  return rows.slice().sort((a, b) => {
    const ta = Date.parse(String(a.occurredAt ?? a.occurred_at ?? ""));
    const tb = Date.parse(String(b.occurredAt ?? b.occurred_at ?? ""));
    const aOk = Number.isFinite(ta);
    const bOk = Number.isFinite(tb);
    if (aOk && bOk && ta !== tb) return ta - tb;
    if (aOk !== bOk) return aOk ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function canonicalSucceededCaptures(
  transactions: readonly JobPaymentWorkspaceTransaction[]
): CanonicalCaptureContribution[] {
  const succeeded = sortByOccurredAt(
    transactions.filter((row) => row.kind === "capture" && row.status === "succeeded")
  );
  const seen = new Set<string>();
  const out: CanonicalCaptureContribution[] = [];
  for (const row of succeeded) {
    const identity = jobPaymentCanonicalCaptureIdentity({
      providerPaymentIntentId: row.provider_payment_intent_id,
      providerEventId: row.provider_event_id,
    });
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push({
      identity,
      amountCents: Math.max(0, row.amount_cents),
      occurredAt: row.occurred_at,
      paymentRequestId: row.payment_request_id,
      providerPaymentIntentId: (row.provider_payment_intent_id ?? "").trim() || null,
      providerEventId: (row.provider_event_id ?? "").trim() || null,
    });
  }
  return out;
}

export function jobPaymentWorkspaceGrossCents(
  transactions: readonly JobPaymentWorkspaceTransaction[]
): number {
  return canonicalSucceededCaptures(transactions).reduce(
    (sum, row) => sum + row.amountCents,
    0
  );
}

type CanonicalRefundContribution = {
  identity: string;
  amountCents: number;
  occurredAt: string;
  paymentRequestId: string;
  providerPaymentIntentId: string | null;
  providerEventId: string | null;
};

function canonicalRefunds(
  transactions: readonly JobPaymentWorkspaceTransaction[]
): CanonicalRefundContribution[] {
  const refunds = sortByOccurredAt(
    transactions.filter((row) => row.kind === "refund" && row.status === "refunded")
  );
  const seen = new Set<string>();
  const out: CanonicalRefundContribution[] = [];
  for (const row of refunds) {
    const pi = (row.provider_payment_intent_id ?? "").trim();
    const identity = pi
      ? `refund:pi:${JOB_PAYMENT_PROVIDER}:${pi}:${row.amount_cents}`
      : `refund:evt:${JOB_PAYMENT_PROVIDER}:${(row.provider_event_id ?? "").trim()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push({
      identity,
      amountCents: Math.max(0, row.amount_cents),
      occurredAt: row.occurred_at,
      paymentRequestId: row.payment_request_id,
      providerPaymentIntentId: pi || null,
      providerEventId: (row.provider_event_id ?? "").trim() || null,
    });
  }
  return out;
}

export function jobPaymentWorkspaceRefundedCents(
  transactions: readonly JobPaymentWorkspaceTransaction[]
): number {
  return canonicalRefunds(transactions).reduce((sum, row) => sum + row.amountCents, 0);
}

export function jobPaymentWorkspaceCashNetCents(input: {
  receivedGrossCents: number;
  refundedCents: number;
}): number {
  return Math.max(0, input.receivedGrossCents - input.refundedCents);
}

export function jobPaymentCollectibleRemainingCents(input: {
  contractTotalCents: number | null;
  receivedGrossCents: number;
}): number {
  if (input.contractTotalCents == null) return 0;
  return Math.max(0, input.contractTotalCents - input.receivedGrossCents);
}

export function jobPaymentWorkspaceSummaryRows(input: {
  contractTotalCents: number | null;
  receivedGrossCents: number;
  collectibleRemainingCents: number;
  refundedCents: number;
}): JobPaymentWorkspaceSummaryRow[] {
  const rows: JobPaymentWorkspaceSummaryRow[] = [
    { label: "Contract", cents: input.contractTotalCents },
    { label: "Received", cents: input.receivedGrossCents },
    { label: "Remaining", cents: input.collectibleRemainingCents },
  ];
  if (input.refundedCents > 0) {
    rows.push({ label: "Refunded", cents: input.refundedCents });
  }
  return rows;
}

export function isJobPaymentCompleteStage(stage: string | null | undefined): boolean {
  return (stage ?? "").trim().toLowerCase() === "complete";
}

function currentActiveRequest(
  requests: readonly JobPaymentWorkspaceRequest[]
): JobPaymentWorkspaceRequest | null {
  return (
    requests.find((row) => row.status === "open" || row.status === "processing") ??
    null
  );
}

function latestFailedRequest(
  requests: readonly JobPaymentWorkspaceRequest[]
): JobPaymentWorkspaceRequest | null {
  const latest = requests
    .filter((row) => row.status !== "cancelled" && row.status !== "expired")
    .slice()
    .sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)))[0];
  return latest?.status === "failed" ? latest : null;
}

function requestById(
  requests: readonly JobPaymentWorkspaceRequest[],
  id: string
): JobPaymentWorkspaceRequest | null {
  return requests.find((row) => row.id === id) ?? null;
}

export function formatJobPaymentWorkspaceDate(
  value: string | null | undefined
): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

export function formatJobPaymentWorkspaceTime(
  value: string | null | undefined
): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

export function formatJobPaymentWorkspaceDateTime(
  value: string | null | undefined
): string | null {
  const date = formatJobPaymentWorkspaceDate(value);
  const time = formatJobPaymentWorkspaceTime(value);
  if (date && time) return `${date} · ${time}`;
  return date ?? time;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatJobPaymentHistoryDayHeading(
  value: string | null | undefined,
  now = new Date()
): string {
  const raw = (value ?? "").trim();
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return "Unknown date";
  const day = new Date(ms);
  if (sameCalendarDay(day, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameCalendarDay(day, yesterday)) return "Yesterday";
  try {
    const opts: Intl.DateTimeFormatOptions =
      day.getFullYear() === now.getFullYear()
        ? { month: "short", day: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" };
    return new Intl.DateTimeFormat("en-US", opts).format(day);
  } catch {
    return formatJobPaymentWorkspaceDate(value) ?? "Unknown date";
  }
}

export function groupJobPaymentHistory(
  events: readonly JobPaymentWorkspaceTimelineEvent[],
  now = new Date()
): JobPaymentHistoryGroup[] {
  const groups: JobPaymentHistoryGroup[] = [];
  for (const event of events) {
    const heading = formatJobPaymentHistoryDayHeading(event.occurredAt, now);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) {
      last.events.push(event);
    } else {
      groups.push({ heading, events: [event] });
    }
  }
  return groups;
}

function requestedTitle(kind: JobPaymentKind): string {
  if (kind === "deposit") return "Deposit requested";
  if (kind === "progress") return "Progress payment requested";
  return "Remaining balance requested";
}

function receivedTitle(kind: JobPaymentKind): string {
  if (kind === "deposit") return "Deposit received";
  if (kind === "progress") return "Progress payment received";
  return "Remaining balance received";
}

function canonicalFailures(
  transactions: readonly JobPaymentWorkspaceTransaction[]
): CanonicalCaptureContribution[] {
  const failures = sortByOccurredAt(
    transactions.filter((row) => row.kind === "failure")
  );
  const seen = new Set<string>();
  const out: CanonicalCaptureContribution[] = [];
  for (const row of failures) {
    const identity = jobPaymentCanonicalCaptureIdentity({
      providerPaymentIntentId: row.provider_payment_intent_id,
      providerEventId: row.provider_event_id,
    });
    const key = `fail:${identity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      identity: key,
      amountCents: Math.max(0, row.amount_cents),
      occurredAt: row.occurred_at,
      paymentRequestId: row.payment_request_id,
      providerPaymentIntentId: (row.provider_payment_intent_id ?? "").trim() || null,
      providerEventId: (row.provider_event_id ?? "").trim() || null,
    });
  }
  return out;
}

export function buildJobPaymentWorkspaceTimeline(input: {
  requests: readonly JobPaymentWorkspaceRequest[];
  transactions: readonly JobPaymentWorkspaceTransaction[];
}): JobPaymentWorkspaceTimelineEvent[] {
  const events: JobPaymentWorkspaceTimelineEvent[] = [];
  const captures = canonicalSucceededCaptures(input.transactions);
  const failures = canonicalFailures(input.transactions);
  const failedRequestIds = new Set(failures.map((row) => row.paymentRequestId));

  const stamped = (iso: string) => ({
    occurredAt: iso,
    occurredAtLabel: formatJobPaymentWorkspaceDateTime(iso),
    occurredAtTimeLabel: formatJobPaymentWorkspaceTime(iso),
  });

  for (const request of input.requests) {
    if (request.status === "expired") continue;

    events.push({
      id: `requested:${request.id}`,
      type: "requested",
      title: requestedTitle(request.kind),
      subtitle: null,
      amountCents: request.amount_cents,
      methodLabel: null,
      ...stamped(request.requested_at),
      settled: false,
      tone: "default",
      disclosure: null,
    });

    if (request.status === "cancelled") {
      const cancelledAt = (request.cancelled_at ?? "").trim() || request.requested_at;
      events.push({
        id: `cancelled:${request.id}`,
        type: "cancelled",
        title: "Payment request cancelled",
        subtitle: jobPaymentCurrentRequestKindLabel(request.kind),
        amountCents: request.amount_cents,
        methodLabel: null,
        ...stamped(cancelledAt),
        settled: false,
        tone: "muted",
        disclosure: null,
      });
    }

    if (request.status === "failed" && !failedRequestIds.has(request.id)) {
      events.push({
        id: `failed-request:${request.id}`,
        type: "failed",
        title: "Payment failed",
        subtitle: jobPaymentCurrentRequestKindLabel(request.kind),
        amountCents: request.amount_cents,
        methodLabel: null,
        ...stamped(request.requested_at),
        settled: false,
        tone: "muted",
        disclosure: null,
      });
    }
  }

  for (const capture of captures) {
    const request = requestById(input.requests, capture.paymentRequestId);
    events.push({
      id: `received:${capture.identity}`,
      type: "received",
      title: receivedTitle(request?.kind ?? "deposit"),
      subtitle: null,
      amountCents: capture.amountCents,
      methodLabel: (request?.settled_payment_method_label ?? "").trim() || null,
      ...stamped(capture.occurredAt),
      settled: true,
      tone: "settled",
      disclosure:
        capture.providerPaymentIntentId || capture.providerEventId
          ? {
              paymentIntentId: capture.providerPaymentIntentId,
              providerEventId: capture.providerEventId,
            }
          : null,
    });
  }

  for (const failure of failures) {
    const request = requestById(input.requests, failure.paymentRequestId);
    events.push({
      id: `failed:${failure.identity}`,
      type: "failed",
      title: "Payment failed",
      subtitle: request ? jobPaymentCurrentRequestKindLabel(request.kind) : null,
      amountCents: failure.amountCents,
      methodLabel: null,
      ...stamped(failure.occurredAt),
      settled: false,
      tone: "muted",
      disclosure:
        failure.providerPaymentIntentId || failure.providerEventId
          ? {
              paymentIntentId: failure.providerPaymentIntentId,
              providerEventId: failure.providerEventId,
            }
          : null,
    });
  }

  for (const refund of canonicalRefunds(input.transactions)) {
    events.push({
      id: `refund:${refund.identity}`,
      type: "refund",
      title: "Refund recorded",
      subtitle: null,
      amountCents: refund.amountCents,
      methodLabel: null,
      ...stamped(refund.occurredAt),
      settled: false,
      tone: "muted",
      disclosure:
        refund.providerPaymentIntentId || refund.providerEventId
          ? {
              paymentIntentId: refund.providerPaymentIntentId,
              providerEventId: refund.providerEventId,
            }
          : null,
    });
  }

  return sortByOccurredAt(events).reverse();
}

function overviewStatusFor(state: JobPaymentWorkspaceState): string | null {
  switch (state) {
    case "deposit_due":
    case "deposit_processing":
    case "balance_processing":
    case "progress_processing":
      return "Payment pending";
    case "deposit_received":
      return "Deposit received";
    case "balance_not_yet_due":
      return "Remaining to collect";
    case "balance_due":
      return "Balance due";
    case "balance_requested":
      return "Balance requested";
    case "progress_requested":
      return "Progress payment requested";
    case "paid_in_full":
      return "Paid in full";
    case "payment_failed":
      return "Payment failed";
    case "partially_paid":
      return "Partially paid";
    default:
      return null;
  }
}

function statusLabelFor(state: JobPaymentWorkspaceState): string {
  switch (state) {
    case "no_payment_required":
      return "No payment required yet";
    case "setup_required":
      return "Payments setup required";
    case "deposit_due":
      return "Deposit due";
    case "deposit_processing":
      return "Deposit processing";
    case "deposit_received":
      return "Deposit received";
    case "payment_failed":
      return "Payment failed";
    case "partially_paid":
      return "Partially paid";
    case "balance_not_yet_due":
      return "Remaining to collect";
    case "balance_due":
      return "Balance due";
    case "balance_requested":
      return "Balance requested";
    case "balance_processing":
      return "Balance processing";
    case "progress_requested":
      return "Progress payment requested";
    case "progress_processing":
      return "Progress payment processing";
    case "paid_in_full":
      return "Paid in full";
  }
}

function nextStepFor(
  state: JobPaymentWorkspaceState,
  connected: boolean
): JobPaymentWorkspaceNextStep | null {
  switch (state) {
    case "no_payment_required":
    case "paid_in_full":
      return null;
    case "setup_required":
      return {
        label: "Connect payments in Company Settings.",
        detail: connected
          ? "Charges are not enabled yet."
          : "Payments are not connected yet.",
        connectHref: JOB_PAYMENT_WORKSPACE_CONNECT_HREF,
      };
    case "deposit_due":
    case "deposit_processing":
    case "balance_processing":
    case "progress_processing":
    case "payment_failed":
    case "deposit_received":
    case "balance_not_yet_due":
    case "partially_paid":
    case "balance_due":
    case "balance_requested":
    case "progress_requested":
      return null;
  }
}

function deriveWorkspaceState(input: {
  accepted: boolean;
  connected: boolean;
  chargesEnabled: boolean;
  depositRequired: boolean;
  jobComplete: boolean;
  collectibleRemainingCents: number;
  receivedGrossCents: number;
  depositGrossCents: number;
  current: JobPaymentWorkspaceRequest | null;
  failed: JobPaymentWorkspaceRequest | null;
  contractTotalCents: number | null;
}): JobPaymentWorkspaceState {
  if (!input.accepted) return "no_payment_required";
  if (!input.connected || !input.chargesEnabled) return "setup_required";

  const collectible = input.collectibleRemainingCents;
  const paidInFull =
    collectible < JOB_PAYMENT_MIN_AMOUNT_CENTS &&
    (input.receivedGrossCents > 0 ||
      (input.contractTotalCents != null &&
        input.contractTotalCents < JOB_PAYMENT_MIN_AMOUNT_CENTS));

  if (input.current?.status === "processing") {
    if (input.current.kind === "balance") return "balance_processing";
    if (input.current.kind === "progress") return "progress_processing";
    return "deposit_processing";
  }

  if (input.current?.status === "open") {
    if (input.current.kind === "balance") return "balance_requested";
    if (input.current.kind === "progress") return "progress_requested";
  }

  if (paidInFull) return "paid_in_full";

  if (!input.current && input.failed) return "payment_failed";

  if (input.current?.status === "open" && input.current.kind === "balance") {
    return "balance_requested";
  }

  if (
    input.depositRequired &&
    input.depositGrossCents < JOB_PAYMENT_MIN_AMOUNT_CENTS
  ) {
    return "deposit_due";
  }

  if (collectible >= JOB_PAYMENT_MIN_AMOUNT_CENTS && input.jobComplete) {
    return "balance_due";
  }

  if (input.receivedGrossCents > 0 && collectible >= JOB_PAYMENT_MIN_AMOUNT_CENTS) {
    if (!input.jobComplete && input.depositGrossCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS) {
      const extra =
        input.receivedGrossCents - input.depositGrossCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS;
      return extra ? "partially_paid" : "deposit_received";
    }
    if (!input.jobComplete) return "partially_paid";
  }

  if (collectible >= JOB_PAYMENT_MIN_AMOUNT_CENTS && !input.jobComplete) {
    return "balance_not_yet_due";
  }

  if (input.receivedGrossCents > 0 && collectible < JOB_PAYMENT_MIN_AMOUNT_CENTS) {
    return "paid_in_full";
  }

  return "no_payment_required";
}

export function buildJobPaymentWorkspace(input: {
  jobStage: string | null;
  accepted: boolean;
  account: CompanyPaymentAccountRow | null;
  requests: readonly JobPaymentWorkspaceRequest[];
  transactions: readonly JobPaymentWorkspaceTransaction[];
  customerChosenTotalCents?: number | null;
  acceptedTotalCents?: number | null;
  terms?: ProposalPaymentTerms | null;
  jobPaymentActive?: boolean;
}): JobPaymentWorkspaceView {
  const connected = Boolean(input.account);
  const chargesEnabled = input.account?.charges_enabled === true;
  const contractTotalCents = proposalAcceptanceContractTotalCents({
    customerChosenTotalCents: input.customerChosenTotalCents,
    acceptedTotalCents: input.acceptedTotalCents,
  });
  const receivedGrossCents = jobPaymentWorkspaceGrossCents(input.transactions);
  const refundedCents = jobPaymentWorkspaceRefundedCents(input.transactions);
  const cashNetCents = jobPaymentWorkspaceCashNetCents({
    receivedGrossCents,
    refundedCents,
  });
  const collectibleRemainingCents = jobPaymentCollectibleRemainingCents({
    contractTotalCents,
    receivedGrossCents,
  });
  const terms = input.terms ?? DEFAULT_PROPOSAL_PAYMENT_TERMS;
  const depositRequired =
    termsRequireOnlineDeposit(terms) ||
    input.requests.some((row) => row.kind === "deposit");
  const jobComplete = isJobPaymentCompleteStage(input.jobStage);
  const depositRequestIds = new Set(
    input.requests.filter((row) => row.kind === "deposit").map((row) => row.id)
  );
  const depositGrossCents = canonicalSucceededCaptures(input.transactions)
    .filter((row) => depositRequestIds.has(row.paymentRequestId))
    .reduce((sum, row) => sum + row.amountCents, 0);
  const current = currentActiveRequest(input.requests);
  const failed = latestFailedRequest(input.requests);
  const state = deriveWorkspaceState({
    accepted: input.accepted,
    connected,
    chargesEnabled,
    depositRequired,
    jobComplete,
    collectibleRemainingCents,
    receivedGrossCents,
    depositGrossCents,
    current,
    failed,
    contractTotalCents,
  });
  const nextStep = nextStepFor(state, connected);
  const jobPaymentActive = input.jobPaymentActive !== false;
  const canCollectPayment =
    input.accepted &&
    chargesEnabled &&
    collectibleRemainingCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS &&
    current == null &&
    jobPaymentActive;

  return {
    contractTotalCents,
    receivedGrossCents,
    refundedCents,
    cashNetCents,
    collectibleRemainingCents,
    state,
    statusLabel: statusLabelFor(state),
    overviewStatusLabel: overviewStatusFor(state),
    nextStep,
    connected,
    chargesEnabled,
    accepted: input.accepted,
    depositRequired,
    jobComplete,
    depositNotReceived:
      state === "deposit_due" ||
      state === "deposit_processing" ||
      (state === "payment_failed" && failed?.kind === "deposit"),
    currentRequest: current
      ? {
          id: current.id,
          kind: current.kind,
          status: current.status,
          amountCents: current.amount_cents,
        }
      : null,
    canCollectRemainingBalance: state === "balance_due",
    canCollectPayment,
    timeline: buildJobPaymentWorkspaceTimeline({
      requests: input.requests,
      transactions: input.transactions,
    }),
    summaryRows: jobPaymentWorkspaceSummaryRows({
      contractTotalCents,
      receivedGrossCents,
      collectibleRemainingCents,
      refundedCents,
    }),
  };
}

export function formatJobPaymentWorkspaceAmount(
  cents: number | null | undefined
): string {
  if (cents == null) return "—";
  return formatUsdFromCents(cents);
}

export function jobPaymentCurrentRequestKindLabel(kind: JobPaymentKind): string {
  if (kind === "deposit") return "Deposit";
  if (kind === "progress") return "Progress payment";
  return "Remaining balance";
}
