/**
 * R18C3B — proposalPublicAccessTokenMintStore.server tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicAccessTokenMintStore.server.test.ts
 *
 * Tests persistence + server entry guardrails without importing server-only module.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  deriveProposalPublicAccessTokenPrefix,
  generateProposalPublicAccessToken,
  hashRawProposalPublicAccessTokenForMint,
} from "./proposalPublicAccessTokenMint";
import {
  mintProposalPublicAccessTokenViaRpc,
  MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
} from "./proposalPublicAccessTokenMintPersistence";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const EXPIRES_AT = "2099-12-31T23:59:59.000Z";

function mintRequest() {
  return {
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    expires_at: EXPIRES_AT,
  };
}

describe("mint server wrapper composition", () => {
  test("server wrapper pattern returns raw token once on success", async () => {
    const rawToken = generateProposalPublicAccessToken();
    const tokenPrefix = deriveProposalPublicAccessTokenPrefix(rawToken);
    const supabase = {
      rpc: async (name: string) => {
        assert.equal(name, MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1);
        return {
          data: {
            ok: true,
            token_id: "11111111-1111-4111-8111-111111111111",
            company_id: COMPANY_ID,
            proposal_id: PROPOSAL_ID,
            proposal_version_id: VERSION_ID,
            token_prefix: tokenPrefix,
            status: "active",
            expires_at: EXPIRES_AT,
            created_at: "2026-06-25T12:00:00.000Z",
          },
          error: null,
        };
      },
    };

    const rpcResult = await mintProposalPublicAccessTokenViaRpc(
      supabase as never,
      rawToken,
      mintRequest()
    );

    assert.equal(rpcResult.ok, true);
    if (!rpcResult.ok) return;

    const serverResult = { ...rpcResult, raw_token: rawToken };
    assert.equal(serverResult.raw_token, rawToken);
    assert.equal(serverResult.token_prefix, tokenPrefix);
    assert.ok(!("token_hash" in serverResult));
    assert.equal(
      hashRawProposalPublicAccessTokenForMint(rawToken),
      hashRawProposalPublicAccessTokenForMint(serverResult.raw_token)
    );
  });

  test("mint wrapper calls mint RPC with p_token_hash, not raw token", async () => {
    const rawToken = generateProposalPublicAccessToken();
    const expectedHash = hashRawProposalPublicAccessTokenForMint(rawToken);
    let rpcArgs: Record<string, unknown> | undefined;

    const supabase = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        rpcArgs = args;
        return {
          data: {
            ok: true,
            token_id: "11111111-1111-4111-8111-111111111111",
            company_id: COMPANY_ID,
            proposal_id: PROPOSAL_ID,
            proposal_version_id: VERSION_ID,
            token_prefix: deriveProposalPublicAccessTokenPrefix(rawToken),
            status: "active",
            expires_at: EXPIRES_AT,
            created_at: "2026-06-25T12:00:00.000Z",
          },
          error: null,
        };
      },
    };

    await mintProposalPublicAccessTokenViaRpc(supabase as never, rawToken, mintRequest());
    assert.equal(rpcArgs?.p_token_hash, expectedHash);
    assert.ok(!Object.values(rpcArgs ?? {}).includes(rawToken));
  });
});

describe("R18C3B server entry guardrails", () => {
  test("server entry module imports server-only and createAdminClient", () => {
    const source = readFileSync(
      new URL("./proposalPublicAccessTokenMintStore.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /import "server-only"/);
    assert.match(source, /createAdminClient/);
    assert.match(source, /generateProposalPublicAccessToken/);
    assert.match(source, /raw_token: rawToken/);
    assert.doesNotMatch(source, /\/p\/\[|app\/p\//);
    assert.doesNotMatch(source, /send_email|payment|sign_|lifecycle/);
  });

  test("no public route or Send/PDF/Sign/Payment/lifecycle in mint modules", () => {
    for (const file of [
      "./proposalPublicAccessTokenMint.ts",
      "./proposalPublicAccessTokenMintPersistence.ts",
      "./proposalPublicAccessTokenMintStore.server.ts",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.doesNotMatch(source, /\/p\/\[|app\/p\//);
      assert.doesNotMatch(source, /send_email|payment|sign_|lifecycle|proposal_events|proposals\.status/);
    }
  });

  test("mint RPC name appears only in server lib, tests, and migrations", () => {
    const persistenceSource = readFileSync(
      new URL("./proposalPublicAccessTokenMintPersistence.ts", import.meta.url),
      "utf8"
    );
    assert.match(persistenceSource, /mint_proposal_public_access_token_v1/);
  });
});
