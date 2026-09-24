/**
 * Astra G9 — scope-change RPC persistence wrappers.
 * Writes only through security-definer RPCs; no direct table mutations.
 * Callers must resolve company_id via getUserCompanyId (no client-trusted tenancy).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuidLike } from "@/app/lib/uuid";
import {
  AUTHORIZE_JOB_SCOPE_CHANGE_RPC_V1,
  CREATE_JOB_SCOPE_CHANGE_RPC_V1,
  DECLINE_JOB_SCOPE_CHANGE_RPC_V1,
  isJobScopeChangeErrorCode,
  isJobScopeChangeStatus,
  MINT_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1,
  PROPOSE_JOB_SCOPE_CHANGE_RPC_V1,
  RESOLVE_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1,
  UPDATE_JOB_SCOPE_CHANGE_DRAFT_RPC_V1,
  VOID_JOB_SCOPE_CHANGE_RPC_V1,
  type JobScopeChange,
  type JobScopeChangeApproval,
  type JobScopeChangeErrorCode,
  type JobScopeChangeLine,
  type JobScopeChangeLineInput,
  type JobScopeChangeStatus,
} from "@/app/lib/jobScopeChangeTypes";
import {
  hashJobScopeChangePublicAccessToken,
  isJobScopeChangePublicAccessTokenSha256Hex,
} from "@/app/lib/jobScopeChangePublicAccess";

export class JobScopeChangePersistenceError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = "JobScopeChangePersistenceError";
  }
}

export type CreateJobScopeChangeInput = {
  company_id: string;
  job_id: string;
  reason?: string | null;
  timing_note?: string | null;
  lines: readonly JobScopeChangeLineInput[];
};

export type UpdateJobScopeChangeDraftInput = {
  company_id: string;
  job_id: string;
  scope_change_id: string;
  expected_row_version?: number | null;
  reason?: string | null;
  timing_note?: string | null;
  lines?: readonly JobScopeChangeLineInput[];
};

export type ScopeChangeTransitionInput = {
  company_id: string;
  job_id: string;
  scope_change_id: string;
  expected_row_version?: number | null;
};

export type AuthorizeJobScopeChangeInput = {
  company_id: string;
  job_id: string;
  scope_change_id: string;
  /** SHA-256 hex of customer-review token (required). */
  token_hash: string;
  approved_by_name: string;
  approved_by_email?: string | null;
  approval_method?: "public_token";
  evidence_json?: Record<string, unknown> | null;
  proposal_signature_id?: string | null;
};

export type MintJobScopeChangePublicAccessTokenInput = {
  company_id: string;
  job_id: string;
  scope_change_id: string;
  token_hash: string;
  token_prefix: string;
  expires_at: string;
  metadata_json?: Record<string, unknown> | null;
};

export type MintJobScopeChangePublicAccessTokenSuccess = {
  ok: true;
  idempotent?: boolean;
  token_id: string;
  token_prefix: string;
  expires_at: string;
  status: string;
};

export type ResolveJobScopeChangePublicAccessTokenSuccess = {
  ok: true;
  token_id: string;
  company_id: string;
  job_id: string;
  scope_change_id: string;
  token_prefix: string;
  expires_at: string;
  scope_change: JobScopeChange;
  lines?: JobScopeChangeLine[];
  contract_total_cents?: number;
  proposed_new_total_cents?: number;
};

export type JobScopeChangeRpcSuccess = {
  ok: true;
  idempotent?: boolean;
  scope_change: JobScopeChange;
  lines?: JobScopeChangeLine[];
  approval_id?: string | null;
  contract_total_cents?: number;
  proposed_new_total_cents?: number;
  activity_id?: string | null;
};

export type JobScopeChangeRpcFailure = {
  ok: false;
  code: JobScopeChangeErrorCode | string;
  row_version?: number;
  basis_contract_total_cents?: number;
  live_contract_total_cents?: number;
  reason?: string;
  price_delta_cents?: number;
  proposed_new_total_cents?: number;
  gross_received_cents?: number;
  open_payment_request_cents?: number;
};

export type JobScopeChangeRpcResult =
  | JobScopeChangeRpcSuccess
  | JobScopeChangeRpcFailure;

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new JobScopeChangePersistenceError(`Invalid ${label}.`, "invalid_payload");
  }
  return id;
}

function parseOptionalUuid(value: unknown): string | null {
  if (value == null || value === "") return null;
  return parseUuid(value, "uuid");
}

function parseScopeChange(row: Record<string, unknown>): JobScopeChange {
  const status = String(row.status ?? "");
  if (!isJobScopeChangeStatus(status)) {
    throw new JobScopeChangePersistenceError(
      `Invalid scope change status: ${status}`
    );
  }
  return {
    id: parseUuid(row.id, "scope_change.id"),
    company_id: parseUuid(row.company_id, "scope_change.company_id"),
    job_id: parseUuid(row.job_id, "scope_change.job_id"),
    base_proposal_id: parseUuid(row.base_proposal_id, "base_proposal_id"),
    base_proposal_version_id: parseUuid(
      row.base_proposal_version_id,
      "base_proposal_version_id"
    ),
    base_acceptance_id: parseUuid(row.base_acceptance_id, "base_acceptance_id"),
    status: status as JobScopeChangeStatus,
    reason: row.reason == null ? null : String(row.reason),
    timing_note: row.timing_note == null ? null : String(row.timing_note),
    price_delta_cents: Number(row.price_delta_cents ?? 0),
    basis_contract_total_cents: Number(row.basis_contract_total_cents ?? 0),
    proposed_at: row.proposed_at == null ? null : String(row.proposed_at),
    authorized_at: row.authorized_at == null ? null : String(row.authorized_at),
    declined_at: row.declined_at == null ? null : String(row.declined_at),
    voided_at: row.voided_at == null ? null : String(row.voided_at),
    created_by: parseOptionalUuid(row.created_by),
    updated_by: parseOptionalUuid(row.updated_by),
    row_version: Number(row.row_version ?? 1),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    deleted_at: row.deleted_at == null ? null : String(row.deleted_at),
  };
}

function parseLines(value: unknown): JobScopeChangeLine[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: parseUuid(row.id, "line.id"),
      company_id: parseUuid(row.company_id, "line.company_id"),
      scope_change_id: parseUuid(row.scope_change_id, "line.scope_change_id"),
      change_kind: String(row.change_kind) as JobScopeChangeLine["change_kind"],
      description: String(row.description ?? ""),
      quantity:
        row.quantity == null || row.quantity === ""
          ? null
          : Number(row.quantity),
      unit: row.unit == null ? null : String(row.unit),
      unit_price_cents:
        row.unit_price_cents == null ? null : Number(row.unit_price_cents),
      line_delta_cents: Number(row.line_delta_cents ?? 0),
      sort_order: Number(row.sort_order ?? 0),
    };
  });
}

function serializeLines(
  lines: readonly JobScopeChangeLineInput[]
): Record<string, unknown>[] {
  return lines.map((line, index) => ({
    change_kind: line.change_kind,
    description: line.description,
    quantity: line.quantity ?? null,
    unit: line.unit ?? null,
    unit_price_cents: line.unit_price_cents ?? null,
    line_delta_cents: line.line_delta_cents,
    sort_order: line.sort_order ?? index,
  }));
}

export function parseJobScopeChangeRpcResult(
  data: unknown
): JobScopeChangeRpcResult {
  if (!data || typeof data !== "object") {
    throw new JobScopeChangePersistenceError("Scope-change RPC returned a non-object.");
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    const code = String(row.code ?? "invalid_payload");
    return {
      ok: false,
      code: isJobScopeChangeErrorCode(code) ? code : code,
      row_version:
        row.row_version == null ? undefined : Number(row.row_version),
      basis_contract_total_cents:
        row.basis_contract_total_cents == null
          ? undefined
          : Number(row.basis_contract_total_cents),
      live_contract_total_cents:
        row.live_contract_total_cents == null
          ? undefined
          : Number(row.live_contract_total_cents),
      reason: row.reason == null ? undefined : String(row.reason),
      price_delta_cents:
        row.price_delta_cents == null
          ? undefined
          : Number(row.price_delta_cents),
      proposed_new_total_cents:
        row.proposed_new_total_cents == null
          ? undefined
          : Number(row.proposed_new_total_cents),
      gross_received_cents:
        row.gross_received_cents == null
          ? undefined
          : Number(row.gross_received_cents),
      open_payment_request_cents:
        row.open_payment_request_cents == null
          ? undefined
          : Number(row.open_payment_request_cents),
    };
  }

  const scopeRaw = row.scope_change;
  if (!scopeRaw || typeof scopeRaw !== "object") {
    throw new JobScopeChangePersistenceError(
      "Scope-change RPC missing scope_change."
    );
  }

  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    scope_change: parseScopeChange(scopeRaw as Record<string, unknown>),
    lines: parseLines(row.lines),
    approval_id:
      row.approval_id == null ? null : String(row.approval_id),
    contract_total_cents:
      row.contract_total_cents == null
        ? undefined
        : Number(row.contract_total_cents),
    proposed_new_total_cents:
      row.proposed_new_total_cents == null
        ? undefined
        : Number(row.proposed_new_total_cents),
    activity_id:
      row.activity_id == null ? null : String(row.activity_id),
  };
}

async function callScopeChangeRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  rpcName: string,
  payload: Record<string, unknown>
): Promise<JobScopeChangeRpcResult> {
  const { data, error } = await supabase.rpc(rpcName, { p_payload: payload });
  if (error) {
    throw new JobScopeChangePersistenceError(
      `${rpcName} failed: ${error.message}`
    );
  }
  return parseJobScopeChangeRpcResult(data);
}

export function buildCreateJobScopeChangePayload(
  input: CreateJobScopeChangeInput
): Record<string, unknown> {
  return {
    company_id: parseUuid(input.company_id, "company_id"),
    job_id: parseUuid(input.job_id, "job_id"),
    reason: input.reason ?? null,
    timing_note: input.timing_note ?? null,
    lines: serializeLines(input.lines),
  };
}

export function buildUpdateJobScopeChangeDraftPayload(
  input: UpdateJobScopeChangeDraftInput
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    company_id: parseUuid(input.company_id, "company_id"),
    job_id: parseUuid(input.job_id, "job_id"),
    scope_change_id: parseUuid(input.scope_change_id, "scope_change_id"),
  };
  if (input.expected_row_version != null) {
    payload.expected_row_version = Number(input.expected_row_version);
  }
  if (input.reason !== undefined) {
    payload.reason = input.reason;
  }
  if (input.timing_note !== undefined) {
    payload.timing_note = input.timing_note;
  }
  if (input.lines !== undefined) {
    payload.lines = serializeLines(input.lines);
  }
  return payload;
}

export function buildScopeChangeTransitionPayload(
  input: ScopeChangeTransitionInput
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    company_id: parseUuid(input.company_id, "company_id"),
    job_id: parseUuid(input.job_id, "job_id"),
    scope_change_id: parseUuid(input.scope_change_id, "scope_change_id"),
  };
  if (input.expected_row_version != null) {
    payload.expected_row_version = Number(input.expected_row_version);
  }
  return payload;
}

export function buildAuthorizeJobScopeChangePayload(
  input: AuthorizeJobScopeChangeInput
): Record<string, unknown> {
  const tokenHash = String(input.token_hash ?? "").trim().toLowerCase();
  if (!isJobScopeChangePublicAccessTokenSha256Hex(tokenHash)) {
    throw new JobScopeChangePersistenceError(
      "token_hash must be a 64-char SHA-256 hex digest.",
      "token_required"
    );
  }
  return {
    company_id: parseUuid(input.company_id, "company_id"),
    job_id: parseUuid(input.job_id, "job_id"),
    scope_change_id: parseUuid(input.scope_change_id, "scope_change_id"),
    token_hash: tokenHash,
    approved_by_name: String(input.approved_by_name ?? "").trim(),
    approved_by_email: input.approved_by_email ?? null,
    approval_method: input.approval_method ?? "public_token",
    evidence_json: input.evidence_json ?? null,
    proposal_signature_id: input.proposal_signature_id ?? null,
  };
}

export function buildMintJobScopeChangePublicAccessTokenPayload(
  input: MintJobScopeChangePublicAccessTokenInput
): Record<string, unknown> {
  const tokenHash = String(input.token_hash ?? "").trim().toLowerCase();
  if (!isJobScopeChangePublicAccessTokenSha256Hex(tokenHash)) {
    throw new JobScopeChangePersistenceError(
      "token_hash must be a 64-char SHA-256 hex digest.",
      "invalid_hash"
    );
  }
  return {
    company_id: parseUuid(input.company_id, "company_id"),
    job_id: parseUuid(input.job_id, "job_id"),
    scope_change_id: parseUuid(input.scope_change_id, "scope_change_id"),
    token_hash: tokenHash,
    token_prefix: String(input.token_prefix ?? "").trim(),
    expires_at: String(input.expires_at ?? ""),
    metadata_json: input.metadata_json ?? {},
  };
}

export async function createJobScopeChangeViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: CreateJobScopeChangeInput
): Promise<JobScopeChangeRpcResult> {
  return callScopeChangeRpc(
    supabase,
    CREATE_JOB_SCOPE_CHANGE_RPC_V1,
    buildCreateJobScopeChangePayload(input)
  );
}

export async function updateJobScopeChangeDraftViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: UpdateJobScopeChangeDraftInput
): Promise<JobScopeChangeRpcResult> {
  return callScopeChangeRpc(
    supabase,
    UPDATE_JOB_SCOPE_CHANGE_DRAFT_RPC_V1,
    buildUpdateJobScopeChangeDraftPayload(input)
  );
}

export async function proposeJobScopeChangeViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: ScopeChangeTransitionInput
): Promise<JobScopeChangeRpcResult> {
  return callScopeChangeRpc(
    supabase,
    PROPOSE_JOB_SCOPE_CHANGE_RPC_V1,
    buildScopeChangeTransitionPayload(input)
  );
}

/**
 * Public customer authorize path — call with admin/service_role client after
 * token resolution. Does not require auth.uid().
 */
export async function authorizeJobScopeChangeViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: AuthorizeJobScopeChangeInput
): Promise<JobScopeChangeRpcResult> {
  return callScopeChangeRpc(
    supabase,
    AUTHORIZE_JOB_SCOPE_CHANGE_RPC_V1,
    buildAuthorizeJobScopeChangePayload(input)
  );
}

export async function declineJobScopeChangeViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: ScopeChangeTransitionInput
): Promise<JobScopeChangeRpcResult> {
  return callScopeChangeRpc(
    supabase,
    DECLINE_JOB_SCOPE_CHANGE_RPC_V1,
    buildScopeChangeTransitionPayload(input)
  );
}

export async function voidJobScopeChangeViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: ScopeChangeTransitionInput
): Promise<JobScopeChangeRpcResult> {
  return callScopeChangeRpc(
    supabase,
    VOID_JOB_SCOPE_CHANGE_RPC_V1,
    buildScopeChangeTransitionPayload(input)
  );
}

/**
 * Contractor mint — authenticated client. App must hash raw token first.
 * Never send raw token. Result never includes token_hash.
 */
export async function mintScopeChangePublicAccessTokenViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: MintJobScopeChangePublicAccessTokenInput
): Promise<
  MintJobScopeChangePublicAccessTokenSuccess | JobScopeChangeRpcFailure
> {
  const payload = buildMintJobScopeChangePublicAccessTokenPayload(input);
  const { data, error } = await supabase.rpc(
    MINT_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1,
    { p_payload: payload }
  );
  if (error) {
    throw new JobScopeChangePersistenceError(
      `${MINT_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1} failed: ${error.message}`
    );
  }
  if (!data || typeof data !== "object") {
    throw new JobScopeChangePersistenceError(
      `${MINT_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1} returned a non-object.`
    );
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "invalid_payload"),
    };
  }
  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    token_id: parseUuid(row.token_id, "token_id"),
    token_prefix: String(row.token_prefix ?? ""),
    expires_at: String(row.expires_at ?? ""),
    status: String(row.status ?? "active"),
  };
}

/**
 * Public resolve — service_role client only. Pass hash or raw token
 * (raw is hashed here; never logged).
 */
export async function resolveScopeChangePublicAccessTokenViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  input: { token_hash?: string; raw_token?: string }
): Promise<
  ResolveJobScopeChangePublicAccessTokenSuccess | JobScopeChangeRpcFailure
> {
  let tokenHash = String(input.token_hash ?? "").trim().toLowerCase();
  if (!tokenHash && input.raw_token) {
    tokenHash = hashJobScopeChangePublicAccessToken(input.raw_token);
  }
  if (!isJobScopeChangePublicAccessTokenSha256Hex(tokenHash)) {
    return { ok: false, code: "invalid_hash" };
  }

  const { data, error } = await supabase.rpc(
    RESOLVE_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1,
    { p_token_hash: tokenHash }
  );
  if (error) {
    throw new JobScopeChangePersistenceError(
      `${RESOLVE_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1} failed: ${error.message}`
    );
  }
  if (!data || typeof data !== "object") {
    throw new JobScopeChangePersistenceError(
      `${RESOLVE_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1} returned a non-object.`
    );
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "not_found"),
      reason: row.scope_change_status == null
        ? undefined
        : String(row.scope_change_status),
    };
  }

  const scopeRaw = row.scope_change;
  if (!scopeRaw || typeof scopeRaw !== "object") {
    throw new JobScopeChangePersistenceError(
      "Resolve RPC missing scope_change."
    );
  }

  return {
    ok: true,
    token_id: parseUuid(row.token_id, "token_id"),
    company_id: parseUuid(row.company_id, "company_id"),
    job_id: parseUuid(row.job_id, "job_id"),
    scope_change_id: parseUuid(row.scope_change_id, "scope_change_id"),
    token_prefix: String(row.token_prefix ?? ""),
    expires_at: String(row.expires_at ?? ""),
    scope_change: parseScopeChange(scopeRaw as Record<string, unknown>),
    lines: parseLines(row.lines),
    contract_total_cents:
      row.contract_total_cents == null
        ? undefined
        : Number(row.contract_total_cents),
    proposed_new_total_cents:
      row.proposed_new_total_cents == null
        ? undefined
        : Number(row.proposed_new_total_cents),
  };
}

// ---------------------------------------------------------------------------
// Reads (RLS / service_role) — no direct table writes
// ---------------------------------------------------------------------------

const SCOPE_CHANGE_SELECT =
  "id,company_id,job_id,base_proposal_id,base_proposal_version_id,base_acceptance_id,status,reason,timing_note,price_delta_cents,basis_contract_total_cents,proposed_at,authorized_at,declined_at,voided_at,created_by,updated_by,row_version,created_at,updated_at,deleted_at";

const SCOPE_CHANGE_LINE_SELECT =
  "id,company_id,scope_change_id,change_kind,description,quantity,unit,unit_price_cents,line_delta_cents,sort_order,created_at";

export type JobScopeChangeWithLines = {
  scope_change: JobScopeChange;
  lines: JobScopeChangeLine[];
};

type SupabaseQuery = Pick<SupabaseClient, "from" | "rpc">;

function parseScopeChangeRow(row: Record<string, unknown>): JobScopeChange {
  return parseScopeChange(row);
}

function parseLineRows(rows: unknown): JobScopeChangeLine[] {
  return parseLines(rows) ?? [];
}

export async function listScopeChangesForJob(
  supabase: SupabaseQuery,
  input: { company_id: string; job_id: string }
): Promise<JobScopeChange[]> {
  const companyId = parseUuid(input.company_id, "company_id");
  const jobId = parseUuid(input.job_id, "job_id");
  const { data, error } = await supabase
    .from("job_scope_changes")
    .select(SCOPE_CHANGE_SELECT)
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new JobScopeChangePersistenceError(
      `listScopeChangesForJob failed: ${error.message}`
    );
  }
  return (data ?? []).map((row) =>
    parseScopeChangeRow(row as Record<string, unknown>)
  );
}

export async function getScopeChangeWithLines(
  supabase: SupabaseQuery,
  input: {
    company_id: string;
    job_id: string;
    scope_change_id: string;
  }
): Promise<JobScopeChangeWithLines | null> {
  const companyId = parseUuid(input.company_id, "company_id");
  const jobId = parseUuid(input.job_id, "job_id");
  const scopeChangeId = parseUuid(input.scope_change_id, "scope_change_id");

  const { data: header, error: headerError } = await supabase
    .from("job_scope_changes")
    .select(SCOPE_CHANGE_SELECT)
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .eq("id", scopeChangeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (headerError) {
    throw new JobScopeChangePersistenceError(
      `getScopeChangeWithLines failed: ${headerError.message}`
    );
  }
  if (!header) return null;

  const { data: lines, error: linesError } = await supabase
    .from("job_scope_change_lines")
    .select(SCOPE_CHANGE_LINE_SELECT)
    .eq("company_id", companyId)
    .eq("scope_change_id", scopeChangeId)
    .order("sort_order", { ascending: true });
  if (linesError) {
    throw new JobScopeChangePersistenceError(
      `getScopeChangeWithLines lines failed: ${linesError.message}`
    );
  }

  return {
    scope_change: parseScopeChangeRow(header as Record<string, unknown>),
    lines: parseLineRows(lines),
  };
}

/**
 * Resolve a scope change by bound public-token claims (service_role).
 * Token claims must match company + job + scope_change; no client-trusted tenancy.
 */
export async function getScopeChangeByPublicTokenBinding(
  supabase: SupabaseQuery,
  binding: {
    company_id: string;
    job_id: string;
    scope_change_id: string;
  }
): Promise<JobScopeChangeWithLines | null> {
  return getScopeChangeWithLines(supabase, binding);
}

export async function fetchJobContractTotalCents(
  supabase: Pick<SupabaseClient, "rpc">,
  input: { company_id: string; job_id: string }
): Promise<number> {
  const companyId = parseUuid(input.company_id, "company_id");
  const jobId = parseUuid(input.job_id, "job_id");
  const { data, error } = await supabase.rpc("job_contract_total_cents_v1", {
    p_company_id: companyId,
    p_job_id: jobId,
  });
  if (error) {
    throw new JobScopeChangePersistenceError(
      `job_contract_total_cents_v1 failed: ${error.message}`
    );
  }
  const cents = Number(data ?? 0);
  return Number.isFinite(cents) ? Math.trunc(cents) : 0;
}

/** Null when the rollup has no accepted basis — callers must not show $0. */
export async function fetchJobContractTotalCentsOrNull(
  supabase: Pick<SupabaseClient, "rpc">,
  input: { company_id: string; job_id: string }
): Promise<number | null> {
  const companyId = parseUuid(input.company_id, "company_id");
  const jobId = parseUuid(input.job_id, "job_id");
  const { data, error } = await supabase.rpc("job_contract_total_cents_v1", {
    p_company_id: companyId,
    p_job_id: jobId,
  });
  if (error || data == null) return null;
  const cents = Number(data);
  return Number.isFinite(cents) ? Math.trunc(cents) : null;
}

const SCOPE_CHANGE_APPROVAL_SELECT =
  "id,company_id,scope_change_id,approved_at,approved_by_name,approved_by_email,approval_method,evidence_json,proposal_signature_id,created_at";

export async function listScopeChangeApprovals(
  supabase: SupabaseQuery,
  input: { company_id: string; scope_change_ids: readonly string[] }
): Promise<JobScopeChangeApproval[]> {
  const companyId = parseUuid(input.company_id, "company_id");
  const ids = input.scope_change_ids.map((id) => parseUuid(id, "scope_change_id"));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("job_scope_change_approvals")
    .select(SCOPE_CHANGE_APPROVAL_SELECT)
    .eq("company_id", companyId)
    .in("scope_change_id", ids)
    .order("approved_at", { ascending: true });
  if (error) {
    throw new JobScopeChangePersistenceError(
      `listScopeChangeApprovals failed: ${error.message}`
    );
  }
  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      company_id: String(row.company_id),
      scope_change_id: String(row.scope_change_id),
      approved_at: String(row.approved_at),
      approved_by_name: String(row.approved_by_name ?? ""),
      approved_by_email: row.approved_by_email == null ? null : String(row.approved_by_email),
      approval_method: "public_token",
      evidence_json:
        row.evidence_json != null && typeof row.evidence_json === "object"
          ? (row.evidence_json as Record<string, unknown>)
          : null,
      proposal_signature_id:
        row.proposal_signature_id == null ? null : String(row.proposal_signature_id),
      created_at: String(row.created_at),
    };
  });
}

export type AuthorizedScopeChangeRecord = JobScopeChangeWithLines & {
  approval: JobScopeChangeApproval | null;
};

/** Authorized changes for one company + job, with lines and approval evidence. */
export async function listAuthorizedScopeChangesWithApprovals(
  supabase: SupabaseQuery,
  input: { company_id: string; job_id: string }
): Promise<AuthorizedScopeChangeRecord[]> {
  const companyId = parseUuid(input.company_id, "company_id");
  const jobId = parseUuid(input.job_id, "job_id");
  const authorized = (await listScopeChangesForJob(supabase, input)).filter(
    (row) => row.status === "authorized" && row.company_id === companyId && row.job_id === jobId
  );
  if (authorized.length === 0) return [];
  const ids = authorized.map((row) => row.id);
  const { data: lines, error: linesError } = await supabase
    .from("job_scope_change_lines")
    .select(SCOPE_CHANGE_LINE_SELECT)
    .eq("company_id", companyId)
    .in("scope_change_id", ids)
    .order("sort_order", { ascending: true });
  if (linesError) {
    throw new JobScopeChangePersistenceError(
      `listAuthorizedScopeChangesWithApprovals lines failed: ${linesError.message}`
    );
  }
  const parsedLines = parseLineRows(lines);
  const approvals = await listScopeChangeApprovals(supabase, {
    company_id: companyId,
    scope_change_ids: ids,
  });
  return authorized.map((scope_change) => ({
    scope_change,
    lines: parsedLines.filter((line) => line.scope_change_id === scope_change.id),
    approval: approvals.find((row) => row.scope_change_id === scope_change.id) ?? null,
  }));
}

export function authorizedDeltasSumCents(
  changes: readonly Pick<JobScopeChange, "status" | "price_delta_cents">[]
): number {
  return changes
    .filter((row) => row.status === "authorized")
    .reduce((sum, row) => sum + (Number(row.price_delta_cents) || 0), 0);
}
