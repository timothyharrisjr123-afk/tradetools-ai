/**
 * Astra G9 — hash-only customer-review token helpers for scope changes.
 * Mirrors proposal public access: never store/log/return raw tokens.
 */

import { randomBytes } from "node:crypto";
import {
  hashProposalPublicAccessToken,
  isProposalPublicAccessTokenSha256Hex,
} from "@/app/lib/proposalPublicAccessTokenHash";

export const JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_BYTE_LENGTH = 32;
export const JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH = 8;

const URL_SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export class JobScopeChangePublicAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobScopeChangePublicAccessError";
  }
}

/** Cryptographically random URL-safe raw token (never persist). */
export function generateJobScopeChangePublicAccessToken(): string {
  const raw = randomBytes(
    JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_BYTE_LENGTH
  ).toString("base64url");
  if (raw.length === 0 || !URL_SAFE_TOKEN_PATTERN.test(raw)) {
    throw new JobScopeChangePublicAccessError(
      "Generated scope-change public access token failed URL-safe validation."
    );
  }
  return raw;
}

export function deriveJobScopeChangePublicAccessTokenPrefix(
  rawToken: string
): string {
  const trimmed = rawToken.trim();
  if (trimmed.length < JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH) {
    throw new JobScopeChangePublicAccessError(
      "Raw token is too short to derive a valid token prefix."
    );
  }
  return trimmed.slice(0, JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH);
}

/** SHA-256 hex for RPC p_token_hash / token_hash payload fields. */
export function hashJobScopeChangePublicAccessToken(rawToken: string): string {
  return hashProposalPublicAccessToken(rawToken);
}

export function isJobScopeChangePublicAccessTokenSha256Hex(
  value: unknown
): value is string {
  return isProposalPublicAccessTokenSha256Hex(value);
}

/** Default expiry: 14 days from now (ISO). */
export function defaultJobScopeChangePublicAccessExpiresAt(
  now: Date = new Date()
): string {
  const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return expires.toISOString();
}

export function buildMintedJobScopeChangePublicAccessToken(): {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
  expiresAt: string;
} {
  const rawToken = generateJobScopeChangePublicAccessToken();
  return {
    rawToken,
    tokenHash: hashJobScopeChangePublicAccessToken(rawToken),
    tokenPrefix: deriveJobScopeChangePublicAccessTokenPrefix(rawToken),
    expiresAt: defaultJobScopeChangePublicAccessExpiresAt(),
  };
}

/** Customer-facing review URL (raw token in path — never store/log). */
export function buildPublicScopeChangeReviewUrl(
  origin: string,
  rawToken: string
): string {
  const base = origin.trim().replace(/\/$/, "");
  return `${base}/scope-changes/${encodeURIComponent(rawToken)}`;
}
