/**
 * Pure catalog setup readiness for Job Card and Catalog workspace (read-only).
 *
 * Describes whether a company has usable catalog_items for future templates —
 * not proposal-ready (that stays on measurement handoff).
 *
 * State rules (evaluated in order):
 * 1. activeItemCount === 0:
 *    - starterDefinitionCount > 0 → starter_available
 *    - else → not_configured
 * 2. activeItemCount > 0 && measurementMappedItemCount < MIN_MEASUREMENT_MAPPED_FOR_READY
 *    → partial_mapping
 * 3. activeItemCount > 0 && measurementMappedItemCount >= MIN && pricedItemCount === 0
 *    → needs_pricing (items exist but no unit prices set)
 * 4. activeItemCount > 0 && measurementMappedItemCount >= MIN
 *    → ready_for_templates
 *
 * Counts:
 * - activeItemCount: length of active catalog items passed in
 * - measurementMappedItemCount: items whose quantity_source is a measurement field
 * - pricedItemCount: items with unit_price_cents set (informational only)
 *
 * No pricing math, proposal totals, React, or Supabase.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import { isMeasurementQuantitySource } from "@/app/lib/catalogTypes";

/** Minimum measurement-linked active items before catalog is template-ready. */
export const MIN_MEASUREMENT_MAPPED_FOR_READY = 8;

export type CatalogReadinessState =
  | "not_configured"
  | "starter_available"
  | "partial_mapping"
  | "needs_pricing"
  | "ready_for_templates";

export type CatalogReadinessSummary = {
  activeItemCount: number;
  measurementMappedItemCount: number;
  pricedItemCount: number;
  starterDefinitionCount: number;
  state: CatalogReadinessState;
};

function countMeasurementMappedItems(items: CatalogItem[]): number {
  return items.filter((item) => isMeasurementQuantitySource(item.quantity_source)).length;
}

function countPricedItems(items: CatalogItem[]): number {
  return items.filter(
    (item) => item.unit_price_cents != null && Number.isFinite(item.unit_price_cents)
  ).length;
}

export function deriveCatalogReadiness(
  activeItems: CatalogItem[],
  starterDefinitionCount: number
): CatalogReadinessSummary {
  const activeItemCount = activeItems.length;
  const measurementMappedItemCount = countMeasurementMappedItems(activeItems);
  const pricedItemCount = countPricedItems(activeItems);
  const starterCount = Math.max(0, Math.trunc(starterDefinitionCount));

  let state: CatalogReadinessState;

  if (activeItemCount === 0) {
    state = starterCount > 0 ? "starter_available" : "not_configured";
  } else if (measurementMappedItemCount < MIN_MEASUREMENT_MAPPED_FOR_READY) {
    state = "partial_mapping";
  } else if (pricedItemCount === 0) {
    state = "needs_pricing";
  } else {
    state = "ready_for_templates";
  }

  return {
    activeItemCount,
    measurementMappedItemCount,
    pricedItemCount,
    starterDefinitionCount: starterCount,
    state,
  };
}

export function formatCatalogReadinessLabel(summary: CatalogReadinessSummary): string {
  switch (summary.state) {
    case "not_configured":
      return "Not configured";
    case "starter_available":
      return "Starter catalog available";
    case "partial_mapping":
      return "Partially configured";
    case "needs_pricing":
      return "Needs pricing";
    case "ready_for_templates":
      return "Ready for templates";
    default:
      return "Not configured";
  }
}

export function formatCatalogNextStepCopy(summary: CatalogReadinessSummary): string {
  switch (summary.state) {
    case "not_configured":
      return "Open catalog setup to add items";
    case "starter_available":
      return "Install starter catalog in catalog setup";
    case "partial_mapping":
      return "Add more measurement-mapped catalog items in catalog setup";
    case "needs_pricing":
      return "Set unit prices on catalog items in catalog setup";
    case "ready_for_templates":
      return "Open proposal templates to install company templates";
    default:
      return "Open catalog setup";
  }
}

/** Count active items missing unit_price_cents (for setup hub pricing step). */
export function countUnpricedCatalogItems(items: CatalogItem[]): number {
  return items.filter(
    (item) => item.unit_price_cents == null || !Number.isFinite(item.unit_price_cents)
  ).length;
}

export function formatCatalogSectionStatus(
  summary: CatalogReadinessSummary
): { label: string; ready: boolean } {
  const label = formatCatalogReadinessLabel(summary);
  return {
    label,
    ready: summary.state === "ready_for_templates",
  };
}

/** Display for starter row when DB is empty but passive definitions exist. */
export function formatStarterCatalogAvailability(summary: CatalogReadinessSummary): string {
  if (summary.starterDefinitionCount <= 0) {
    return "Not available";
  }
  if (summary.activeItemCount > 0) {
    return "Installed";
  }
  return `${summary.starterDefinitionCount} items available, not installed`;
}
