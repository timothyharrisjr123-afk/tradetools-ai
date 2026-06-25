/**
 * R18C3B — proposalPublicAccessTokenMint tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicAccessTokenMint.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  deriveProposalPublicAccessTokenPrefix,
  generateProposalPublicAccessToken,
  hashRawProposalPublicAccessTokenForMint,
  PROPOSAL_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH,
  sanitizeProposalPublicAccessMintMetadata,
  validateProposalPublicAccessMintRecipientHash,
} from "./proposalPublicAccessTokenMint";
import { hashProposalPublicAccessToken } from "./proposalPublicAccessTokenHash";

describe("generateProposalPublicAccessToken", () => {
  test("generated token is URL-safe", () => {
    const token = generateProposalPublicAccessToken();
    assert.match(token, /^[A-Za-z0-9_-]+$/);
  });

  test("generated token is non-empty and high-length", () => {
    const token = generateProposalPublicAccessToken();
    assert.ok(token.length >= 32);
  });

  test("repeated calls differ", () => {
    const a = generateProposalPublicAccessToken();
    const b = generateProposalPublicAccessToken();
    assert.notEqual(a, b);
  });
});

describe("deriveProposalPublicAccessTokenPrefix", () => {
  test("prefix generation matches table length constraints", () => {
    const raw = generateProposalPublicAccessToken();
    const prefix = deriveProposalPublicAccessTokenPrefix(raw);
    assert.ok(prefix.length >= 6);
    assert.ok(prefix.length <= 16);
    assert.equal(prefix.length, PROPOSAL_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH);
    assert.equal(prefix, raw.slice(0, PROPOSAL_PUBLIC_ACCESS_TOKEN_PREFIX_LENGTH));
  });
});

describe("hashRawProposalPublicAccessTokenForMint", () => {
  test("token hash uses hashProposalPublicAccessToken", () => {
    const raw = "fielddive-r18c3b-mint-token-example";
    assert.equal(
      hashRawProposalPublicAccessTokenForMint(raw),
      hashProposalPublicAccessToken(raw)
    );
  });
});

describe("sanitizeProposalPublicAccessMintMetadata", () => {
  test("raw token is not placed in metadata-shaped objects", () => {
    const metadata = sanitizeProposalPublicAccessMintMetadata({
      source: "send-prep",
      raw_token: "must-not-remain",
      token: "also-forbidden",
    });
    assert.deepEqual(metadata, { source: "send-prep" });
    assert.ok(!("raw_token" in metadata));
    assert.ok(!("token" in metadata));
  });
});

describe("validateProposalPublicAccessMintRecipientHash", () => {
  test("accepts valid sha256 hex or null", () => {
    const hash = hashProposalPublicAccessToken("recipient-salt");
    assert.equal(validateProposalPublicAccessMintRecipientHash(hash), hash);
    assert.equal(validateProposalPublicAccessMintRecipientHash(null), null);
    assert.equal(validateProposalPublicAccessMintRecipientHash("bad"), "__invalid__");
  });
});
