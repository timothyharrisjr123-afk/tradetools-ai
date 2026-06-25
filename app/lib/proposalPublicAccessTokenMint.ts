/**
 * R18C3B — Pure public proposal access token generation helpers.
 *
 * Generates cryptographically random URL-safe raw tokens and display prefixes.
 * Never stores, logs, or persists raw tokens.
 */

import { randomBytes } from "node:crypto";

import {
  hashProposalPublicAccessToken,
  isProposalPublicAccessTokenSha256Hex,
} from "@/app/lib/proposalPublicAccessTokenHash";

/** Raw token byte length before base64url encoding (256-bit entropy). */
export const PROPOSAL_PUBLIC_ACCESS_TOKEN_BYTE_LENGTH = 32;

/** Display prefix length — must satisfy DB check (6–16 chars). */
export const PROPOSAL_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH = 8;

const URL_SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ProposalPublicAccessTokenMintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalPublicAccessTokenMintError";
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Cryptographically random URL-safe public access token (base64url, no padding).
 * Never stored by this helper — caller must hash before persistence.
 */
export function generateProposalPublicAccessToken(): string {
  const raw = randomBytes(PROPOSAL_PUBLIC_ACCESS_TOKEN_BYTE_LENGTH).toString("base64url");
  if (raw.length === 0 || !URL_SAFE_TOKEN_PATTERN.test(raw)) {
    throw new ProposalPublicAccessTokenMintError(
      "Generated public access token failed URL-safe validation."
    );
  }
  return raw;
}

/**
 * Derives a short display prefix from the raw token for DB token_prefix column.
 * Prefix is not secret — full access requires the complete raw token.
 */
export function deriveProposalPublicAccessTokenPrefix(rawToken: string): string {
  const trimmed = rawToken.trim();
  if (trimmed.length < PROPOSAL_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH) {
    throw new ProposalPublicAccessTokenMintError(
      "Raw token is too short to derive a valid token prefix."
    );
  }
  const prefix = trimmed.slice(0, PROPOSAL_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH);
  if (prefix.length < 6 || prefix.length > 16) {
    throw new ProposalPublicAccessTokenMintError(
      "Derived token prefix violates table length constraints."
    );
  }
  return prefix;
}

/** Hashes a raw token for RPC persistence using the R18C3A helper. */
export function hashRawProposalPublicAccessTokenForMint(rawToken: string): string {
  return hashProposalPublicAccessToken(rawToken);
}

/** Validates optional recipient hash fields before mint RPC. */
export function validateProposalPublicAccessMintRecipientHash(
  value: string | null | undefined
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!isProposalPublicAccessTokenSha256Hex(trimmed)) {
    return "__invalid__";
  }
  return trimmed;
}

/** Returns metadata object safe for mint RPC (no raw token keys). */
export function sanitizeProposalPublicAccessMintMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (metadata == null) {
    return {};
  }
  const clone = structuredClone(metadata) as Record<string, unknown>;
  for (const forbidden of ["raw_token", "token", "public_token", "token_secret"] as const) {
    if (forbidden in clone) {
      delete clone[forbidden];
    }
  }
  return clone;
}
