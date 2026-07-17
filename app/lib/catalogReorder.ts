/**
 * Catalog display reorder — pure helpers + sequential apply via store adapters.
 * Persists catalog_items.sort_order only. Does not affect pricing or customer output.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";

/** Matches starter-catalog stride (10, 20, …) for readable gaps. */
export const CATALOG_SORT_ORDER_STRIDE = 10;

export type CatalogReorderDirection = "up" | "down" | "top" | "bottom";

export type CatalogReorderApplyResult = {
  ok: boolean;
  attemptedCount: number;
  successCount: number;
  failedCount: number;
  errors: string[];
};

export type CatalogReorderStoreAdapter = {
  updateSortOrder: (
    id: string,
    sortOrder: number,
    options: { companyId: string }
  ) => Promise<CatalogItem | null>;
};

/**
 * Reorder is available only with a full unfiltered catalog list
 * (no search, no type filter). Custom column sorts are not supported.
 */
export function isCatalogReorderAvailable(options: {
  searchQuery: string;
  itemTypeFilter: string;
}): boolean {
  return options.searchQuery.trim() === "" && options.itemTypeFilter === "all";
}

export const CATALOG_REORDER_UNAVAILABLE_COPY =
  "Clear search and type filters to reorder the full Catalog. Reorder is unavailable while filters are active." as const;

export const CATALOG_REORDER_HELPER_COPY =
  "Reorder changes the Catalog display order only. It does not change pricing, proposals, or customer documents." as const;

/** Move one id within an ordered id list. Returns a new array (no mutation). */
export function moveCatalogItemInOrder(
  orderedIds: readonly string[],
  itemId: string,
  direction: CatalogReorderDirection
): string[] {
  const index = orderedIds.indexOf(itemId);
  if (index < 0) return [...orderedIds];
  const next = [...orderedIds];
  if (direction === "up") {
    if (index === 0) return next;
    const tmp = next[index - 1]!;
    next[index - 1] = next[index]!;
    next[index] = tmp;
    return next;
  }
  if (direction === "down") {
    if (index >= next.length - 1) return next;
    const tmp = next[index + 1]!;
    next[index + 1] = next[index]!;
    next[index] = tmp;
    return next;
  }
  if (direction === "top") {
    if (index === 0) return next;
    const [item] = next.splice(index, 1);
    next.unshift(item!);
    return next;
  }
  // bottom
  if (index >= next.length - 1) return next;
  const [item] = next.splice(index, 1);
  next.push(item!);
  return next;
}

/** Assign sequential sort_order values (stride) from an ordered id list. */
export function buildCatalogSortOrderAssignments(
  orderedIds: readonly string[],
  stride: number = CATALOG_SORT_ORDER_STRIDE
): Array<{ id: string; sort_order: number }> {
  const step = Number.isFinite(stride) && stride > 0 ? Math.floor(stride) : CATALOG_SORT_ORDER_STRIDE;
  return orderedIds.map((id, index) => ({
    id,
    sort_order: (index + 1) * step,
  }));
}

/**
 * Only emit patches where persisted sort_order differs from the target.
 * Keeps write volume small when cancel/no-op saves are avoided at the UI layer.
 */
export function diffCatalogSortOrderAssignments(
  orderedIds: readonly string[],
  currentById: ReadonlyMap<string, number | null | undefined>,
  stride: number = CATALOG_SORT_ORDER_STRIDE
): Array<{ id: string; sort_order: number }> {
  return buildCatalogSortOrderAssignments(orderedIds, stride).filter((row) => {
    const current = currentById.get(row.id);
    return current !== row.sort_order;
  });
}

export function catalogReorderOrderChanged(
  originalIds: readonly string[],
  pendingIds: readonly string[]
): boolean {
  if (originalIds.length !== pendingIds.length) return true;
  for (let i = 0; i < originalIds.length; i++) {
    if (originalIds[i] !== pendingIds[i]) return true;
  }
  return false;
}

/**
 * Persist sort_order for the given ordered ids sequentially.
 * Stops on first failure and reports partial progress clearly.
 */
export async function applyCatalogSortOrder(options: {
  companyId: string;
  orderedIds: readonly string[];
  currentById: ReadonlyMap<string, number | null | undefined>;
  adapters: CatalogReorderStoreAdapter;
  stride?: number;
}): Promise<CatalogReorderApplyResult> {
  const { companyId, orderedIds, currentById, adapters, stride } = options;
  if (orderedIds.length === 0) {
    return {
      ok: false,
      attemptedCount: 0,
      successCount: 0,
      failedCount: 0,
      errors: ["No catalog items to reorder."],
    };
  }

  const patches = diffCatalogSortOrderAssignments(orderedIds, currentById, stride);
  if (patches.length === 0) {
    return {
      ok: true,
      attemptedCount: 0,
      successCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  let successCount = 0;
  for (const patch of patches) {
    const updated = await adapters.updateSortOrder(patch.id, patch.sort_order, {
      companyId,
    });
    if (!updated) {
      return {
        ok: false,
        attemptedCount: patches.length,
        successCount,
        failedCount: 1,
        errors: [`Could not update catalog order for item ${patch.id}.`],
      };
    }
    successCount++;
  }

  return {
    ok: true,
    attemptedCount: patches.length,
    successCount,
    failedCount: 0,
    errors: [],
  };
}

export function formatCatalogReorderResultMessage(
  result: CatalogReorderApplyResult
): string {
  if (result.ok) {
    if (result.successCount === 0) {
      return "Catalog order unchanged.";
    }
    return `Catalog order saved: updated ${result.successCount} item${result.successCount === 1 ? "" : "s"}.`;
  }
  if (result.successCount > 0) {
    return `Catalog reorder stopped after ${result.successCount} success${result.successCount === 1 ? "" : "es"} and ${result.failedCount} failure. ${result.errors.join(" ")} Reload Catalog before retrying.`;
  }
  return result.errors[0]
    ? `Catalog reorder failed. ${result.errors[0]}`
    : "Catalog reorder failed.";
}
