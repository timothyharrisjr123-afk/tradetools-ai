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
 * Capability required for a disposition mutation.
 * - jobs.hold: active ↔ on_hold (including same-target idempotent)
 * - jobs.finalize: lost/closed targets and reopen from lost/closed
 */
export function capabilityForDispositionTransition(
  fromStatus: string | null | undefined,
  toStatus: DispositionManagementTarget | OperationalJobDisposition
): DispositionCapability {
  const from = dispositionForCapabilityGate(fromStatus);
  const to = toStatus;

  if (to === "on_hold") {
    return "jobs.hold";
  }
  if (to === "active") {
    if (from === "on_hold" || from === "active") {
      return "jobs.hold";
    }
    return "jobs.finalize";
  }
  // lost | closed
  return "jobs.finalize";
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
