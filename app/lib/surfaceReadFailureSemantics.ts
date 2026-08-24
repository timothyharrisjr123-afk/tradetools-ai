/**
 * Error-vs-empty semantics for secondary Job Card reads.
 *
 * Transport failure is not absence. Canonical/contractual truth must keep
 * last-known-good values when safe. Do not mint Attention or payments from error.
 */

export type AttentionDetailStatus =
  | "loading"
  | "ready-empty"
  | "ready-items"
  | "error";

export type AttentionDetailApplyResult<T> = {
  status: AttentionDetailStatus;
  items: T[];
  selectedAttentionId: string | null;
  error: string | null;
};

export function applyAttentionDetailFetchResult<T extends { id: string }>(input: {
  previousItems: readonly T[];
  previousSelectedId: string | null;
  result:
    | { ok: true; items: readonly T[]; selectedAttentionId: string | null }
    | { ok: false; error: string };
}): AttentionDetailApplyResult<T> {
  if (input.result.ok) {
    const items = [...input.result.items];
    return {
      status: items.length > 0 ? "ready-items" : "ready-empty",
      items,
      selectedAttentionId: input.result.selectedAttentionId,
      error: null,
    };
  }
  return {
    status: "error",
    items: [...input.previousItems],
    selectedAttentionId: input.previousSelectedId,
    error: input.result.error.trim() || "Attention could not be loaded.",
  };
}

export type EnrichmentReadStatus = "idle" | "loading" | "ready" | "error";

export function applyPaymentEnrichmentFailure<T>(input: {
  previousItems: readonly T[];
}): { status: "error"; items: T[] } {
  return { status: "error", items: [...input.previousItems] };
}

export function applyCustomerRequestFetchFailure<T>(input: {
  previousRequests: readonly T[];
  error: string;
}): { requests: T[]; error: string } {
  return {
    requests: [...input.previousRequests],
    error: input.error.trim() || "Customer requests could not be loaded.",
  };
}
