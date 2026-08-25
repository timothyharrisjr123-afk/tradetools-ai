export type ListedProposalReadStatus =
  | "idle"
  | "loading"
  | "ready_empty"
  | "ready_items"
  | "error";

export type ListedProposalApplyResult<T> = {
  status: ListedProposalReadStatus;
  items: T[];
  error: string | null;
};

/**
 * Proposal list transport failure must not fabricate "no proposals".
 * Keep last-known-good items when the failed read is for the same Job.
 */
export function applyListedProposalFetchResult<T>(input: {
  previousItems: readonly T[];
  previousStatus: ListedProposalReadStatus;
  result: { ok: true; items: readonly T[] } | { ok: false; error: string };
}): ListedProposalApplyResult<T> {
  if (input.result.ok) {
    const items = [...input.result.items];
    return {
      status: items.length > 0 ? "ready_items" : "ready_empty",
      items,
      error: null,
    };
  }
  return {
    status: "error",
    items: [...input.previousItems],
    error: input.result.error.trim() || "Proposals could not be loaded.",
  };
}

export function listedProposalShowsEmptyState(
  status: ListedProposalReadStatus,
  itemCount: number
): boolean {
  return status === "ready_empty" && itemCount === 0;
}

export function listedProposalShowsUnavailable(
  status: ListedProposalReadStatus,
  itemCount: number
): boolean {
  return status === "error" && itemCount === 0;
}
