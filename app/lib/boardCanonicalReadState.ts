/**
 * Canonical Jobs Board read status — loading / ready / error.
 * Failed reads must not be rendered as an empty company.
 */

export type BoardCanonicalJobsReadStatus = "loading" | "ready" | "error";

export type BoardCanonicalJobsSnapshot<T> = {
  jobs: T[];
  status: BoardCanonicalJobsReadStatus;
  refreshError: boolean;
  everSucceeded: boolean;
};

export function createInitialBoardCanonicalJobsSnapshot<T>(): BoardCanonicalJobsSnapshot<T> {
  return {
    jobs: [],
    status: "loading",
    refreshError: false,
    everSucceeded: false,
  };
}

export function applyBoardCanonicalJobsSuccess<T>(
  _previous: BoardCanonicalJobsSnapshot<T>,
  jobs: T[]
): BoardCanonicalJobsSnapshot<T> {
  return {
    jobs,
    status: "ready",
    refreshError: false,
    everSucceeded: true,
  };
}

/** First-load failure: error, no fabricated empty company. Refresh failure: keep last-good. */
export function applyBoardCanonicalJobsFailure<T>(
  previous: BoardCanonicalJobsSnapshot<T>
): BoardCanonicalJobsSnapshot<T> {
  if (previous.everSucceeded) {
    return {
      jobs: previous.jobs,
      status: "ready",
      refreshError: true,
      everSucceeded: true,
    };
  }
  return {
    jobs: previous.jobs,
    status: "error",
    refreshError: false,
    everSucceeded: false,
  };
}

export function isBoardCanonicalJobsLoaded(
  snapshot: BoardCanonicalJobsSnapshot<unknown>
): boolean {
  return snapshot.status === "ready" || snapshot.status === "error";
}

/** True empty company — only after a successful read with zero jobs. */
export function isBoardEmptyCompanyState(
  snapshot: BoardCanonicalJobsSnapshot<unknown>
): boolean {
  return snapshot.status === "ready" && snapshot.jobs.length === 0;
}

export function boardCanonicalLifecycleActionsEnabled(
  snapshot: BoardCanonicalJobsSnapshot<unknown>
): boolean {
  return snapshot.status === "ready";
}
