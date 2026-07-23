/**
 * R3B1 — Customer package request RPC persistence.
 *
 * Hashes raw public tokens before service_role RPC calls.
 * Injectable Supabase client for tests. Server entry: proposalCustomerRequestStore.server.ts.
 */

import { isUuidLike } from "@/app/lib/jobStore";
import {
  hashProposalPublicAccessToken,
  ProposalPublicAccessTokenHashError,
} from "@/app/lib/proposalPublicAccessTokenHash";
import type { SupabaseClient } from "@supabase/supabase-js";

export const RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1 =
  "record_proposal_customer_request_v1";

export const PROPOSAL_CUSTOMER_REQUEST_INTENTS = [
  "request_package",
  "ask_question",
  "ask_about_package",
] as const;

export type ProposalCustomerRequestIntent =
  (typeof PROPOSAL_CUSTOMER_REQUEST_INTENTS)[number];

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
  "option_required",
  "option_not_on_version",
] as const;

export type ProposalCustomerRequestFailureCode =
  (typeof PROPOSAL_CUSTOMER_REQUEST_FAILURE_CODES)[number];

export type ProposalCustomerRequestRecordSuccess = {
  ok: true;
  request_id: string;
  intent: ProposalCustomerRequestIntent;
  status: "new";
  token_id: string;
  proposal_id: string;
  proposal_version_id: string;
  requested_option_id: string | null;
  requested_option_label: string | null;
  proposal_status_unchanged: string | null;
  selected_option_id_unchanged: string | null;
};

export type ProposalCustomerRequestFailure = {
  ok: false;
  code: ProposalCustomerRequestFailureCode;
};

export type ProposalCustomerRequestRecordResult =
  | ProposalCustomerRequestRecordSuccess
  | ProposalCustomerRequestFailure;

export type ProposalCustomerRequestSubmitInput = {
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
    throw new ProposalCustomerRequestStoreError(
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
      throw new ProposalCustomerRequestStoreError(error.message);
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

  if (String(result.status ?? "").trim() !== "new") {
    throw new ProposalCustomerRequestStoreError(
      `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC returned unexpected status.`
    );
  }

  const labelRaw = result.requested_option_label;
  const requestedOptionLabel =
    labelRaw == null ? null : String(labelRaw).trim() || null;

  return {
    ok: true,
    request_id: parseUuidField(result.request_id, "request_id"),
    intent: result.intent,
    status: "new",
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
  };
}

/** Validate body fields before hashing/RPC. Does not accept company/proposal overrides. */
export function normalizeCustomerRequestSubmitInput(
  input: ProposalCustomerRequestSubmitInput
): {
  intent: ProposalCustomerRequestIntent;
  requestedOptionId: string | null;
  message: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  payloadJson: Record<string, unknown>;
} {
  if (!isIntent(input.intent)) {
    throw new ProposalCustomerRequestStoreError("Invalid customer request intent.");
  }

  const requestedOptionIdRaw = (input.requestedOptionId ?? "").trim();
  const requestedOptionId = requestedOptionIdRaw
    ? requestedOptionIdRaw
    : null;

  if (
    (input.intent === "request_package" || input.intent === "ask_about_package") &&
    (!requestedOptionId || !isUuidLike(requestedOptionId))
  ) {
    throw new ProposalCustomerRequestStoreError(
      "requestedOptionId is required for package requests."
    );
  }

  if (requestedOptionId && !isUuidLike(requestedOptionId)) {
    throw new ProposalCustomerRequestStoreError("requestedOptionId must be a UUID.");
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
  });

  if (error) {
    throw new ProposalCustomerRequestStoreError(
      error.message ?? `${RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1} RPC failed.`
    );
  }

  return parseProposalCustomerRequestRpcResult(data);
}
