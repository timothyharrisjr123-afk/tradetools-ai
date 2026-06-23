/**
 * R17D Phase 2+ — orchestrated scope decision actions (upsert + trusted refresh).
 */

import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import {
  refreshDraftPricing,
  type ProposalDraftGraph,
  type ProposalRecordStoreDeps,
} from "@/app/lib/proposalRecordStore";
import {
  clearDraftScopeDecisionByTarget,
  clearDraftScopeDecisionByTargetIfActive,
  upsertDraftScopeDecision,
  type ProposalScopeDecisionStoreDeps,
} from "@/app/lib/proposalScopeDecisionStore";
import type { ProposalScopeDecision } from "@/app/lib/proposalScopeDecisionTypes";

export class ProposalScopeDecisionActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalScopeDecisionActionError";
  }
}

export type ManualQuantityValidationResult =
  | { ok: true; quantity: number }
  | { ok: false; message: string };

export function validateManualQuantityInput(value: unknown): ManualQuantityValidationResult {
  if (typeof value === "string" && value.trim().length === 0) {
    return { ok: false, message: "Enter a valid quantity." };
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return { ok: false, message: "Enter a valid quantity." };
  }
  if (parsed < 0) {
    return { ok: false, message: "Quantity cannot be negative." };
  }
  return { ok: true, quantity: parsed };
}

export type ManualQuantityRefreshContext = {
  quantity_context: ProposalQuantityPreviewContext | null;
  measurement_record_id?: string | null;
  measurement_quantities_display?: string | null;
};

export type ApplyManualQuantityScopeDecisionInput = {
  companyId: string;
  proposalId: string;
  runtimeProposalOptionId: string;
  sourceTemplateItemId: string;
  quantity: unknown;
  refreshContext: ManualQuantityRefreshContext;
  quantityDisplayLabel?: string | null;
  actorUserId?: string | null;
};

export type ApplyManualQuantityScopeDecisionResult = {
  decision: ProposalScopeDecision;
  graph: ProposalDraftGraph;
};

export type ProposalScopeDecisionActionDeps = ProposalScopeDecisionStoreDeps &
  ProposalRecordStoreDeps;

function validateScopeDecisionTargetIds(input: {
  companyId: string;
  proposalId: string;
  runtimeProposalOptionId: string;
  sourceTemplateItemId: string;
}): {
  companyId: string;
  proposalId: string;
  runtimeProposalOptionId: string;
  sourceTemplateItemId: string;
} {
  const companyId = (input.companyId ?? "").trim();
  const proposalId = (input.proposalId ?? "").trim();
  const runtimeProposalOptionId = (input.runtimeProposalOptionId ?? "").trim();
  const sourceTemplateItemId = (input.sourceTemplateItemId ?? "").trim();

  if (!companyId || !proposalId || !runtimeProposalOptionId || !sourceTemplateItemId) {
    throw new ProposalScopeDecisionActionError(
      "companyId, proposalId, runtimeProposalOptionId, and sourceTemplateItemId are required."
    );
  }

  return { companyId, proposalId, runtimeProposalOptionId, sourceTemplateItemId };
}

async function refreshAfterScopeDecision(
  companyId: string,
  proposalId: string,
  refreshContext: ManualQuantityRefreshContext,
  deps?: ProposalScopeDecisionActionDeps
): Promise<ProposalDraftGraph> {
  const graph = await refreshDraftPricing(companyId, proposalId, refreshContext, deps);
  if (!graph) {
    throw new ProposalScopeDecisionActionError(
      "Scope decision saved but draft pricing could not be refreshed."
    );
  }
  return graph;
}

export async function applyManualQuantityScopeDecision(
  input: ApplyManualQuantityScopeDecisionInput,
  deps?: ProposalScopeDecisionActionDeps
): Promise<ApplyManualQuantityScopeDecisionResult> {
  const validation = validateManualQuantityInput(input.quantity);
  if (!validation.ok) {
    throw new ProposalScopeDecisionActionError(validation.message);
  }

  const ids = validateScopeDecisionTargetIds(input);

  const payload: { quantity: number; quantity_display_label?: string | null } = {
    quantity: validation.quantity,
  };
  const displayLabel = (input.quantityDisplayLabel ?? "").trim();
  if (displayLabel) {
    payload.quantity_display_label = displayLabel;
  }

  const decision = await upsertDraftScopeDecision(
    {
      company_id: ids.companyId,
      proposal_id: ids.proposalId,
      proposal_option_id: ids.runtimeProposalOptionId,
      decision_type: "manual_quantity",
      source_template_item_id: ids.sourceTemplateItemId,
      payload,
      actor_user_id: input.actorUserId ?? null,
    },
    deps
  );

  const graph = await refreshAfterScopeDecision(
    ids.companyId,
    ids.proposalId,
    input.refreshContext,
    deps
  );

  return { decision, graph };
}

export type ClearManualQuantityScopeDecisionInput = {
  companyId: string;
  proposalId: string;
  runtimeProposalOptionId: string;
  sourceTemplateItemId: string;
  refreshContext: ManualQuantityRefreshContext;
  actorUserId?: string | null;
};

export type ClearManualQuantityScopeDecisionResult = {
  graph: ProposalDraftGraph;
};

export async function clearManualQuantityScopeDecision(
  input: ClearManualQuantityScopeDecisionInput,
  deps?: ProposalScopeDecisionActionDeps
): Promise<ClearManualQuantityScopeDecisionResult> {
  const ids = validateScopeDecisionTargetIds(input);

  await clearDraftScopeDecisionByTarget(
    {
      company_id: ids.companyId,
      proposal_id: ids.proposalId,
      proposal_option_id: ids.runtimeProposalOptionId,
      decision_type: "manual_quantity",
      source_template_item_id: ids.sourceTemplateItemId,
      actor_user_id: input.actorUserId ?? null,
    },
    deps
  );

  const graph = await refreshAfterScopeDecision(
    ids.companyId,
    ids.proposalId,
    input.refreshContext,
    deps
  );

  return { graph };
}

export type ExcludeLineFromProposalOptionInput = {
  companyId: string;
  proposalId: string;
  runtimeProposalOptionId: string;
  sourceTemplateItemId: string;
  refreshContext: ManualQuantityRefreshContext;
  reason?: string | null;
  actorUserId?: string | null;
};

export type ExcludeLineFromProposalOptionResult = {
  decision: ProposalScopeDecision;
  graph: ProposalDraftGraph;
};

export async function excludeLineFromProposalOption(
  input: ExcludeLineFromProposalOptionInput,
  deps?: ProposalScopeDecisionActionDeps
): Promise<ExcludeLineFromProposalOptionResult> {
  const ids = validateScopeDecisionTargetIds(input);

  await clearDraftScopeDecisionByTargetIfActive(
    {
      company_id: ids.companyId,
      proposal_id: ids.proposalId,
      proposal_option_id: ids.runtimeProposalOptionId,
      decision_type: "manual_quantity",
      source_template_item_id: ids.sourceTemplateItemId,
      actor_user_id: input.actorUserId ?? null,
    },
    deps
  );

  const payload: { reason?: string | null } = {};
  const reason = (input.reason ?? "").trim();
  if (reason) {
    payload.reason = reason;
  }

  const decision = await upsertDraftScopeDecision(
    {
      company_id: ids.companyId,
      proposal_id: ids.proposalId,
      proposal_option_id: ids.runtimeProposalOptionId,
      decision_type: "excluded",
      source_template_item_id: ids.sourceTemplateItemId,
      payload,
      actor_user_id: input.actorUserId ?? null,
    },
    deps
  );

  const graph = await refreshAfterScopeDecision(
    ids.companyId,
    ids.proposalId,
    input.refreshContext,
    deps
  );

  return { decision, graph };
}

export type ClearExcludedLineInput = {
  companyId: string;
  proposalId: string;
  runtimeProposalOptionId: string;
  sourceTemplateItemId: string;
  refreshContext: ManualQuantityRefreshContext;
  actorUserId?: string | null;
};

export type ClearExcludedLineResult = {
  graph: ProposalDraftGraph;
};

export async function clearExcludedLine(
  input: ClearExcludedLineInput,
  deps?: ProposalScopeDecisionActionDeps
): Promise<ClearExcludedLineResult> {
  const ids = validateScopeDecisionTargetIds(input);

  await clearDraftScopeDecisionByTarget(
    {
      company_id: ids.companyId,
      proposal_id: ids.proposalId,
      proposal_option_id: ids.runtimeProposalOptionId,
      decision_type: "excluded",
      source_template_item_id: ids.sourceTemplateItemId,
      actor_user_id: input.actorUserId ?? null,
    },
    deps
  );

  const graph = await refreshAfterScopeDecision(
    ids.companyId,
    ids.proposalId,
    input.refreshContext,
    deps
  );

  return { graph };
}
