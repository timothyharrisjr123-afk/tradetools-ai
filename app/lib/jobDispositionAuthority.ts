/**
 * Astra G8 — disposition capability mapping (bounded; not a general ACL).
 *
 * Writers remain change_job_disposition_v1. This module only decides which
 * G7 capability gates a from→to transition at the API boundary.
 */

import type { CompanyCapability } from "@/app/lib/companyMembershipRoles";
import {
  resolveOperationalDisposition,
  type DispositionManagementTarget,
} from "@/app/lib/jobDispositionManagement";
import type { OperationalJobDisposition } from "@/app/lib/jobLifecycleTypes";

/**
 * Null / unknown disposition is active-equivalent for capability decisions
 * (matches R3I isActiveJobDisposition null→active).
 */
export function dispositionForCapabilityGate(
  value: string | null | undefined
): OperationalJobDisposition {
  return resolveOperationalDisposition(value) ?? "active";
}

/**
 * Capability required for a disposition mutation.
 * - job_pause_resume: active ↔ on_hold (including same-target idempotent)
 * - job_disposition_finalize: lost/closed targets and reopen from lost/closed
 */
export function capabilityForDispositionTransition(
  fromStatus: string | null | undefined,
  toStatus: DispositionManagementTarget | OperationalJobDisposition
): CompanyCapability {
  const from = dispositionForCapabilityGate(fromStatus);
  const to = toStatus;

  if (to === "on_hold") {
    return "job_pause_resume";
  }
  if (to === "active") {
    if (from === "on_hold" || from === "active") {
      return "job_pause_resume";
    }
    return "job_disposition_finalize";
  }
  // lost | closed
  return "job_disposition_finalize";
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
