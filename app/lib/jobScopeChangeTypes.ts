/**
 * Astra G9 / Phase 10 — approved scope-change contracts.
 * Additive amendments only. Original accepted agreement remains immutable.
 *
 * Capability gates (Phase 13B-C): draft create / edit / void / decline require
 * `scope_changes.write` (Owner, Admin, Sales); propose and the customer review link
 * require `scope_changes.issue` (Owner, or the Owner-granted Issue scope changes package).
 * Production Lead and Field: authorized + pending summaries via the Field brief only.
 */

export const JOB_SCOPE_CHANGE_STATUSES = [
  "draft",
  "proposed",
  "authorized",
  "declined",
  "voided",
] as const;

export type JobScopeChangeStatus = (typeof JOB_SCOPE_CHANGE_STATUSES)[number];

export const JOB_SCOPE_CHANGE_STATUS_LABELS: Record<
  JobScopeChangeStatus,
  string
> = {
  draft: "Draft",
  proposed: "Pending approval",
  authorized: "Authorized",
  declined: "Declined",
  voided: "Voided",
};

export const JOB_SCOPE_CHANGE_LINE_KINDS = ["add", "remove"] as const;

export type JobScopeChangeLineKind =
  (typeof JOB_SCOPE_CHANGE_LINE_KINDS)[number];

export const JOB_SCOPE_CHANGE_LINE_KIND_LABELS: Record<
  JobScopeChangeLineKind,
  string
> = {
  add: "Add",
  remove: "Remove",
};

export const JOB_SCOPE_CHANGE_ACTIVITY_EVENT_TYPES = [
  "scope_change_created",
  "scope_change_proposed",
  "scope_change_authorized",
  "scope_change_declined",
  "scope_change_voided",
] as const;

export type JobScopeChangeActivityEventType =
  (typeof JOB_SCOPE_CHANGE_ACTIVITY_EVENT_TYPES)[number];

/** Server/RPC failure codes returned in `{ ok: false, code }`. */
export const JOB_SCOPE_CHANGE_ERROR_CODES = [
  "unauthorized",
  "invalid_payload",
  "forbidden",
  "not_found",
  "acceptance_required",
  "disposition_blocks_scope_change",
  "complete_blocks_scope_change",
  "not_draft",
  "illegal_transition",
  "row_version_conflict",
  "scope_change_lines_required",
  "invalid_scope_change_line",
  "stale_basis",
  "proposed_already_exists",
  "financial_conflict",
  "invalid_signature",
  "token_required",
  "invalid_token",
  "token_binding_mismatch",
  "expired",
  "revoked",
  "invalid_hash",
  "invalid_prefix",
  "invalid_expires_at",
  "not_proposed",
  "duplicate_token_hash",
  "forbidden_metadata_keys",
] as const;

export type JobScopeChangeErrorCode =
  (typeof JOB_SCOPE_CHANGE_ERROR_CODES)[number];

export const JOB_SCOPE_CHANGE_ERROR_LABELS: Record<
  JobScopeChangeErrorCode,
  string
> = {
  unauthorized: "Sign in required.",
  invalid_payload: "Invalid scope-change request.",
  forbidden: "You do not have permission for this scope change.",
  not_found: "Scope change not found.",
  acceptance_required: "An accepted agreement is required before scope changes.",
  disposition_blocks_scope_change:
    "This job’s disposition does not allow new scope changes.",
  complete_blocks_scope_change:
    "Completed jobs cannot receive new scope changes.",
  not_draft: "Only draft scope changes can be edited.",
  illegal_transition: "That status transition is not allowed.",
  row_version_conflict:
    "This scope change was updated elsewhere. Refresh and try again.",
  scope_change_lines_required: "Add at least one scope-change line.",
  invalid_scope_change_line: "One or more scope-change lines are invalid.",
  stale_basis:
    "The contract total changed since this draft was prepared. Review and rebase.",
  proposed_already_exists:
    "Only one proposed scope change is allowed per job at a time.",
  financial_conflict: "Financial review required before this reduction can apply.",
  invalid_signature: "Signature reference is invalid for this job.",
  token_required: "A valid customer-review token is required to authorize.",
  invalid_token: "Customer-review token is invalid or inactive.",
  token_binding_mismatch:
    "Customer-review token does not match this scope change.",
  expired: "Customer-review token has expired.",
  revoked: "Customer-review token has been revoked.",
  invalid_hash: "Token hash format is invalid.",
  invalid_prefix: "Token prefix format is invalid.",
  invalid_expires_at: "Token expiry must be in the future.",
  not_proposed: "Only proposed scope changes can mint a customer-review token.",
  duplicate_token_hash: "That token hash is already in use.",
  forbidden_metadata_keys: "Token metadata must not include raw token fields.",
};

export type JobScopeChangeLineInput = {
  change_kind: JobScopeChangeLineKind;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  unit_price_cents?: number | null;
  line_delta_cents: number;
  sort_order?: number;
};

export type JobScopeChangeLine = JobScopeChangeLineInput & {
  id: string;
  company_id: string;
  scope_change_id: string;
  sort_order: number;
};

export type JobScopeChange = {
  id: string;
  company_id: string;
  job_id: string;
  base_proposal_id: string;
  base_proposal_version_id: string;
  base_acceptance_id: string;
  status: JobScopeChangeStatus;
  reason: string | null;
  timing_note: string | null;
  price_delta_cents: number;
  basis_contract_total_cents: number;
  proposed_at: string | null;
  authorized_at: string | null;
  declined_at: string | null;
  voided_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type JobScopeChangeApproval = {
  id: string;
  company_id: string;
  scope_change_id: string;
  approved_at: string;
  approved_by_name: string;
  approved_by_email: string | null;
  approval_method: "public_token";
  evidence_json: Record<string, unknown> | null;
  proposal_signature_id: string | null;
  created_at: string;
};

export const CREATE_JOB_SCOPE_CHANGE_RPC_V1 = "create_job_scope_change_v1";
export const UPDATE_JOB_SCOPE_CHANGE_DRAFT_RPC_V1 =
  "update_job_scope_change_draft_v1";
export const PROPOSE_JOB_SCOPE_CHANGE_RPC_V1 = "propose_job_scope_change_v1";
export const AUTHORIZE_JOB_SCOPE_CHANGE_RPC_V1 = "authorize_job_scope_change_v1";
export const DECLINE_JOB_SCOPE_CHANGE_RPC_V1 = "decline_job_scope_change_v1";
export const VOID_JOB_SCOPE_CHANGE_RPC_V1 = "void_job_scope_change_v1";
export const MINT_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1 =
  "mint_job_scope_change_public_access_token_v1";
export const RESOLVE_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1 =
  "resolve_job_scope_change_public_access_token_v1";

/** Contractor draft create / update / void / decline. */
export const JOB_SCOPE_CHANGE_WRITE_CAPABILITY = "scope_changes.write" as const;
/** Contractor propose + customer review link (sensitive; Owner or the Issue scope changes package). */
export const JOB_SCOPE_CHANGE_ISSUE_CAPABILITY = "scope_changes.issue" as const;

export function isJobScopeChangeStatus(
  value: string | null | undefined
): value is JobScopeChangeStatus {
  return (JOB_SCOPE_CHANGE_STATUSES as readonly string[]).includes(
    String(value ?? "")
  );
}

export function isJobScopeChangeErrorCode(
  value: string | null | undefined
): value is JobScopeChangeErrorCode {
  return (JOB_SCOPE_CHANGE_ERROR_CODES as readonly string[]).includes(
    String(value ?? "")
  );
}

export function jobScopeChangeErrorLabel(
  code: string | null | undefined
): string {
  if (isJobScopeChangeErrorCode(code)) {
    return JOB_SCOPE_CHANGE_ERROR_LABELS[code];
  }
  return "Scope change failed.";
}
