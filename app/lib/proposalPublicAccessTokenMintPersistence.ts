/**
 * R18C3B — Public proposal access token mint RPC persistence.
 *
 * Hashes raw tokens before service_role RPC calls. Injectable Supabase client for tests.
 * Server entry points live in proposalPublicAccessTokenMintStore.server.ts.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  deriveProposalPublicAccessTokenPrefix,
  hashRawProposalPublicAccessTokenForMint,
  sanitizeProposalPublicAccessMintMetadata,
  validateProposalPublicAccessMintRecipientHash,
} from "@/app/lib/proposalPublicAccessTokenMint";
import { ProposalPublicAccessTokenHashError } from "@/app/lib/proposalPublicAccessTokenHash";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// RPC contract
// ---------------------------------------------------------------------------

export const MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1 =
  "mint_proposal_public_access_token_v1";

export const MINT_AND_SUPERSEDE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1 =
  "mint_and_supersede_proposal_public_access_token_v1";

export const PROPOSAL_PUBLIC_ACCESS_MINT_FAILURE_CODES = [
  "invalid_hash",
  "invalid_prefix",
  "invalid_company_id",
  "invalid_proposal_id",
  "invalid_proposal_version_id",
  "invalid_expires_at",
  "invalid_recipient_hash",
  "invalid_metadata",
  "forbidden_metadata_keys",
  "invalid_purpose",
  "invalid_version_kind",
  "binding_mismatch",
  "proposal_not_found",
  "version_not_found",
  "duplicate_token_hash",
] as const;

export const PROPOSAL_PUBLIC_ACCESS_EMAIL_SEND_MINT_FAILURE_CODES = [
  ...PROPOSAL_PUBLIC_ACCESS_MINT_FAILURE_CODES,
  "latest_sent_version_missing",
  "not_latest_sent_version",
  "sent_version_not_frozen",
] as const;

export type ProposalPublicAccessMintFailureCode =
  (typeof PROPOSAL_PUBLIC_ACCESS_MINT_FAILURE_CODES)[number];

export type ProposalPublicAccessEmailSendMintFailureCode =
  (typeof PROPOSAL_PUBLIC_ACCESS_EMAIL_SEND_MINT_FAILURE_CODES)[number];

export type ProposalPublicAccessMintRequest = {
  company_id: string;
  proposal_id: string;
  proposal_version_id: string;
  expires_at: string;
  recipient_email_hash?: string | null;
  recipient_phone_hash?: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_by?: string | null;
};

export type ProposalPublicAccessMintRpcSuccess = {
  ok: true;
  token_id: string;
  company_id: string;
  proposal_id: string;
  proposal_version_id: string;
  token_prefix: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type ProposalPublicAccessEmailSendMintRpcSuccess =
  ProposalPublicAccessMintRpcSuccess & {
    superseded_count: number;
  };

export type ProposalPublicAccessMintFailure = {
  ok: false;
  code: ProposalPublicAccessMintFailureCode;
};

export type ProposalPublicAccessEmailSendMintFailure = {
  ok: false;
  code: ProposalPublicAccessEmailSendMintFailureCode;
};

export type ProposalPublicAccessMintRpcResult =
  | ProposalPublicAccessMintRpcSuccess
  | ProposalPublicAccessMintFailure;

export type ProposalPublicAccessEmailSendMintRpcResult =
  | ProposalPublicAccessEmailSendMintRpcSuccess
  | ProposalPublicAccessEmailSendMintFailure;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalPublicAccessTokenMintPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalPublicAccessTokenMintPersistenceError";
  }
}

// ---------------------------------------------------------------------------
// Parsing (exported for tests)
// ---------------------------------------------------------------------------

function isListedFailureCode<T extends string>(
  value: unknown,
  codes: readonly T[]
): value is T {
  return typeof value === "string" && (codes as readonly string[]).includes(value);
}

function isMintFailureCode(value: unknown): value is ProposalPublicAccessMintFailureCode {
  return isListedFailureCode(value, PROPOSAL_PUBLIC_ACCESS_MINT_FAILURE_CODES);
}

function isEmailSendMintFailureCode(
  value: unknown
): value is ProposalPublicAccessEmailSendMintFailureCode {
  return isListedFailureCode(value, PROPOSAL_PUBLIC_ACCESS_EMAIL_SEND_MINT_FAILURE_CODES);
}

function parseUuidField(
  value: unknown,
  label: string,
  rpcName: string
): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
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
    throw new ProposalPublicAccessTokenMintPersistenceError(
      `${rpcName} RPC returned invalid ${label}.`
    );
  }
  return text;
}

function parseFailureResult<T extends string>(
  data: unknown,
  rpcName: string,
  isCode: (value: unknown) => value is T
): { ok: false; code: T } {
  if (!data || typeof data !== "object") {
    throw new ProposalPublicAccessTokenMintPersistenceError(`${rpcName} RPC returned no result.`);
  }
  const result = data as Record<string, unknown>;
  if (result.ok !== false) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      `${rpcName} RPC returned unexpected ok !== false failure shape.`
    );
  }
  const code = result.code;
  if (!isCode(code)) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      `${rpcName} RPC returned invalid failure code.`
    );
  }
  return { ok: false, code };
}

export function parseProposalPublicAccessMintRpcResult(
  data: unknown
): ProposalPublicAccessMintRpcResult {
  if (!data || typeof data !== "object") {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      "mint_proposal_public_access_token_v1 RPC returned no result."
    );
  }

  const result = data as Record<string, unknown>;

  if (result.ok === false) {
    return parseFailureResult(
      result,
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
      isMintFailureCode
    );
  }

  if (result.ok !== true) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      "mint_proposal_public_access_token_v1 RPC returned unexpected ok value."
    );
  }

  const parsed: ProposalPublicAccessMintRpcSuccess = {
    ok: true,
    token_id: parseUuidField(
      result.token_id,
      "token_id",
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    company_id: parseUuidField(
      result.company_id,
      "company_id",
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    proposal_id: parseUuidField(
      result.proposal_id,
      "proposal_id",
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    proposal_version_id: parseUuidField(
      result.proposal_version_id,
      "proposal_version_id",
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    token_prefix: parseNonEmptyStringField(
      result.token_prefix,
      "token_prefix",
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    status: parseNonEmptyStringField(
      result.status,
      "status",
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    expires_at: parseNonEmptyStringField(
      result.expires_at,
      "expires_at",
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
    created_at: parseNonEmptyStringField(
      result.created_at,
      "created_at",
      MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1
    ),
  };

  if ("token_hash" in result) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      "mint_proposal_public_access_token_v1 RPC must not return token_hash."
    );
  }

  return parsed;
}

export function parseMintAndSupersedeProposalPublicAccessTokenRpcResult(
  data: unknown
): ProposalPublicAccessEmailSendMintRpcResult {
  if (!data || typeof data !== "object") {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      "mint_and_supersede_proposal_public_access_token_v1 RPC returned no result."
    );
  }

  const result = data as Record<string, unknown>;

  if (result.ok === false) {
    return parseFailureResult(
      result,
      MINT_AND_SUPERSEDE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
      isEmailSendMintFailureCode
    );
  }

  if (result.ok !== true) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      "mint_and_supersede_proposal_public_access_token_v1 RPC returned unexpected ok value."
    );
  }

  const generic = parseProposalPublicAccessMintRpcResult({
    ...result,
  });
  if (!generic.ok) {
    return generic;
  }

  const supersededCount = result.superseded_count;
  if (
    typeof supersededCount !== "number" ||
    !Number.isInteger(supersededCount) ||
    supersededCount < 0
  ) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      "mint_and_supersede_proposal_public_access_token_v1 RPC returned invalid superseded_count."
    );
  }

  if ("token_hash" in result) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      "mint_and_supersede_proposal_public_access_token_v1 RPC must not return token_hash."
    );
  }

  return {
    ...generic,
    superseded_count: supersededCount,
  };
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

function assertValidMintRequest(input: ProposalPublicAccessMintRequest): void {
  if (!isUuidLike(input.company_id.trim())) {
    throw new ProposalPublicAccessTokenMintPersistenceError("Invalid company_id.");
  }
  if (!isUuidLike(input.proposal_id.trim())) {
    throw new ProposalPublicAccessTokenMintPersistenceError("Invalid proposal_id.");
  }
  if (!isUuidLike(input.proposal_version_id.trim())) {
    throw new ProposalPublicAccessTokenMintPersistenceError("Invalid proposal_version_id.");
  }

  const expiresAt = Date.parse(input.expires_at);
  if (!Number.isFinite(expiresAt)) {
    throw new ProposalPublicAccessTokenMintPersistenceError("Invalid expires_at.");
  }
  if (expiresAt <= Date.now()) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      "expires_at must be in the future."
    );
  }

  if (input.created_by != null && input.created_by.trim().length > 0) {
    if (!isUuidLike(input.created_by.trim())) {
      throw new ProposalPublicAccessTokenMintPersistenceError("Invalid created_by.");
    }
  }
}

function buildMintRpcArgs(
  rawToken: string,
  input: ProposalPublicAccessMintRequest
): Record<string, unknown> | { __invalid_recipient_hash: true } {
  let tokenHash: string;
  let tokenPrefix: string;

  try {
    tokenHash = hashRawProposalPublicAccessTokenForMint(rawToken);
    tokenPrefix = deriveProposalPublicAccessTokenPrefix(rawToken);
  } catch (error) {
    if (error instanceof ProposalPublicAccessTokenHashError) {
      throw new ProposalPublicAccessTokenMintPersistenceError(error.message);
    }
    throw error;
  }

  const emailHash = validateProposalPublicAccessMintRecipientHash(
    input.recipient_email_hash
  );
  if (emailHash === "__invalid__") {
    return { __invalid_recipient_hash: true };
  }

  const phoneHash = validateProposalPublicAccessMintRecipientHash(
    input.recipient_phone_hash
  );
  if (phoneHash === "__invalid__") {
    return { __invalid_recipient_hash: true };
  }

  return {
    p_token_hash: tokenHash,
    p_token_prefix: tokenPrefix,
    p_company_id: input.company_id.trim(),
    p_proposal_id: input.proposal_id.trim(),
    p_proposal_version_id: input.proposal_version_id.trim(),
    p_expires_at: input.expires_at,
    p_recipient_email_hash: emailHash,
    p_recipient_phone_hash: phoneHash,
    p_metadata_json: sanitizeProposalPublicAccessMintMetadata(input.metadata_json),
    p_created_by:
      input.created_by != null && input.created_by.trim().length > 0
        ? input.created_by.trim()
        : null,
    p_purpose: "customer_view",
  };
}

// ---------------------------------------------------------------------------
// RPC wrapper (injectable Supabase client for tests)
// ---------------------------------------------------------------------------

export async function mintProposalPublicAccessTokenViaRpc(
  supabase: SupabaseClient,
  rawToken: string,
  input: ProposalPublicAccessMintRequest
): Promise<ProposalPublicAccessMintRpcResult> {
  assertValidMintRequest(input);

  const rpcArgs = buildMintRpcArgs(rawToken, input);
  if ("__invalid_recipient_hash" in rpcArgs) {
    return { ok: false, code: "invalid_recipient_hash" };
  }

  const { data, error } = await supabase.rpc(
    MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
    rpcArgs
  );

  if (error) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      error.message ?? "mint_proposal_public_access_token_v1 RPC failed."
    );
  }

  return parseProposalPublicAccessMintRpcResult(data);
}

export async function mintAndSupersedeProposalPublicAccessTokenViaRpc(
  supabase: SupabaseClient,
  rawToken: string,
  input: ProposalPublicAccessMintRequest
): Promise<ProposalPublicAccessEmailSendMintRpcResult> {
  assertValidMintRequest(input);

  const rpcArgs = buildMintRpcArgs(rawToken, input);
  if ("__invalid_recipient_hash" in rpcArgs) {
    return { ok: false, code: "invalid_recipient_hash" };
  }

  const { data, error } = await supabase.rpc(
    MINT_AND_SUPERSEDE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
    rpcArgs
  );

  if (error) {
    throw new ProposalPublicAccessTokenMintPersistenceError(
      error.message ?? "mint_and_supersede_proposal_public_access_token_v1 RPC failed."
    );
  }

  return parseMintAndSupersedeProposalPublicAccessTokenRpcResult(data);
}
