/**
 * R17D Phase 1 — scope decision persistence (draft-only).
 *
 * Decisions are contractor intent stored separately from proposal_line_items.
 * Merge happens on refreshDraftPricing via proposalScopeDecisionMerge.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import {
  mutableDraftTouchFailureMessage,
  touchMutableDraftProposalUpdatedAt,
} from "@/app/lib/proposalMutableDraftTouch";
import {
  appendProposalEvent,
  isUuidLike,
  normalizeCompanyId,
  ProposalRecordStoreError,
  type ProposalRecordStoreDeps,
  type ProposalOptionRow,
  type ProposalRow,
  type ProposalVersionRow,
} from "@/app/lib/proposalRecordStore";
import type { ProposalStatus, ProposalVersionKind } from "@/app/lib/proposalLifecycleTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { getProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  isInstanceLineScopeDecisionType,
  isTemplateTargetScopeDecisionType,
  rowToProposalScopeDecision,
  type ProposalScopeDecision,
  type ProposalScopeDecisionPayload,
  type ProposalScopeDecisionRow,
  type ProposalScopeDecisionType,
} from "@/app/lib/proposalScopeDecisionTypes";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export type ProposalScopeDecisionStoreDeps = ProposalRecordStoreDeps & {
  getTemplateGraph?: (
    templateId: string,
    opts: { companyId: string }
  ) => Promise<ProposalTemplateGraph | null>;
};

function resolveDeps(deps?: ProposalScopeDecisionStoreDeps) {
  return {
    getSupabase: deps?.getSupabase ?? getSupabaseClient,
    getTemplateGraph: deps?.getTemplateGraph ?? getProposalTemplateGraph,
  };
}

const INSTANCE_LINE_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

// ---------------------------------------------------------------------------
// Draft guards
// ---------------------------------------------------------------------------

async function loadMutableDraftContext(
  companyId: string,
  proposalId: string,
  deps?: ProposalScopeDecisionStoreDeps
): Promise<{
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>;
  proposal: ProposalRow;
  version: ProposalVersionRow;
}> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const pid = (proposalId ?? "").trim();

  if (!supabase || !cid || !isUuidLike(pid)) {
    throw new ProposalRecordStoreError("Invalid company_id or proposal_id.");
  }

  const { data: proposalData, error: proposalError } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", pid)
    .eq("company_id", cid)
    .maybeSingle();

  if (proposalError || !proposalData) {
    throw new ProposalRecordStoreError("Proposal not found.");
  }

  const proposal = proposalData as ProposalRow;
  if ((proposal.status as ProposalStatus) !== "draft") {
    throw new ProposalRecordStoreError("Proposal is not in draft status.");
  }

  const versionId = proposal.current_draft_version_id;
  if (!versionId) {
    throw new ProposalRecordStoreError("Proposal has no current draft version.");
  }

  const { data: versionData, error: versionError } = await supabase
    .from("proposal_versions")
    .select("*")
    .eq("id", versionId)
    .eq("company_id", cid)
    .eq("proposal_id", pid)
    .maybeSingle();

  if (versionError || !versionData) {
    throw new ProposalRecordStoreError("Draft version not found for proposal.");
  }

  const version = versionData as ProposalVersionRow;
  if ((version.version_kind as ProposalVersionKind) !== "draft") {
    throw new ProposalRecordStoreError(
      `Version ${version.id} is not mutable (kind=${version.version_kind}).`
    );
  }

  return { supabase, proposal, version };
}

async function touchMutableDraftHeader(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  proposalId: string
): Promise<void> {
  try {
    await touchMutableDraftProposalUpdatedAt(supabase, { companyId, proposalId });
  } catch (error) {
    throw new ProposalRecordStoreError(mutableDraftTouchFailureMessage(error));
  }
}

async function assertProposalOptionOnDraft(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  companyId: string,
  versionId: string,
  proposalOptionId: string
): Promise<ProposalOptionRow> {
  const { data, error } = await supabase
    .from("proposal_options")
    .select("*")
    .eq("id", proposalOptionId)
    .eq("company_id", companyId)
    .eq("proposal_version_id", versionId)
    .maybeSingle();

  if (error || !data) {
    throw new ProposalRecordStoreError(
      "Proposal option not found on the current draft version."
    );
  }

  return data as ProposalOptionRow;
}

function assertInstanceLineKey(instanceLineKey: string | null | undefined): string {
  const key = (instanceLineKey ?? "").trim();
  if (!key || !INSTANCE_LINE_KEY_PATTERN.test(key)) {
    throw new ProposalRecordStoreError(
      "instance_line_key must be 1–128 characters (alphanumeric, ., _, -)."
    );
  }
  return key;
}

function payloadToRecord(payload: ProposalScopeDecisionPayload): Record<string, unknown> {
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

async function assertTemplateItemOnProposalTemplate(
  graph: ProposalTemplateGraph,
  templateId: string,
  sourceTemplateItemId: string,
  templateOptionId: string | null
): Promise<void> {
  const item = graph.items.find((row) => row.id === sourceTemplateItemId);
  if (!item || item.template_id !== templateId) {
    throw new ProposalRecordStoreError(
      "source_template_item_id does not belong to the proposal template."
    );
  }
  if (templateOptionId && item.option_id !== templateOptionId) {
    throw new ProposalRecordStoreError(
      "source_template_item_id does not belong to the target proposal option."
    );
  }
}

function validateDecisionTarget(
  decisionType: ProposalScopeDecisionType,
  sourceTemplateItemId: string | null | undefined,
  instanceLineKey: string | null | undefined
): { sourceTemplateItemId: string | null; instanceLineKey: string | null } {
  if (isTemplateTargetScopeDecisionType(decisionType)) {
    const templateItemId = (sourceTemplateItemId ?? "").trim();
    if (!isUuidLike(templateItemId)) {
      throw new ProposalRecordStoreError(
        `${decisionType} requires a valid source_template_item_id.`
      );
    }
    if (instanceLineKey != null && String(instanceLineKey).trim().length > 0) {
      throw new ProposalRecordStoreError(
        `${decisionType} cannot set instance_line_key.`
      );
    }
    return { sourceTemplateItemId: templateItemId, instanceLineKey: null };
  }

  if (isInstanceLineScopeDecisionType(decisionType)) {
    const key = assertInstanceLineKey(instanceLineKey);
    if (sourceTemplateItemId != null && String(sourceTemplateItemId).trim().length > 0) {
      throw new ProposalRecordStoreError(`${decisionType} cannot set source_template_item_id.`);
    }
    return { sourceTemplateItemId: null, instanceLineKey: key };
  }

  throw new ProposalRecordStoreError(`Unsupported decision_type: ${decisionType}.`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getScopeDecisionsForProposalOption(
  companyId: string,
  proposalOptionId: string,
  options?: { activeOnly?: boolean },
  deps?: ProposalScopeDecisionStoreDeps
): Promise<ProposalScopeDecision[]> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const optionId = (proposalOptionId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(optionId)) return [];

  try {
    let query = supabase
      .from("proposal_option_scope_decisions")
      .select("*")
      .eq("company_id", cid)
      .eq("proposal_option_id", optionId)
      .order("created_at", { ascending: true });

    if (options?.activeOnly !== false) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as ProposalScopeDecisionRow[]).map(rowToProposalScopeDecision);
  } catch {
    return [];
  }
}

export async function getScopeDecisionsForDraftVersion(
  companyId: string,
  proposalVersionId: string,
  options?: { activeOnly?: boolean },
  deps?: ProposalScopeDecisionStoreDeps
): Promise<ProposalScopeDecision[]> {
  const { getSupabase } = resolveDeps(deps);
  const supabase = getSupabase();
  const cid = normalizeCompanyId(companyId);
  const versionId = (proposalVersionId ?? "").trim();
  if (!supabase || !cid || !isUuidLike(versionId)) return [];

  try {
    let query = supabase
      .from("proposal_option_scope_decisions")
      .select("*")
      .eq("company_id", cid)
      .eq("proposal_version_id", versionId)
      .order("created_at", { ascending: true });

    if (options?.activeOnly !== false) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return (data as ProposalScopeDecisionRow[]).map(rowToProposalScopeDecision);
  } catch {
    return [];
  }
}

/** Batch loader used by refreshDraftPricing. */
export async function getScopeDecisionsForDraftGraph(
  companyId: string,
  proposalVersionId: string,
  deps?: ProposalScopeDecisionStoreDeps
): Promise<ProposalScopeDecision[]> {
  return getScopeDecisionsForDraftVersion(companyId, proposalVersionId, { activeOnly: true }, deps);
}

// ---------------------------------------------------------------------------
// Writes (draft-only)
// ---------------------------------------------------------------------------

export type UpsertDraftScopeDecisionInput<T extends ProposalScopeDecisionType = ProposalScopeDecisionType> = {
  company_id: string;
  proposal_id: string;
  proposal_option_id: string;
  decision_type: T;
  source_template_item_id?: string | null;
  instance_line_key?: string | null;
  payload: ProposalScopeDecisionPayload<T>;
  actor_user_id?: string | null;
};

export async function upsertDraftScopeDecision(
  input: UpsertDraftScopeDecisionInput,
  deps?: ProposalScopeDecisionStoreDeps
): Promise<ProposalScopeDecision> {
  const d = resolveDeps(deps);
  const cid = normalizeCompanyId(input.company_id);
  const pid = (input.proposal_id ?? "").trim();
  const proposalOptionId = (input.proposal_option_id ?? "").trim();

  if (!cid || !isUuidLike(pid) || !isUuidLike(proposalOptionId)) {
    throw new ProposalRecordStoreError("company_id, proposal_id, and proposal_option_id are required UUIDs.");
  }

  const { supabase, proposal, version } = await loadMutableDraftContext(cid, pid, deps);
  if (proposal.id !== pid) {
    throw new ProposalRecordStoreError("Proposal mismatch.");
  }

  const optionRow = await assertProposalOptionOnDraft(
    supabase,
    cid,
    version.id,
    proposalOptionId
  );

  const target = validateDecisionTarget(
    input.decision_type,
    input.source_template_item_id,
    input.instance_line_key
  );

  const templateId = proposal.template_id;
  if (!templateId) {
    throw new ProposalRecordStoreError("Proposal has no template_id.");
  }

  const graph = await d.getTemplateGraph(templateId, { companyId: cid });
  if (!graph) {
    throw new ProposalRecordStoreError("Template graph not found.");
  }

  if (target.sourceTemplateItemId) {
    await assertTemplateItemOnProposalTemplate(
      graph,
      templateId,
      target.sourceTemplateItemId,
      optionRow.source_template_option_id
    );
  }

  const now = new Date().toISOString();
  const payloadJson = payloadToRecord(input.payload);

  let existingQuery = supabase
    .from("proposal_option_scope_decisions")
    .select("*")
    .eq("company_id", cid)
    .eq("proposal_option_id", proposalOptionId)
    .eq("decision_type", input.decision_type)
    .eq("active", true);

  existingQuery = target.sourceTemplateItemId
    ? existingQuery.eq("source_template_item_id", target.sourceTemplateItemId).is(
        "instance_line_key",
        null
      )
    : existingQuery.eq("instance_line_key", target.instanceLineKey!).is(
        "source_template_item_id",
        null
      );

  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    throw new ProposalRecordStoreError(
      existingError.message ?? "Failed to look up existing scope decision."
    );
  }

  const existing = (existingRows ?? [])[0] as ProposalScopeDecisionRow | undefined;
  let row: ProposalScopeDecisionRow;

  if (existing) {
    const { data, error } = await supabase
      .from("proposal_option_scope_decisions")
      .update({
        payload_json: payloadJson,
        active: true,
        updated_at: now,
        updated_by: input.actor_user_id ?? null,
      })
      .eq("id", existing.id)
      .eq("company_id", cid)
      .select("*")
      .single();

    if (error || !data) {
      throw new ProposalRecordStoreError(error?.message ?? "Failed to update scope decision.");
    }
    row = data as ProposalScopeDecisionRow;
  } else {
    const { data, error } = await supabase
      .from("proposal_option_scope_decisions")
      .insert({
        company_id: cid,
        proposal_id: pid,
        proposal_version_id: version.id,
        proposal_option_id: proposalOptionId,
        decision_type: input.decision_type,
        source_template_item_id: target.sourceTemplateItemId,
        instance_line_key: target.instanceLineKey,
        payload_json: payloadJson,
        active: true,
        created_by: input.actor_user_id ?? null,
        updated_by: input.actor_user_id ?? null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new ProposalRecordStoreError(error?.message ?? "Failed to insert scope decision.");
    }
    row = data as ProposalScopeDecisionRow;
  }

  await touchMutableDraftHeader(supabase, cid, pid);

  await appendProposalEvent(
    {
      company_id: cid,
      proposal_id: pid,
      proposal_version_id: version.id,
      event_type: "draft_saved",
      actor_user_id: input.actor_user_id ?? null,
      payload_json: {
        reason: "scope_decision_upsert",
        decision_id: row.id,
        decision_type: input.decision_type,
        proposal_option_id: proposalOptionId,
        source_template_item_id: target.sourceTemplateItemId,
        instance_line_key: target.instanceLineKey,
      },
    },
    deps
  );

  return rowToProposalScopeDecision(row);
}

export type ClearDraftScopeDecisionInput = {
  company_id: string;
  proposal_id: string;
  decision_id: string;
  actor_user_id?: string | null;
};

export async function clearDraftScopeDecision(
  input: ClearDraftScopeDecisionInput,
  deps?: ProposalScopeDecisionStoreDeps
): Promise<ProposalScopeDecision | null> {
  const cid = normalizeCompanyId(input.company_id);
  const pid = (input.proposal_id ?? "").trim();
  const decisionId = (input.decision_id ?? "").trim();

  if (!cid || !isUuidLike(pid) || !isUuidLike(decisionId)) {
    throw new ProposalRecordStoreError("company_id, proposal_id, and decision_id are required UUIDs.");
  }

  const { supabase, version } = await loadMutableDraftContext(cid, pid, deps);
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await supabase
    .from("proposal_option_scope_decisions")
    .select("*")
    .eq("id", decisionId)
    .eq("company_id", cid)
    .eq("proposal_id", pid)
    .eq("proposal_version_id", version.id)
    .maybeSingle();

  if (loadError) {
    throw new ProposalRecordStoreError(loadError.message ?? "Failed to load scope decision.");
  }
  if (!existing) {
    throw new ProposalRecordStoreError("Scope decision not found on current draft.");
  }

  const { data, error } = await supabase
    .from("proposal_option_scope_decisions")
    .update({
      active: false,
      updated_at: now,
      updated_by: input.actor_user_id ?? null,
    })
    .eq("id", decisionId)
    .eq("company_id", cid)
    .select("*")
    .single();

  if (error || !data) {
    throw new ProposalRecordStoreError(error?.message ?? "Failed to clear scope decision.");
  }

  await touchMutableDraftHeader(supabase, cid, pid);

  await appendProposalEvent(
    {
      company_id: cid,
      proposal_id: pid,
      proposal_version_id: version.id,
      event_type: "draft_saved",
      actor_user_id: input.actor_user_id ?? null,
      payload_json: {
        reason: "scope_decision_clear",
        decision_id: decisionId,
      },
    },
    deps
  );

  return rowToProposalScopeDecision(data as ProposalScopeDecisionRow);
}

export type ClearDraftScopeDecisionByTargetInput = {
  company_id: string;
  proposal_id: string;
  proposal_option_id: string;
  decision_type: ProposalScopeDecisionType;
  source_template_item_id?: string | null;
  instance_line_key?: string | null;
  actor_user_id?: string | null;
};

export async function clearDraftScopeDecisionByTarget(
  input: ClearDraftScopeDecisionByTargetInput,
  deps?: ProposalScopeDecisionStoreDeps
): Promise<ProposalScopeDecision> {
  const cid = normalizeCompanyId(input.company_id);
  const pid = (input.proposal_id ?? "").trim();
  const proposalOptionId = (input.proposal_option_id ?? "").trim();

  if (!cid || !isUuidLike(pid) || !isUuidLike(proposalOptionId)) {
    throw new ProposalRecordStoreError(
      "company_id, proposal_id, and proposal_option_id are required UUIDs."
    );
  }

  const { supabase, version } = await loadMutableDraftContext(cid, pid, deps);
  await assertProposalOptionOnDraft(supabase, cid, version.id, proposalOptionId);

  const target = validateDecisionTarget(
    input.decision_type,
    input.source_template_item_id,
    input.instance_line_key
  );

  let existingQuery = supabase
    .from("proposal_option_scope_decisions")
    .select("*")
    .eq("company_id", cid)
    .eq("proposal_id", pid)
    .eq("proposal_version_id", version.id)
    .eq("proposal_option_id", proposalOptionId)
    .eq("decision_type", input.decision_type)
    .eq("active", true);

  existingQuery = target.sourceTemplateItemId
    ? existingQuery.eq("source_template_item_id", target.sourceTemplateItemId).is(
        "instance_line_key",
        null
      )
    : existingQuery.eq("instance_line_key", target.instanceLineKey!).is(
        "source_template_item_id",
        null
      );

  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    throw new ProposalRecordStoreError(
      existingError.message ?? "Failed to look up scope decision for clear."
    );
  }

  const existing = (existingRows ?? [])[0] as ProposalScopeDecisionRow | undefined;
  if (!existing) {
    throw new ProposalRecordStoreError("No active scope decision found for this target.");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("proposal_option_scope_decisions")
    .update({
      active: false,
      updated_at: now,
      updated_by: input.actor_user_id ?? null,
    })
    .eq("id", existing.id)
    .eq("company_id", cid)
    .select("*")
    .single();

  if (error || !data) {
    throw new ProposalRecordStoreError(error?.message ?? "Failed to clear scope decision.");
  }

  await touchMutableDraftHeader(supabase, cid, pid);

  await appendProposalEvent(
    {
      company_id: cid,
      proposal_id: pid,
      proposal_version_id: version.id,
      event_type: "draft_saved",
      actor_user_id: input.actor_user_id ?? null,
      payload_json: {
        reason: "scope_decision_clear",
        decision_id: existing.id,
        decision_type: input.decision_type,
        proposal_option_id: proposalOptionId,
        source_template_item_id: target.sourceTemplateItemId,
        instance_line_key: target.instanceLineKey,
      },
    },
    deps
  );

  return rowToProposalScopeDecision(data as ProposalScopeDecisionRow);
}

export async function clearDraftScopeDecisionByTargetIfActive(
  input: ClearDraftScopeDecisionByTargetInput,
  deps?: ProposalScopeDecisionStoreDeps
): Promise<ProposalScopeDecision | null> {
  try {
    return await clearDraftScopeDecisionByTarget(input, deps);
  } catch (error) {
    if (
      error instanceof ProposalRecordStoreError &&
      error.message === "No active scope decision found for this target."
    ) {
      return null;
    }
    throw error;
  }
}
