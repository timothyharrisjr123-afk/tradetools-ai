/**
 * R3I contractor disposition management — presentation and action contracts.
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
  resolveCanonicalJobStageLabel,
} from "@/app/lib/jobLifecycleMapper";

export const DISPOSITION_REASON_MAX_LENGTH = 240;

export type DispositionManagementTarget = OperationalJobDisposition;

export type DispositionManagementAction = {
  target: DispositionManagementTarget;
  kind: "hold" | "lost" | "close" | "reactivate";
  menuLabel: string;
  confirmTitle: string;
  confirmActionLabel: string;
};

export type ChangeDispositionApiErrorCode =
  | "unauthorized"
  | "invalid_payload"
  | "forbidden"
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

export function visibleDispositionLabel(
  value: string | null | undefined
): string | null {
  const disposition = resolveOperationalDisposition(value);
  if (!disposition || disposition === "active") return null;
  return OPERATIONAL_JOB_DISPOSITION_LABELS[disposition];
}

export function resolveDispositionManagementActions(
  current: string | null | undefined
): DispositionManagementAction[] {
  const disposition = resolveOperationalDisposition(current);
  if (!disposition) return [];
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
        confirmTitle: "Mark job lost",
        confirmActionLabel: "Mark lost",
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
  return [
    {
      target: "active",
      kind: "reactivate",
      menuLabel: "Reactivate",
      confirmTitle: "Reactivate job",
      confirmActionLabel: "Reactivate",
    },
  ];
}

export function dispositionBlockedWorkCopy(
  current: string | null | undefined
): string | null {
  const disposition = resolveOperationalDisposition(current);
  if (!disposition || disposition === "active") return null;
  if (disposition === "on_hold") {
    return "Job is on hold. Reactivate to continue work.";
  }
  if (disposition === "lost") {
    return "Job is lost. Reactivate to continue work.";
  }
  return "Job is closed. Reactivate to continue work.";
}

export function dispositionConfirmCopy(input: {
  target: DispositionManagementTarget;
  stage: CanonicalJobStage | string | null | undefined;
}): { body: string; closeDoesNotComplete: boolean } {
  const stageLabel = resolveCanonicalJobStageLabel({
    stage: input.stage ?? "intake",
  });
  if (input.target === "on_hold") {
    return {
      body: `Lifecycle stage stays ${stageLabel}. Operational actions stay paused until this job is reactivated.`,
      closeDoesNotComplete: false,
    };
  }
  if (input.target === "lost") {
    return {
      body: `Lifecycle stage stays ${stageLabel}. This does not complete the job.`,
      closeDoesNotComplete: false,
    };
  }
  if (input.target === "closed") {
    return {
      body: `Lifecycle stage stays ${stageLabel}. Closing is a business disposition — it does not mean work was completed unless the stage is already Complete.`,
      closeDoesNotComplete: true,
    };
  }
  return {
    body: `Return this job to Active. Lifecycle stage stays ${stageLabel}.`,
    closeDoesNotComplete: false,
  };
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
