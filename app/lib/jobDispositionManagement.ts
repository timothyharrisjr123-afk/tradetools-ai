/**
 * R3I + Astra G8 contractor disposition management — presentation and action contracts.
 *
 * Writes remain owned by change_job_disposition_v1. This module does not
 * invent stages, reason storage, or reactivation beyond that RPC.
 */

import {
  OPERATIONAL_JOB_DISPOSITION_LABELS,
  type CanonicalJobStage,
  type OperationalJobDisposition,
} from "@/app/lib/jobLifecycleTypes";
import {
  isOperationalJobDisposition,
  resolveCanonicalJobStage,
  resolveCanonicalJobStageLabel,
} from "@/app/lib/jobLifecycleMapper";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import { dispositionActionNeedsCapability } from "@/app/lib/jobDispositionAuthority";

export const DISPOSITION_REASON_MAX_LENGTH = 240;

export type DispositionManagementTarget = OperationalJobDisposition;

export type DispositionManagementActionKind =
  | "hold"
  | "lost"
  | "close"
  | "resume"
  | "reopen";

export type DispositionManagementAction = {
  target: DispositionManagementTarget;
  kind: DispositionManagementActionKind;
  menuLabel: string;
  confirmTitle: string;
  confirmActionLabel: string;
};

export type ChangeDispositionApiErrorCode =
  | "unauthorized"
  | "invalid_payload"
  | "forbidden"
  | "capability_denied"
  | "not_found"
  | "illegal_disposition_target"
  | "internal_error";

export function resolveOperationalDisposition(
  value: string | null | undefined
): OperationalJobDisposition | null {
  const token = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!isOperationalJobDisposition(token)) return null;
  return token;
}

/**
 * User-facing disposition label (quiet). Optional reason appends " · <reason>".
 * ACTIVE returns null (visually quiet).
 */
export function visibleDispositionLabel(
  value: string | null | undefined,
  reason?: string | null
): string | null {
  const disposition = resolveOperationalDisposition(value);
  if (!disposition || disposition === "active") return null;
  const note = normalizeDispositionReason(reason);
  if (disposition === "on_hold") {
    return note ? `On hold · ${note}` : "On hold";
  }
  if (disposition === "lost") {
    return note ? `Not proceeding · ${note}` : "Not proceeding";
  }
  return "Closed to active work";
}

/** Compact Board/list chip — shorter than Job Card header copy. */
export function compactDispositionBadgeLabel(
  value: string | null | undefined
): string | null {
  const disposition = resolveOperationalDisposition(value);
  if (!disposition || disposition === "active") return null;
  if (disposition === "on_hold") return "On hold";
  if (disposition === "lost") return "Not proceeding";
  return "Closed";
}

export function resolveDispositionManagementActions(
  current: string | null | undefined,
  options?: {
    /** When true, recovery actions stay out of More (they are primary CTAs). */
    omitPrimaryRecoveryFromMenu?: boolean;
  }
): DispositionManagementAction[] {
  const disposition = resolveOperationalDisposition(current);
  if (!disposition) return [];
  const omitRecovery = options?.omitPrimaryRecoveryFromMenu !== false;

  if (disposition === "active") {
    return [
      {
        target: "on_hold",
        kind: "hold",
        menuLabel: "Put on hold",
        confirmTitle: "Put job on hold",
        confirmActionLabel: "Put on hold",
      },
      {
        target: "lost",
        kind: "lost",
        menuLabel: "Mark lost",
        confirmTitle: "Mark job not proceeding",
        confirmActionLabel: "Mark not proceeding",
      },
      {
        target: "closed",
        kind: "close",
        menuLabel: "Close job",
        confirmTitle: "Close job",
        confirmActionLabel: "Close job",
      },
    ];
  }

  if (disposition === "on_hold") {
    const secondary: DispositionManagementAction[] = [
      {
        target: "lost",
        kind: "lost",
        menuLabel: "Mark lost",
        confirmTitle: "Mark job not proceeding",
        confirmActionLabel: "Mark not proceeding",
      },
      {
        target: "closed",
        kind: "close",
        menuLabel: "Close job",
        confirmTitle: "Close job",
        confirmActionLabel: "Close job",
      },
    ];
    if (omitRecovery) return secondary;
    return [
      {
        target: "active",
        kind: "resume",
        menuLabel: "Resume job",
        confirmTitle: "Resume job",
        confirmActionLabel: "Resume job",
      },
      ...secondary,
    ];
  }

  // lost / closed — recovery is primary; menu empty when omitRecovery
  if (omitRecovery) return [];
  return [
    {
      target: "active",
      kind: "reopen",
      menuLabel: "Reopen job",
      confirmTitle: "Reopen job",
      confirmActionLabel: "Reopen job",
    },
  ];
}

export function filterDispositionActionsByCapability(
  actions: readonly DispositionManagementAction[],
  capabilities: { pauseResume: boolean; finalize: boolean }
): DispositionManagementAction[] {
  return actions.filter((action) =>
    dispositionActionNeedsCapability(action.kind, capabilities)
  );
}

export function dispositionBlockedWorkCopy(
  current: string | null | undefined
): string | null {
  const disposition = resolveOperationalDisposition(current);
  if (!disposition || disposition === "active") return null;
  if (disposition === "on_hold") {
    return "Job is on hold. Resume to continue work.";
  }
  if (disposition === "lost") {
    return "Not proceeding. Reopen to continue work.";
  }
  return "Closed to active work. Reopen to continue.";
}

export function dispositionConfirmCopy(input: {
  target: DispositionManagementTarget;
  stage: CanonicalJobStage | string | null | undefined;
  kind?: DispositionManagementActionKind;
}): { body: string; closeDoesNotComplete: boolean } {
  const stageLabel = resolveCanonicalJobStageLabel({
    stage: input.stage ?? "intake",
  });
  if (input.target === "on_hold") {
    return {
      body: `Lifecycle stage stays ${stageLabel}. Schedule and production clocks stay as they are. Operational actions pause until this job is resumed.`,
      closeDoesNotComplete: false,
    };
  }
  if (input.target === "lost") {
    return {
      body: `Lifecycle stage stays ${stageLabel}. Agreements, payments, schedule, and assignments are preserved. This does not complete the job.`,
      closeDoesNotComplete: false,
    };
  }
  if (input.target === "closed") {
    return {
      body: `Lifecycle stage stays ${stageLabel}. Closing stops active work — it is not the same as Complete unless the stage is already Complete.`,
      closeDoesNotComplete: true,
    };
  }
  if (input.kind === "resume") {
    return {
      body: `Return this job to Active. Lifecycle stage stays ${stageLabel}. No schedule or lifecycle progress is fabricated.`,
      closeDoesNotComplete: false,
    };
  }
  return {
    body: `Reopen this job to Active. Lifecycle stage stays ${stageLabel}. Schedule and history are unchanged.`,
    closeDoesNotComplete: false,
  };
}

export const CLOSE_COMMITMENT_STATIC_NOTES = [
  "Closing stops active work.",
  "It does not cancel agreements.",
  "It does not forgive balances.",
  "It does not refund payments.",
] as const;

export type CloseCommitmentWarningFact = {
  id: string;
  text: string;
};

/**
 * Read-only close warning facts from existing canonical truth.
 * Omit any fact that cannot be supported — never invent $0 when unknown.
 */
export function buildCloseCommitmentWarningFacts(input: {
  hasAcceptedAgreement: boolean;
  collectibleRemainingCents?: number | null;
  paymentOverviewStatusLabel?: string | null;
  paymentState?: string | null;
}): CloseCommitmentWarningFact[] {
  const facts: CloseCommitmentWarningFact[] = [];
  if (input.hasAcceptedAgreement) {
    facts.push({
      id: "accepted_agreement",
      text: "An accepted agreement exists on this job.",
    });
  }
  const remaining = input.collectibleRemainingCents;
  if (typeof remaining === "number" && remaining > 0) {
    facts.push({
      id: "outstanding_balance",
      text: `Outstanding / collectible balance: ${formatUsdFromCents(remaining)}.`,
    });
  }
  const state = String(input.paymentState ?? "").trim();
  const overview = String(input.paymentOverviewStatusLabel ?? "").trim();
  if (
    overview &&
    remaining == null &&
    state &&
    state !== "contract_unavailable" &&
    state !== "no_payment_required" &&
    state !== "paid_in_full" &&
    state !== "payments_complete"
  ) {
    facts.push({
      id: "payment_state",
      text: overview,
    });
  } else if (
    overview &&
    typeof remaining === "number" &&
    remaining > 0 &&
    !facts.some((f) => f.id === "outstanding_balance")
  ) {
    facts.push({ id: "payment_state", text: overview });
  }
  return facts;
}

export function normalizeDispositionReason(
  value: string | null | undefined
): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, DISPOSITION_REASON_MAX_LENGTH);
}

export function mapDispositionMutationError(
  code: string | null | undefined
): string {
  switch (String(code ?? "").trim()) {
    case "unauthorized":
      return "Sign in to change this job.";
    case "forbidden":
      return "You do not have access to change this job.";
    case "capability_denied":
      return "You do not have permission to change this job status.";
    case "not_found":
      return "This job could not be found.";
    case "illegal_disposition_target":
      return "That job status is not allowed.";
    case "invalid_payload":
      return "That change could not be submitted. Refresh and try again.";
    default:
      return "Job status could not be updated. Refresh and try again.";
  }
}

export function composeDispositionChangedActivity(payload: {
  to_status?: unknown;
  reopened?: unknown;
  reason?: unknown;
}): { label: string; note: string } | null {
  const toStatus = String(payload.to_status ?? "")
    .trim()
    .toLowerCase();
  const reason = normalizeDispositionReason(
    typeof payload.reason === "string" ? payload.reason : null
  );
  const reopened = payload.reopened === true || toStatus === "active";
  if (reopened) {
    return {
      label: "Job reactivated",
      note: reason || "Disposition returned to Active",
    };
  }
  if (toStatus === "on_hold") {
    return {
      label: "Job put on hold",
      note: reason || "Job placed on hold",
    };
  }
  if (toStatus === "lost") {
    return {
      label: "Job marked lost",
      note: reason || "Job marked lost",
    };
  }
  if (toStatus === "closed") {
    return {
      label: "Job closed",
      note: reason || "Job closed",
    };
  }
  return null;
}

export function isActiveOperationalDisposition(
  value: string | null | undefined
): boolean {
  return resolveOperationalDisposition(value) === "active";
}

export function applyKnownDispositionToJobRecord<
  T extends { id: string; status: string },
>(
  record: T | null | undefined,
  jobId: string,
  toStatus: OperationalJobDisposition
): T | null {
  if (!record || record.id !== jobId) return record ?? null;
  return { ...record, status: toStatus };
}

/** True when Closed + Production and Complete would be eligible after reopen. */
export function isProductionClosedReopenAndCompletePath(input: {
  stage: CanonicalJobStage | string | null | undefined;
  disposition: string | null | undefined;
  canCompleteIfActive: boolean;
}): boolean {
  const disposition = resolveOperationalDisposition(input.disposition);
  if (disposition !== "closed") return false;
  const stage = resolveCanonicalJobStage({ stage: input.stage });
  if (stage !== "production") return false;
  return input.canCompleteIfActive === true;
}

/** Re-export labels for callers that still need enum labels. */
export { OPERATIONAL_JOB_DISPOSITION_LABELS };
