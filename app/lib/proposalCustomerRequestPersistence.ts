/**
 * R3B1 — Customer package request RPC persistence.
 *
 * Hashes raw public tokens before service_role RPC calls.
 * Injectable Supabase client for tests. Server entry: proposalCustomerRequestStore.server.ts.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  hashProposalPublicAccessToken,
  ProposalPublicAccessTokenHashError,
} from "@/app/lib/proposalPublicAccessTokenHash";
import type { SupabaseClient } from "@supabase/supabase-js";

export const RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1 =
  "record_proposal_customer_request_v1";

export const UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1 =
  "update_proposal_customer_request_status_v1";

export const PROPOSAL_CUSTOMER_REQUEST_INTENTS = [
  "request_package",
  "ask_question",
  "ask_about_package",
] as const;

export type ProposalCustomerRequestIntent =
  (typeof PROPOSAL_CUSTOMER_REQUEST_INTENTS)[number];

export const PROPOSAL_CUSTOMER_REQUEST_STATUSES = [
  "new",
  "seen",
  "dismissed",
] as const;

export type ProposalCustomerRequestStatus =
  (typeof PROPOSAL_CUSTOMER_REQUEST_STATUSES)[number];

export const PROPOSAL_CUSTOMER_REQUEST_REVIEW_STATUSES = [
  "seen",
  "dismissed",
] as const;

export type ProposalCustomerRequestReviewStatus =
  (typeof PROPOSAL_CUSTOMER_REQUEST_REVIEW_STATUSES)[number];

export const PROPOSAL_CUSTOMER_REQUEST_FAILURE_CODES = [
  "invalid_hash",
  "not_found",
  "revoked",
  "superseded",
  "expired",
  "invalid_version",
  "invalid_binding",
  "proposal_unavailable",
  "invalid_intent",
  "invalid_message",
  "invalid_customer_name",
  "invalid_customer_email",
  "invalid_customer_phone",
  "invalid_payload",
  "forbidden_payload_keys",
  "invalid_submission_key",
  "idempotency_conflict",
  "option_required",
  "option_not_on_version",
] as const;

export type ProposalCustomerRequestFailureCode =
  (typeof PROPOSAL_CUSTOMER_REQUEST_FAILURE_CODES)[number];

export type ProposalCustomerRequestRecordSuccess = {
  ok: true;
  request_id: string;
  attention_id: string;
  intent: ProposalCustomerRequestIntent;
  status: ProposalCustomerRequestStatus;
  idempotent_replay: boolean;
  token_id: string;
  proposal_id: string;
  proposal_version_id: string;
  requested_option_id: string | null;
  requested_option_label: string | null;
  proposal_status_unchanged: string | null;
  selected_option_id_unchanged: string | null;
  job_stage_unchanged: string | null;
};

export type ProposalCustomerRequestFailure = {
  ok: false;
  code: ProposalCustomerRequestFailureCode;
};

export type ProposalCustomerRequestRecordResult =
  | ProposalCustomerRequestRecordSuccess
  | ProposalCustomerRequestFailure;

export type ProposalCustomerRequestSubmitInput = {
  submissionKey: string;
  intent: ProposalCustomerRequestIntent;
  requestedOptionId?: string | null;
  message?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  payloadJson?: Record<string, unknown> | null;
};

export class ProposalCustomerRequestStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalCustomerRequestStoreError";
  }
}

export class ProposalCustomerRequestValidationError extends ProposalCustomerRequestStoreError {
  constructor(message: string) {
    super(message);
    this.name = "ProposalCustomerRequestValidationError";
  }
}

export const PROPOSAL_CUSTOMER_REQUEST_MESSAGE_MAX = 2000;
export const PROPOSAL_CUSTOMER_REQUEST_NAME_MAX = 120;
export const PROPOSAL_CUSTOMER_REQUEST_EMAIL_MAX = 254;
export const PROPOSAL_CUSTOMER_REQUEST_PHONE_MAX = 40;

function isFailureCode(value: unknown): value is ProposalCustomerRequestFailureCode {
  return (
    typeof value === "string" &&
    (PROPOSAL_CUSTOMER_REQUEST_FAILURE_CODES as readonly string[]).includes(value)
  );
}

function isIntent(value: unknown): value is ProposalCustomerRequestIntent {
  return (
    typeof value === "string" &&
    (PROPOSAL_CUSTOMER_REQUEST_INTENTS as readonly string[]).includes(value)
  );
}

function parseUuidField(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new ProposalCustomerRequestStoreError(
      `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned invalid ${label}.`
    );
  }
  return id;
}

function parseOptionalUuidField(value: unknown, label: string): string | null {
  if (value == null) return null;
  const id = String(value).trim();
  if (!id) return null;
  if (!isUuidLike(id)) {
    throw new ProposalCustomerRequestStoreError(
      `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned invalid ${label}.`
    );
  }
  return id;
}

function trimOrNull(value: string | null | undefined, max: number): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new ProposalCustomerRequestValidationError(
      `Customer request field exceeds max length (${max}).`
    );
  }
  return trimmed;
}

function tokenHashFromRaw(rawToken: string): string {
  try {
    return hashProposalPublicAccessToken(rawToken);
  } catch (error) {
    if (error instanceof ProposalPublicAccessTokenHashError) {
      throw new ProposalCustomerRequestValidationError(error.message);
    }
    throw error;
  }
}

export function parseProposalCustomerRequestRpcResult(
  data: unknown
): ProposalCustomerRequestRecordResult {
  if (!data || typeof data !== "object") {
    throw new ProposalCustomerRequestStoreError(
      `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned no result.`
    );
  }

  const result = data as Record<string, unknown>;

  if (result.ok === false) {
    const code = result.code;
    if (!isFailureCode(code)) {
      throw new ProposalCustomerRequestStoreError(
        `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned unknown failure code.`
      );
    }
    return { ok: false, code };
  }

  if (result.ok !== true) {
    throw new ProposalCustomerRequestStoreError(
      `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned unexpected ok value.`
    );
  }

  if (!isIntent(result.intent)) {
    throw new ProposalCustomerRequestStoreError(
      `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned invalid intent.`
    );
  }

  if (!isRequestStatus(result.status)) {
    throw new ProposalCustomerRequestStoreError(
      `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned unexpected status.`
    );
  }

  if (typeof result.idempotent_replay !== "boolean") {
    throw new ProposalCustomerRequestStoreError(
      `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned invalid replay state.`
    );
  }

  const labelRaw = result.requested_option_label;
  const requestedOptionLabel =
    labelRaw == null ? null : String(labelRaw).trim() || null;

  return {
    ok: true,
    request_id: parseUuidField(result.request_id, "request_id"),
    attention_id: parseUuidField(result.attention_id, "attention_id"),
    intent: result.intent,
    status: result.status,
    idempotent_replay: result.idempotent_replay,
    token_id: parseUuidField(result.token_id, "token_id"),
    proposal_id: parseUuidField(result.proposal_id, "proposal_id"),
    proposal_version_id: parseUuidField(
      result.proposal_version_id,
      "proposal_version_id"
    ),
    requested_option_id: parseOptionalUuidField(
      result.requested_option_id,
      "requested_option_id"
    ),
    requested_option_label: requestedOptionLabel,
    proposal_status_unchanged:
      result.proposal_status_unchanged == null
        ? null
        : String(result.proposal_status_unchanged),
    selected_option_id_unchanged: parseOptionalUuidField(
      result.selected_option_id_unchanged,
      "selected_option_id_unchanged"
    ),
    job_stage_unchanged:
      result.job_stage_unchanged == null
        ? null
        : String(result.job_stage_unchanged),
  };
}

/** Validate body fields before hashing/RPC. Does not accept company/proposal overrides. */
export function normalizeCustomerRequestSubmitInput(
  input: ProposalCustomerRequestSubmitInput
): {
  submissionKey: string;
  intent: ProposalCustomerRequestIntent;
  requestedOptionId: string | null;
  message: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  payloadJson: Record<string, unknown>;
} {
  if (!isIntent(input.intent)) {
    throw new ProposalCustomerRequestValidationError("Invalid customer request intent.");
  }

  const submissionKey = input.submissionKey.trim();
  if (!isUuidLike(submissionKey)) {
    throw new ProposalCustomerRequestValidationError(
      "submissionKey must be a UUID."
    );
  }

  const requestedOptionIdRaw = (input.requestedOptionId ?? "").trim();
  const requestedOptionId = requestedOptionIdRaw
    ? requestedOptionIdRaw
    : null;

  if (
    (input.intent === "request_package" || input.intent === "ask_about_package") &&
    (!requestedOptionId || !isUuidLike(requestedOptionId))
  ) {
    throw new ProposalCustomerRequestValidationError(
      "requestedOptionId is required for package requests."
    );
  }

  if (requestedOptionId && !isUuidLike(requestedOptionId)) {
    throw new ProposalCustomerRequestValidationError("requestedOptionId must be a UUID.");
  }

  const payloadJson =
    input.payloadJson && typeof input.payloadJson === "object"
      ? { ...input.payloadJson }
      : {};

  // Never forward client binding overrides.
  delete payloadJson.company_id;
  delete payloadJson.proposal_id;
  delete payloadJson.proposal_version_id;
  delete payloadJson.token_id;
  delete payloadJson.public_access_token_id;
  delete payloadJson.raw_token;
  delete payloadJson.token;
  delete payloadJson.token_hash;

  return {
    submissionKey,
    intent: input.intent,
    requestedOptionId,
    message: trimOrNull(input.message, PROPOSAL_CUSTOMER_REQUEST_MESSAGE_MAX),
    customerName: trimOrNull(input.customerName, PROPOSAL_CUSTOMER_REQUEST_NAME_MAX),
    customerEmail: trimOrNull(input.customerEmail, PROPOSAL_CUSTOMER_REQUEST_EMAIL_MAX),
    customerPhone: trimOrNull(input.customerPhone, PROPOSAL_CUSTOMER_REQUEST_PHONE_MAX),
    payloadJson,
  };
}

export async function recordProposalCustomerRequestViaRpc(
  supabase: SupabaseClient,
  rawToken: string,
  input: ProposalCustomerRequestSubmitInput
): Promise<ProposalCustomerRequestRecordResult> {
  const tokenHash = tokenHashFromRaw(rawToken);
  const normalized = normalizeCustomerRequestSubmitInput(input);

  const { data, error } = await supabase.rpc(RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1, {
    p_token_hash: tokenHash,
    p_intent: normalized.intent,
    p_requested_option_id: normalized.requestedOptionId,
    p_message: normalized.message,
    p_customer_name: normalized.customerName,
    p_customer_email: normalized.customerEmail,
    p_customer_phone: normalized.customerPhone,
    p_payload_json: normalized.payloadJson,
    p_submission_key: normalized.submissionKey,
  });

  if (error) {
    throw new ProposalCustomerRequestStoreError(
      error.message ?? `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC failed.`
    );
  }

  return parseProposalCustomerRequestRpcResult(data);
}

export type ProposalCustomerRequestContractorRow = {
  id: string;
  intent: ProposalCustomerRequestIntent;
  status: ProposalCustomerRequestStatus;
  requested_option_id: string | null;
  requested_option_label: string | null;
  message: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  created_at: string;
  proposal_id: string;
  proposal_version_id: string;
};

export const PROPOSAL_CUSTOMER_REQUEST_STATUS_UPDATE_FAILURE_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_request_id",
  "invalid_status",
  "invalid_transition",
  "proposal_unavailable",
] as const;

export type ProposalCustomerRequestStatusUpdateFailureCode =
  (typeof PROPOSAL_CUSTOMER_REQUEST_STATUS_UPDATE_FAILURE_CODES)[number];

export type ProposalCustomerRequestStatusUpdateSuccess = {
  ok: true;
  request_id: string;
  status: ProposalCustomerRequestReviewStatus;
  previous_status: ProposalCustomerRequestStatus;
  proposal_id: string;
  proposal_version_id: string;
  proposal_status_unchanged: string | null;
  selected_option_id_unchanged: string | null;
  job_stage_unchanged: string | null;
};

export type ProposalCustomerRequestStatusUpdateFailure = {
  ok: false;
  code: ProposalCustomerRequestStatusUpdateFailureCode;
};

export type ProposalCustomerRequestStatusUpdateResult =
  | ProposalCustomerRequestStatusUpdateSuccess
  | ProposalCustomerRequestStatusUpdateFailure;

function isRequestStatus(value: unknown): value is ProposalCustomerRequestStatus {
  return (
    typeof value === "string" &&
    (PROPOSAL_CUSTOMER_REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

function isReviewStatus(value: unknown): value is ProposalCustomerRequestReviewStatus {
  return (
    typeof value === "string" &&
    (PROPOSAL_CUSTOMER_REQUEST_REVIEW_STATUSES as readonly string[]).includes(value)
  );
}

function isStatusUpdateFailureCode(
  value: unknown
): value is ProposalCustomerRequestStatusUpdateFailureCode {
  return (
    typeof value === "string" &&
    (PROPOSAL_CUSTOMER_REQUEST_STATUS_UPDATE_FAILURE_CODES as readonly string[]).includes(
      value
    )
  );
}

function parseContractorRequestRow(
  row: Record<string, unknown>
): ProposalCustomerRequestContractorRow {
  if (!isIntent(row.intent)) {
    throw new ProposalCustomerRequestStoreError(
      "proposal_customer_requests row has invalid intent."
    );
  }
  if (!isRequestStatus(row.status)) {
    throw new ProposalCustomerRequestStoreError(
      "proposal_customer_requests row has invalid status."
    );
  }

  const createdAt = String(row.created_at ?? "").trim();
  if (!createdAt) {
    throw new ProposalCustomerRequestStoreError(
      "proposal_customer_requests row missing created_at."
    );
  }

  return {
    id: parseUuidField(row.id, "id"),
    intent: row.intent,
    status: row.status,
    requested_option_id: parseOptionalUuidField(
      row.requested_option_id,
      "requested_option_id"
    ),
    requested_option_label:
      row.requested_option_label == null
        ? null
        : String(row.requested_option_label).trim() || null,
    message: row.message == null ? null : String(row.message).trim() || null,
    customer_name:
      row.customer_name == null ? null : String(row.customer_name).trim() || null,
    customer_email:
      row.customer_email == null ? null : String(row.customer_email).trim() || null,
    customer_phone:
      row.customer_phone == null ? null : String(row.customer_phone).trim() || null,
    created_at: createdAt,
    proposal_id: parseUuidField(row.proposal_id, "proposal_id"),
    proposal_version_id: parseUuidField(
      row.proposal_version_id,
      "proposal_version_id"
    ),
  };
}

/** Authenticated SELECT via RLS — never returns public token fields. */
export async function listProposalCustomerRequestsForProposalWithClient(
  supabase: SupabaseClient,
  input: { company_id: string; proposal_id: string }
): Promise<ProposalCustomerRequestContractorRow[]> {
  const companyId = input.company_id.trim();
  const proposalId = input.proposal_id.trim();
  if (!isUuidLike(companyId) || !isUuidLike(proposalId)) {
    throw new ProposalCustomerRequestStoreError(
      "company_id and proposal_id must be UUIDs."
    );
  }

  const { data, error } = await supabase
    .from("proposal_customer_requests")
    .select(
      [
        "id",
        "intent",
        "status",
        "requested_option_id",
        "requested_option_label",
        "message",
        "customer_name",
        "customer_email",
        "customer_phone",
        "created_at",
        "proposal_id",
        "proposal_version_id",
      ].join(", ")
    )
    .eq("company_id", companyId)
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProposalCustomerRequestStoreError(
      error.message ?? "Failed to list proposal_customer_requests."
    );
  }

  return (data ?? []).map((row) =>
    parseContractorRequestRow(row as unknown as Record<string, unknown>)
  );
}

export function parseProposalCustomerRequestStatusUpdateRpcResult(
  data: unknown
): ProposalCustomerRequestStatusUpdateResult {
  if (!data || typeof data !== "object") {
    throw new ProposalCustomerRequestStoreError(
      `${UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1} RPC returned no result.`
    );
  }

  const result = data as Record<string, unknown>;

  if (result.ok === false) {
    if (!isStatusUpdateFailureCode(result.code)) {
      throw new ProposalCustomerRequestStoreError(
        `${UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1} RPC returned unknown failure code.`
      );
    }
    return { ok: false, code: result.code };
  }

  if (result.ok !== true) {
    throw new ProposalCustomerRequestStoreError(
      `${UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1} RPC returned unexpected ok value.`
    );
  }

  if (!isReviewStatus(result.status)) {
    throw new ProposalCustomerRequestStoreError(
      `${UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1} RPC returned invalid status.`
    );
  }

  if (!isRequestStatus(result.previous_status)) {
    throw new ProposalCustomerRequestStoreError(
      `${UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1} RPC returned invalid previous_status.`
    );
  }

  return {
    ok: true,
    request_id: parseUuidField(result.request_id, "request_id"),
    status: result.status,
    previous_status: result.previous_status,
    proposal_id: parseUuidField(result.proposal_id, "proposal_id"),
    proposal_version_id: parseUuidField(
      result.proposal_version_id,
      "proposal_version_id"
    ),
    proposal_status_unchanged:
      result.proposal_status_unchanged == null
        ? null
        : String(result.proposal_status_unchanged),
    selected_option_id_unchanged: parseOptionalUuidField(
      result.selected_option_id_unchanged,
      "selected_option_id_unchanged"
    ),
    job_stage_unchanged:
      result.job_stage_unchanged == null
        ? null
        : String(result.job_stage_unchanged),
  };
}

export async function updateProposalCustomerRequestStatusViaRpc(
  supabase: SupabaseClient,
  input: { requestId: string; status: ProposalCustomerRequestReviewStatus }
): Promise<ProposalCustomerRequestStatusUpdateResult> {
  const requestId = input.requestId.trim();
  if (!isUuidLike(requestId)) {
    throw new ProposalCustomerRequestStoreError("requestId must be a UUID.");
  }
  if (!isReviewStatus(input.status)) {
    throw new ProposalCustomerRequestStoreError("Invalid review status.");
  }

  const { data, error } = await supabase.rpc(
    UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1,
    {
      p_request_id: requestId,
      p_status: input.status,
    }
  );

  if (error) {
    throw new ProposalCustomerRequestStoreError(
      error.message ??
        `${UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1} RPC failed.`
    );
  }

  return parseProposalCustomerRequestStatusUpdateRpcResult(data);
}
