/**
 * Catalog table row selection — pure helpers only.
 * Selection is by catalog item id, in-memory only (no DB / localStorage).
 */

export type CatalogSelectionHeaderState = "none" | "some" | "all";

export function toggleCatalogSelectionId(
  selectedIds: ReadonlySet<string>,
  id: string
): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Select or deselect every id in `visibleIds` while preserving other selections. */
export function setCatalogVisibleSelection(
  selectedIds: ReadonlySet<string>,
  visibleIds: readonly string[],
  selectAll: boolean
): Set<string> {
  const next = new Set(selectedIds);
  if (selectAll) {
    for (const id of visibleIds) next.add(id);
  } else {
    for (const id of visibleIds) next.delete(id);
  }
  return next;
}

/** Drop ids that are no longer present in the current item universe. */
export function pruneCatalogSelection(
  selectedIds: ReadonlySet<string>,
  existingIds: ReadonlySet<string> | readonly string[]
): Set<string> {
  const existing =
    existingIds instanceof Set ? existingIds : new Set(existingIds);
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (existing.has(id)) next.add(id);
  }
  return next;
}

export function catalogSelectionHeaderState(
  selectedIds: ReadonlySet<string>,
  visibleIds: readonly string[]
): CatalogSelectionHeaderState {
  if (visibleIds.length === 0) return "none";
  let selectedVisible = 0;
  for (const id of visibleIds) {
    if (selectedIds.has(id)) selectedVisible++;
  }
  if (selectedVisible === 0) return "none";
  if (selectedVisible === visibleIds.length) return "all";
  return "some";
}

export function countSelectedAmong(
  selectedIds: ReadonlySet<string>,
  candidateIds: readonly string[]
): number {
  let n = 0;
  for (const id of candidateIds) {
    if (selectedIds.has(id)) n++;
  }
  return n;
}

export function formatCatalogSelectedCount(count: number): string {
  if (count === 1) return "1 selected";
  return `${count} selected`;
}
