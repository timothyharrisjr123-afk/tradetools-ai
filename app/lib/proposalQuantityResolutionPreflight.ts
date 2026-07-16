/**
 * S3D6 — internal quantity resolution preflight (metadata only).
 *
 * Builds honest ProposalQuantityResolverInput for loaded draft lines (mirroring
 * create/refresh adapter joins), then summarizes S3D5 inspection results.
 *
 * Pure / unwired from getDraftGraph and UI. Not persisted. No auto-refresh.
 * No customer/public DTO exposure. Does not mutate quantities or pricing.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import {
  inspectLoadedDraftLinesQuantityResolution,
  type DraftLineQuantityResolutionInspection,
  type LoadedDraftLineForQuantityInspection,
} from "@/app/lib/proposalQuantityResolutionInspection";
import type { ProposalQuantityResolverInput } from "@/app/lib/proposalQuantityResolver";
import type { QuantityResolutionEchoStalenessStatus } from "@/app/lib/proposalQuantityResolutionStaleness";
import type { ProposalTemplateItem } from "@/app/lib/proposalTemplateTypes";

export type QuantityResolutionPreflightStatus = QuantityResolutionEchoStalenessStatus;

export type QuantityResolutionPreflightSummary = {
  status: QuantityResolutionPreflightStatus;
  staleCount: number;
  unknownCount: number;
  currentCount: number;
  byLineId: Record<string, DraftLineQuantityResolutionInspection>;
};

export type LoadedDraftLineForQuantityPreflight = LoadedDraftLineForQuantityInspection & {
  catalog_item_id?: string | null;
};

export type SummarizeLoadedDraftQuantityResolutionPreflightInput = {
  lines: readonly LoadedDraftLineForQuantityPreflight[];
  /** Template items keyed by template item id (source_template_item_id). */
  templateItemsById:
    | ReadonlyMap<string, ProposalTemplateItem>
    | Readonly<Record<string, ProposalTemplateItem>>;
  /** Catalog items keyed by catalog item id. */
  catalogItemsById:
    | ReadonlyMap<string, CatalogItem>
    | Readonly<Record<string, CatalogItem>>;
  /** Live measurement handoff + quantity map; null is honest (may yield unresolved). */
  quantityContext: ProposalQuantityPreviewContext | null | undefined;
};

function lookupById<T>(
  table:
    | ReadonlyMap<string, T>
    | Readonly<Record<string, T>>,
  id: string
): T | undefined {
  if (typeof (table as Map<string, T>).get === "function") {
    return (table as Map<string, T>).get(id);
  }
  return (table as Record<string, T>)[id];
}

/**
 * Build honest resolver input for one loaded draft line.
 * Returns null when template item context is missing (cannot recompute honestly).
 * Catalog may be null; measurement context may be null — both are honest.
 */
export function buildProposalQuantityResolverInputForLoadedDraftLine(input: {
  line: LoadedDraftLineForQuantityPreflight;
  templateItemsById:
    | ReadonlyMap<string, ProposalTemplateItem>
    | Readonly<Record<string, ProposalTemplateItem>>;
  catalogItemsById:
    | ReadonlyMap<string, CatalogItem>
    | Readonly<Record<string, CatalogItem>>;
  quantityContext: ProposalQuantityPreviewContext | null | undefined;
}): ProposalQuantityResolverInput | null {
  const templateItemId =
    typeof input.line.source_template_item_id === "string"
      ? input.line.source_template_item_id.trim()
      : "";
  if (!templateItemId) return null;

  const templateItem = lookupById(input.templateItemsById, templateItemId);
  if (templateItem == null) return null;

  const catalogItemId =
    typeof input.line.catalog_item_id === "string"
      ? input.line.catalog_item_id.trim()
      : typeof templateItem.catalog_item_id === "string"
        ? templateItem.catalog_item_id.trim()
        : "";
  const catalogItem =
    catalogItemId.length > 0
      ? lookupById(input.catalogItemsById, catalogItemId) ?? null
      : null;

  return {
    measurementHandoff: input.quantityContext?.measurementHandoff ?? null,
    quantityMap: input.quantityContext?.quantityMap ?? null,
    catalogItem,
    templateItem,
  };
}

function aggregatePreflightStatus(counts: {
  staleCount: number;
  unknownCount: number;
  currentCount: number;
}): QuantityResolutionPreflightStatus {
  if (counts.staleCount > 0) return "stale";
  if (counts.unknownCount > 0) return "unknown";
  return "current";
}

/**
 * Internal preflight summary for loaded draft lines.
 * Does not write DB, refresh pricing, or mutate line quantities/totals.
 */
export function summarizeLoadedDraftQuantityResolutionPreflight(
  input: SummarizeLoadedDraftQuantityResolutionPreflightInput
): QuantityResolutionPreflightSummary {
  const byLineId = inspectLoadedDraftLinesQuantityResolution({
    lines: input.lines,
    resolveInputForLine: (line) =>
      buildProposalQuantityResolverInputForLoadedDraftLine({
        line: line as LoadedDraftLineForQuantityPreflight,
        templateItemsById: input.templateItemsById,
        catalogItemsById: input.catalogItemsById,
        quantityContext: input.quantityContext,
      }),
  });

  let staleCount = 0;
  let unknownCount = 0;
  let currentCount = 0;

  for (const inspection of Object.values(byLineId)) {
    if (inspection.status === "stale") staleCount += 1;
    else if (inspection.status === "unknown") unknownCount += 1;
    else currentCount += 1;
  }

  return {
    status: aggregatePreflightStatus({ staleCount, unknownCount, currentCount }),
    staleCount,
    unknownCount,
    currentCount,
    byLineId,
  };
}
