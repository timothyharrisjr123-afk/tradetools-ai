import type { CatalogItem, CatalogItemType, CustomerVisibility, PricingBasis } from "@/app/lib/catalogTypes";
import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import type { CatalogUnit, QuantitySource } from "@/app/lib/catalogTypes";

export const STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

const STARTER_SEED_KEYS: readonly string[] = DEFAULT_ROOFING_CATALOG_DEFINITIONS.map(
  (definition) => definition.metadata.seed_key
);

export type CatalogItemEditDraft = {
  customer_name: string;
  description: string;
  unit_price_dollars: string;
  unit_cost_dollars: string;
  labor_unit_cost_dollars: string;
  pricing_basis: PricingBasis;
  customer_visibility: CustomerVisibility;
  sort_order: string;
  /** Empty string = null (1:1 / no conversion). */
  coverage_rate: string;
  waste_applies: boolean;
  /** Empty string = null (no item waste). Inactive when waste_applies is false. */
  waste_pct: string;
};

export type AddCatalogItemForm = {
  name: string;
  item_type: CatalogItemType;
  unit: CatalogUnit;
  quantity_source: QuantitySource;
  customer_name: string;
  description: string;
  unit_price_dollars: string;
  unit_cost_dollars: string;
  pricing_basis: PricingBasis;
  customer_visibility: CustomerVisibility;
  coverage_rate: string;
  waste_applies: boolean;
  waste_pct: string;
};

export const EMPTY_ADD_CATALOG_FORM: AddCatalogItemForm = {
  name: "",
  item_type: "material",
  unit: "each",
  quantity_source: "fixed",
  customer_name: "",
  description: "",
  unit_price_dollars: "",
  unit_cost_dollars: "",
  pricing_basis: "unit_price",
  customer_visibility: "customer_visible",
  coverage_rate: "",
  waste_applies: false,
  waste_pct: "",
};

export function extractSeedKey(metadata: Record<string, unknown> | null | undefined): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = metadata.seed_key;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasAllStarterSeedKeys(items: CatalogItem[]): boolean {
  const existing = new Set<string>();
  for (const item of items) {
    const key = extractSeedKey(item.metadata ?? null);
    if (key) existing.add(key);
  }
  return STARTER_SEED_KEYS.every((key) => existing.has(key));
}

export function formatCents(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unpriced";
  return `$${(value / 100).toFixed(2)}`;
}

export function isUnpricedCents(value: number | null | undefined): boolean {
  return value == null || !Number.isFinite(value);
}

export function formatCentsForInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return (value / 100).toFixed(2);
}

export function parseDollarsToCentsOrNull(
  value: string,
  fieldLabel: string
): { cents: number | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { cents: null, error: null };
  const normalized = trimmed.replace(/,/g, "");
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return { cents: null, error: `${fieldLabel} must be a valid number.` };
  }
  if (parsed < 0) {
    return { cents: null, error: `${fieldLabel} cannot be negative.` };
  }
  return { cents: Math.round(parsed * 100), error: null };
}

export function parseSortOrderOrNull(value: string): { sort_order: number | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { sort_order: null, error: null };
  if (!/^-?\d+$/.test(trimmed)) {
    return { sort_order: null, error: "Sort order must be a whole number." };
  }
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return { sort_order: null, error: "Sort order must be a whole number." };
  }
  return { sort_order: parsed, error: null };
}

/** Empty/null = 1:1 coverage. Valid values must be > 0. */
export function parseCoverageRateOrNull(
  value: string
): { value: number | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };
  const normalized = trimmed.replace(/,/g, "");
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: "Coverage must be a valid number." };
  }
  if (parsed <= 0) {
    return { value: null, error: "Coverage must be greater than 0." };
  }
  return { value: parsed, error: null };
}

/** Empty/null = no item waste. Valid values must be >= 0. */
export function parseWastePctOrNull(
  value: string
): { value: number | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };
  const normalized = trimmed.replace(/,/g, "");
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: "Waste must be a valid number." };
  }
  if (parsed < 0) {
    return { value: null, error: "Waste cannot be negative." };
  }
  return { value: parsed, error: null };
}

export function formatNullableNumberForInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

export type CatalogQuantityDriversParsed = {
  coverage_rate: number | null;
  waste_applies: boolean;
  waste_pct: number | null;
  error: string | null;
};

/**
 * Parse Coverage / Waste form fields for Catalog create/update.
 * When waste_applies is false, waste_pct is still validated if present so bad
 * values cannot be saved, but raw mode ignores it until waste applies.
 */
export function parseCatalogQuantityDrivers(input: {
  coverage_rate: string;
  waste_applies: boolean;
  waste_pct: string;
}): CatalogQuantityDriversParsed {
  const coverage = parseCoverageRateOrNull(input.coverage_rate);
  if (coverage.error) {
    return {
      coverage_rate: null,
      waste_applies: input.waste_applies,
      waste_pct: null,
      error: coverage.error,
    };
  }
  const waste = parseWastePctOrNull(input.waste_pct);
  if (waste.error) {
    return {
      coverage_rate: coverage.value,
      waste_applies: input.waste_applies,
      waste_pct: null,
      error: waste.error,
    };
  }
  return {
    coverage_rate: coverage.value,
    waste_applies: input.waste_applies,
    waste_pct: waste.value,
    error: null,
  };
}

/** Compact table secondary line — omit when both drivers are unset/off. */
export function formatCatalogQuantityDriversLine(
  item: Pick<CatalogItem, "coverage_rate" | "waste_applies" | "waste_pct">
): string | null {
  const parts: string[] = [];
  if (item.coverage_rate != null && Number.isFinite(item.coverage_rate)) {
    parts.push(`Coverage ${item.coverage_rate}`);
  }
  if (item.waste_applies) {
    if (item.waste_pct != null && Number.isFinite(item.waste_pct)) {
      parts.push(`Waste ${item.waste_pct}%`);
    } else {
      parts.push("Waste on");
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildEditDraftFromItem(item: CatalogItem): CatalogItemEditDraft {
  return {
    customer_name: item.customer_name?.trim() ?? "",
    description: item.description?.trim() ?? "",
    unit_price_dollars: formatCentsForInput(item.unit_price_cents),
    unit_cost_dollars: formatCentsForInput(item.unit_cost_cents),
    labor_unit_cost_dollars: formatCentsForInput(item.labor_unit_cost_cents),
    pricing_basis: item.pricing_basis,
    customer_visibility: item.customer_visibility,
    sort_order: item.sort_order != null ? String(item.sort_order) : "",
    coverage_rate: formatNullableNumberForInput(item.coverage_rate),
    waste_applies: Boolean(item.waste_applies),
    waste_pct: formatNullableNumberForInput(item.waste_pct),
  };
}

export function isCatalogItemUnpriced(item: CatalogItem): boolean {
  return isUnpricedCents(item.unit_price_cents);
}

export function catalogItemSearchHaystack(item: CatalogItem): string {
  const seedKey = extractSeedKey(item.metadata ?? null) ?? "";
  return [
    item.name,
    item.customer_name ?? "",
    item.description ?? "",
    seedKey,
    item.item_type,
    catalogItemTypeLabel(item.item_type),
    item.unit,
    catalogUnitLabel(item.unit),
    item.quantity_source,
    quantitySourceLabel(item.quantity_source),
  ]
    .join(" ")
    .toLowerCase();
}

export function compareCatalogItemsForDisplay(a: CatalogItem, b: CatalogItem): number {
  const orderA = a.sort_order;
  const orderB = b.sort_order;
  if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
  if (orderA != null && orderB == null) return -1;
  if (orderA == null && orderB != null) return 1;
  return a.name.localeCompare(b.name);
}
