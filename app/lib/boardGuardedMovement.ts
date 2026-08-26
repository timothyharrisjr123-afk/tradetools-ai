/**
 * Guarded Jobs Board movement — drag is an interaction method, not a
 * lifecycle writer. Every allowed drop maps to an existing canonical action.
 */

import { mapCanonicalStageToBoardColumnKey } from "@/app/lib/jobBoardAdapter";
import type { JobAttentionSafeItem } from "@/app/lib/jobAttentionReadModel";
import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";
import type { BoardColumnKey } from "@/app/tools/roofing/saved/jobsBoardUtils";
import { isUuidLike } from "@/app/lib/uuid";

export { mapCanonicalStageToBoardColumnKey };

export const BOARD_DRAG_THRESHOLD_PX = 8;

export const BOARD_MOVEMENT_REACTIVATE_COPY = "Reactivate to continue.";
export const BOARD_MOVEMENT_ACCEPTANCE_REQUIRED_COPY =
  "Customer acceptance is required before this job can be approved.";
export const BOARD_MOVEMENT_MISSING_SCHEDULE_COPY =
  "This job cannot move without an active schedule.";
export const BOARD_MOVEMENT_TERMINAL_COPY = "Completed jobs cannot be moved.";
export const BOARD_MOVEMENT_BLOCKED_COPY = "That move is not available.";
export const BOARD_MOVEMENT_UNKNOWN_TARGET_COPY = "That stage is not available.";

export const BOARD_APPROVE_CONFIRM_TITLE = "Approve job?";
export const BOARD_START_WORK_CONFIRM_TITLE = "Start work?";
export const BOARD_COMPLETE_CONFIRM_TITLE = "Complete job?";
export const BOARD_UNSCHEDULE_CONFIRM_TITLE = "Unschedule job?";
export const BOARD_UNSCHEDULE_CONFIRM_BODY =
  "The active schedule will be removed from the calendar and the job will return to Approved.";

export type BoardMovementIntentKind =
  | "proposal_create"
  | "approve_job"
  | "open_schedule_workspace"
  | "start_work"
  | "complete_job"
  | "unschedule";

export type BoardMovementIntent = {
  kind: BoardMovementIntentKind;
};

export type BoardMovementRejectReason =
  | "same_lane"
  | "blocked"
  | "terminal"
  | "disposition"
  | "missing_acceptance"
  | "missing_schedule"
  | "unknown_target";

export type BoardMovementResolution =
  | { allowed: true; intent: BoardMovementIntent }
  | {
      allowed: false;
      reason: BoardMovementRejectReason;
      message: string;
    };

export type BoardGuardedMovementInput = {
  fromStage: CanonicalJobStage;
  toStage: CanonicalJobStage | null;
  dispositionActive: boolean;
  canApproveJob: boolean;
  hasActivePlannedSchedule: boolean;
};

const ALLOWED_FORWARD: ReadonlyArray<
  readonly [CanonicalJobStage, CanonicalJobStage, BoardMovementIntentKind]
> = [
  ["intake", "proposal", "proposal_create"],
  ["proposal", "approved", "approve_job"],
  ["approved", "scheduled", "open_schedule_workspace"],
  ["scheduled", "production", "start_work"],
  ["production", "complete", "complete_job"],
];

export function mapBoardColumnKeyToCanonicalStage(
  key: BoardColumnKey | string | null | undefined
): CanonicalJobStage | null {
  switch (key) {
    case "estimate":
      return "intake";
    case "leads":
      return "proposal";
    case "approved":
      return "approved";
    case "scheduled":
      return "scheduled";
    case "in_progress":
      return "production";
    case "paid":
      return "complete";
    default:
      return null;
  }
}

export function pointerDeltaIsDrag(
  dx: number,
  dy: number,
  threshold = BOARD_DRAG_THRESHOLD_PX
): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

export function isBoardCardLifecycleActionTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "[data-board-schedule-job], [data-board-start-work], [data-board-complete-job], [data-board-approve-job], [data-board-list-start-work], [data-board-list-complete-job], [data-board-list-approve-job], [data-board-list-schedule-job]"
    )
  );
}

export function hitTestBoardColumnKey(
  clientX: number,
  clientY: number
): BoardColumnKey | null {
  if (typeof document === "undefined") return null;
  const node = document.elementFromPoint(clientX, clientY);
  const attr = node
    ?.closest("[data-jobs-board-column]")
    ?.getAttribute("data-jobs-board-column");
  if (
    attr === "estimate" ||
    attr === "leads" ||
    attr === "approved" ||
    attr === "scheduled" ||
    attr === "in_progress" ||
    attr === "paid" ||
    attr === "deposit_paid"
  ) {
    return attr;
  }
  return null;
}

export function findApproveJobAcceptanceItem(
  items: readonly JobAttentionSafeItem[]
): JobAttentionSafeItem | null {
  return (
    items.find(
      (item) =>
        item.attentionType === "acceptance_confirmation_required" &&
        item.acceptance?.attentionAction === "approve_job" &&
        isUuidLike(item.acceptance.acceptanceId)
    ) ?? null
  );
}

export function approvalPendingFromAttentionType(
  primaryType: string | null | undefined
): boolean {
  return primaryType === "acceptance_confirmation_required";
}

export function buildBoardProposalCreateHref(jobId: string): string {
  const params = new URLSearchParams({
    entry: "job-card",
    job: jobId,
    from: "board",
    tab: "proposals",
  });
  return `/tools/roofing?${params.toString()}`;
}

export function movementRejectMessage(
  reason: BoardMovementRejectReason
): string {
  switch (reason) {
    case "disposition":
      return BOARD_MOVEMENT_REACTIVATE_COPY;
    case "missing_acceptance":
      return BOARD_MOVEMENT_ACCEPTANCE_REQUIRED_COPY;
    case "missing_schedule":
      return BOARD_MOVEMENT_MISSING_SCHEDULE_COPY;
    case "terminal":
      return BOARD_MOVEMENT_TERMINAL_COPY;
    case "unknown_target":
      return BOARD_MOVEMENT_UNKNOWN_TARGET_COPY;
    case "same_lane":
      return "";
    case "blocked":
    default:
      return BOARD_MOVEMENT_BLOCKED_COPY;
  }
}

export function resolveBoardGuardedMovement(
  input: BoardGuardedMovementInput
): BoardMovementResolution {
  const { fromStage, toStage, dispositionActive } = input;

  if (!toStage) {
    return {
      allowed: false,
      reason: "unknown_target",
      message: movementRejectMessage("unknown_target"),
    };
  }

  if (fromStage === toStage) {
    return { allowed: false, reason: "same_lane", message: "" };
  }

  if (fromStage === "complete") {
    return {
      allowed: false,
      reason: "terminal",
      message: movementRejectMessage("terminal"),
    };
  }

  if (!dispositionActive) {
    return {
      allowed: false,
      reason: "disposition",
      message: movementRejectMessage("disposition"),
    };
  }

  if (fromStage === "scheduled" && toStage === "approved") {
    if (!input.hasActivePlannedSchedule) {
      return {
        allowed: false,
        reason: "missing_schedule",
        message: movementRejectMessage("missing_schedule"),
      };
    }
    return { allowed: true, intent: { kind: "unschedule" } };
  }

  const forward = ALLOWED_FORWARD.find(
    ([from, to]) => from === fromStage && to === toStage
  );
  if (!forward) {
    return {
      allowed: false,
      reason: "blocked",
      message: movementRejectMessage("blocked"),
    };
  }

  const kind = forward[2];

  if (kind === "approve_job" && !input.canApproveJob) {
    return {
      allowed: false,
      reason: "missing_acceptance",
      message: movementRejectMessage("missing_acceptance"),
    };
  }

  if (
    (kind === "start_work" || kind === "complete_job") &&
    !input.hasActivePlannedSchedule
  ) {
    return {
      allowed: false,
      reason: "missing_schedule",
      message: movementRejectMessage("missing_schedule"),
    };
  }

  return { allowed: true, intent: { kind } };
}

export function boardDropTargetValidity(
  input: BoardGuardedMovementInput
): "valid" | "invalid" | "none" {
  const resolution = resolveBoardGuardedMovement(input);
  if (!resolution.allowed) {
    return resolution.reason === "same_lane" ? "none" : "invalid";
  }
  return "valid";
}
