/**
 * Optional Upgrade Truth — selection persistence (draft-only writes).
 *
 * Choices are first-class proposal-version truth stored separately from
 * proposal_line_items (mirrors proposalScopeDecisionStore). Merge into pricing
 * happens on refreshDraftPricing via resolveOptionUpgradeChoiceRows.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import {
  appendProposalEvent,
  isUuidLike,
  normalizeCompanyId,
  ProposalRecordStoreError,
  type ProposalOptionRow,
  type ProposalRecordStoreDeps,
  type ProposalRow,
  type ProposalVersionRow,
} from "@/app/lib/proposalRecordStore";
import type { ProposalStatus, ProposalVersionKind } from "@/app/lib/proposalLifecycleTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { getProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  isUpgradeTemplateItemRole,
  resolveTemplateUpgradeEffect,
} from "@/app/lib/proposalUpgradeTruth";
import {
  rowToProposalOptionUpgradeChoice,
  type ProposalOptionUpgradeChoice,
  type ProposalOptionUpgradeChoicePersistRow,
  type ProposalOptionUpgradeChoiceRow,
} from "@/app/lib/proposalUpgradeTruthTypes";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export type ProposalUpgradeChoiceStoreDeps = ProposalRecordStoreDeps & {
  getTemplateGraph?: (
    templateId: string,
    opts: { companyId: string }
  ) => Promise<ProposalTemplateGraph | null>;
};

function resolveDeps(deps?: ProposalUpgradeChoiceStoreDeps) {
  return {
    getSupabase: deps?.getSupabase ?? getSupabaseClient,
    getTemplateGraph: deps?.getTemplateGraph ?? getProposalTemplateGraph,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getUpgradeChoicesForDraftVersion(
  companyId: string,
  proposalVersionId: string,
  deps?: ProposalUpgradeChoiceStoreDeps
): Promise<ProposalOptionUpgradeChoice[]> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const versionId = (proposalVersionId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(versionId)) return [];

  try {
    const { data, error } = await supabase
      .from("proposal_option_upgrade_choices")
      .select("*")
      .eq("company_id", cid)
      .eq("proposal_version_id", versionId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return (data as ProposalOptionUpgradeChoiceRow[]).map(rowToProposalOptionUpgradeChoice);
  } catch {
    return [];
  }
}

/** Batch loader used by getDraftGraph / refreshDraftPricing. */
export async function getUpgradeChoicesForDraftGraph(
  companyId: string,
  proposalVersionId: string,
  deps?: ProposalUpgradeChoiceStoreDeps
): Promise<ProposalOptionUpgradeChoice[]> {
  return getUpgradeChoicesForDraftVersion(companyId, proposalVersionId, deps);
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

export function groupUpgradeChoicesByProposalOptionId(
  choices: readonly ProposalOptionUpgradeChoice[]
): Record<string, ProposalOptionUpgradeChoice[]> {
  const grouped: Record<string, ProposalOptionUpgradeChoice[]> = {};
  for (const choice of choices) {
    grouped[choice.proposalOptionId] = grouped[choice.proposalOptionId] ?? [];
    grouped[choice.proposalOptionId]!.push(choice);
  }
  return grouped;
}

export function upgradeChoiceToPersistRow(
  choice: ProposalOptionUpgradeChoice
): ProposalOptionUpgradeChoicePersistRow {
  return {
    source_template_item_id: choice.sourceTemplateItemId,
    selection_state: choice.selectionState,
    upgrade_effect: choice.upgradeEffect,
    replaces_source_template_item_id: choice.replacesSourceTemplateItemId,
  };
}

/** Group persisted choices by the template option id of their proposal option. */
export function groupUpgradeChoicePersistRowsByTemplateOptionId(
  choices: readonly ProposalOptionUpgradeChoice[],
  proposalOptionById: Map<string, { source_template_option_id: string | null }>
): Record<string, ProposalOptionUpgradeChoicePersistRow[]> {
  const grouped: Record<string, ProposalOptionUpgradeChoicePersistRow[]> = {};
  for (const choice of choices) {
    const optionRow = proposalOptionById.get(choice.proposalOptionId);
    const templateOptionId = optionRow?.source_template_option_id;
    if (!templateOptionId) continue;
    grouped[templateOptionId] = grouped[templateOptionId] ?? [];
    grouped[templateOptionId]!.push(upgradeChoiceToPersistRow(choice));
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Writes (draft-only)
// ---------------------------------------------------------------------------

async function loadMutableDraftContextForOption(
  companyId: string,
  proposalOptionId: string,
  deps?: ProposalUpgradeChoiceStoreDeps
): Promise<{
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>;
  proposal: ProposalRow;
  version: ProposalVersionRow;
  option: ProposalOptionRow;
}> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const optionId = (proposalOptionId ?? "").trim();

  if (!supabase || !cid || !isUuidLike(optionId)) {
    throw new ProposalRecordStoreError("Invalid company_id or proposal_option_id.");
  }

  const { data: optionData, error: optionError } = await supabase
    .from("proposal_options")
    .select("*")
    .eq("id", optionId)
    .eq("company_id", cid)
    .maybeSingle();

  if (optionError || !optionData) {
    throw new ProposalRecordStoreError("Proposal option not found.");
  }
  const option = optionData as ProposalOptionRow;

  const { data: versionData, error: versionError } = await supabase
    .from("proposal_versions")
    .select("*")
    .eq("id", option.proposal_version_id)
    .eq("company_id", cid)
    .maybeSingle();

  if (versionError || !versionData) {
    throw new ProposalRecordStoreError("Proposal version not found for option.");
  }
  const version = versionData as ProposalVersionRow;
  if ((version.version_kind as ProposalVersionKind) !== "draft") {
    throw new ProposalRecordStoreError(
      `Version ${version.id} is not mutable (kind=${version.version_kind}).`
    );
  }

  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", version.proposal_id)
    .eq("company_id", cid)
    .maybeSingle();

  if (proposalError || !proposalData) {
    throw new ProposalRecordStoreError("Proposal not found for option.");
  }
  const proposal = proposalData as ProposalRow;
  if ((proposal.status as ProposalStatus) !== "draft") {
    throw new ProposalRecordStoreError("Proposal is not in draft status.");
  }
  if (proposal.current_draft_version_id !== version.id) {
    throw new ProposalRecordStoreError(
      "Proposal option is not on the current draft version."
    );
  }

  return { supabase, proposal, version, option };
}

export async function upsertUpgradeChoiceSelection(
  companyId: string,
  proposalOptionId: string,
  sourceTemplateItemId: string,
  selectionState: "selected" | "not_selected",
  options?: { actorUserId?: string | null },
  deps?: ProposalUpgradeChoiceStoreDeps
): Promise<ProposalOptionUpgradeChoice> {
  const d = resolveDeps(deps);
  const cid = normalizeCompanyId(companyId);
  const templateItemId = (sourceTemplateItemId ?? "").trim();

  if (!cid || !isUuidLike(templateItemId)) {
    throw new ProposalRecordStoreError(
      "company_id and source_template_item_id are required UUIDs."
    );
  }
  if (selectionState !== "selected" && selectionState !== "not_selected") {
    throw new ProposalRecordStoreError(
      "selection_state must be 'selected' or 'not_selected'."
    );
  }

  const { supabase, proposal, version, option } = await loadMutableDraftContextForOption(
    cid,
    proposalOptionId,
    deps
  );

  const now = new Date().toISOString();
  const actorUserId = options?.actorUserId ?? null;

  const { data: existingRows, error: existingError } = await supabase
    .from("proposal_option_upgrade_choices")
    .select("*")
    .eq("company_id", cid)
    .eq("proposal_option_id", option.id)
    .eq("source_template_item_id", templateItemId);

  if (existingError) {
    throw new ProposalRecordStoreError(
      existingError.message ?? "Failed to look up existing upgrade choice."
    );
  }

  const existing = (existingRows ?? [])[0] as ProposalOptionUpgradeChoiceRow | undefined;
  let row: ProposalOptionUpgradeChoiceRow;

  if (existing) {
    const { data, error } = await supabase
      .from("proposal_option_upgrade_choices")
      .update({
        selection_state: selectionState,
        updated_at: now,
        updated_by: actorUserId,
      })
      .eq("id", existing.id)
      .eq("company_id", cid)
      .select("*")
      .single();

    if (error || !data) {
      throw new ProposalRecordStoreError(error?.message ?? "Failed to update upgrade choice.");
    }
    row = data as ProposalOptionUpgradeChoiceRow;
  } else {
    // No persisted choice yet — derive effect/replacement target from the template.
    const templateId = proposal.template_id;
    if (!templateId) {
      throw new ProposalRecordStoreError("Proposal has no template_id.");
    }
    const graph = await d.getTemplateGraph(templateId, { companyId: cid });
    if (!graph) {
      throw new ProposalRecordStoreError("Template graph not found.");
    }
    const templateItem = graph.items.find((item) => item.id === templateItemId);
    if (!templateItem || templateItem.template_id !== templateId) {
      throw new ProposalRecordStoreError(
        "source_template_item_id does not belong to the proposal template."
      );
    }
    if (
      option.source_template_option_id &&
      templateItem.option_id !== option.source_template_option_id
    ) {
      throw new ProposalRecordStoreError(
        "source_template_item_id does not belong to the target proposal option."
      );
    }
    if (!isUpgradeTemplateItemRole(templateItem.item_role)) {
      throw new ProposalRecordStoreError(
        "source_template_item_id is not an upgrade/optional_addon template item."
      );
    }

    const effect = resolveTemplateUpgradeEffect(templateItem) ?? "additive";
    const { data, error } = await supabase
      .from("proposal_option_upgrade_choices")
      .insert({
        company_id: cid,
        proposal_id: proposal.id,
        proposal_version_id: version.id,
        proposal_option_id: option.id,
        source_template_item_id: templateItemId,
        selection_state: selectionState,
        upgrade_effect: effect,
        replaces_source_template_item_id:
          effect === "replacement" ? templateItem.replaces_template_item_id ?? null : null,
        created_by: actorUserId,
        updated_by: actorUserId,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new ProposalRecordStoreError(error?.message ?? "Failed to insert upgrade choice.");
    }
    row = data as ProposalOptionUpgradeChoiceRow;
  }

  await appendProposalEvent(
    {
      company_id: cid,
      proposal_id: proposal.id,
      proposal_version_id: version.id,
      event_type: "draft_saved",
      actor_user_id: actorUserId,
      payload_json: {
        reason: "upgrade_choice_upsert",
        choice_id: row.id,
        proposal_option_id: option.id,
        source_template_item_id: templateItemId,
        selection_state: selectionState,
      },
    },
    deps
  );

  return rowToProposalOptionUpgradeChoice(row);
}
