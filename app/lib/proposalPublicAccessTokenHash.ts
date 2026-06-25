/**
 * R18C3A — Pure SHA-256 hashing for public proposal access tokens.
 *
 * Server/route callers hash raw URL tokens before any Supabase RPC.
 * Never store, log, or return raw tokens from structured results.
 */

import { createHash } from "node:crypto";

const SHA256_HEX_LENGTH = 64;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalPublicAccessTokenHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalPublicAccessTokenHashError";
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Returns true when value is a lowercase 64-character SHA-256 hex digest. */
export function isProposalPublicAccessTokenSha256Hex(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.length === SHA256_HEX_LENGTH && SHA256_HEX_PATTERN.test(trimmed);
}

function assertUsableRawPublicAccessToken(rawToken: unknown): asserts rawToken is string {
  if (typeof rawToken !== "string") {
    throw new ProposalPublicAccessTokenHashError(
      "Public access token must be a non-empty string."
    );
  }
  if (rawToken.trim().length === 0) {
    throw new ProposalPublicAccessTokenHashError(
      "Public access token must not be empty or whitespace-only."
    );
  }
}

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash of a raw public access token for RPC `p_token_hash`.
 * Uses UTF-8 encoding; returns lowercase 64-char hex. Never returns raw token.
 */
export function hashProposalPublicAccessToken(rawToken: string): string {
  assertUsableRawPublicAccessToken(rawToken);
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
