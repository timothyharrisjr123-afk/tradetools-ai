/**
 * Catalog table column visibility — client prefs only.
 * Required columns cannot be hidden. Optional columns toggle via Columns menu.
 * No DB-backed preferences in this block.
 */

export const CATALOG_COLUMN_PREFS_STORAGE_KEY =
  "fielddive.catalog.columnVisibility.v1" as const;

/** Always visible — not toggleable. */
export const CATALOG_REQUIRED_COLUMN_IDS = ["select", "name", "actions"] as const;

export type CatalogRequiredColumnId = (typeof CATALOG_REQUIRED_COLUMN_IDS)[number];

/** Toggleable table columns (Coverage/Waste/Tax stay on name detail / edit panel). */
export const CATALOG_OPTIONAL_COLUMNS = [
  { id: "type", label: "Type", defaultVisible: true },
  { id: "measurement", label: "Measurement", defaultVisible: true },
  { id: "unit", label: "Unit", defaultVisible: true },
  { id: "unit_cost", label: "Unit cost", defaultVisible: true },
  { id: "unit_price", label: "Unit price", defaultVisible: true },
  { id: "proposal", label: "Proposal", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
] as const;

export type CatalogOptionalColumnId = (typeof CATALOG_OPTIONAL_COLUMNS)[number]["id"];

export type CatalogOptionalColumnVisibility = Record<CatalogOptionalColumnId, boolean>;

export function defaultCatalogOptionalColumnVisibility(): CatalogOptionalColumnVisibility {
  const out = {} as CatalogOptionalColumnVisibility;
  for (const col of CATALOG_OPTIONAL_COLUMNS) {
    out[col.id] = col.defaultVisible;
  }
  return out;
}

export function isCatalogOptionalColumnId(value: unknown): value is CatalogOptionalColumnId {
  return (
    typeof value === "string" &&
    CATALOG_OPTIONAL_COLUMNS.some((col) => col.id === value)
  );
}

/**
 * Merge stored prefs with defaults. Unknown keys ignored. Missing keys use default.
 * Required columns are never represented here (always shown).
 */
export function normalizeCatalogOptionalColumnVisibility(
  candidate: unknown
): CatalogOptionalColumnVisibility {
  const defaults = defaultCatalogOptionalColumnVisibility();
  if (candidate == null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return defaults;
  }
  const raw = candidate as Record<string, unknown>;
  const out = { ...defaults };
  for (const col of CATALOG_OPTIONAL_COLUMNS) {
    const value = raw[col.id];
    if (typeof value === "boolean") {
      out[col.id] = value;
    }
  }
  return out;
}

export function parseCatalogOptionalColumnVisibilityJson(
  raw: string | null | undefined
): CatalogOptionalColumnVisibility {
  if (raw == null || !raw.trim()) {
    return defaultCatalogOptionalColumnVisibility();
  }
  try {
    return normalizeCatalogOptionalColumnVisibility(JSON.parse(raw));
  } catch {
    return defaultCatalogOptionalColumnVisibility();
  }
}

export function serializeCatalogOptionalColumnVisibility(
  visibility: CatalogOptionalColumnVisibility
): string {
  return JSON.stringify(normalizeCatalogOptionalColumnVisibility(visibility));
}

export function isCatalogOptionalColumnVisible(
  visibility: CatalogOptionalColumnVisibility,
  columnId: CatalogOptionalColumnId
): boolean {
  return visibility[columnId] !== false;
}

/** Count currently visible optional columns (for min-width tuning). */
export function countVisibleOptionalCatalogColumns(
  visibility: CatalogOptionalColumnVisibility
): number {
  let n = 0;
  for (const col of CATALOG_OPTIONAL_COLUMNS) {
    if (isCatalogOptionalColumnVisible(visibility, col.id)) n += 1;
  }
  return n;
}
