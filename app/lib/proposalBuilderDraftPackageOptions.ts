/**
 * Builder package picker truth — draft option scoped.
 *
 * Package choices shown after a draft exists must come from saved proposal_options.
 * Live template options that are not on the draft must not appear as selectable.
 * Pure helpers — no React, store writes, or pricing math.
 */

import type { ProposalDraftGraph, ProposalOptionRow } from "@/app/lib/proposalRecordStore";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateOption } from "@/app/lib/proposalTemplateTypes";

export const BUILDER_ONLY_ONE_PACKAGE_NOTE =
  "Only one package exists on this draft." as const;

export const JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE =
  "Package changes happen in Builder for this draft." as const;

/** Draft options that can participate in Builder package selection. */
export function listDraftPackageOptions(
  draftGraph: ProposalDraftGraph | null | undefined
): ProposalOptionRow[] {
  if (!draftGraph?.options?.length) return [];
  return [...draftGraph.options]
    .filter((row) => {
      const sourceId = (row.source_template_option_id ?? "").trim();
      const runtimeId = (row.id ?? "").trim();
      return sourceId.length > 0 || runtimeId.length > 0;
    })
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function countDraftPackageOptions(
  draftGraph: ProposalDraftGraph | null | undefined
): number {
  return listDraftPackageOptions(draftGraph).length;
}

/** Change package is only useful when the draft snapshot has 2+ options. */
export function canChangeBuilderDraftPackage(optionCount: number): boolean {
  return optionCount >= 2;
}

function synthesizeTemplateOptionFromDraft(
  draftOption: ProposalOptionRow,
  sourceTemplateOptionId: string,
  templateId: string
): ProposalTemplateOption {
  return {
    id: sourceTemplateOptionId,
    template_id: templateId,
    name: (draftOption.name ?? "").trim() || "Package",
    customer_label: draftOption.customer_label,
    description: null,
    selection_mode: "single",
    is_default: Boolean(draftOption.is_default),
    visible_to_customer: draftOption.visible_to_customer !== false,
    sort_order: draftOption.sort_order ?? 0,
    metadata: null,
  };
}

/**
 * Scope a live template graph's options to those present on the draft.
 *
 * - No draft (setup preview): return the live template graph unchanged.
 * - With draft: options list is draft-driven; live template supplies matching
 *   option rows for labels/details only. Live-only options are dropped.
 * - Draft options missing from the live template are synthesized from draft rows
 *   so the picker stays truthful without importing new live packages.
 */
export function scopeTemplateGraphToDraftPackageOptions(
  templateGraph: ProposalTemplateGraph | null,
  draftGraph: ProposalDraftGraph | null | undefined
): ProposalTemplateGraph | null {
  if (!templateGraph) return null;
  if (!draftGraph) return templateGraph;

  const draftOptions = listDraftPackageOptions(draftGraph);
  if (draftOptions.length === 0) {
    return { ...templateGraph, options: [] };
  }

  const templateById = new Map(
    templateGraph.options.map((option) => [option.id, option] as const)
  );
  const templateId = (templateGraph.template.id ?? "").trim();
  const scoped: ProposalTemplateOption[] = [];
  const seen = new Set<string>();

  for (const draftOption of draftOptions) {
    const sourceId = (draftOption.source_template_option_id ?? "").trim();
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);

    const live = templateById.get(sourceId);
    if (live) {
      scoped.push(live);
      continue;
    }

    scoped.push(
      synthesizeTemplateOptionFromDraft(draftOption, sourceId, templateId)
    );
  }

  return {
    ...templateGraph,
    options: scoped,
  };
}

/** True when a template option id is present on the draft snapshot. */
export function isTemplateOptionOnDraft(
  draftGraph: ProposalDraftGraph | null | undefined,
  templateOptionId: string | null | undefined
): boolean {
  const id = (templateOptionId ?? "").trim();
  if (!id || !draftGraph) return false;
  return draftGraph.options.some(
    (option) => (option.source_template_option_id ?? "").trim() === id
  );
}
