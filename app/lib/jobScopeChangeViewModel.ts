/**
 * Astra G9 — contractor/customer scope-change view helpers (pure).
 */

import {
  JOB_SCOPE_CHANGE_STATUS_LABELS,
  type JobScopeChange,
  type JobScopeChangeLine,
  type JobScopeChangeStatus,
} from "@/app/lib/jobScopeChangeTypes";
import {
  buildScopeChangeTotalsDisplay,
  type ScopeChangeTotalsDisplay,
} from "@/app/lib/jobScopeChangeContract";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";

export const JOB_CARD_PROPOSE_SCOPE_CHANGE_LABEL = "Propose scope change" as const;
export const JOB_CARD_SCOPE_CHANGES_HEADING = "Scope changes" as const;
export const JOB_CARD_SCOPE_CHANGE_PENDING_OVERVIEW_LABEL =
  "Scope change pending approval" as const;

export type ScopeChangeAuthoringEligibilityInput = {
  hasAcceptedAgreement: boolean;
  canAuthor: boolean;
  jobStage: string | null | undefined;
  jobDisposition: string | null | undefined;
  hasProposedAlready?: boolean;
};

export function isScopeChangeAuthoringAllowed(
  input: ScopeChangeAuthoringEligibilityInput
): boolean {
  if (!input.hasAcceptedAgreement) return false;
  if (!input.canAuthor) return false;
  const stage = String(input.jobStage ?? "")
    .trim()
    .toLowerCase();
  if (stage === "complete") return false;
  const disposition = String(input.jobDisposition ?? "")
    .trim()
    .toLowerCase();
  if (
    disposition === "lost" ||
    disposition === "closed" ||
    disposition === "on_hold"
  ) {
    return false;
  }
  return true;
}

export function canShowProposeScopeChangeCta(
  input: ScopeChangeAuthoringEligibilityInput
): boolean {
  return isScopeChangeAuthoringAllowed(input);
}

export function scopeChangeStatusLabel(
  status: JobScopeChangeStatus | string
): string {
  if (status in JOB_SCOPE_CHANGE_STATUS_LABELS) {
    return JOB_SCOPE_CHANGE_STATUS_LABELS[status as JobScopeChangeStatus];
  }
  return String(status);
}

export function formatScopeChangeDeltaLabel(cents: number): string {
  const n = Number(cents) || 0;
  if (n === 0) return formatUsdFromCents(0);
  const abs = formatUsdFromCents(Math.abs(n));
  return n > 0 ? `+${abs}` : `−${abs}`;
}

export function buildScopeChangeHistoryRow(input: {
  change: Pick<
    JobScopeChange,
    | "id"
    | "status"
    | "price_delta_cents"
    | "basis_contract_total_cents"
    | "reason"
    | "proposed_at"
    | "authorized_at"
    | "created_at"
  >;
}): {
  id: string;
  status: string;
  statusLabel: string;
  deltaLabel: string;
  newTotalLabel: string;
  reason: string | null;
  dateIso: string | null;
} {
  const change = input.change;
  const newTotal =
    Number(change.basis_contract_total_cents) + Number(change.price_delta_cents);
  const dateIso =
    change.authorized_at ??
    change.proposed_at ??
    change.created_at ??
    null;
  return {
    id: change.id,
    status: change.status,
    statusLabel: scopeChangeStatusLabel(change.status),
    deltaLabel: formatScopeChangeDeltaLabel(change.price_delta_cents),
    newTotalLabel: formatUsdFromCents(newTotal),
    reason: change.reason,
    dateIso,
  };
}

export function buildScopeChangeEditorTotals(input: {
  originalAgreementCents: number;
  previouslyAuthorizedDeltasCents: number;
  thisChangeDeltaCents: number;
}): ScopeChangeTotalsDisplay {
  return buildScopeChangeTotalsDisplay(input);
}

/** Field-brief authorized summaries from authorized change lines/reason. */
export function buildAuthorizedChangeSummariesFromScopeChanges(
  changes: readonly {
    status: string;
    reason?: string | null;
    lines?: readonly Pick<JobScopeChangeLine, "description" | "change_kind">[];
  }[]
): string[] {
  const out: string[] = [];
  for (const change of changes) {
    if (change.status !== "authorized") continue;
    const lines = change.lines ?? [];
    if (lines.length > 0) {
      for (const line of lines) {
        const desc = String(line.description ?? "").trim();
        if (desc) out.push(desc);
      }
      continue;
    }
    const reason = String(change.reason ?? "").trim();
    if (reason) out.push(reason);
  }
  return out;
}

/** Field-brief pending proposed summaries (never treated as authorized). */
export function buildPendingProposedSummariesFromScopeChanges(
  changes: readonly {
    status: string;
    reason?: string | null;
    lines?: readonly Pick<JobScopeChangeLine, "description">[];
  }[]
): string[] {
  const out: string[] = [];
  for (const change of changes) {
    if (change.status !== "proposed") continue;
    const lines = change.lines ?? [];
    if (lines.length > 0) {
      for (const line of lines) {
        const desc = String(line.description ?? "").trim();
        if (desc) out.push(desc);
      }
      continue;
    }
    const reason = String(change.reason ?? "").trim();
    if (reason) out.push(reason);
    else out.push("Scope change");
  }
  return out;
}

export function sumLineDeltasCents(
  lines: readonly Pick<JobScopeChangeLine, "line_delta_cents">[]
): number {
  return lines.reduce((sum, line) => sum + (Number(line.line_delta_cents) || 0), 0);
}

/** Client (camelCase) line sum used by the contractor editor. */
export function sumClientLineDeltasCents(
  lines: readonly { lineDeltaCents: number }[]
): number {
  return lines.reduce((sum, line) => sum + (Number(line.lineDeltaCents) || 0), 0);
}

export const SCOPE_CHANGE_BASIS_UNAVAILABLE_MESSAGE =
  "The current contract total could not be confirmed, so totals are not shown. You can save the draft; proposing waits until the contract total loads." as const;

export type ScopeChangeEditorBasis =
  | {
      status: "ready";
      originalAgreementCents: number;
      /** Signed sum of authorized deltas (may be negative). */
      previouslyAuthorizedDeltasCents: number;
      currentContractCents: number;
    }
  | { status: "loading" }
  | { status: "unavailable" };

/**
 * Editor basis from the live contract total and authorized rows. Signed
 * authorized deltas are preserved; an unknown contract total is never shown
 * as $0.
 */
export function resolveScopeChangeEditorBasis(input: {
  loadStatus: "idle" | "loading" | "ready" | "error";
  contractTotalCents: number | null;
  rows: readonly { status: string; priceDeltaCents: number }[];
}): ScopeChangeEditorBasis {
  if (input.loadStatus === "loading" || input.loadStatus === "idle") {
    return { status: "loading" };
  }
  if (
    input.loadStatus !== "ready" ||
    input.contractTotalCents == null ||
    !Number.isFinite(input.contractTotalCents)
  ) {
    return { status: "unavailable" };
  }
  const authorized = input.rows
    .filter((row) => row.status === "authorized")
    .reduce((sum, row) => sum + (Number(row.priceDeltaCents) || 0), 0);
  return {
    status: "ready",
    originalAgreementCents: input.contractTotalCents - authorized,
    previouslyAuthorizedDeltasCents: authorized,
    currentContractCents: input.contractTotalCents,
  };
}

export type ScopeChangeDraftLineClient = {
  id?: string;
  changeKind: "add" | "remove";
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  lineDeltaCents: number;
  sortOrder: number;
};

/** Persisted draft lines for resume; falls back to one empty add line. */
export function hydrateScopeChangeDraftLines(
  persisted: readonly ScopeChangeDraftLineClient[] | null | undefined
): ScopeChangeDraftLineClient[] {
  const rows = [...(persisted ?? [])]
    .filter((line) => line && (line.changeKind === "add" || line.changeKind === "remove"))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((line, index) => ({
      ...(line.id ? { id: line.id } : {}),
      changeKind: line.changeKind,
      description: String(line.description ?? ""),
      quantity: line.quantity ?? null,
      unit: line.unit ?? null,
      unitPriceCents: line.unitPriceCents ?? null,
      lineDeltaCents: Number(line.lineDeltaCents) || 0,
      sortOrder: index,
    }));
  if (rows.length > 0) return rows;
  return [
    {
      changeKind: "add",
      description: "",
      quantity: null,
      unit: null,
      unitPriceCents: null,
      lineDeltaCents: 0,
      sortOrder: 0,
    },
  ];
}

export const SCOPE_CHANGE_PROPOSE_ACTION_LABEL = "Propose to customer" as const;
export const SCOPE_CHANGE_GET_REVIEW_LINK_LABEL = "Get customer review link" as const;

/** History total copy: only authorized changes applied their total. */
export function scopeChangeHistoryTotalCopy(
  status: string,
  totalLabel: string
): string {
  if (status === "authorized") return `Total after this change ${totalLabel}`;
  if (status === "proposed") return `Proposed total ${totalLabel} — not applied`;
  if (status === "draft") return `Draft total ${totalLabel} — not applied`;
  return `Proposed total ${totalLabel} — not applied`;
}

export type ScopeChangeProposeOutcome =
  | { kind: "link_ready"; url: string; message: string }
  | { kind: "link_missing"; message: string };

/** Propose succeeded; a review link may or may not have been minted. */
export function describeScopeChangeProposeOutcome(
  publicReviewUrl: string | null | undefined
): ScopeChangeProposeOutcome {
  const url = String(publicReviewUrl ?? "").trim();
  if (url) {
    return {
      kind: "link_ready",
      url,
      message:
        "Scope change proposed. Share this review link with your customer — FieldDive did not email it.",
    };
  }
  return {
    kind: "link_missing",
    message:
      "Scope change proposed, but the customer review link could not be created. Use “Get customer review link” to try again.",
  };
}
