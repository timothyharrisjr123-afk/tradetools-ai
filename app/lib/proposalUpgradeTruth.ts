/**
 * Optional Upgrade Truth — pure helpers for template definition and selection merge.
 */

import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateItem } from "@/app/lib/proposalTemplateTypes";
import type { PricingLineInput, UpgradeScopeRef } from "@/app/lib/proposalPricingTypes";
import {
  isProposalUpgradeEffect,
  resolveInitialUpgradeSelectionState,
  type ProposalOptionUpgradeChoicePersistRow,
  type ProposalUpgradeEffect,
  type ProposalUpgradeSelectionState,
} from "@/app/lib/proposalUpgradeTruthTypes";

export function isUpgradeTemplateItemRole(role: string | null | undefined): boolean {
  const normalized = (role ?? "").trim().toLowerCase();
  return normalized === "upgrade" || normalized === "optional_addon";
}

export function resolveTemplateUpgradeEffect(
  templateItem: Pick<ProposalTemplateItem, "item_role" | "upgrade_effect">
): ProposalUpgradeEffect | null {
  if (!isUpgradeTemplateItemRole(templateItem.item_role)) return null;
  if (isProposalUpgradeEffect(templateItem.upgrade_effect)) {
    return templateItem.upgrade_effect;
  }
  return "additive";
}

export function resolveTemplateUpgradeSelectionState(
  templateItem: Pick<ProposalTemplateItem, "item_role" | "default_selected">,
  choiceSelection: ProposalUpgradeSelectionState | null | undefined
): ProposalUpgradeSelectionState | null {
  if (!isUpgradeTemplateItemRole(templateItem.item_role)) return null;
  if (choiceSelection === "selected" || choiceSelection === "not_selected") {
    return choiceSelection;
  }
  if (choiceSelection === "legacy_unknown") return "legacy_unknown";
  return resolveInitialUpgradeSelectionState(templateItem.default_selected);
}

export function buildUpgradeScopeRef(params: {
  templateItem: ProposalTemplateItem;
  optionId: string;
  selectionState?: ProposalUpgradeSelectionState | null;
}): UpgradeScopeRef | null {
  const { templateItem, optionId, selectionState } = params;
  if (!isUpgradeTemplateItemRole(templateItem.item_role)) return null;
  if (templateItem.option_id !== optionId) return null;

  const effect = resolveTemplateUpgradeEffect(templateItem);
  const resolvedSelection = resolveTemplateUpgradeSelectionState(templateItem, selectionState);

  return {
    parentOptionId: optionId,
    isSelectedByDefault: templateItem.default_selected === true,
    selectionState: resolvedSelection,
    effect,
    replacesTemplateItemId:
      effect === "replacement" ? templateItem.replaces_template_item_id ?? null : null,
  };
}

export type UpgradeChoiceByTemplateItemId = ReadonlyMap<
  string,
  { selectionState: ProposalUpgradeSelectionState; upgradeEffect?: ProposalUpgradeEffect | null }
>;

/**
 * Apply upgrade selection/replacement contribution gates onto mapped pricing lines.
 * - Unselected upgrades do not contribute (selectionState not selected).
 * - Selected replacement upgrades suppress the replaced base line via hidden exclusion set.
 */
export function applyUpgradeTruthToPricingLines(params: {
  optionId: string;
  lines: PricingLineInput[];
  graph: ProposalTemplateGraph;
  choicesByTemplateItemId?: UpgradeChoiceByTemplateItemId | null;
}): { lines: PricingLineInput[]; suppressedTemplateItemIds: Set<string> } {
  const { optionId, graph, choicesByTemplateItemId } = params;
  const suppressedTemplateItemIds = new Set<string>();

  const withScope = params.lines.map((line) => {
    const templateItem = graph.items.find((item) => item.id === line.templateItemId);
    if (!templateItem) return { ...line, suppressedByReplacement: false };

    const choice = choicesByTemplateItemId?.get(line.templateItemId);
    const upgradeScope = buildUpgradeScopeRef({
      templateItem,
      optionId,
      selectionState: choice?.selectionState ?? line.upgradeScope?.selectionState ?? null,
    });

    if (!upgradeScope) {
      return { ...line, upgradeScope: null, suppressedByReplacement: false };
    }

    if (
      upgradeScope.selectionState === "selected" &&
      upgradeScope.effect === "replacement" &&
      upgradeScope.replacesTemplateItemId
    ) {
      suppressedTemplateItemIds.add(upgradeScope.replacesTemplateItemId);
    }

    return {
      ...line,
      upgradeScope,
      suppressedByReplacement: false,
    };
  });

  const lines = withScope.map((line) => {
    if (!suppressedTemplateItemIds.has(line.templateItemId)) {
      return line;
    }
    return {
      ...line,
      suppressedByReplacement: true,
    };
  });

  return { lines, suppressedTemplateItemIds };
}

export function buildInitialUpgradeChoicePersistRows(params: {
  graph: ProposalTemplateGraph;
  optionId: string;
}): ProposalOptionUpgradeChoicePersistRow[] {
  const rows: ProposalOptionUpgradeChoicePersistRow[] = [];
  for (const item of params.graph.items) {
    if (item.option_id !== params.optionId) continue;
    if (!isUpgradeTemplateItemRole(item.item_role)) continue;
    const effect = resolveTemplateUpgradeEffect(item);
    rows.push({
      source_template_item_id: item.id,
      selection_state: resolveInitialUpgradeSelectionState(item.default_selected),
      upgrade_effect: effect ?? "additive",
      replaces_source_template_item_id:
        effect === "replacement" ? item.replaces_template_item_id ?? null : null,
    });
  }
  return rows;
}

/**
 * Merge persisted upgrade choices with current template upgrade definitions.
 * - Selection state comes from the persisted choice when present.
 * - Effect/replacement target always re-derive from the template (definition truth).
 * - Upgrade items with no persisted choice initialize per template default (not_selected).
 * - Persisted rows whose source item is no longer an upgrade on this option are dropped.
 */
export function mergeUpgradeChoicePersistRowsWithTemplateDefaults(params: {
  graph: ProposalTemplateGraph;
  optionId: string;
  existing: readonly ProposalOptionUpgradeChoicePersistRow[];
}): ProposalOptionUpgradeChoicePersistRow[] {
  const existingBySourceId = new Map(
    params.existing.map((row) => [row.source_template_item_id, row] as const)
  );
  return buildInitialUpgradeChoicePersistRows(params).map((defaults) => {
    const existing = existingBySourceId.get(defaults.source_template_item_id);
    if (!existing) return defaults;
    return {
      ...defaults,
      selection_state: existing.selection_state,
    };
  });
}

export type ResolvedOptionUpgradeChoiceRows = {
  rows: ProposalOptionUpgradeChoicePersistRow[];
  choicesByTemplateItemId: UpgradeChoiceByTemplateItemId;
};

/**
 * Resolve the effective upgrade choice rows for one option at snapshot-build time.
 * With no explicit choices (draft create) rows are the template-default initial set.
 */
export function resolveOptionUpgradeChoiceRows(params: {
  graph: ProposalTemplateGraph;
  optionId: string;
  explicit?: readonly ProposalOptionUpgradeChoicePersistRow[] | null;
}): ResolvedOptionUpgradeChoiceRows {
  const rows = params.explicit
    ? mergeUpgradeChoicePersistRowsWithTemplateDefaults({
        graph: params.graph,
        optionId: params.optionId,
        existing: params.explicit,
      })
    : buildInitialUpgradeChoicePersistRows({
        graph: params.graph,
        optionId: params.optionId,
      });
  return {
    rows,
    choicesByTemplateItemId: upgradeChoicesToMap(rows),
  };
}

/**
 * Extract Upgrade Truth line echoes from a mapped pricing line's upgradeScope.
 * legacy_unknown selection maps to null (echo columns store definite states only).
 */
export function upgradeLineEchoesFromPricingLine(line: PricingLineInput): {
  upgradeSelectionState: "selected" | "not_selected" | null;
  upgradeEffect: ProposalUpgradeEffect | null;
  replacesSourceTemplateItemId: string | null;
} {
  const scope = line.upgradeScope;
  const selectionState =
    scope?.selectionState === "selected" || scope?.selectionState === "not_selected"
      ? scope.selectionState
      : null;
  return {
    upgradeSelectionState: selectionState,
    upgradeEffect: scope?.effect ?? null,
    replacesSourceTemplateItemId: scope?.replacesTemplateItemId ?? null,
  };
}

export function upgradeChoicesToMap(
  choices: readonly {
    sourceTemplateItemId?: string;
    source_template_item_id?: string;
    selectionState?: ProposalUpgradeSelectionState;
    selection_state?: ProposalUpgradeSelectionState;
    upgradeEffect?: ProposalUpgradeEffect | null;
    upgrade_effect?: ProposalUpgradeEffect | null;
  }[]
): UpgradeChoiceByTemplateItemId {
  const map = new Map<
    string,
    { selectionState: ProposalUpgradeSelectionState; upgradeEffect?: ProposalUpgradeEffect | null }
  >();
  for (const choice of choices) {
    const id = (choice.sourceTemplateItemId ?? choice.source_template_item_id ?? "").trim();
    if (!id) continue;
    const selectionState = choice.selectionState ?? choice.selection_state;
    if (
      selectionState !== "selected" &&
      selectionState !== "not_selected" &&
      selectionState !== "legacy_unknown"
    ) {
      continue;
    }
    map.set(id, {
      selectionState,
      upgradeEffect: choice.upgradeEffect ?? choice.upgrade_effect ?? null,
    });
  }
  return map;
}
