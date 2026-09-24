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
