/**
 * Pure proposal template setup readiness (company-level).
 *
 * Combines catalog readiness, installed starter template graph, and catalog
 * pricing on linked line items. Does not enable Proposal Builder, create
 * proposals, or run pricing math.
 *
 * No React, Supabase, or store writes.
 */

import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { ROOF_REPLACEMENT_CORE_LINE_ITEMS } from "@/app/lib/defaultRoofingProposalTemplates";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type {
  ProposalTemplateReadiness,
  ProposalTemplateReadinessStatus,
} from "@/app/lib/proposalTemplateTypes";
import { proposalTemplateReadinessStatusLabel } from "@/app/lib/proposalTemplateTypes";

/** Standard / Enhanced / Premium options on the starter template. */
export const MIN_STARTER_TEMPLATE_OPTIONS = 3;

/** Minimum linked core line items (standard package) before builder readiness. */
export const MIN_STARTER_LINKED_LINE_ITEMS = ROOF_REPLACEMENT_CORE_LINE_ITEMS.length;

export type DeriveProposalTemplateReadinessInput = {
  catalogReadiness: CatalogReadinessSummary;
  activeCatalogItems: CatalogItem[];
  starterGraph: ProposalTemplateGraph | null;
  templateCount?: number;
  activeTemplateCount?: number;
  lastInstallMissingCatalogSeedKeys?: readonly string[];
};

type GraphLinkMetrics = {
  option_count: number;
  section_count: number;
  item_count: number;
  linked_catalog_item_count: number;
  missing_catalog_item_count: number;
  priced_catalog_item_count: number;
  unpriced_linked_catalog_item_count: number;
};

function isCatalogItemPriced(item: CatalogItem): boolean {
  return item.unit_price_cents != null && Number.isFinite(item.unit_price_cents);
}

function buildCatalogItemById(items: CatalogItem[]): Map<string, CatalogItem> {
  const map = new Map<string, CatalogItem>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
}

function computeGraphLinkMetrics(
  graph: ProposalTemplateGraph | null,
  catalogById: Map<string, CatalogItem>
): GraphLinkMetrics {
  if (!graph) {
    return {
      option_count: 0,
      section_count: 0,
      item_count: 0,
      linked_catalog_item_count: 0,
      missing_catalog_item_count: 0,
      priced_catalog_item_count: 0,
      unpriced_linked_catalog_item_count: 0,
    };
  }

  const { options, sections, items } = graph;
  let linked = 0;
  let missing = 0;
  let priced = 0;
  let unpricedLinked = 0;

  for (const row of items) {
    const catalogId =
      row.catalog_item_id != null ? String(row.catalog_item_id).trim() : "";
    if (!catalogId) {
      missing += 1;
      continue;
    }
    linked += 1;
    const catalogRow = catalogById.get(catalogId);
    if (catalogRow && isCatalogItemPriced(catalogRow)) {
      priced += 1;
    } else {
      unpricedLinked += 1;
    }
  }

  return {
    option_count: options.length,
    section_count: sections.length,
    item_count: items.length,
    linked_catalog_item_count: linked,
    missing_catalog_item_count: missing,
    priced_catalog_item_count: priced,
    unpriced_linked_catalog_item_count: unpricedLinked,
  };
}

function isStarterGraphStructurallyIncomplete(
  metrics: GraphLinkMetrics,
  missingSeedKeys: readonly string[]
): boolean {
  if (missingSeedKeys.length > 0) return true;
  if (metrics.option_count < MIN_STARTER_TEMPLATE_OPTIONS) return true;
  if (metrics.section_count === 0) return true;
  if (metrics.item_count === 0) return true;
  if (metrics.linked_catalog_item_count === 0) return true;
  if (metrics.missing_catalog_item_count > 0) return true;
  if (metrics.linked_catalog_item_count < MIN_STARTER_LINKED_LINE_ITEMS) return true;
  return false;
}

function buildMissingRequiredFields(
  metrics: GraphLinkMetrics,
  missingSeedKeys: readonly string[]
): string[] | undefined {
  const fields: string[] = [];
  if (metrics.option_count < MIN_STARTER_TEMPLATE_OPTIONS) {
    fields.push(`options (need ${MIN_STARTER_TEMPLATE_OPTIONS})`);
  }
  if (metrics.linked_catalog_item_count < MIN_STARTER_LINKED_LINE_ITEMS) {
    fields.push(`linked line items (need ${MIN_STARTER_LINKED_LINE_ITEMS})`);
  }
  if (metrics.missing_catalog_item_count > 0) {
    fields.push("catalog links on template line items");
  }
  for (const key of missingSeedKeys) {
    fields.push(`catalog seed: ${key}`);
  }
  return fields.length > 0 ? fields : undefined;
}

export function deriveProposalTemplateReadiness(
  input: DeriveProposalTemplateReadinessInput
): ProposalTemplateReadiness {
  const {
    catalogReadiness,
    activeCatalogItems,
    starterGraph,
    templateCount = starterGraph ? 1 : 0,
    activeTemplateCount = starterGraph?.template.active ? 1 : starterGraph ? 1 : 0,
    lastInstallMissingCatalogSeedKeys = [],
  } = input;

  const missingSeedKeys = [...lastInstallMissingCatalogSeedKeys];
  const catalogById = buildCatalogItemById(activeCatalogItems);
  const metrics = computeGraphLinkMetrics(starterGraph, catalogById);

  const base: ProposalTemplateReadiness = {
    status: "not_started",
    template_count: templateCount,
    active_template_count: activeTemplateCount,
    option_count: metrics.option_count,
    section_count: metrics.section_count,
    item_count: metrics.item_count,
    linked_catalog_item_count: metrics.linked_catalog_item_count,
    missing_catalog_item_count: metrics.missing_catalog_item_count,
    priced_catalog_item_count: metrics.priced_catalog_item_count,
  };

  const hasStarterGraph = starterGraph != null;
  const catalogReady = catalogReadiness.state === "ready_for_templates";

  if (catalogReadiness.activeItemCount === 0 && !hasStarterGraph) {
    return { ...base, status: "not_started" };
  }

  if (!catalogReady) {
    return { ...base, status: "needs_catalog" };
  }

  if (
    !hasStarterGraph ||
    isStarterGraphStructurallyIncomplete(metrics, missingSeedKeys)
  ) {
    return {
      ...base,
      status: "needs_items",
      missing_required_fields: buildMissingRequiredFields(metrics, missingSeedKeys),
    };
  }

  if (metrics.unpriced_linked_catalog_item_count > 0) {
    return {
      ...base,
      status: "needs_pricing",
      missing_required_fields: ["unit prices on catalog items linked to template lines"],
    };
  }

  return { ...base, status: "ready_for_builder" };
}

export function formatProposalTemplateReadinessLabel(
  readiness: ProposalTemplateReadiness
): string {
  return proposalTemplateReadinessStatusLabel(readiness.status);
}

export function formatProposalTemplateNextStepCopy(
  readiness: ProposalTemplateReadiness
): string {
  switch (readiness.status) {
    case "not_started":
      return "Install starter catalog and the starter proposal template to begin company setup.";
    case "needs_catalog":
      return "Finish catalog setup (measurement-mapped items and pricing) before template install can complete.";
    case "needs_items":
      if (readiness.missing_required_fields?.length) {
        return `Install or recheck the starter template — still needed: ${readiness.missing_required_fields.join(", ")}.`;
      }
      return "Install or recheck the starter template so all options and catalog-linked line items are present.";
    case "needs_pricing":
      return "Set unit prices on catalog items linked to template line items in catalog setup.";
    case "ready_for_builder":
      return "Template setup is ready. Proposal Builder opens from Job Card in a later stage.";
    default:
      return "Complete catalog and template setup on this page.";
  }
}

export function formatProposalTemplateReadinessSectionStatus(
  readiness: ProposalTemplateReadiness
): { label: string; ready: boolean } {
  return {
    label: formatProposalTemplateReadinessLabel(readiness),
    ready: readiness.status === "ready_for_builder",
  };
}

export function proposalTemplateReadinessStatusPillClass(
  status: ProposalTemplateReadinessStatus
): string {
  const base =
    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1";
  if (status === "needs_pricing") {
    return `${base} bg-amber-50 text-amber-800 ring-amber-200`;
  }
  if (status === "ready_for_builder") {
    return `${base} bg-emerald-50 text-emerald-800 ring-emerald-200`;
  }
  if (status === "not_started") {
    return `${base} bg-slate-100 text-slate-600 ring-slate-200`;
  }
  return `${base} bg-amber-50 text-amber-800 ring-amber-200`;
}
