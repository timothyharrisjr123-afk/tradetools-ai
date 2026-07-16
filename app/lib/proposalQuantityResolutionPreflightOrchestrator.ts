/**
 * S3D7 — internal quantity resolution preflight orchestrator (metadata only).
 *
 * Thin pure assembly layer: accepts already-loaded draft lines + template +
 * catalog + measurement context and calls summarizeLoadedDraftQuantityResolutionPreflight.
 *
 * Does not fetch from stores. Does not write DB. Does not auto-refresh.
 * Does not attach metadata to customer/public DTOs. Does not touch UI.
 * Dual-mode when wasteModel is supplied (default adjusted_measurement).
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import {
  summarizeLoadedDraftQuantityResolutionPreflight,
  type LoadedDraftLineForQuantityPreflight,
  type QuantityResolutionPreflightSummary,
} from "@/app/lib/proposalQuantityResolutionPreflight";
import type { WasteModel } from "@/app/lib/proposalPricingTypes";
import type { ProposalTemplateItem } from "@/app/lib/proposalTemplateTypes";

/**
 * Minimal loaded draft line slice needed for quantity echo preflight.
 * Compatible with ProposalLineItemRow from getDraftGraph.
 */
export type DraftLineRowForQuantityPreflightOrchestrator = {
  id: string;
  source_template_item_id?: string | null;
  catalog_item_id?: string | null;
  quantity?: number | null;
  customer_line_total_cents?: number | null;
  quantity_resolution_echo?: Record<string, unknown> | null;
};

export type DraftQuantityResolutionPreflightIdentity = {
  proposalId?: string | null;
  jobId?: string | null;
  templateId?: string | null;
};

export type OrchestrateDraftQuantityResolutionPreflightInput = {
  /** Loaded draft proposal_line_items (e.g. draft graph lineItems). */
  lineItems: readonly DraftLineRowForQuantityPreflightOrchestrator[];
  /**
   * Template items from the loaded template graph.
   * Null/undefined/empty → lines cannot rebuild honest current echo → unknown.
   */
  templateItems: readonly ProposalTemplateItem[] | null | undefined;
  /**
   * Company catalog items. Null/undefined treated as empty (honest).
   * Missing catalog for a line may yield unresolved → unknown, not invented stale.
   */
  catalogItems: readonly CatalogItem[] | null | undefined;
  /**
   * Live measurement handoff + quantity map.
   * Null is honest and may yield unresolved/unknown.
   */
  quantityContext: ProposalQuantityPreviewContext | null | undefined;
  /** From company/draft policy. Default adjusted_measurement. */
  wasteModel?: WasteModel | null;
  /** Optional caller identity — not used in comparison math. */
  identity?: DraftQuantityResolutionPreflightIdentity | null;
};

export type DraftQuantityResolutionPreflightOrchestratorResult =
  QuantityResolutionPreflightSummary & {
    identity: DraftQuantityResolutionPreflightIdentity | null;
  };

export function mapDraftLineItemsForQuantityPreflight(
  lineItems: readonly DraftLineRowForQuantityPreflightOrchestrator[]
): LoadedDraftLineForQuantityPreflight[] {
  return lineItems.map((line) => ({
    id: line.id,
    source_template_item_id: line.source_template_item_id ?? null,
    catalog_item_id: line.catalog_item_id ?? null,
    quantity_resolution_echo: line.quantity_resolution_echo ?? null,
  }));
}

export function buildTemplateItemsByIdForQuantityPreflight(
  templateItems: readonly ProposalTemplateItem[] | null | undefined
): Map<string, ProposalTemplateItem> {
  const map = new Map<string, ProposalTemplateItem>();
  if (templateItems == null) return map;
  for (const item of templateItems) {
    if (typeof item.id === "string" && item.id.trim().length > 0) {
      map.set(item.id.trim(), item);
    }
  }
  return map;
}

export function buildCatalogItemsByIdForQuantityPreflight(
  catalogItems: readonly CatalogItem[] | null | undefined
): Map<string, CatalogItem> {
  const map = new Map<string, CatalogItem>();
  if (catalogItems == null) return map;
  for (const item of catalogItems) {
    if (typeof item.id === "string" && item.id.trim().length > 0) {
      map.set(item.id.trim(), item);
    }
  }
  return map;
}

/**
 * Assemble already-loaded draft/template/catalog/measurement deps into an
 * internal quantity-resolution preflight summary.
 *
 * Pure: no Supabase, no persistence, no refresh, no UI.
 */
export function orchestrateDraftQuantityResolutionPreflight(
  input: OrchestrateDraftQuantityResolutionPreflightInput
): DraftQuantityResolutionPreflightOrchestratorResult {
  const summary = summarizeLoadedDraftQuantityResolutionPreflight({
    lines: mapDraftLineItemsForQuantityPreflight(input.lineItems),
    templateItemsById: buildTemplateItemsByIdForQuantityPreflight(input.templateItems),
    catalogItemsById: buildCatalogItemsByIdForQuantityPreflight(input.catalogItems),
    quantityContext: input.quantityContext ?? null,
    wasteModel: input.wasteModel,
  });

  return {
    ...summary,
    identity: input.identity ?? null,
  };
}
