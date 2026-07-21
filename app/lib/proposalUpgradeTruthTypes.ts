/**
 * Optional Upgrade Truth — shared type contract.
 *
 * Separates package-included enhancements from true optional add-ons.
 * Selection is first-class proposal-version truth, not inferred from role/section.
 */

export const PROPOSAL_UPGRADE_EFFECTS = ["additive", "replacement"] as const;
export type ProposalUpgradeEffect = (typeof PROPOSAL_UPGRADE_EFFECTS)[number];

export const PROPOSAL_UPGRADE_SELECTION_STATES = [
  "selected",
  "not_selected",
  "legacy_unknown",
] as const;
export type ProposalUpgradeSelectionState = (typeof PROPOSAL_UPGRADE_SELECTION_STATES)[number];

export type ProposalOptionUpgradeChoice = {
  id: string;
  companyId: string;
  proposalId: string;
  proposalVersionId: string;
  proposalOptionId: string;
  sourceTemplateItemId: string;
  selectionState: Exclude<ProposalUpgradeSelectionState, "legacy_unknown">;
  upgradeEffect: ProposalUpgradeEffect;
  replacesSourceTemplateItemId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProposalOptionUpgradeChoiceRow = {
  id: string;
  company_id: string;
  proposal_id: string;
  proposal_version_id: string;
  proposal_option_id: string;
  source_template_item_id: string;
  selection_state: "selected" | "not_selected";
  upgrade_effect: ProposalUpgradeEffect;
  replaces_source_template_item_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalOptionUpgradeChoicePersistRow = {
  source_template_item_id: string;
  selection_state: "selected" | "not_selected";
  upgrade_effect: ProposalUpgradeEffect;
  replaces_source_template_item_id: string | null;
};

export function isProposalUpgradeEffect(value: unknown): value is ProposalUpgradeEffect {
  return value === "additive" || value === "replacement";
}

export function isProposalUpgradeSelectionState(
  value: unknown
): value is ProposalUpgradeSelectionState {
  return value === "selected" || value === "not_selected" || value === "legacy_unknown";
}

export function rowToProposalOptionUpgradeChoice(
  row: ProposalOptionUpgradeChoiceRow
): ProposalOptionUpgradeChoice {
  return {
    id: row.id,
    companyId: row.company_id,
    proposalId: row.proposal_id,
    proposalVersionId: row.proposal_version_id,
    proposalOptionId: row.proposal_option_id,
    sourceTemplateItemId: row.source_template_item_id,
    selectionState: row.selection_state,
    upgradeEffect: row.upgrade_effect,
    replacesSourceTemplateItemId: row.replaces_source_template_item_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Whether an upgrade line may contribute to customer/internal totals.
 * Unselected and legacy_unknown never contribute. Missing selection on an
 * upgrade-scoped line defaults to not contributing (safe new truth).
 */
export function upgradeLineContributesToTotals(params: {
  isUpgradeLine: boolean;
  selectionState: ProposalUpgradeSelectionState | null | undefined;
}): boolean {
  if (!params.isUpgradeLine) return true;
  return params.selectionState === "selected";
}

/**
 * Resolve initial selection for a newly instantiated upgrade.
 * V1 product default is not_selected unless template explicitly sets default_selected.
 */
export function resolveInitialUpgradeSelectionState(
  defaultSelected: boolean | null | undefined
): "selected" | "not_selected" {
  return defaultSelected === true ? "selected" : "not_selected";
}
