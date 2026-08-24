/**
 * Job Card refresh ownership — discard stale Job A results after navigating to Job B.
 */

import { matchingServerJobRecord } from "@/app/lib/jobCardServerSeed";
import type { JobRecord } from "@/app/lib/jobTypes";

export function shouldApplyJobCardRefreshResult(input: {
  requestedJobId: string;
  currentJobId: string | null | undefined;
  currentCompanyId: string | null | undefined;
  refreshGeneration: number;
  currentGeneration: number;
  record: JobRecord | null | undefined;
}): boolean {
  if (input.refreshGeneration !== input.currentGeneration) return false;
  const requested = String(input.requestedJobId ?? "").trim();
  const current = String(input.currentJobId ?? "").trim();
  if (!requested || requested !== current) return false;
  return (
    matchingServerJobRecord(
      input.record,
      current,
      input.currentCompanyId
    ) != null
  );
}
