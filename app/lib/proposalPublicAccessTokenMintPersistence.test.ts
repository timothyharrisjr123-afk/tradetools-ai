/**
 * R18C3B — proposalPublicAccessTokenMintPersistence tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicAccessTokenMintPersistence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  deriveProposalPublicAccessTokenPrefix,
  hashRawProposalPublicAccessTokenForMint,
} from "./proposalPublicAccessTokenMint";
import {
  MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
  mintProposalPublicAccessTokenViaRpc,
  parseProposalPublicAccessMintRpcResult,
  ProposalPublicAccessTokenMintPersistenceError,
} from "./proposalPublicAccessTokenMintPersistence";

const RAW_TOKEN = "fielddive-r18c3b-mint-persistence-token";
const TOKEN_HASH = hashRawProposalPublicAccessTokenForMint(RAW_TOKEN);
const TOKEN_PREFIX = deriveProposalPublicAccessTokenPrefix(RAW_TOKEN);
const TOKEN_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const EXPIRES_AT = "2099-12-31T23:59:59.000Z";
const CREATED_AT = "2026-06-25T12:00:00.000Z";

function mintRequest() {
  return {
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    expires_at: EXPIRES_AT,
  };
}

function mintSuccessRpcData() {
  return {
    ok: true,
    token_id: TOKEN_ID,
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    token_prefix: TOKEN_PREFIX,
    status: "active",
    expires_at: EXPIRES_AT,
    created_at: CREATED_AT,
  };
}

describe("parseProposalPublicAccessMintRpcResult", () => {
  test("parses valid mint success envelope", () => {
    const parsed = parseProposalPublicAccessMintRpcResult(mintSuccessRpcData());
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.token_id, TOKEN_ID);
      assert.equal(parsed.token_prefix, TOKEN_PREFIX);
    }
  });

  test("parses mint failure envelope", () => {
    const parsed = parseProposalPublicAccessMintRpcResult({
      ok: false,
      code: "invalid_version_kind",
    });
    assert.deepEqual(parsed, { ok: false, code: "invalid_version_kind" });
  });

  test("rejects token_hash in success envelope", () => {
    assert.throws(
      () =>
        parseProposalPublicAccessMintRpcResult({
          ...mintSuccessRpcData(),
          token_hash: TOKEN_HASH,
        }),
      ProposalPublicAccessTokenMintPersistenceError
    );
  });
});

describe("mintProposalPublicAccessTokenViaRpc", () => {
  test("hashes raw token before RPC", async () => {
    let rpcHash = "";
    const supabase = {
      rpc: async (_name: string, args: { p_token_hash: string }) => {
        rpcHash = args.p_token_hash;
        return { data: mintSuccessRpcData(), error: null };
      },
    };

    await mintProposalPublicAccessTokenViaRpc(
      supabase as never,
      RAW_TOKEN,
      mintRequest()
    );
    assert.equal(rpcHash, TOKEN_HASH);
  });

  test("calls mint_proposal_public_access_token_v1", async () => {
    let rpcName = "";
    const supabase = {
      rpc: async (name: string) => {
        rpcName = name;
        return { data: mintSuccessRpcData(), error: null };
      },
    };

    await mintProposalPublicAccessTokenViaRpc(
      supabase as never,
      RAW_TOKEN,
      mintRequest()
    );
    assert.equal(rpcName, MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1);
  });

  test("RPC payload includes token prefix and IDs", async () => {
    let rpcArgs: Record<string, unknown> | undefined;
    const supabase = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        rpcArgs = args;
        return { data: mintSuccessRpcData(), error: null };
      },
    };

    await mintProposalPublicAccessTokenViaRpc(
      supabase as never,
      RAW_TOKEN,
      mintRequest()
    );

    assert.equal(rpcArgs?.p_token_hash, TOKEN_HASH);
    assert.equal(rpcArgs?.p_token_prefix, TOKEN_PREFIX);
    assert.equal(rpcArgs?.p_company_id, COMPANY_ID);
    assert.equal(rpcArgs?.p_proposal_id, PROPOSAL_ID);
    assert.equal(rpcArgs?.p_proposal_version_id, VERSION_ID);
    assert.equal(rpcArgs?.p_purpose, "customer_view");
    assert.ok(!("raw_token" in (rpcArgs ?? {})));
    assert.ok(!Object.values(rpcArgs ?? {}).includes(RAW_TOKEN));
  });

  test("success result excludes token_hash", async () => {
    const supabase = {
      rpc: async () => ({ data: mintSuccessRpcData(), error: null }),
    };

    const result = await mintProposalPublicAccessTokenViaRpc(
      supabase as never,
      RAW_TOKEN,
      mintRequest()
    );
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("token_hash"));
    assert.ok(!("token_hash" in (result as object)));
    assert.ok(!serialized.includes(RAW_TOKEN));
  });

  test("RPC failure returns typed failure", async () => {
    const supabase = {
      rpc: async () => ({
        data: { ok: false, code: "binding_mismatch" },
        error: null,
      }),
    };

    const result = await mintProposalPublicAccessTokenViaRpc(
      supabase as never,
      RAW_TOKEN,
      mintRequest()
    );
    assert.deepEqual(result, { ok: false, code: "binding_mismatch" });
  });

  test("transport error throws typed error", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "permission denied" } }),
    };

    await assert.rejects(
      () =>
        mintProposalPublicAccessTokenViaRpc(
          supabase as never,
          RAW_TOKEN,
          mintRequest()
        ),
      ProposalPublicAccessTokenMintPersistenceError
    );
  });

  test("invalid IDs fail before RPC", async () => {
    let called = false;
    const supabase = {
      rpc: async () => {
        called = true;
        return { data: mintSuccessRpcData(), error: null };
      },
    };

    await assert.rejects(
      () =>
        mintProposalPublicAccessTokenViaRpc(supabase as never, RAW_TOKEN, {
          ...mintRequest(),
          proposal_id: "not-a-uuid",
        }),
      ProposalPublicAccessTokenMintPersistenceError
    );
    assert.equal(called, false);
  });

  test("past expires_at fails before RPC", async () => {
    let called = false;
    const supabase = {
      rpc: async () => {
        called = true;
        return { data: mintSuccessRpcData(), error: null };
      },
    };

    await assert.rejects(
      () =>
        mintProposalPublicAccessTokenViaRpc(supabase as never, RAW_TOKEN, {
          ...mintRequest(),
          expires_at: "2000-01-01T00:00:00.000Z",
        }),
      ProposalPublicAccessTokenMintPersistenceError
    );
    assert.equal(called, false);
  });

  test("invalid recipient hash fails before RPC", async () => {
    let called = false;
    const supabase = {
      rpc: async () => {
        called = true;
        return { data: mintSuccessRpcData(), error: null };
      },
    };

    const result = await mintProposalPublicAccessTokenViaRpc(
      supabase as never,
      RAW_TOKEN,
      {
        ...mintRequest(),
        recipient_email_hash: "not-sha256",
      }
    );
    assert.deepEqual(result, { ok: false, code: "invalid_recipient_hash" });
    assert.equal(called, false);
  });
});

describe("R18C3B migration guardrails", () => {
  test("mint RPC migration exists with service_role-only hardening", () => {
    const mintMigration = readFileSync(
      new URL(
        "../../supabase/migrations/20260626_018_create_proposal_public_access_mint_rpc.sql",
        import.meta.url
      ),
      "utf8"
    );
    const permMigration = readFileSync(
      new URL(
        "../../supabase/migrations/20260626_019_harden_proposal_public_access_mint_rpc_permissions.sql",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(mintMigration, /mint_proposal_public_access_token_v1/);
    assert.match(mintMigration, /security definer/i);
    assert.match(mintMigration, /set search_path = public/i);
    assert.match(mintMigration, /p_token_hash text/);
    assert.doesNotMatch(mintMigration, /p_raw_token/i);
    assert.doesNotMatch(mintMigration, /update\s+public\.proposals/i);
    assert.doesNotMatch(mintMigration, /insert\s+into\s+public\.proposal_events/i);

    assert.match(permMigration, /revoke all on function public\.mint_proposal_public_access_token_v1/);
    assert.match(permMigration, /from public/);
    assert.match(permMigration, /from anon/);
    assert.match(permMigration, /from authenticated/);
    assert.match(permMigration, /grant execute on function public\.mint_proposal_public_access_token_v1/);
    assert.match(permMigration, /to service_role/);
  });
});

describe("R18C3B persistence guardrails", () => {
  test("persistence module has no public route or lifecycle references", () => {
    const source = readFileSync(
      new URL("./proposalPublicAccessTokenMintPersistence.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /\/p\/\[|app\/p\//);
    assert.doesNotMatch(source, /getProposalVersionGraph|proposalPublicGraphDto/);
    assert.doesNotMatch(source, /send_email|payment|sign_|lifecycle|proposal_events|proposals\.status/);
    assert.doesNotMatch(source, /import "server-only"/);
    assert.doesNotMatch(source, /createAdminClient/);
  });
});
