/**
 * R18C3A — Public proposal access token resolve / view-record RPC persistence.
 *
 * Hashes raw tokens before service_role RPC calls. Injectable Supabase client for tests.
 * Server entry points live in proposalPublicAccessRpcStore.server.ts.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  hashProposalPublicAccessToken,
  isProposalPublicAccessTokenSha256Hex,
  ProposalPublicAccessTokenHashError,
} from "@/app/lib/proposalPublicAccessTokenHash";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// RPC contract
// ---------------------------------------------------------------------------

export const RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1 =
  "resolve_proposal_public_access_token_v1";

export const RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1 =
  "record_proposal_customer_view_v1";

export const PROPOSAL_PUBLIC_ACCESS_FAILURE_CODES = [
  "invalid_hash",
  "not_found",
  "revoked",
  "superseded",
  "expired",
  "invalid_version",
  "invalid_binding",
  "invalid_ip_hash",
  "invalid_referrer_host",
  "invalid_payload",
  "forbidden_payload_keys",
] as const;

export type ProposalPublicAccessFailureCode =
  (typeof PROPOSAL_PUBLIC_ACCESS_FAILURE_CODES)[number];

export type ProposalPublicAccessResolveSuccess = {
  ok: true;
  token_id: string;
  company_id: string;
  proposal_id: string;
  proposal_version_id: string;
  purpose: string;
  status: string;
  expires_at: string;
};

export type ProposalPublicAccessRecordViewSuccess = {
  ok: true;
  event_type: "first_view" | "view";
  token_id: string;
  proposal_id: string;
  proposal_version_id: string;
};

export type ProposalPublicAccessFailure = {
  ok: false;
  code: ProposalPublicAccessFailureCode;
};

export type ProposalPublicAccessResolveResult =
  | ProposalPublicAccessResolveSuccess
  | ProposalPublicAccessFailure;

export type ProposalPublicAccessRecordViewResult =
  | ProposalPublicAccessRecordViewSuccess
  | ProposalPublicAccessFailure;

export type ProposalPublicAccessCustomerViewMetadata = {
  ipHash?: string | null;
  userAgent?: string | null;
  referrerHost?: string | null;
  payloadJson?: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalPublicAccessRpcStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalPublicAccessRpcStoreError";
  }
}

// ---------------------------------------------------------------------------
// Parsing (exported for tests)
// ---------------------------------------------------------------------------

function isFailureCode(value: unknown): value is ProposalPublicAccessFailureCode {
  return (
    typeof value === "string" &&
    (PROPOSAL_PUBLIC_ACCESS_FAILURE_CODES as readonly string[]).includes(value)
  );
}

function parseUuidField(
  value: unknown,
  label: string,
  rpcName: string
): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new ProposalPublicAccessRpcStoreError(
      `${rpcName} RPC returned invalid ${label}.`
    );
  }
  return id;
}

function parseNonEmptyStringField(
  value: unknown,
  label: string,
  rpcName: string
): string {
  const text = String(value ?? "").trim();
  if (text.length === 0) {
    throw new ProposalPublicAccessRpcStoreError(
      `${rpcName} RPC returned invalid ${label}.`
    );
  }
  return text;
}

function parseFailureResult(data: unknown, rpcName: string): ProposalPublicAccessFailure {
  if (!data || typeof data !== "object") {
    throw new ProposalPublicAccessRpcStoreError(`${rpcName} RPC returned no result.`);
  }
  const result = data as Record<string, unknown>;
  if (result.ok !== false) {
    throw new ProposalPublicAccessRpcStoreError(
      `${rpcName} RPC returned unexpected ok !== false failure shape.`
    );
  }
  const code = result.code;
  if (!isFailureCode(code)) {
    throw new ProposalPublicAccessRpcStoreError(
      `${rpcName} RPC returned invalid failure code.`
    );
  }
  return { ok: false, code };
}

export function parseProposalPublicAccessResolveRpcResult(
  data: unknown
): ProposalPublicAccessResolveResult {
  if (!data || typeof data !== "object") {
    throw new ProposalPublicAccessRpcStoreError(
      "resolve_proposal_public_access_token_v1 RPC returned no result."
    );
  }

  const result = data as Record<string, unknown>;

  if (result.ok === false) {
    return parseFailureResult(result, RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1);
  }

  if (result.ok !== true) {
    throw new ProposalPublicAccessRpcStoreError(
      "resolve_proposal_public_access_token_v1 RPC returned unexpected ok value."
    );
  }

  return {
    ok: true,
    token_id: parseUuidField(
      result.token_id,
      "token_id",
      RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    company_id: parseUuidField(
      result.company_id,
      "company_id",
      RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    proposal_id: parseUuidField(
      result.proposal_id,
      "proposal_id",
      RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    proposal_version_id: parseUuidField(
      result.proposal_version_id,
      "proposal_version_id",
      RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    purpose: parseNonEmptyStringField(
      result.purpose,
      "purpose",
      RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    status: parseNonEmptyStringField(
      result.status,
      "status",
      RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    expires_at: parseNonEmptyStringField(
      result.expires_at,
      "expires_at",
      RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
  };
}

export function parseProposalPublicAccessRecordViewRpcResult(
  data: unknown
): ProposalPublicAccessRecordViewResult {
  if (!data || typeof data !== "object") {
    throw new ProposalPublicAccessRpcStoreError(
      "record_proposal_customer_view_v1 RPC returned no result."
    );
  }

  const result = data as Record<string, unknown>;

  if (result.ok === false) {
    return parseFailureResult(result, RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1);
  }

  if (result.ok !== true) {
    throw new ProposalPublicAccessRpcStoreError(
      "record_proposal_customer_view_v1 RPC returned unexpected ok value."
    );
  }

  const eventType = String(result.event_type ?? "").trim();
  if (eventType !== "first_view" && eventType !== "view") {
    throw new ProposalPublicAccessRpcStoreError(
      "record_proposal_customer_view_v1 RPC returned invalid event_type."
    );
  }

  return {
    ok: true,
    event_type: eventType,
    token_id: parseUuidField(
      result.token_id,
      "token_id",
      RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1
    ),
    proposal_id: parseUuidField(
      result.proposal_id,
      "proposal_id",
      RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1
    ),
    proposal_version_id: parseUuidField(
      result.proposal_version_id,
      "proposal_version_id",
      RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1
    ),
  };
}

// ---------------------------------------------------------------------------
// RPC argument builders
// ---------------------------------------------------------------------------

function tokenHashFromRaw(rawToken: string): string {
  try {
    return hashProposalPublicAccessToken(rawToken);
  } catch (error) {
    if (error instanceof ProposalPublicAccessTokenHashError) {
      throw new ProposalPublicAccessRpcStoreError(error.message);
    }
    throw error;
  }
}

function validateOptionalIpHash(ipHash: string | null | undefined): string | null {
  if (ipHash == null) {
    return null;
  }
  const trimmed = ipHash.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!isProposalPublicAccessTokenSha256Hex(trimmed)) {
    return "__invalid__";
  }
  return trimmed;
}

function buildRecordViewRpcArgs(
  tokenHash: string,
  metadata: ProposalPublicAccessCustomerViewMetadata = {}
): Record<string, unknown> {
  const ipHash = validateOptionalIpHash(metadata.ipHash);
  if (ipHash === "__invalid__") {
    return { __invalid_ip_hash: true };
  }

  const payloadJson =
    metadata.payloadJson == null ? {} : metadata.payloadJson;

  return {
    p_token_hash: tokenHash,
    p_ip_hash: ipHash,
    p_user_agent: metadata.userAgent ?? null,
    p_referrer_host: metadata.referrerHost ?? null,
    p_payload_json: payloadJson,
  };
}

// ---------------------------------------------------------------------------
// RPC wrappers (injectable Supabase client for tests)
// ---------------------------------------------------------------------------

export async function resolveProposalPublicAccessTokenViaRpc(
  supabase: SupabaseClient,
  rawToken: string
): Promise<ProposalPublicAccessResolveResult> {
  const tokenHash = tokenHashFromRaw(rawToken);

  const { data, error } = await supabase.rpc(RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1, {
    p_token_hash: tokenHash,
  });

  if (error) {
    throw new ProposalPublicAccessRpcStoreError(
      error.message ?? "resolve_proposal_public_access_token_v1 RPC failed."
    );
  }

  return parseProposalPublicAccessResolveRpcResult(data);
}

export async function recordProposalCustomerViewViaRpc(
  supabase: SupabaseClient,
  rawToken: string,
  metadata: ProposalPublicAccessCustomerViewMetadata = {}
): Promise<ProposalPublicAccessRecordViewResult> {
  const tokenHash = tokenHashFromRaw(rawToken);
  const rpcArgs = buildRecordViewRpcArgs(tokenHash, metadata);

  if (rpcArgs.__invalid_ip_hash) {
    return { ok: false, code: "invalid_ip_hash" };
  }

  const { data, error } = await supabase.rpc(
    RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1,
    rpcArgs
  );

  if (error) {
    throw new ProposalPublicAccessRpcStoreError(
      error.message ?? "record_proposal_customer_view_v1 RPC failed."
    );
  }

  return parseProposalPublicAccessRecordViewRpcResult(data);
}
