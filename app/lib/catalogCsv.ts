/**
 * FieldDive Catalog CSV v1 — pure parse / validate / export foundation.
 *
 * No DB writes. No supplier sync. Supplier SKU columns persist on catalog items
 * as contractor/internal metadata only — they do not activate integrations.
 *
 * CSV headers are stable machine keys. UI uses FieldDive contractor labels.
 */

import {
  formatCentsForInput,
  formatNullableNumberForInput,
  parseCatalogQuantityDrivers,
  parseCatalogSupplierSkus,
  parseCatalogTaxRates,
  parseDollarsToCentsOrNull,
  buildCatalogCreateDraft,
  type AddCatalogItemForm,
} from "@/app/admin/catalog/catalogAdminUtils";
import { CATALOG_CONTRACTOR_LABELS } from "@/app/lib/catalogContractorLabels";
import { isUuidLike } from "@/app/lib/catalogStore";
import type {
  CatalogItem,
  CatalogItemDraft,
  CatalogItemType,
  CatalogUnit,
  CoverageBasis,
  CustomerVisibility,
  QuantitySource,
} from "@/app/lib/catalogTypes";
import {
  CATALOG_ITEM_TYPES,
  CATALOG_UNITS,
  COVERAGE_BASES,
  CUSTOMER_VISIBILITIES,
  QUANTITY_SOURCES,
} from "@/app/lib/catalogTypes";

// ---------------------------------------------------------------------------
// Headers (stable contract)
// ---------------------------------------------------------------------------

export const CATALOG_CSV_HEADERS = [
  "id",
  "name",
  "description",
  "item_type",
  "quantity_source",
  "unit",
  "unit_cost",
  "unit_price",
  "proposal_visibility",
  "active",
  "coverage",
  "coverage_basis",
  "waste_applies",
  "waste_pct",
  "sales_tax_rate_pct",
  "purchase_tax_rate_pct",
  "abc_sku",
  "qxo_sku",
  "srs_sku",
] as const;

export type CatalogCsvHeader = (typeof CATALOG_CSV_HEADERS)[number];

/** Supplier SKU CSV columns — persisted on catalog items; sync remains planned. */
export const CATALOG_CSV_SUPPLIER_SKU_HEADERS = [
  "abc_sku",
  "qxo_sku",
  "srs_sku",
] as const;

/** @deprecated Use CATALOG_CSV_SUPPLIER_SKU_HEADERS — kept for transitional callers. */
export const CATALOG_CSV_RESERVED_SKU_HEADERS = CATALOG_CSV_SUPPLIER_SKU_HEADERS;

export type CatalogCsvRowAction = "create" | "update" | "invalid" | "unchanged";

export type CatalogCsvRawRow = Record<CatalogCsvHeader, string>;

export type CatalogCsvParsedValues = {
  id: string | null;
  name: string;
  description: string | null;
  item_type: CatalogItemType;
  quantity_source: QuantitySource;
  unit: CatalogUnit;
  unit_cost_cents: number | null;
  unit_price_cents: number | null;
  proposal_visibility: CustomerVisibility;
  /** null = omit on update / default true on create */
  active: boolean | null;
  coverage_rate: number | null;
  coverage_basis: CoverageBasis | null;
  waste_applies: boolean;
  waste_pct: number | null;
  sales_tax_rate_pct: number | null;
  purchase_tax_rate_pct: number | null;
  abc_sku: string | null;
  qxo_sku: string | null;
  srs_sku: string | null;
};

export type CatalogCsvAnalyzedRow = {
  rowNumber: number;
  action: CatalogCsvRowAction;
  raw: CatalogCsvRawRow;
  values: CatalogCsvParsedValues | null;
  errors: string[];
  warnings: string[];
  existingItemId: string | null;
};

export type CatalogCsvAnalyzeResult = {
  ok: boolean;
  fileErrors: string[];
  rows: CatalogCsvAnalyzedRow[];
  summary: {
    rowCount: number;
    createCount: number;
    updateCount: number;
    unchangedCount: number;
    invalidCount: number;
    warningCount: number;
  };
};

const ITEM_TYPE_SET = new Set<string>(CATALOG_ITEM_TYPES);
const UNIT_SET = new Set<string>(CATALOG_UNITS);
const QUANTITY_SOURCE_SET = new Set<string>(QUANTITY_SOURCES);
const VISIBILITY_SET = new Set<string>(CUSTOMER_VISIBILITIES);
const COVERAGE_BASIS_SET = new Set<string>(COVERAGE_BASES);

// ---------------------------------------------------------------------------
// Low-level CSV parse / serialize
// ---------------------------------------------------------------------------

/** RFC4180-ish split: commas, quoted fields, "" escape. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.length > 1 || row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    field += ch;
  }

  row.push(field);
  if (row.length > 1 || row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }
  return rows;
}

export function serializeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function serializeCsvRows(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return rows.map((row) => row.map(serializeCsvValue).join(",")).join("\r\n") + "\r\n";
}

export function buildCatalogCsvTemplate(): string {
  return serializeCsvRows([[...CATALOG_CSV_HEADERS]]);
}

function formatMoneyDollarsFromCents(cents: number | null | undefined): string {
  return formatCentsForInput(cents);
}

function formatPercentForCsv(value: number | null | undefined): string {
  return formatNullableNumberForInput(value);
}

function formatBooleanForCsv(value: boolean): string {
  return value ? "true" : "false";
}

export function catalogItemToCsvRawRow(item: CatalogItem): CatalogCsvRawRow {
  return {
    id: item.id,
    name: item.name ?? "",
    description: item.description ?? "",
    item_type: item.item_type,
    quantity_source: item.quantity_source,
    unit: item.unit,
    unit_cost: formatMoneyDollarsFromCents(item.unit_cost_cents),
    unit_price: formatMoneyDollarsFromCents(item.unit_price_cents),
    proposal_visibility: item.customer_visibility,
    active: formatBooleanForCsv(Boolean(item.active)),
    coverage: formatPercentForCsv(item.coverage_rate ?? null),
    coverage_basis: item.coverage_basis ?? "",
    waste_applies: formatBooleanForCsv(Boolean(item.waste_applies)),
    waste_pct: formatPercentForCsv(item.waste_pct ?? null),
    sales_tax_rate_pct: formatPercentForCsv(item.sales_tax_rate_pct ?? null),
    purchase_tax_rate_pct: formatPercentForCsv(item.purchase_tax_rate_pct ?? null),
    abc_sku: item.abc_sku?.trim() ?? "",
    qxo_sku: item.qxo_sku?.trim() ?? "",
    srs_sku: item.srs_sku?.trim() ?? "",
  };
}

export function buildCatalogCsvExport(items: CatalogItem[]): string {
  const sorted = [...items].sort((a, b) => {
    const orderA = a.sort_order;
    const orderB = b.sort_order;
    if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
    if (orderA != null && orderB == null) return -1;
    if (orderA == null && orderB != null) return 1;
    return a.name.localeCompare(b.name);
  });
  const dataRows = sorted.map((item) => {
    const raw = catalogItemToCsvRawRow(item);
    return CATALOG_CSV_HEADERS.map((h) => raw[h]);
  });
  return serializeCsvRows([[...CATALOG_CSV_HEADERS], ...dataRows]);
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

export function parseCsvBoolean(
  value: string
): { value: boolean | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };
  const lower = trimmed.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") {
    return { value: true, error: null };
  }
  if (lower === "false" || lower === "0" || lower === "no") {
    return { value: false, error: null };
  }
  return { value: null, error: "must be true or false." };
}

function cell(row: string[], index: number): string {
  return row[index] ?? "";
}

function validateHeaders(headerCells: string[]): string[] {
  const errors: string[] = [];
  if (headerCells.length === 0) {
    return ["CSV is empty."];
  }
  const normalized = headerCells.map((h) => h.trim());
  if (normalized.length !== CATALOG_CSV_HEADERS.length) {
    errors.push(
      `CSV must have exactly ${CATALOG_CSV_HEADERS.length} columns in the Catalog CSV v1 header order.`
    );
  }
  for (let i = 0; i < CATALOG_CSV_HEADERS.length; i++) {
    const expected = CATALOG_CSV_HEADERS[i];
    const actual = normalized[i] ?? "";
    if (actual !== expected) {
      errors.push(
        `Header column ${i + 1} must be "${expected}"${actual ? ` (found "${actual}")` : ""}.`
      );
    }
  }
  for (let i = CATALOG_CSV_HEADERS.length; i < normalized.length; i++) {
    const extra = normalized[i];
    if (extra) {
      errors.push(`Unknown header "${extra}" is not part of Catalog CSV v1.`);
    }
  }
  return errors;
}

function rowToRaw(cells: string[]): CatalogCsvRawRow {
  const raw = {} as CatalogCsvRawRow;
  for (let i = 0; i < CATALOG_CSV_HEADERS.length; i++) {
    raw[CATALOG_CSV_HEADERS[i]] = cell(cells, i).trim();
  }
  return raw;
}

function valuesEqualMoney(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  const na = a == null || !Number.isFinite(a) ? null : a;
  const nb = b == null || !Number.isFinite(b) ? null : b;
  return na === nb;
}

function valuesEqualNumber(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  const na = a == null || !Number.isFinite(a) ? null : a;
  const nb = b == null || !Number.isFinite(b) ? null : b;
  return na === nb;
}

export function catalogCsvValuesMatchItem(
  values: CatalogCsvParsedValues,
  item: CatalogItem
): boolean {
  if (values.name !== item.name) return false;
  if ((values.description ?? null) !== (item.description ?? null)) return false;
  if (values.item_type !== item.item_type) return false;
  if (values.quantity_source !== item.quantity_source) return false;
  if (values.unit !== item.unit) return false;
  if (!valuesEqualMoney(values.unit_cost_cents, item.unit_cost_cents)) return false;
  if (!valuesEqualMoney(values.unit_price_cents, item.unit_price_cents)) return false;
  if (values.proposal_visibility !== item.customer_visibility) return false;
  if (values.active != null && values.active !== Boolean(item.active)) return false;
  if (!valuesEqualNumber(values.coverage_rate, item.coverage_rate)) return false;
  if ((values.coverage_basis ?? null) !== (item.coverage_basis ?? null)) return false;
  if (values.waste_applies !== Boolean(item.waste_applies)) return false;
  if (!valuesEqualNumber(values.waste_pct, item.waste_pct)) return false;
  if (!valuesEqualNumber(values.sales_tax_rate_pct, item.sales_tax_rate_pct)) return false;
  if (!valuesEqualNumber(values.purchase_tax_rate_pct, item.purchase_tax_rate_pct)) {
    return false;
  }
  if ((values.abc_sku ?? null) !== (item.abc_sku ?? null)) return false;
  if ((values.qxo_sku ?? null) !== (item.qxo_sku ?? null)) return false;
  if ((values.srs_sku ?? null) !== (item.srs_sku ?? null)) return false;
  return true;
}

function validateDataRow(
  rowNumber: number,
  raw: CatalogCsvRawRow,
  existingById: Map<string, CatalogItem>,
  seenIds: Map<string, number>,
  createNames: Map<string, number[]>
): CatalogCsvAnalyzedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const idRaw = raw.id.trim();
  let id: string | null = null;
  let existing: CatalogItem | null = null;

  if (idRaw) {
    if (!isUuidLike(idRaw)) {
      errors.push("id must be a valid UUID when provided.");
    } else {
      id = idRaw;
      const prior = seenIds.get(id);
      if (prior != null) {
        errors.push(`Duplicate id "${id}" (also on row ${prior}).`);
      } else {
        seenIds.set(id, rowNumber);
      }
      existing = existingById.get(id) ?? null;
      if (!existing) {
        errors.push(
          "id does not match an item in this company catalog (create rows must leave id blank)."
        );
      }
    }
  }

  const name = raw.name.trim();
  if (!name) {
    errors.push("name is required.");
  }

  const itemTypeRaw = raw.item_type.trim();
  if (!itemTypeRaw) {
    errors.push("item_type is required.");
  } else if (!ITEM_TYPE_SET.has(itemTypeRaw)) {
    errors.push(`item_type "${itemTypeRaw}" is not valid.`);
  }

  const quantitySourceRaw = raw.quantity_source.trim();
  if (!quantitySourceRaw) {
    errors.push("quantity_source is required.");
  } else if (!QUANTITY_SOURCE_SET.has(quantitySourceRaw)) {
    errors.push(`quantity_source "${quantitySourceRaw}" is not valid.`);
  }

  const unitRaw = raw.unit.trim();
  if (!unitRaw) {
    errors.push("unit is required.");
  } else if (!UNIT_SET.has(unitRaw)) {
    errors.push(`unit "${unitRaw}" is not valid.`);
  }

  const unitCost = parseDollarsToCentsOrNull(raw.unit_cost, CATALOG_CONTRACTOR_LABELS.unitCost);
  if (unitCost.error) errors.push(unitCost.error);

  const unitPrice = parseDollarsToCentsOrNull(raw.unit_price, CATALOG_CONTRACTOR_LABELS.unitPrice);
  if (unitPrice.error) errors.push(unitPrice.error);

  const visibilityRaw = raw.proposal_visibility.trim();
  if (!visibilityRaw) {
    errors.push("proposal_visibility is required.");
  } else if (!VISIBILITY_SET.has(visibilityRaw)) {
    errors.push(`proposal_visibility "${visibilityRaw}" is not valid.`);
  }

  const activeParsed = parseCsvBoolean(raw.active);
  if (activeParsed.error) {
    errors.push(`active ${activeParsed.error}`);
  }

  const wasteAppliesParsed = parseCsvBoolean(raw.waste_applies);
  if (wasteAppliesParsed.error) {
    errors.push(`waste_applies ${wasteAppliesParsed.error}`);
  } else if (wasteAppliesParsed.value == null) {
    errors.push("waste_applies is required (true or false).");
  }

  const quantityDrivers = parseCatalogQuantityDrivers({
    coverage_rate: raw.coverage,
    coverage_basis: raw.coverage_basis,
    waste_applies: wasteAppliesParsed.value ?? false,
    waste_pct: raw.waste_pct,
  });
  if (quantityDrivers.error) {
    errors.push(quantityDrivers.error);
  }

  const taxRates = parseCatalogTaxRates({
    sales_tax_rate_pct: raw.sales_tax_rate_pct,
    purchase_tax_rate_pct: raw.purchase_tax_rate_pct,
  });
  if (taxRates.error) {
    errors.push(taxRates.error);
  }

  const supplierSkus = parseCatalogSupplierSkus({
    abc_sku: raw.abc_sku,
    qxo_sku: raw.qxo_sku,
    srs_sku: raw.srs_sku,
  });
  if (supplierSkus.error) {
    errors.push(supplierSkus.error);
  }

  if (
    raw.coverage_basis.trim() &&
    !COVERAGE_BASIS_SET.has(raw.coverage_basis.trim()) &&
    !quantityDrivers.error
  ) {
    // parseCatalogQuantityDrivers already rejects invalid basis; keep for clarity
  }

  if (errors.length > 0) {
    return {
      rowNumber,
      action: "invalid",
      raw,
      values: null,
      errors,
      warnings,
      existingItemId: existing?.id ?? null,
    };
  }

  const values: CatalogCsvParsedValues = {
    id,
    name,
    description: raw.description.trim() || null,
    item_type: itemTypeRaw as CatalogItemType,
    quantity_source: quantitySourceRaw as QuantitySource,
    unit: unitRaw as CatalogUnit,
    unit_cost_cents: unitCost.cents,
    unit_price_cents: unitPrice.cents,
    proposal_visibility: visibilityRaw as CustomerVisibility,
    active: activeParsed.value,
    coverage_rate: quantityDrivers.coverage_rate,
    coverage_basis: quantityDrivers.coverage_basis,
    waste_applies: wasteAppliesParsed.value!,
    waste_pct: quantityDrivers.waste_pct,
    sales_tax_rate_pct: taxRates.sales_tax_rate_pct,
    purchase_tax_rate_pct: taxRates.purchase_tax_rate_pct,
    abc_sku: supplierSkus.abc_sku,
    qxo_sku: supplierSkus.qxo_sku,
    srs_sku: supplierSkus.srs_sku,
  };

  if (!id) {
    const key = name.toLowerCase();
    const priorRows = createNames.get(key) ?? [];
    priorRows.push(rowNumber);
    createNames.set(key, priorRows);
    return {
      rowNumber,
      action: "create",
      raw,
      values,
      errors: [],
      warnings,
      existingItemId: null,
    };
  }

  if (existing && catalogCsvValuesMatchItem(values, existing)) {
    return {
      rowNumber,
      action: "unchanged",
      raw,
      values,
      errors: [],
      warnings,
      existingItemId: existing.id,
    };
  }

  return {
    rowNumber,
    action: "update",
    raw,
    values,
    errors: [],
    warnings,
    existingItemId: existing!.id,
  };
}

/**
 * Parse + validate Catalog CSV v1 against the current company catalog.
 * existingItems must be company-scoped (caller responsibility).
 */
export function analyzeCatalogCsv(
  text: string,
  existingItems: CatalogItem[]
): CatalogCsvAnalyzeResult {
  const grid = parseCsvText(text);
  if (grid.length === 0) {
    return {
      ok: false,
      fileErrors: ["CSV is empty."],
      rows: [],
      summary: {
        rowCount: 0,
        createCount: 0,
        updateCount: 0,
        unchangedCount: 0,
        invalidCount: 0,
        warningCount: 0,
      },
    };
  }

  const fileErrors = validateHeaders(grid[0]);
  if (fileErrors.length > 0) {
    return {
      ok: false,
      fileErrors,
      rows: [],
      summary: {
        rowCount: 0,
        createCount: 0,
        updateCount: 0,
        unchangedCount: 0,
        invalidCount: 0,
        warningCount: 0,
      },
    };
  }

  const dataRows = grid.slice(1);
  if (dataRows.length === 0) {
    return {
      ok: false,
      fileErrors: ["CSV has no data rows."],
      rows: [],
      summary: {
        rowCount: 0,
        createCount: 0,
        updateCount: 0,
        unchangedCount: 0,
        invalidCount: 0,
        warningCount: 0,
      },
    };
  }

  const existingById = new Map<string, CatalogItem>();
  for (const item of existingItems) {
    existingById.set(item.id, item);
  }

  const seenIds = new Map<string, number>();
  const createNames = new Map<string, number[]>();
  const rows: CatalogCsvAnalyzedRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2; // 1-based file line; header is line 1
    const raw = rowToRaw(dataRows[i]);
    rows.push(validateDataRow(rowNumber, raw, existingById, seenIds, createNames));
  }

  for (const [, rowNumbers] of createNames) {
    if (rowNumbers.length < 2) continue;
    for (const rowNumber of rowNumbers) {
      const row = rows.find((r) => r.rowNumber === rowNumber);
      if (!row || row.action === "invalid") continue;
      row.warnings.push(
        `Multiple new rows share the name "${row.values?.name ?? ""}" (rows ${rowNumbers.join(", ")}).`
      );
    }
  }

  // Also warn when a create name matches an existing catalog item name.
  const existingNames = new Map<string, string>();
  for (const item of existingItems) {
    existingNames.set(item.name.trim().toLowerCase(), item.id);
  }
  for (const row of rows) {
    if (row.action !== "create" || !row.values) continue;
    const matchId = existingNames.get(row.values.name.toLowerCase());
    if (matchId) {
      row.warnings.push(
        `A catalog item named "${row.values.name}" already exists (id ${matchId}). This row will create a duplicate name.`
      );
    }
  }

  const summary = {
    rowCount: rows.length,
    createCount: rows.filter((r) => r.action === "create").length,
    updateCount: rows.filter((r) => r.action === "update").length,
    unchangedCount: rows.filter((r) => r.action === "unchanged").length,
    invalidCount: rows.filter((r) => r.action === "invalid").length,
    warningCount: rows.reduce((n, r) => n + r.warnings.length, 0),
  };

  return {
    ok: summary.invalidCount === 0 && fileErrors.length === 0,
    fileErrors,
    rows,
    summary,
  };
}

export function catalogCsvValuesToAddForm(values: CatalogCsvParsedValues): AddCatalogItemForm {
  return {
    name: values.name,
    item_type: values.item_type,
    unit: values.unit,
    quantity_source: values.quantity_source,
    customer_name: "",
    description: values.description ?? "",
    unit_price_dollars: formatMoneyDollarsFromCents(values.unit_price_cents),
    unit_cost_dollars: formatMoneyDollarsFromCents(values.unit_cost_cents),
    pricing_basis: "unit_price",
    customer_visibility: values.proposal_visibility,
    coverage_rate: formatPercentForCsv(values.coverage_rate),
    coverage_basis: values.coverage_basis ?? "",
    waste_applies: values.waste_applies,
    waste_pct: formatPercentForCsv(values.waste_pct),
    sales_tax_rate_pct: formatPercentForCsv(values.sales_tax_rate_pct),
    purchase_tax_rate_pct: formatPercentForCsv(values.purchase_tax_rate_pct),
    abc_sku: values.abc_sku ?? "",
    qxo_sku: values.qxo_sku ?? "",
    srs_sku: values.srs_sku ?? "",
  };
}

export function buildCatalogCsvCreateDraft(
  companyId: string,
  values: CatalogCsvParsedValues
): { ok: true; draft: CatalogItemDraft } | { ok: false; error: string } {
  const built = buildCatalogCreateDraft(companyId, catalogCsvValuesToAddForm(values));
  if (!built.ok) return built;
  const draft: CatalogItemDraft = {
    ...built.draft,
    active: values.active == null ? true : values.active,
  };
  return { ok: true, draft };
}

export function buildCatalogCsvUpdatePatch(
  item: CatalogItem,
  values: CatalogCsvParsedValues
): { ok: true; patch: Partial<CatalogItemDraft> } | { ok: false; error: string } {
  const quantityDrivers = parseCatalogQuantityDrivers({
    coverage_rate: formatPercentForCsv(values.coverage_rate),
    coverage_basis: values.coverage_basis ?? "",
    waste_applies: values.waste_applies,
    waste_pct: formatPercentForCsv(values.waste_pct),
  });
  if (quantityDrivers.error) {
    return { ok: false, error: quantityDrivers.error };
  }
  const taxRates = parseCatalogTaxRates({
    sales_tax_rate_pct: formatPercentForCsv(values.sales_tax_rate_pct),
    purchase_tax_rate_pct: formatPercentForCsv(values.purchase_tax_rate_pct),
  });
  if (taxRates.error) {
    return { ok: false, error: taxRates.error };
  }

  const patch: Partial<CatalogItemDraft> = {
    name: values.name,
    description: values.description,
    item_type: values.item_type,
    quantity_source: values.quantity_source,
    unit: values.unit,
    unit_cost_cents: values.unit_cost_cents,
    unit_price_cents: values.unit_price_cents,
    customer_visibility: values.proposal_visibility,
    coverage_rate: quantityDrivers.coverage_rate,
    coverage_basis: quantityDrivers.coverage_basis,
    waste_applies: quantityDrivers.waste_applies,
    waste_pct: quantityDrivers.waste_pct,
    sales_tax_rate_pct: taxRates.sales_tax_rate_pct,
    purchase_tax_rate_pct: taxRates.purchase_tax_rate_pct,
    abc_sku: values.abc_sku,
    qxo_sku: values.qxo_sku,
    srs_sku: values.srs_sku,
  };
  if (values.active != null) {
    patch.active = values.active;
  }
  // Preserve fields not represented in CSV v1 (pricing_basis, sort_order, labor, metadata).
  // Catalog display order is managed by Reorder mode (sort_order) — not CSV v1 round-trip.
  void item;
  return { ok: true, patch };
}

export type CatalogCsvImportWriteResult = {
  ok: boolean;
  createdCount: number;
  updatedCount: number;
  skippedUnchangedCount: number;
  failedCount: number;
  errors: string[];
};

/**
 * Apply a previously analyzed CSV. Caller must ensure analyze.ok === true.
 * Writes sequentially via provided store adapters (company-scoped).
 * Stops on first write failure and reports partial progress clearly —
 * true DB transaction/RPC is a future durability upgrade if required.
 */
export async function applyCatalogCsvImport(options: {
  companyId: string;
  analysis: CatalogCsvAnalyzeResult;
  existingItems: CatalogItem[];
  createItem: (draft: CatalogItemDraft) => Promise<CatalogItem | null>;
  updateItem: (
    id: string,
    patch: Partial<CatalogItemDraft>,
    opts: { companyId: string }
  ) => Promise<CatalogItem | null>;
}): Promise<CatalogCsvImportWriteResult> {
  const { companyId, analysis, existingItems, createItem, updateItem } = options;
  if (!analysis.ok) {
    return {
      ok: false,
      createdCount: 0,
      updatedCount: 0,
      skippedUnchangedCount: 0,
      failedCount: 0,
      errors: ["Import blocked: CSV has invalid rows or file errors."],
    };
  }

  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  let createdCount = 0;
  let updatedCount = 0;
  let skippedUnchangedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const row of analysis.rows) {
    if (row.action === "unchanged") {
      skippedUnchangedCount++;
      continue;
    }
    if (row.action === "invalid" || !row.values) {
      failedCount++;
      errors.push(`Row ${row.rowNumber}: invalid row reached write path.`);
      break;
    }

    if (row.action === "create") {
      const built = buildCatalogCsvCreateDraft(companyId, row.values);
      if (!built.ok) {
        failedCount++;
        errors.push(`Row ${row.rowNumber}: ${built.error}`);
        break;
      }
      const created = await createItem(built.draft);
      if (!created) {
        failedCount++;
        errors.push(`Row ${row.rowNumber}: could not create catalog item.`);
        break;
      }
      createdCount++;
      continue;
    }

    if (row.action === "update") {
      const existing = existingById.get(row.existingItemId ?? "");
      if (!existing) {
        failedCount++;
        errors.push(`Row ${row.rowNumber}: update target missing.`);
        break;
      }
      const built = buildCatalogCsvUpdatePatch(existing, row.values);
      if (!built.ok) {
        failedCount++;
        errors.push(`Row ${row.rowNumber}: ${built.error}`);
        break;
      }
      const updated = await updateItem(existing.id, built.patch, { companyId });
      if (!updated) {
        failedCount++;
        errors.push(`Row ${row.rowNumber}: could not update catalog item.`);
        break;
      }
      updatedCount++;
      existingById.set(updated.id, updated);
    }
  }

  return {
    ok: failedCount === 0 && errors.length === 0,
    createdCount,
    updatedCount,
    skippedUnchangedCount,
    failedCount,
    errors,
  };
}

export function downloadCatalogCsvFile(filename: string, content: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
