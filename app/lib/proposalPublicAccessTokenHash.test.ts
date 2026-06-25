/**
 * R18C3A — proposalPublicAccessTokenHash tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicAccessTokenHash.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import {
  hashProposalPublicAccessToken,
  isProposalPublicAccessTokenSha256Hex,
  ProposalPublicAccessTokenHashError,
} from "./proposalPublicAccessTokenHash";

const KNOWN_RAW = "fielddive-r18c3a-known-token";
const KNOWN_HASH = createHash("sha256").update(KNOWN_RAW, "utf8").digest("hex");

describe("hashProposalPublicAccessToken", () => {
  test("fixed known token returns known SHA-256 hash", () => {
    assert.equal(hashProposalPublicAccessToken(KNOWN_RAW), KNOWN_HASH);
  });

  test("hash is lowercase 64-char hex", () => {
    const hash = hashProposalPublicAccessToken("test");
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(hash, hash.toLowerCase());
    assert.equal(
      hash,
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    );
  });

  test("same input produces same hash", () => {
    const a = hashProposalPublicAccessToken("repeat-me");
    const b = hashProposalPublicAccessToken("repeat-me");
    assert.equal(a, b);
  });

  test("different input produces different hash", () => {
    const a = hashProposalPublicAccessToken("token-a");
    const b = hashProposalPublicAccessToken("token-b");
    assert.notEqual(a, b);
  });

  test("empty token is rejected", () => {
    assert.throws(
      () => hashProposalPublicAccessToken(""),
      ProposalPublicAccessTokenHashError
    );
  });

  test("whitespace-only token is rejected", () => {
    assert.throws(
      () => hashProposalPublicAccessToken("   \t\n  "),
      ProposalPublicAccessTokenHashError
    );
  });

  test("helper never returns raw token in structured results", () => {
    const raw = "never-leak-raw-token-value";
    const hash = hashProposalPublicAccessToken(raw);
    assert.equal(typeof hash, "string");
    assert.notEqual(hash, raw);
    assert.ok(!hash.includes(raw));
  });
});

describe("isProposalPublicAccessTokenSha256Hex", () => {
  test("accepts valid lowercase SHA-256 hex", () => {
    assert.equal(isProposalPublicAccessTokenSha256Hex(KNOWN_HASH), true);
  });

  test("rejects uppercase hex", () => {
    assert.equal(isProposalPublicAccessTokenSha256Hex(KNOWN_HASH.toUpperCase()), false);
  });

  test("rejects wrong length", () => {
    assert.equal(isProposalPublicAccessTokenSha256Hex("abc"), false);
  });
});
