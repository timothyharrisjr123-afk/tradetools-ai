/**
 * FieldDive Catalog / Price Book — type contract.
 *
 * Catalog items define reusable company-owned line items and quantity drivers.
 * They describe what can be priced (materials, labor, services) and which
 * measurement field supplies quantity — not final proposal totals.
 *
 * Catalog does not own final proposal totals, payment status, approval truth,
 * or send/PDF state. Pricing, payment, approval, and status belong elsewhere.
 *
 * Architecture (later stages):
 *   MeasurementRecord → quantity resolution → CatalogItem rules
 *   ProposalTemplate → which catalog items are included
 *   Proposal → job-specific instance
 *   Pricing engine → deterministic math (separate from this module)
 *
 * This file is types and pure label helpers only. No DB, no pricing math.
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type CatalogItemType =
  | "material"
  | "labor"
  | "service"
  | "fee"
  | "discount"
  | "package";

export type CatalogUnit =
  | "square"
  | "sqft"
  | "linear_foot"
  | "each"
  | "bundle"
  | "hour"
  | "day"
  | "fixed"
  | "allowance";

export type QuantitySource =
  | "roof_squares"
  | "adjusted_roof_squares"
  | "roof_area_sqft"
  | "eaves_lf"
  | "rakes_lf"
  | "ridges_lf"
  | "hips_lf"
  | "valleys_lf"
  | "wall_flashing_lf"
  | "step_flashing_lf"
  | "transitions_lf"
  | "parapet_wall_lf"
  | "drip_edge_lf"
  | "starter_lf"
  | "ridge_cap_lf"
  | "pipe_boots_count"
  | "vents_count"
  | "skylights_count"
  | "chimneys_count"
  | "satellite_dishes_count"
  | "debris_tons"
  | "tear_off_squares"
  | "labor_multiplier"
  | "fixed"
  | "custom";

export type PricingBasis =
  | "unit_price"
  | "cost_plus_margin"
  | "fixed_price"
  | "included";

export type CustomerVisibility =
  | "customer_visible"
  | "internal_only"
  | "grouped";

/**
 * Measurement-side unit of the coverage divisor (what coverage_rate measures).
 * Not the purchase/sell unit — see `unit`.
 */
export type CoverageBasis =
  | "roof_square"
  | "square_feet"
  | "linear_feet"
  | "each"
  | "tons";

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/**
 * Full company-owned catalog item — reusable across templates and proposals.
 */
export type CatalogItem = {
  id: string;
  company_id: string;
  name: string;
  customer_name?: string | null;
  description?: string | null;
  item_type: CatalogItemType;
  unit: CatalogUnit;
  quantity_source: QuantitySource;
  default_quantity?: number | null;
  coverage_rate?: number | null;
  /**
   * Measurement-side unit of coverage_rate. Null when coverage is unset or not yet chosen.
   * Do not infer from purchase `unit`.
   */
  coverage_basis?: CoverageBasis | null;
  waste_applies?: boolean | null;
  /**
   * Item waste percent (points; 10 = 10%). Editable on Catalog items.
   * Applied only when company policy wasteModel is raw_plus_waste; ignored under
   * adjusted_measurement. No Settings mode switch yet.
   */
  waste_pct?: number | null;
  /**
   * Customer-facing item sales tax rate (percent points; 8.25 = 8.25%).
   * Catalog capture / source of truth only — not applied to proposal totals yet.
   */
  sales_tax_rate_pct?: number | null;
  /**
   * Internal supplier/material purchase tax rate (percent points).
   * Never customer-facing. Capture only — not applied to proposal/customer output yet.
   */
  purchase_tax_rate_pct?: number | null;
  unit_cost_cents?: number | null;
  unit_price_cents?: number | null;
  labor_unit_cost_cents?: number | null;
  pricing_basis: PricingBasis;
  customer_visibility: CustomerVisibility;
  active: boolean;
  sort_order?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

/**
 * Payload for creating or updating a catalog item before persistence assigns ids/timestamps.
 */
export type CatalogItemDraft = Omit<
  CatalogItem,
  "id" | "created_at" | "updated_at" | "created_by" | "updated_by"
>;

/**
 * Lightweight row for admin lists and template pickers.
 */
export type CatalogItemSummary = {
  id: string;
  company_id: string;
  name: string;
  customer_name?: string | null;
  item_type: CatalogItemType;
  unit: CatalogUnit;
  quantity_source: QuantitySource;
  unit_cost_cents?: number | null;
  unit_price_cents?: number | null;
  pricing_basis: PricingBasis;
  customer_visibility: CustomerVisibility;
  active: boolean;
  sort_order?: number | null;
};

/**
 * Result of resolving a catalog item quantity from measurement (type only; resolver comes later).
 */
export type CatalogQuantityResolution = {
  item_id: string;
  quantity_source: QuantitySource;
  resolved_quantity: number | null;
  unit: CatalogUnit;
  missing_reason?: string | null;
};

// ---------------------------------------------------------------------------
// Const arrays (UI validation / selects)
// ---------------------------------------------------------------------------

export const CATALOG_ITEM_TYPES: readonly CatalogItemType[] = [
  "material",
  "labor",
  "service",
  "fee",
  "discount",
  "package",
] as const;

export const CATALOG_UNITS: readonly CatalogUnit[] = [
  "square",
  "sqft",
  "linear_foot",
  "each",
  "bundle",
  "hour",
  "day",
  "fixed",
  "allowance",
] as const;

export const QUANTITY_SOURCES: readonly QuantitySource[] = [
  "roof_squares",
  "adjusted_roof_squares",
  "roof_area_sqft",
  "eaves_lf",
  "rakes_lf",
  "ridges_lf",
  "hips_lf",
  "valleys_lf",
  "wall_flashing_lf",
  "step_flashing_lf",
  "transitions_lf",
  "parapet_wall_lf",
  "drip_edge_lf",
  "starter_lf",
  "ridge_cap_lf",
  "pipe_boots_count",
  "vents_count",
  "skylights_count",
  "chimneys_count",
  "satellite_dishes_count",
  "debris_tons",
  "tear_off_squares",
  "labor_multiplier",
  "fixed",
  "custom",
] as const;

export const PRICING_BASES: readonly PricingBasis[] = [
  "unit_price",
  "cost_plus_margin",
  "fixed_price",
  "included",
] as const;

export const CUSTOMER_VISIBILITIES: readonly CustomerVisibility[] = [
  "customer_visible",
  "internal_only",
  "grouped",
] as const;

export const COVERAGE_BASES: readonly CoverageBasis[] = [
  "roof_square",
  "square_feet",
  "linear_feet",
  "each",
  "tons",
] as const;

const MEASUREMENT_QUANTITY_SOURCES: ReadonlySet<QuantitySource> = new Set([
  "roof_squares",
  "adjusted_roof_squares",
  "roof_area_sqft",
  "eaves_lf",
  "rakes_lf",
  "ridges_lf",
  "hips_lf",
  "valleys_lf",
  "wall_flashing_lf",
  "step_flashing_lf",
  "transitions_lf",
  "parapet_wall_lf",
  "drip_edge_lf",
  "starter_lf",
  "ridge_cap_lf",
  "pipe_boots_count",
  "vents_count",
  "skylights_count",
  "chimneys_count",
  "satellite_dishes_count",
  "debris_tons",
  "tear_off_squares",
  "labor_multiplier",
]);

// ---------------------------------------------------------------------------
// Label helpers (pure)
// ---------------------------------------------------------------------------

const CATALOG_ITEM_TYPE_LABELS: Record<CatalogItemType, string> = {
  material: "Material",
  labor: "Labor",
  service: "Service",
  fee: "Fee",
  discount: "Discount",
  package: "Package",
};

const CATALOG_UNIT_LABELS: Record<CatalogUnit, string> = {
  square: "Square",
  sqft: "Sq ft",
  linear_foot: "Linear foot",
  each: "Each",
  bundle: "Bundle",
  hour: "Hour",
  day: "Day",
  fixed: "Fixed",
  allowance: "Allowance",
};

const QUANTITY_SOURCE_LABELS: Record<QuantitySource, string> = {
  roof_squares: "Roof squares",
  adjusted_roof_squares: "Adjusted roof squares",
  roof_area_sqft: "Roof area (sq ft)",
  eaves_lf: "Eaves (LF)",
  rakes_lf: "Rakes (LF)",
  ridges_lf: "Ridges (LF)",
  hips_lf: "Hips (LF)",
  valleys_lf: "Valleys (LF)",
  wall_flashing_lf: "Wall flashing (LF)",
  step_flashing_lf: "Step flashing (LF)",
  transitions_lf: "Transitions (LF)",
  parapet_wall_lf: "Parapet wall (LF)",
  drip_edge_lf: "Drip edge (LF)",
  starter_lf: "Starter (LF)",
  ridge_cap_lf: "Ridge cap (LF)",
  pipe_boots_count: "Pipe boots",
  vents_count: "Vents",
  skylights_count: "Skylights",
  chimneys_count: "Chimneys",
  satellite_dishes_count: "Satellite dishes",
  debris_tons: "Debris (tons)",
  tear_off_squares: "Tear-off squares",
  labor_multiplier: "Labor multiplier",
  fixed: "Fixed quantity",
  custom: "Custom",
};

const PRICING_BASIS_LABELS: Record<PricingBasis, string> = {
  unit_price: "Unit price",
  cost_plus_margin: "Cost plus margin",
  fixed_price: "Fixed price",
  included: "Included",
};

const CUSTOMER_VISIBILITY_LABELS: Record<CustomerVisibility, string> = {
  customer_visible: "Customer visible",
  internal_only: "Internal only",
  grouped: "Grouped",
};

const COVERAGE_BASIS_LABELS: Record<CoverageBasis, string> = {
  roof_square: "Roof squares",
  square_feet: "Square feet",
  linear_feet: "Linear feet",
  each: "Each/count",
  tons: "Tons",
};

export function catalogItemTypeLabel(value: CatalogItemType): string {
  return CATALOG_ITEM_TYPE_LABELS[value];
}

export function catalogUnitLabel(value: CatalogUnit): string {
  return CATALOG_UNIT_LABELS[value];
}

export function quantitySourceLabel(value: QuantitySource): string {
  return QUANTITY_SOURCE_LABELS[value];
}

export function pricingBasisLabel(value: PricingBasis): string {
  return PRICING_BASIS_LABELS[value];
}

export function customerVisibilityLabel(value: CustomerVisibility): string {
  return CUSTOMER_VISIBILITY_LABELS[value];
}

export function coverageBasisLabel(value: CoverageBasis): string {
  return COVERAGE_BASIS_LABELS[value];
}

export function isCoverageBasis(value: unknown): value is CoverageBasis {
  return (
    typeof value === "string" &&
    (COVERAGE_BASES as readonly string[]).includes(value)
  );
}

/** True when quantity is expected to come from a measurement field (not fixed/custom-only). */
export function isMeasurementQuantitySource(value: QuantitySource): boolean {
  return MEASUREMENT_QUANTITY_SOURCES.has(value);
}
