/**
 * R17D Phase 1 — persisted contractor scope decision types.
 *
 * Pure types only. Decisions overlay template pricing input before snapshot build;
 * proposal_line_items remain derived output.
 */

// ---------------------------------------------------------------------------
// Decision types
// ---------------------------------------------------------------------------

export const PROPOSAL_SCOPE_DECISION_TYPES = [
  "manual_quantity",
  "excluded",
  "not_applicable",
  "visibility_override",
  "role_override",
  "added_catalog",
  "added_custom",
  "quantity_source_override",
] as const;

export type ProposalScopeDecisionType = (typeof PROPOSAL_SCOPE_DECISION_TYPES)[number];

export const TEMPLATE_TARGET_SCOPE_DECISION_TYPES = [
  "manual_quantity",
  "excluded",
  "not_applicable",
  "visibility_override",
  "role_override",
  "quantity_source_override",
] as const;

export type TemplateTargetScopeDecisionType = (typeof TEMPLATE_TARGET_SCOPE_DECISION_TYPES)[number];

export const INSTANCE_LINE_SCOPE_DECISION_TYPES = ["added_catalog", "added_custom"] as const;

export type InstanceLineScopeDecisionType = (typeof INSTANCE_LINE_SCOPE_DECISION_TYPES)[number];

// ---------------------------------------------------------------------------
// Payload shapes (discriminated by decision_type)
// ---------------------------------------------------------------------------

export type ManualQuantityScopeDecisionPayload = {
  quantity: number;
  quantity_display_label?: string | null;
};

export type ExcludedScopeDecisionPayload = {
  reason?: string | null;
};

export type NotApplicableScopeDecisionPayload = {
  reason?: string | null;
};

export type VisibilityOverrideScopeDecisionPayload = {
  visible_to_customer: boolean;
};

export type RoleOverrideScopeDecisionPayload = {
  role: string;
};

export type AddedCatalogScopeDecisionPayload = {
  catalog_item_id: string;
  section_id?: string | null;
  sort_order?: number | null;
  customer_name?: string | null;
};

export type AddedCustomScopeDecisionPayload = {
  customer_name: string;
  description?: string | null;
  section_id?: string | null;
  sort_order?: number | null;
  quantity?: number | null;
  unit?: string | null;
};

export type QuantitySourceOverrideScopeDecisionPayload = {
  measurement_quantity_key?: string | null;
  quantity_source_label?: string | null;
};

export type ProposalScopeDecisionPayloadByType = {
  manual_quantity: ManualQuantityScopeDecisionPayload;
  excluded: ExcludedScopeDecisionPayload;
  not_applicable: NotApplicableScopeDecisionPayload;
  visibility_override: VisibilityOverrideScopeDecisionPayload;
  role_override: RoleOverrideScopeDecisionPayload;
  added_catalog: AddedCatalogScopeDecisionPayload;
  added_custom: AddedCustomScopeDecisionPayload;
  quantity_source_override: QuantitySourceOverrideScopeDecisionPayload;
};

export type ProposalScopeDecisionPayload<T extends ProposalScopeDecisionType = ProposalScopeDecisionType> =
  ProposalScopeDecisionPayloadByType[T];

// ---------------------------------------------------------------------------
// Record shape (DB + app)
// ---------------------------------------------------------------------------

export type ProposalScopeDecisionRow = {
  id: string;
  company_id: string;
  proposal_id: string;
  proposal_version_id: string;
  proposal_option_id: string;
  decision_type: ProposalScopeDecisionType;
  source_template_item_id: string | null;
  instance_line_key: string | null;
  payload_json: Record<string, unknown>;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalScopeDecision<T extends ProposalScopeDecisionType = ProposalScopeDecisionType> = {
  id: string;
  companyId: string;
  proposalId: string;
  proposalVersionId: string;
  proposalOptionId: string;
  decisionType: T;
  sourceTemplateItemId: string | null;
  instanceLineKey: string | null;
  payload: ProposalScopeDecisionPayload<T>;
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Target key helpers
// ---------------------------------------------------------------------------

export type ProposalScopeDecisionTemplateTargetKey = {
  kind: "template_item";
  sourceTemplateItemId: string;
};

export type ProposalScopeDecisionInstanceTargetKey = {
  kind: "instance_line";
  instanceLineKey: string;
};

export type ProposalScopeDecisionTargetKey =
  | ProposalScopeDecisionTemplateTargetKey
  | ProposalScopeDecisionInstanceTargetKey;

export function scopeDecisionTemplateTargetKey(
  sourceTemplateItemId: string
): ProposalScopeDecisionTemplateTargetKey {
  return { kind: "template_item", sourceTemplateItemId };
}

export function scopeDecisionInstanceTargetKey(
  instanceLineKey: string
): ProposalScopeDecisionInstanceTargetKey {
  return { kind: "instance_line", instanceLineKey };
}

export function isTemplateTargetScopeDecisionType(
  decisionType: ProposalScopeDecisionType
): decisionType is TemplateTargetScopeDecisionType {
  return (TEMPLATE_TARGET_SCOPE_DECISION_TYPES as readonly string[]).includes(decisionType);
}

export function isInstanceLineScopeDecisionType(
  decisionType: ProposalScopeDecisionType
): decisionType is InstanceLineScopeDecisionType {
  return (INSTANCE_LINE_SCOPE_DECISION_TYPES as readonly string[]).includes(decisionType);
}

export function rowToProposalScopeDecision(
  row: ProposalScopeDecisionRow
): ProposalScopeDecision {
  return {
    id: row.id,
    companyId: row.company_id,
    proposalId: row.proposal_id,
    proposalVersionId: row.proposal_version_id,
    proposalOptionId: row.proposal_option_id,
    decisionType: row.decision_type,
    sourceTemplateItemId: row.source_template_item_id,
    instanceLineKey: row.instance_line_key,
    payload: row.payload_json as ProposalScopeDecisionPayload,
    active: row.active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseManualQuantityPayload(
  payload: Record<string, unknown>
): ManualQuantityScopeDecisionPayload | null {
  const quantity = payload.quantity;
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) {
    return null;
  }
  const quantityDisplayLabel =
    payload.quantity_display_label == null
      ? null
      : String(payload.quantity_display_label);
  return {
    quantity,
    quantity_display_label: quantityDisplayLabel,
  };
}
