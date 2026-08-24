/**
 * Job Card performance boundary: defer secondary hydration until core Job truth
 * is ready AND the canonical schedule read has settled for the current Job.
 *
 * Settlement is explicit state — never an elapsed-time timer.
 */

export type JobCardScheduleSettlement =
  | { status: "idle" }
  | { status: "loading"; jobId: string }
  | { status: "ready"; jobId: string }
  | { status: "error"; jobId: string }
  | { status: "not_applicable"; jobId: string };

export type JobCardJobHydrateStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable";

export function createIdleJobCardScheduleSettlement(): JobCardScheduleSettlement {
  return { status: "idle" };
}

export function beginJobCardScheduleSettlement(
  jobId: string
): JobCardScheduleSettlement {
  const id = String(jobId ?? "").trim();
  if (!id) return { status: "idle" };
  return { status: "loading", jobId: id };
}

export function settleJobCardScheduleSuccess(
  jobId: string
): JobCardScheduleSettlement {
  return { status: "ready", jobId: String(jobId).trim() };
}

export function settleJobCardScheduleError(
  jobId: string
): JobCardScheduleSettlement {
  return { status: "error", jobId: String(jobId).trim() };
}

export function settleJobCardScheduleNotApplicable(
  jobId: string
): JobCardScheduleSettlement {
  return { status: "not_applicable", jobId: String(jobId).trim() };
}

/** Keep a settled result for this job across background retries; otherwise load. */
export function preserveOrBeginJobCardScheduleSettlement(
  previous: JobCardScheduleSettlement,
  jobId: string
): JobCardScheduleSettlement {
  const id = String(jobId ?? "").trim();
  if (!id) return { status: "idle" };
  if (
    (previous.status === "ready" ||
      previous.status === "error" ||
      previous.status === "not_applicable") &&
    previous.jobId === id
  ) {
    return previous;
  }
  return { status: "loading", jobId: id };
}

export function isJobCardScheduleSettledForJob(
  settlement: JobCardScheduleSettlement,
  jobId: string | null | undefined
): boolean {
  const id = String(jobId ?? "").trim();
  if (!id) return false;
  return (
    (settlement.status === "ready" ||
      settlement.status === "error" ||
      settlement.status === "not_applicable") &&
    settlement.jobId === id
  );
}

/**
 * Secondary Job Card work may begin only when:
 * - not job-card mode (unchanged / immediate), or
 * - already enabled, or
 * - canonical Job is ready AND schedule read has settled for this Job
 *   (success, error, or not_applicable).
 *
 * Schedule error settlement must NOT be confused with Complete eligibility.
 * Complete still requires a truthful active planned work schedule.
 */
export function shouldEnableJobCardSecondaryEffects(input: {
  entryMode: string;
  jobHydrateStatus: JobCardJobHydrateStatus;
  currentJobId: string | null;
  scheduleSettlement: JobCardScheduleSettlement;
  secondaryEnabled: boolean;
}): boolean {
  if (input.entryMode !== "job-card") return true;
  if (input.secondaryEnabled) return true;
  const jobId = String(input.currentJobId ?? "").trim();
  if (!jobId) return false;
  if (input.jobHydrateStatus !== "ready") return false;
  return isJobCardScheduleSettledForJob(input.scheduleSettlement, jobId);
}
