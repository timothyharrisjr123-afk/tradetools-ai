/**
 * S3D5 / Phase 5 — internal draft quantity_resolution_echo inspection (metadata only).
 *
 * Composes adapter current-echo + compare for loaded draft lines.
 * Dual-mode: adjusted (default) or raw_plus_waste when wasteModel selects it.
 *
 * Not persisted. Not customer/public. No UI. No auto-refresh. No DB writes.
 * Does not mutate line quantities or pricing.
 */

import {
  resolveProposalLineQuantityViaAdapter,
  type QuantityResolutionEcho,
} from "@/app/lib/proposalQuantityResolutionAdapter";
import type { ProposalQuantityResolverInput } from "@/app/lib/proposalQuantityResolver";
import {
  compareAdjustedQuantityResolutionEcho,
  compareRawPlusWasteQuantityResolutionEcho,
  type QuantityResolutionEchoStalenessReason,
  type QuantityResolutionEchoStalenessStatus,
} from "@/app/lib/proposalQuantityResolutionStaleness";
import type { WasteModel } from "@/app/lib/proposalPricingTypes";
import type { RawPlusWasteQuantityResolutionEcho } from "@/app/lib/proposalQuantityResolutionDisabledRawBranch";
import type { AdjustedQuantityResolutionEcho } from "@/app/lib/proposalQuantityResolutionAdapter";

export type DraftLineQuantityResolutionInspection = {
  /** proposal_line_items.id when available. */
  lineId: string | null;
  /** source_template_item_id when available. */
  sourceTemplateItemId: string | null;
  status: QuantityResolutionEchoStalenessStatus;
  reasons: QuantityResolutionEchoStalenessReason[];
  previous: Record<string, unknown> | null;
  current: QuantityResolutionEcho | null;
};

export type InspectLoadedDraftLineQuantityResolutionInput = {
  lineId?: string | null;
  sourceTemplateItemId?: string | null;
  /** Persisted proposal_line_items.quantity_resolution_echo. */
  persistedEcho: unknown;
  /**
   * Honest live resolver inputs for this line. When null/undefined, inspection
   * returns unknown (missing_current_echo) rather than inventing values.
   */
  resolverInput: ProposalQuantityResolverInput | null | undefined;
  /** From company/draft policy. Default adjusted_measurement. */
  wasteModel?: WasteModel | null;
};

function toInspection(
  lineId: string | null,
  sourceTemplateItemId: string | null,
  result: {
    status: QuantityResolutionEchoStalenessStatus;
    reasons: QuantityResolutionEchoStalenessReason[];
    previous: Record<string, unknown> | null;
    current: QuantityResolutionEcho | null;
  }
): DraftLineQuantityResolutionInspection {
  return {
    lineId,
    sourceTemplateItemId,
    status: result.status,
    reasons: result.reasons,
    previous: result.previous,
    current: result.current,
  };
}

/**
 * Inspect one loaded draft line's persisted echo against current adapter echo.
 * Pure / internal metadata only.
 */
export function inspectLoadedDraftLineQuantityResolution(
  input: InspectLoadedDraftLineQuantityResolutionInput
): DraftLineQuantityResolutionInspection {
  const lineId =
    typeof input.lineId === "string" && input.lineId.trim().length > 0
      ? input.lineId.trim()
      : null;
  const sourceTemplateItemId =
    typeof input.sourceTemplateItemId === "string" &&
    input.sourceTemplateItemId.trim().length > 0
      ? input.sourceTemplateItemId.trim()
      : null;

  const wasteModel = input.wasteModel ?? "adjusted_measurement";

  if (input.resolverInput == null) {
    if (wasteModel === "raw_plus_waste") {
      return toInspection(
        lineId,
        sourceTemplateItemId,
        compareRawPlusWasteQuantityResolutionEcho({
          persistedEcho: input.persistedEcho,
          currentEcho: null,
        })
      );
    }
    return toInspection(
      lineId,
      sourceTemplateItemId,
      compareAdjustedQuantityResolutionEcho({
        persistedEcho: input.persistedEcho,
        currentEcho: null,
      })
    );
  }

  const adapted = resolveProposalLineQuantityViaAdapter(input.resolverInput, {
    wasteModel,
  });

  if (wasteModel === "raw_plus_waste") {
    return toInspection(
      lineId,
      sourceTemplateItemId,
      compareRawPlusWasteQuantityResolutionEcho({
        persistedEcho: input.persistedEcho,
        currentEcho: adapted.quantityResolutionEcho as RawPlusWasteQuantityResolutionEcho,
        currentPreviewUnresolved: adapted.preview.unresolved === true,
      })
    );
  }

  return toInspection(
    lineId,
    sourceTemplateItemId,
    compareAdjustedQuantityResolutionEcho({
      persistedEcho: input.persistedEcho,
      currentEcho: adapted.quantityResolutionEcho as AdjustedQuantityResolutionEcho,
      currentPreviewUnresolved: adapted.preview.unresolved === true,
    })
  );
}

export type LoadedDraftLineForQuantityInspection = {
  id?: string | null;
  source_template_item_id?: string | null;
  quantity_resolution_echo?: Record<string, unknown> | null;
};

/**
 * Inspect many loaded draft lines. Keyed by line id when present; otherwise by
 * source_template_item_id; otherwise skipped (no key).
 *
 * `resolveInputForLine` must return honest resolver inputs or null.
 * Results are not persisted and must not be copied onto customer/public DTOs.
 */
export function inspectLoadedDraftLinesQuantityResolution(input: {
  lines: readonly LoadedDraftLineForQuantityInspection[];
  resolveInputForLine: (
    line: LoadedDraftLineForQuantityInspection
  ) => ProposalQuantityResolverInput | null | undefined;
  wasteModel?: WasteModel | null;
}): Record<string, DraftLineQuantityResolutionInspection> {
  const out: Record<string, DraftLineQuantityResolutionInspection> = {};

  for (const line of input.lines) {
    const lineId =
      typeof line.id === "string" && line.id.trim().length > 0
        ? line.id.trim()
        : null;
    const sourceTemplateItemId =
      typeof line.source_template_item_id === "string" &&
      line.source_template_item_id.trim().length > 0
        ? line.source_template_item_id.trim()
        : null;
    const key = lineId ?? sourceTemplateItemId;
    if (key == null) continue;

    out[key] = inspectLoadedDraftLineQuantityResolution({
      lineId,
      sourceTemplateItemId,
      persistedEcho: line.quantity_resolution_echo ?? null,
      resolverInput: input.resolveInputForLine(line),
      wasteModel: input.wasteModel,
    });
  }

  return out;
}
