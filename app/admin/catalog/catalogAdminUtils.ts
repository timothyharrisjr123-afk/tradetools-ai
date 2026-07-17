import type {
  CatalogItem,
  CatalogItemDraft,
  CatalogItemType,
  CoverageBasis,
  CustomerVisibility,
  PricingBasis,
} from "@/app/lib/catalogTypes";
import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  coverageBasisLabel,
  isCoverageBasis,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import type { CatalogUnit, QuantitySource } from "@/app/lib/catalogTypes";
import {
  classifyCatalogCoverageCompatibility,
  type CatalogCoverageCompatibilityStatus,
} from "@/app/lib/catalogCoverageCompatibility";
import { CATALOG_CONTRACTOR_LABELS } from "@/app/lib/catalogContractorLabels";

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
  /** Empty string = null. Cleared automatically when coverage_rate is empty. */
  coverage_basis: "" | CoverageBasis;
  waste_applies: boolean;
  /** Empty string = null (no item waste). Inactive when waste_applies is false. */
  waste_pct: string;
  /** Empty string = null. Capture only — not applied to proposal totals yet. */
  sales_tax_rate_pct: string;
  /** Empty string = null. Internal only — never customer-facing. */
  purchase_tax_rate_pct: string;
  /** Empty string = null. Internal supplier SKU — no sync implied. */
  abc_sku: string;
  /** Empty string = null. Internal supplier SKU — no sync implied. */
  qxo_sku: string;
  /** Empty string = null. Internal supplier SKU — no sync implied. */
  srs_sku: string;
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
  coverage_basis: "" | CoverageBasis;
  waste_applies: boolean;
  waste_pct: string;
  sales_tax_rate_pct: string;
  purchase_tax_rate_pct: string;
  abc_sku: string;
  qxo_sku: string;
  srs_sku: string;
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
  coverage_basis: "",
  waste_applies: false,
  waste_pct: "",
  sales_tax_rate_pct: "",
  purchase_tax_rate_pct: "",
  abc_sku: "",
  qxo_sku: "",
  srs_sku: "",
};

/** Catalog item tax capture bound — matches company sales-tax isFinitePct (0..100). */
export const CATALOG_TAX_RATE_PCT_MAX = 100;

/** Matches DB CHECK char_length 1..128 on catalog_items.*_sku. */
export const CATALOG_SUPPLIER_SKU_MAX_LENGTH = 128;

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

/**
 * Strict decimal parse — rejects suffixes ("12abc"), multiple dots, NaN/Infinity
 * literals, and other non-numeric leftovers that parseFloat would silently coerce.
 */
export function parseStrictFiniteNumber(
  value: string
): { value: number | null; error: "empty" | "invalid" | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: "empty" };
  const normalized = trimmed.replace(/,/g, "");
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return { value: null, error: "invalid" };
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: "invalid" };
  }
  return { value: parsed, error: null };
}

export function parseDollarsToCentsOrNull(
  value: string,
  fieldLabel: string
): { cents: number | null; error: string | null } {
  const parsed = parseStrictFiniteNumber(value);
  if (parsed.error === "empty") return { cents: null, error: null };
  if (parsed.error === "invalid" || parsed.value == null) {
    return { cents: null, error: `${fieldLabel} must be a valid number.` };
  }
  if (parsed.value < 0) {
    return { cents: null, error: `${fieldLabel} cannot be negative.` };
  }
  return { cents: Math.round(parsed.value * 100), error: null };
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
  const parsed = parseStrictFiniteNumber(value);
  if (parsed.error === "empty") return { value: null, error: null };
  if (parsed.error === "invalid" || parsed.value == null) {
    return { value: null, error: "Coverage must be a valid number." };
  }
  if (parsed.value <= 0) {
    return { value: null, error: "Coverage must be greater than 0." };
  }
  return { value: parsed.value, error: null };
}

/** Empty/null = no item waste. Valid values must be >= 0. */
export function parseWastePctOrNull(
  value: string
): { value: number | null; error: string | null } {
  const parsed = parseStrictFiniteNumber(value);
  if (parsed.error === "empty") return { value: null, error: null };
  if (parsed.error === "invalid" || parsed.value == null) {
    return { value: null, error: "Waste must be a valid number." };
  }
  if (parsed.value < 0) {
    return { value: null, error: "Waste cannot be negative." };
  }
  return { value: parsed.value, error: null };
}

/**
 * Empty/null = unset item tax rate. Valid values: 0..CATALOG_TAX_RATE_PCT_MAX inclusive.
 * Same strict numeric parsing as Coverage/Waste — no silent coercion.
 */
export function parseTaxRatePctOrNull(
  value: string,
  fieldLabel: string
): { value: number | null; error: string | null } {
  const parsed = parseStrictFiniteNumber(value);
  if (parsed.error === "empty") return { value: null, error: null };
  if (parsed.error === "invalid" || parsed.value == null) {
    return { value: null, error: `${fieldLabel} must be a valid number.` };
  }
  if (parsed.value < 0) {
    return { value: null, error: `${fieldLabel} cannot be negative.` };
  }
  if (parsed.value > CATALOG_TAX_RATE_PCT_MAX) {
    return {
      value: null,
      error: `${fieldLabel} cannot exceed ${CATALOG_TAX_RATE_PCT_MAX}%.`,
    };
  }
  return { value: parsed.value, error: null };
}

/**
 * Parse a supplier SKU string field.
 * Empty → null. Trim only. Reject control chars and overlong values.
 * Preserves ordinary supplier formats (letters, numbers, -, _, /, spaces).
 */
export function parseSupplierSkuOrNull(
  value: string,
  fieldLabel: string
): { value: string | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };
  if (trimmed.length > CATALOG_SUPPLIER_SKU_MAX_LENGTH) {
    return {
      value: null,
      error: `${fieldLabel} cannot exceed ${CATALOG_SUPPLIER_SKU_MAX_LENGTH} characters.`,
    };
  }
  // Reject C0/C1 control characters (including tabs/newlines) — SKUs are single-line identifiers.
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return {
      value: null,
      error: `${fieldLabel} contains invalid characters.`,
    };
  }
  return { value: trimmed, error: null };
}

export function parseCatalogSupplierSkus(input: {
  abc_sku: string;
  qxo_sku: string;
  srs_sku: string;
}): {
  abc_sku: string | null;
  qxo_sku: string | null;
  srs_sku: string | null;
  error: string | null;
} {
  const abc = parseSupplierSkuOrNull(input.abc_sku, CATALOG_CONTRACTOR_LABELS.abcSku);
  if (abc.error) {
    return { abc_sku: null, qxo_sku: null, srs_sku: null, error: abc.error };
  }
  const qxo = parseSupplierSkuOrNull(input.qxo_sku, CATALOG_CONTRACTOR_LABELS.qxoSku);
  if (qxo.error) {
    return { abc_sku: null, qxo_sku: null, srs_sku: null, error: qxo.error };
  }
  const srs = parseSupplierSkuOrNull(input.srs_sku, CATALOG_CONTRACTOR_LABELS.srsSku);
  if (srs.error) {
    return { abc_sku: null, qxo_sku: null, srs_sku: null, error: srs.error };
  }
  return {
    abc_sku: abc.value,
    qxo_sku: qxo.value,
    srs_sku: srs.value,
    error: null,
  };
}

/** Display helper for detail summary — null means no supplier SKU linked. */
export function formatCatalogSupplierSkuDisplay(
  value: string | null | undefined
): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "Not linked";
}

export function formatCatalogSupplierSkusSummary(
  item: Pick<CatalogItem, "abc_sku" | "qxo_sku" | "srs_sku">
): string {
  const parts: string[] = [];
  if (item.abc_sku?.trim()) parts.push(`ABC ${item.abc_sku.trim()}`);
  if (item.qxo_sku?.trim()) parts.push(`QXO ${item.qxo_sku.trim()}`);
  if (item.srs_sku?.trim()) parts.push(`SRS ${item.srs_sku.trim()}`);
  return parts.length > 0 ? parts.join(" · ") : "No supplier SKUs";
}

export function parseCatalogTaxRates(input: {
  sales_tax_rate_pct: string;
  purchase_tax_rate_pct: string;
}): {
  sales_tax_rate_pct: number | null;
  purchase_tax_rate_pct: number | null;
  error: string | null;
} {
  const sales = parseTaxRatePctOrNull(
    input.sales_tax_rate_pct,
    CATALOG_CONTRACTOR_LABELS.salesTax
  );
  if (sales.error) {
    return {
      sales_tax_rate_pct: null,
      purchase_tax_rate_pct: null,
      error: sales.error,
    };
  }
  const purchase = parseTaxRatePctOrNull(
    input.purchase_tax_rate_pct,
    CATALOG_CONTRACTOR_LABELS.purchaseTax
  );
  if (purchase.error) {
    return {
      sales_tax_rate_pct: null,
      purchase_tax_rate_pct: null,
      error: purchase.error,
    };
  }
  return {
    sales_tax_rate_pct: sales.value,
    purchase_tax_rate_pct: purchase.value,
    error: null,
  };
}

/** Display helper for detail summary — null means unset / company default. */
export function formatCatalogTaxRateDisplay(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) {
    return "Not set (company default)";
  }
  return `${value}%`;
}

/** Empty = null. Invalid enum values are rejected. */
export function parseCoverageBasisOrNull(
  value: string | CoverageBasis | null | undefined
): { value: CoverageBasis | null; error: string | null } {
  if (value == null) return { value: null, error: null };
  const trimmed = String(value).trim();
  if (!trimmed) return { value: null, error: null };
  if (!isCoverageBasis(trimmed)) {
    return { value: null, error: "Coverage basis is not valid." };
  }
  return { value: trimmed, error: null };
}

export function formatNullableNumberForInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

export function formatCoverageBasisForInput(
  value: CoverageBasis | null | undefined
): "" | CoverageBasis {
  return value != null && isCoverageBasis(value) ? value : "";
}

export type CatalogQuantityDriversParsed = {
  coverage_rate: number | null;
  coverage_basis: CoverageBasis | null;
  waste_applies: boolean;
  waste_pct: number | null;
  error: string | null;
};

/**
 * Parse Coverage / Coverage basis / Waste form fields for Catalog create/update.
 * When coverage_rate is null, coverage_basis is forced null.
 * When waste_applies is false, waste_pct is still validated if present so bad
 * values cannot be saved, but raw mode ignores it until waste applies.
 * Missing basis with non-null coverage is allowed (not_verified) — does not block save.
 */
export function parseCatalogQuantityDrivers(input: {
  coverage_rate: string;
  coverage_basis?: string | CoverageBasis | null;
  waste_applies: boolean;
  waste_pct: string;
}): CatalogQuantityDriversParsed {
  const coverage = parseCoverageRateOrNull(input.coverage_rate);
  if (coverage.error) {
    return {
      coverage_rate: null,
      coverage_basis: null,
      waste_applies: input.waste_applies,
      waste_pct: null,
      error: coverage.error,
    };
  }

  const basis = parseCoverageBasisOrNull(input.coverage_basis);
  if (basis.error) {
    return {
      coverage_rate: coverage.value,
      coverage_basis: null,
      waste_applies: input.waste_applies,
      waste_pct: null,
      error: basis.error,
    };
  }

  const waste = parseWastePctOrNull(input.waste_pct);
  if (waste.error) {
    return {
      coverage_rate: coverage.value,
      coverage_basis: coverage.value == null ? null : basis.value,
      waste_applies: input.waste_applies,
      waste_pct: null,
      error: waste.error,
    };
  }

  return {
    coverage_rate: coverage.value,
    coverage_basis: coverage.value == null ? null : basis.value,
    waste_applies: input.waste_applies,
    waste_pct: waste.value,
    error: null,
  };
}

/** Compact table secondary line — omit when both drivers are unset/off. */
export function formatCatalogQuantityDriversLine(
  item: Pick<
    CatalogItem,
    "coverage_rate" | "coverage_basis" | "waste_applies" | "waste_pct"
  >
): string | null {
  const parts: string[] = [];
  if (item.coverage_rate != null && Number.isFinite(item.coverage_rate)) {
    parts.push(`Coverage ${item.coverage_rate}`);
    if (item.coverage_basis != null && isCoverageBasis(item.coverage_basis)) {
      parts.push(coverageBasisLabel(item.coverage_basis));
    }
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
  const coverageRate = formatNullableNumberForInput(item.coverage_rate);
  return {
    customer_name: item.customer_name?.trim() ?? "",
    description: item.description?.trim() ?? "",
    unit_price_dollars: formatCentsForInput(item.unit_price_cents),
    unit_cost_dollars: formatCentsForInput(item.unit_cost_cents),
    labor_unit_cost_dollars: formatCentsForInput(item.labor_unit_cost_cents),
    pricing_basis: item.pricing_basis,
    customer_visibility: item.customer_visibility,
    sort_order: item.sort_order != null ? String(item.sort_order) : "",
    coverage_rate: coverageRate,
    coverage_basis:
      coverageRate.trim() === ""
        ? ""
        : formatCoverageBasisForInput(item.coverage_basis),
    waste_applies: Boolean(item.waste_applies),
    waste_pct: formatNullableNumberForInput(item.waste_pct),
    sales_tax_rate_pct: formatNullableNumberForInput(item.sales_tax_rate_pct),
    purchase_tax_rate_pct: formatNullableNumberForInput(item.purchase_tax_rate_pct),
    abc_sku: item.abc_sku?.trim() ?? "",
    qxo_sku: item.qxo_sku?.trim() ?? "",
    srs_sku: item.srs_sku?.trim() ?? "",
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
    item.abc_sku ?? "",
    item.qxo_sku ?? "",
    item.srs_sku ?? "",
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

export type CatalogCreateDraftResult =
  | { ok: true; draft: CatalogItemDraft; coverageCompatibility: CatalogCoverageCompatibilityStatus }
  | { ok: false; error: string };

/** Pure create-draft builder used by CatalogSetupClient and behavioral tests. */
export function buildCatalogCreateDraft(
  companyId: string,
  form: AddCatalogItemForm
): CatalogCreateDraftResult {
  const name = form.name.trim();
  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  const unitPrice = parseDollarsToCentsOrNull(
    form.unit_price_dollars,
    CATALOG_CONTRACTOR_LABELS.unitPrice
  );
  if (unitPrice.error) return { ok: false, error: unitPrice.error };

  const unitCost = parseDollarsToCentsOrNull(
    form.unit_cost_dollars,
    CATALOG_CONTRACTOR_LABELS.unitCost
  );
  if (unitCost.error) return { ok: false, error: unitCost.error };

  const quantityDrivers = parseCatalogQuantityDrivers({
    coverage_rate: form.coverage_rate,
    coverage_basis: form.coverage_basis,
    waste_applies: form.waste_applies,
    waste_pct: form.waste_pct,
  });
  if (quantityDrivers.error) {
    return { ok: false, error: quantityDrivers.error };
  }

  const taxRates = parseCatalogTaxRates({
    sales_tax_rate_pct: form.sales_tax_rate_pct,
    purchase_tax_rate_pct: form.purchase_tax_rate_pct,
  });
  if (taxRates.error) {
    return { ok: false, error: taxRates.error };
  }

  const supplierSkus = parseCatalogSupplierSkus({
    abc_sku: form.abc_sku,
    qxo_sku: form.qxo_sku,
    srs_sku: form.srs_sku,
  });
  if (supplierSkus.error) {
    return { ok: false, error: supplierSkus.error };
  }

  const coverageCompatibility = classifyCatalogCoverageCompatibility({
    quantity_source: form.quantity_source,
    unit: form.unit,
    coverage_rate: quantityDrivers.coverage_rate,
    coverage_basis: quantityDrivers.coverage_basis,
    waste_applies: quantityDrivers.waste_applies,
    waste_pct: quantityDrivers.waste_pct,
  });

  return {
    ok: true,
    coverageCompatibility,
    draft: {
      company_id: companyId,
      name,
      item_type: form.item_type,
      unit: form.unit,
      quantity_source: form.quantity_source,
      customer_name: form.customer_name.trim() || null,
      description: form.description.trim() || null,
      unit_price_cents: unitPrice.cents,
      unit_cost_cents: unitCost.cents,
      labor_unit_cost_cents: null,
      pricing_basis: form.pricing_basis,
      customer_visibility: form.customer_visibility,
      active: true,
      coverage_rate: quantityDrivers.coverage_rate,
      coverage_basis: quantityDrivers.coverage_basis,
      waste_applies: quantityDrivers.waste_applies,
      waste_pct: quantityDrivers.waste_pct,
      sales_tax_rate_pct: taxRates.sales_tax_rate_pct,
      purchase_tax_rate_pct: taxRates.purchase_tax_rate_pct,
      abc_sku: supplierSkus.abc_sku,
      qxo_sku: supplierSkus.qxo_sku,
      srs_sku: supplierSkus.srs_sku,
      metadata: null,
    },
  };
}

export type CatalogUpdatePatchResult =
  | {
      ok: true;
      patch: Partial<CatalogItemDraft>;
      coverageCompatibility: CatalogCoverageCompatibilityStatus;
    }
  | { ok: false; error: string };

/** Pure update-patch builder used by CatalogSetupClient and behavioral tests. */
export function buildCatalogUpdatePatch(
  item: CatalogItem,
  editDraft: CatalogItemEditDraft
): CatalogUpdatePatchResult {
  const unitPrice = parseDollarsToCentsOrNull(
    editDraft.unit_price_dollars,
    CATALOG_CONTRACTOR_LABELS.unitPrice
  );
  if (unitPrice.error) return { ok: false, error: unitPrice.error };

  const unitCost = parseDollarsToCentsOrNull(
    editDraft.unit_cost_dollars,
    CATALOG_CONTRACTOR_LABELS.unitCost
  );
  if (unitCost.error) return { ok: false, error: unitCost.error };

  let laborCents: number | null | undefined = undefined;
  if (item.item_type === "labor") {
    const labor = parseDollarsToCentsOrNull(editDraft.labor_unit_cost_dollars, "Labor cost");
    if (labor.error) return { ok: false, error: labor.error };
    laborCents = labor.cents;
  }

  const sortParsed = parseSortOrderOrNull(editDraft.sort_order);
  if (sortParsed.error) return { ok: false, error: sortParsed.error };

  const quantityDrivers = parseCatalogQuantityDrivers({
    coverage_rate: editDraft.coverage_rate,
    coverage_basis: editDraft.coverage_basis,
    waste_applies: editDraft.waste_applies,
    waste_pct: editDraft.waste_pct,
  });
  if (quantityDrivers.error) {
    return { ok: false, error: quantityDrivers.error };
  }

  const taxRates = parseCatalogTaxRates({
    sales_tax_rate_pct: editDraft.sales_tax_rate_pct,
    purchase_tax_rate_pct: editDraft.purchase_tax_rate_pct,
  });
  if (taxRates.error) {
    return { ok: false, error: taxRates.error };
  }

  const supplierSkus = parseCatalogSupplierSkus({
    abc_sku: editDraft.abc_sku,
    qxo_sku: editDraft.qxo_sku,
    srs_sku: editDraft.srs_sku,
  });
  if (supplierSkus.error) {
    return { ok: false, error: supplierSkus.error };
  }

  const coverageCompatibility = classifyCatalogCoverageCompatibility({
    quantity_source: item.quantity_source,
    unit: item.unit,
    coverage_rate: quantityDrivers.coverage_rate,
    coverage_basis: quantityDrivers.coverage_basis,
    waste_applies: quantityDrivers.waste_applies,
    waste_pct: quantityDrivers.waste_pct,
  });

  const patch: Partial<CatalogItemDraft> = {
    customer_name: editDraft.customer_name.trim() || null,
    description: editDraft.description.trim() || null,
    unit_price_cents: unitPrice.cents,
    unit_cost_cents: unitCost.cents,
    pricing_basis: editDraft.pricing_basis,
    customer_visibility: editDraft.customer_visibility,
    sort_order: sortParsed.sort_order,
    coverage_rate: quantityDrivers.coverage_rate,
    coverage_basis: quantityDrivers.coverage_basis,
    waste_applies: quantityDrivers.waste_applies,
    waste_pct: quantityDrivers.waste_pct,
    sales_tax_rate_pct: taxRates.sales_tax_rate_pct,
    purchase_tax_rate_pct: taxRates.purchase_tax_rate_pct,
    abc_sku: supplierSkus.abc_sku,
    qxo_sku: supplierSkus.qxo_sku,
    srs_sku: supplierSkus.srs_sku,
  };

  if (item.item_type === "labor") {
    patch.labor_unit_cost_cents = laborCents ?? null;
  }

  return { ok: true, patch, coverageCompatibility };
}
