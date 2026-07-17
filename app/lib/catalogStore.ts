/**
 * FieldDive Catalog Store — client-side data layer for public.catalog_items.
 *
 * Company-scoped CRUD for reusable catalog / price-book line items.
 * No pricing math, payment, approval, send/PDF, proposal creation, or UI.
 *
 * Uses getSupabaseClient() with RLS (same pattern as jobStore / measurementStore).
 * Stage 3F3: foundation only — not wired from admin or RoofingClient yet.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import type {
  CatalogItem,
  CatalogItemDraft,
  CatalogItemSummary,
  CatalogItemType,
  CatalogUnit,
  CustomerVisibility,
  PricingBasis,
  QuantitySource,
} from "@/app/lib/catalogTypes";

// ---------------------------------------------------------------------------
// DB row shape (public.catalog_items)
// ---------------------------------------------------------------------------

export type JsonObject = Record<string, unknown>;

export type CatalogItemRow = {
  id: string;
  company_id: string;
  name: string;
  customer_name?: string | null;
  description?: string | null;
  item_type: string;
  unit: string;
  quantity_source: string;
  default_quantity?: number | null;
  coverage_rate?: number | null;
  waste_applies: boolean;
  /** Item waste percent (points; 10 = 10%). Used by policy-gated raw_plus_waste only. */
  waste_pct?: number | null;
  unit_cost_cents?: number | string | null;
  unit_price_cents?: number | string | null;
  labor_unit_cost_cents?: number | string | null;
  pricing_basis: string;
  customer_visibility: string;
  active: boolean;
  sort_order?: number | null;
  metadata?: JsonObject | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogItemInsertRow = Partial<CatalogItemRow>;
export type CatalogItemUpdateRow = Partial<CatalogItemRow>;

const CATALOG_ITEM_SELECT_COLUMNS =
  "id, company_id, name, customer_name, description, item_type, unit, quantity_source, default_quantity, coverage_rate, waste_applies, waste_pct, unit_cost_cents, unit_price_cents, labor_unit_cost_cents, pricing_basis, customer_visibility, active, sort_order, metadata, created_by, updated_by, created_at, updated_at";

/** Subset for future admin list queries (full row mapper supports summary today). */
export const CATALOG_ITEM_SUMMARY_SELECT_COLUMNS =
  "id, company_id, name, customer_name, item_type, unit, quantity_source, unit_cost_cents, unit_price_cents, pricing_basis, customer_visibility, active, sort_order";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export function normalizeNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function normalizeNullableBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return null;
}

export function normalizeNullableInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function compactObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

function normalizeJsonObject(value: unknown): JsonObject | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
}

function normalizeCompanyId(companyId: string): string | null {
  const id = normalizeNullableString(companyId);
  if (!id || !isUuidLike(id)) return null;
  return id;
}

// ---------------------------------------------------------------------------
// Row ↔ record mappers
// ---------------------------------------------------------------------------

export function rowToCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    customer_name: normalizeNullableString(row.customer_name),
    description: normalizeNullableString(row.description),
    item_type: row.item_type as CatalogItemType,
    unit: row.unit as CatalogUnit,
    quantity_source: row.quantity_source as QuantitySource,
    default_quantity: normalizeNullableNumber(row.default_quantity),
    coverage_rate: normalizeNullableNumber(row.coverage_rate),
    waste_applies: Boolean(row.waste_applies),
    waste_pct: normalizeNullableNumber(row.waste_pct),
    unit_cost_cents: normalizeNullableInteger(row.unit_cost_cents),
    unit_price_cents: normalizeNullableInteger(row.unit_price_cents),
    labor_unit_cost_cents: normalizeNullableInteger(row.labor_unit_cost_cents),
    pricing_basis: row.pricing_basis as PricingBasis,
    customer_visibility: row.customer_visibility as CustomerVisibility,
    active: Boolean(row.active),
    sort_order: normalizeNullableInteger(row.sort_order),
    metadata: normalizeJsonObject(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
  };
}

export function rowToCatalogItemSummary(row: CatalogItemRow): CatalogItemSummary {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    customer_name: normalizeNullableString(row.customer_name),
    item_type: row.item_type as CatalogItemType,
    unit: row.unit as CatalogUnit,
    quantity_source: row.quantity_source as QuantitySource,
    unit_cost_cents: normalizeNullableInteger(row.unit_cost_cents),
    unit_price_cents: normalizeNullableInteger(row.unit_price_cents),
    pricing_basis: row.pricing_basis as PricingBasis,
    customer_visibility: row.customer_visibility as CustomerVisibility,
    active: Boolean(row.active),
    sort_order: normalizeNullableInteger(row.sort_order),
  };
}

function draftToRowFields(
  draft: CatalogItemDraft | Partial<CatalogItemDraft>,
  mode: "insert" | "update"
): CatalogItemInsertRow {
  const row: CatalogItemInsertRow = {
    company_id: mode === "insert" ? draft.company_id : undefined,
    name:
      draft.name !== undefined ? normalizeNullableString(draft.name) ?? undefined : undefined,
    customer_name:
      draft.customer_name !== undefined
        ? normalizeNullableString(draft.customer_name)
        : undefined,
    description:
      draft.description !== undefined
        ? normalizeNullableString(draft.description)
        : undefined,
    item_type: draft.item_type,
    unit: draft.unit,
    quantity_source: draft.quantity_source,
    default_quantity:
      draft.default_quantity !== undefined
        ? normalizeNullableNumber(draft.default_quantity)
        : undefined,
    coverage_rate:
      draft.coverage_rate !== undefined
        ? normalizeNullableNumber(draft.coverage_rate)
        : undefined,
    waste_applies:
      draft.waste_applies !== undefined
        ? Boolean(draft.waste_applies)
        : mode === "insert"
          ? false
          : undefined,
    waste_pct:
      draft.waste_pct !== undefined
        ? normalizeNullableNumber(draft.waste_pct)
        : undefined,
    unit_cost_cents:
      draft.unit_cost_cents !== undefined
        ? normalizeNullableInteger(draft.unit_cost_cents)
        : undefined,
    unit_price_cents:
      draft.unit_price_cents !== undefined
        ? normalizeNullableInteger(draft.unit_price_cents)
        : undefined,
    labor_unit_cost_cents:
      draft.labor_unit_cost_cents !== undefined
        ? normalizeNullableInteger(draft.labor_unit_cost_cents)
        : undefined,
    pricing_basis: draft.pricing_basis ?? (mode === "insert" ? "unit_price" : undefined),
    customer_visibility:
      draft.customer_visibility ?? (mode === "insert" ? "customer_visible" : undefined),
    active: draft.active ?? (mode === "insert" ? true : undefined),
    sort_order:
      draft.sort_order !== undefined
        ? normalizeNullableInteger(draft.sort_order)
        : undefined,
    metadata: draft.metadata !== undefined ? (draft.metadata ?? null) : undefined,
  };

  return compactObject(row as Record<string, unknown>) as CatalogItemInsertRow;
}

export function catalogItemDraftToInsertRow(draft: CatalogItemDraft): CatalogItemInsertRow {
  return draftToRowFields(draft, "insert");
}

export function catalogItemPatchToUpdateRow(
  patch: Partial<CatalogItemDraft>
): CatalogItemUpdateRow {
  return draftToRowFields(patch, "update");
}

function applyCatalogListFilters<
  Q extends {
    eq: (column: string, value: unknown) => Q;
    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean }
    ) => Q;
  },
>(
  query: Q,
  options?: {
    activeOnly?: boolean;
    itemType?: CatalogItemType;
    quantitySource?: QuantitySource;
  }
): Q {
  let q = query;
  if (options?.activeOnly) {
    q = q.eq("active", true);
  }
  if (options?.itemType) {
    q = q.eq("item_type", options.itemType);
  }
  if (options?.quantitySource) {
    q = q.eq("quantity_source", options.quantitySource);
  }
  return q
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
}

// ---------------------------------------------------------------------------
// Supabase reads
// ---------------------------------------------------------------------------

export async function getCatalogItemById(
  id: string,
  options?: { companyId?: string }
): Promise<CatalogItem | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[catalogStore] getCatalogItemById: Supabase client unavailable");
    return null;
  }
  const itemId = String(id || "").trim();
  if (!isUuidLike(itemId)) {
    console.error("[catalogStore] getCatalogItemById: invalid catalog item id");
    return null;
  }

  const companyId = options?.companyId
    ? normalizeCompanyId(options.companyId)
    : null;
  if (options?.companyId && !companyId) {
    console.error("[catalogStore] getCatalogItemById: invalid company id");
    return null;
  }

  try {
    let query = supabase
      .from("catalog_items")
      .select(CATALOG_ITEM_SELECT_COLUMNS)
      .eq("id", itemId);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("[catalogStore] getCatalogItemById failed:", error.message, {
        id: itemId,
        companyId: companyId ?? undefined,
      });
      return null;
    }
    if (!data) return null;
    return rowToCatalogItem(data as CatalogItemRow);
  } catch (err) {
    console.error("[catalogStore] getCatalogItemById error:", err);
    return null;
  }
}

export type CatalogItemsLoadResult =
  | { ok: true; items: CatalogItem[] }
  | { ok: false; error: string };

/**
 * Discriminated catalog list load — preserves success-empty vs failed-read.
 * Prefer this over array getters when empty-state / starter install depends on truth.
 */
export async function loadCatalogItemsByCompany(
  companyId: string,
  options?: {
    activeOnly?: boolean;
    itemType?: CatalogItemType;
    quantitySource?: QuantitySource;
  }
): Promise<CatalogItemsLoadResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[catalogStore] loadCatalogItemsByCompany: Supabase client unavailable");
    return { ok: false, error: "Catalog service is unavailable." };
  }
  const scopedCompanyId = normalizeCompanyId(companyId);
  if (!scopedCompanyId) {
    console.error("[catalogStore] loadCatalogItemsByCompany: invalid company id");
    return { ok: false, error: "Invalid company context for catalog load." };
  }

  try {
    let query = supabase
      .from("catalog_items")
      .select(CATALOG_ITEM_SELECT_COLUMNS)
      .eq("company_id", scopedCompanyId);

    query = applyCatalogListFilters(query, options);

    const { data, error } = await query;

    if (error) {
      console.error("[catalogStore] loadCatalogItemsByCompany failed:", error.message, {
        companyId: scopedCompanyId,
      });
      return { ok: false, error: "Could not load catalog items." };
    }
    const rows = (data ?? []) as CatalogItemRow[];
    return { ok: true, items: rows.map(rowToCatalogItem) };
  } catch (err) {
    console.error("[catalogStore] loadCatalogItemsByCompany error:", err);
    return { ok: false, error: "Could not load catalog items." };
  }
}

export async function getCatalogItemsByCompany(
  companyId: string,
  options?: {
    activeOnly?: boolean;
    itemType?: CatalogItemType;
    quantitySource?: QuantitySource;
  }
): Promise<CatalogItem[]> {
  const result = await loadCatalogItemsByCompany(companyId, options);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.items;
}

export async function getActiveCatalogItemsByCompany(
  companyId: string
): Promise<CatalogItem[]> {
  return getCatalogItemsByCompany(companyId, { activeOnly: true });
}

export async function loadActiveCatalogItemsByCompany(
  companyId: string
): Promise<CatalogItemsLoadResult> {
  return loadCatalogItemsByCompany(companyId, { activeOnly: true });
}

export async function getCatalogItemsByQuantitySource(
  companyId: string,
  quantitySource: QuantitySource,
  options?: { activeOnly?: boolean }
): Promise<CatalogItem[]> {
  return getCatalogItemsByCompany(companyId, {
    ...options,
    quantitySource,
  });
}

// ---------------------------------------------------------------------------
// Supabase writes
// ---------------------------------------------------------------------------

export async function createCatalogItem(
  draft: CatalogItemDraft
): Promise<CatalogItem | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[catalogStore] createCatalogItem: Supabase client unavailable");
    return null;
  }

  const companyId = normalizeCompanyId(draft.company_id);
  if (!companyId) {
    console.error("[catalogStore] createCatalogItem: company_id is required");
    return null;
  }

  const name = normalizeNullableString(draft.name);
  if (!name) {
    console.error("[catalogStore] createCatalogItem: name is required");
    return null;
  }

  if (!draft.item_type) {
    console.error("[catalogStore] createCatalogItem: item_type is required");
    return null;
  }
  if (!draft.unit) {
    console.error("[catalogStore] createCatalogItem: unit is required");
    return null;
  }
  if (!draft.quantity_source) {
    console.error("[catalogStore] createCatalogItem: quantity_source is required");
    return null;
  }

  const row = catalogItemDraftToInsertRow({
    ...draft,
    company_id: companyId,
    name,
  });

  try {
    const { data, error } = await supabase
      .from("catalog_items")
      .insert(row)
      .select(CATALOG_ITEM_SELECT_COLUMNS)
      .single();

    if (error) {
      console.error("[catalogStore] createCatalogItem failed:", error.message, {
        companyId,
      });
      return null;
    }
    if (!data) return null;
    return rowToCatalogItem(data as CatalogItemRow);
  } catch (err) {
    console.error("[catalogStore] createCatalogItem error:", err);
    return null;
  }
}

export async function updateCatalogItem(
  id: string,
  patch: Partial<CatalogItemDraft>,
  options?: { companyId?: string }
): Promise<CatalogItem | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("[catalogStore] updateCatalogItem: Supabase client unavailable");
    return null;
  }
  const itemId = String(id || "").trim();
  if (!isUuidLike(itemId)) {
    console.error("[catalogStore] updateCatalogItem: invalid catalog item id");
    return null;
  }

  const companyId = options?.companyId
    ? normalizeCompanyId(options.companyId)
    : null;
  if (options?.companyId && !companyId) {
    console.error("[catalogStore] updateCatalogItem: invalid company id");
    return null;
  }

  const row = catalogItemPatchToUpdateRow(patch);
  delete (row as { id?: string }).id;
  delete (row as { created_at?: string }).created_at;
  delete (row as { updated_at?: string }).updated_at;
  delete (row as { created_by?: string }).created_by;
  delete (row as { updated_by?: string }).updated_by;
  delete (row as { company_id?: string }).company_id;

  if (Object.keys(row).length === 0) {
    return getCatalogItemById(itemId, companyId ? { companyId } : undefined);
  }

  try {
    let query = supabase
      .from("catalog_items")
      .update(row)
      .eq("id", itemId);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.select(CATALOG_ITEM_SELECT_COLUMNS).single();

    if (error) {
      console.error("[catalogStore] updateCatalogItem failed:", error.message, {
        id: itemId,
        companyId: companyId ?? undefined,
      });
      return null;
    }
    if (!data) return null;
    return rowToCatalogItem(data as CatalogItemRow);
  } catch (err) {
    console.error("[catalogStore] updateCatalogItem error:", err);
    return null;
  }
}

export async function setCatalogItemActive(
  id: string,
  active: boolean,
  options?: { companyId?: string }
): Promise<CatalogItem | null> {
  return updateCatalogItem(id, { active: Boolean(active) }, options);
}
