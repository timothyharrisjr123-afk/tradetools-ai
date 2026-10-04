/**
 * Astra G8 — disposition capability mapping (bounded; not a general ACL).
 *
 * Writers remain change_job_disposition_v1. This module only decides which
 * canonical capability gates a from→to transition at the API boundary.
 */

import {
  resolveOperationalDisposition,
  type DispositionManagementTarget,
} from "@/app/lib/jobDispositionManagement";
import type { OperationalJobDisposition } from "@/app/lib/jobLifecycleTypes";
import type { ActiveCapabilityKey } from "@/app/lib/access/registry";

/**
 * Null / unknown disposition is active-equivalent for capability decisions
 * (matches R3I isActiveJobDisposition null→active).
 */
export function dispositionForCapabilityGate(
  value: string | null | undefined
): OperationalJobDisposition {
  return resolveOperationalDisposition(value) ?? "active";
}

export type DispositionCapability = Extract<ActiveCapabilityKey, "jobs.hold" | "jobs.finalize">;

/**
 * Capability required for a disposition mutation. Mirrors the database gate in
 * change_job_disposition_v1, which re-checks it under the Job row lock.
 * - jobs.hold: active ↔ on_hold (including same-target idempotent)
 * - jobs.finalize: any transition into or out of lost/closed
 */
export function capabilityForDispositionTransition(
  fromStatus: string | null | undefined,
  toStatus: DispositionManagementTarget | OperationalJobDisposition
): DispositionCapability {
  const from = dispositionForCapabilityGate(fromStatus);
  const to = toStatus;

  if (to === "lost" || to === "closed" || from === "lost" || from === "closed") {
    return "jobs.finalize";
  }
  return "jobs.hold";
}

export type DispositionTransitionDenial =
  | "lost_is_terminal"
  | "complete_cannot_be_lost"
  | "lost_reason_required";

/**
 * Transition rules enforced by change_job_disposition_v1 (same order; same-target
 * replays are idempotent and never denied here).
 */
export function dispositionTransitionDenial(input: {
  fromStatus: string | null | undefined;
  toStatus: DispositionManagementTarget | OperationalJobDisposition;
  stage: string | null | undefined;
  reason: string | null | undefined;
}): DispositionTransitionDenial | null {
  const from = dispositionForCapabilityGate(input.fromStatus);
  if (from === input.toStatus) return null;
  if (from === "lost") return "lost_is_terminal";
  if (input.toStatus === "lost") {
    if (String(input.stage ?? "").trim().toLowerCase() === "complete") {
      return "complete_cannot_be_lost";
    }
    if (!String(input.reason ?? "").trim()) return "lost_reason_required";
  }
  return null;
}

export function dispositionActionNeedsCapability(
  kind: "hold" | "lost" | "close" | "resume" | "reopen",
  capabilities: {
    pauseResume: boolean;
    finalize: boolean;
  }
): boolean {
  if (kind === "hold" || kind === "resume") {
    return capabilities.pauseResume;
  }
  return capabilities.finalize;
}
