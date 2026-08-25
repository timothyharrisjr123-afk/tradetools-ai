import type { JobCardScheduleSettlement } from "@/app/lib/jobCardPerfBoundary";
import {
  resolveJobCardActiveSchedule,
} from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

export type JobCardScheduleLoadStatus =
  | "loading"
  | "ready_with_schedule"
  | "ready_without_schedule"
  | "error";

export type JobCardScheduleDisplay = {
  active: JobSchedule | null;
  /** True only after a successful canonical read for this Job. */
  ready: boolean;
  loadStatus: JobCardScheduleLoadStatus;
  refreshError: boolean;
};

/**
 * Schedule display ownership.
 * Transport/read failure is never "Not scheduled".
 * Last-known-good rows are kept when a prior successful read exists.
 */
export function resolveJobCardScheduleDisplay(input: {
  jobId: string | null | undefined;
  rows: readonly JobSchedule[];
  loadedForJobId: string | null;
  settlement: JobCardScheduleSettlement;
}): JobCardScheduleDisplay {
  const jobId = String(input.jobId ?? "").trim();
  const settledError =
    input.settlement.status === "error" && input.settlement.jobId === jobId;
  const resolved = resolveJobCardActiveSchedule({
    jobId,
    rows: input.rows,
    loadedForJobId: input.loadedForJobId,
  });

  if (resolved.ready) {
    return {
      active: resolved.active,
      ready: true,
      loadStatus: resolved.active
        ? "ready_with_schedule"
        : "ready_without_schedule",
      refreshError: settledError,
    };
  }

  if (settledError) {
    return {
      active: null,
      ready: false,
      loadStatus: "error",
      refreshError: true,
    };
  }

  return {
    active: null,
    ready: false,
    loadStatus: "loading",
    refreshError: false,
  };
}

export function jobCardScheduleSectionCopy(display: JobCardScheduleDisplay): {
  showNotScheduled: boolean;
  showUnavailable: boolean;
  showLoading: boolean;
} {
  return {
    showUnavailable: display.loadStatus === "error",
    showNotScheduled: display.loadStatus === "ready_without_schedule",
    showLoading: display.loadStatus === "loading",
  };
}
