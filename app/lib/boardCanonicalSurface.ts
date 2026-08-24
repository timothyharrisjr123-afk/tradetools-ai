/**
 * Canonical Jobs Board surface ownership vs legacy estimate-lane navigation.
 * Column headers stay on the canonical board; they must not open SavedEstimateCard.
 */

import {
  JOBS_BOARD_COLUMNS,
  type BoardColumnKey,
} from "@/app/tools/roofing/saved/jobsBoardUtils";

export const CANONICAL_BOARD_STATUS_FILTER = "all" as const;

export const CANONICAL_LIFECYCLE_HEADER_FILTERS = [
  "approved",
  "scheduled",
  "in_progress",
  "paid",
] as const;

export type CanonicalLifecycleHeaderFilter =
  (typeof CANONICAL_LIFECYCLE_HEADER_FILTERS)[number];

export function isCanonicalJobsBoardSurface(statusFilter: string): boolean {
  return statusFilter === CANONICAL_BOARD_STATUS_FILTER;
}

export function isLegacyEstimateLaneSurface(statusFilter: string): boolean {
  return statusFilter !== CANONICAL_BOARD_STATUS_FILTER;
}

export function boardColumnKeyFromListFilter(
  listFilter: string | null | undefined
): BoardColumnKey | null {
  const key = String(listFilter ?? "").trim();
  if (!key) return null;
  const column = JOBS_BOARD_COLUMNS.find((entry) => entry.listFilter === key);
  return column?.key ?? null;
}

/**
 * Returning from Job Card / restoring session must not divert canonical
 * lifecycle filters into the legacy dark lane.
 */
export function restoreCanonicalBoardFromReturnStatus(savedStatus: string | null): {
  statusFilter: typeof CANONICAL_BOARD_STATUS_FILTER;
  focusedColumnKey: BoardColumnKey | null;
} {
  if (!savedStatus || savedStatus === CANONICAL_BOARD_STATUS_FILTER) {
    return { statusFilter: CANONICAL_BOARD_STATUS_FILTER, focusedColumnKey: null };
  }
  return {
    statusFilter: CANONICAL_BOARD_STATUS_FILTER,
    focusedColumnKey: boardColumnKeyFromListFilter(savedStatus),
  };
}

export function canonicalJobsForFocusedColumn<T>(
  columnJobs: T[],
  focusedColumnKey: BoardColumnKey | null,
  columnKey: BoardColumnKey
): T[] {
  if (!focusedColumnKey || focusedColumnKey === columnKey) return columnJobs;
  return [];
}
