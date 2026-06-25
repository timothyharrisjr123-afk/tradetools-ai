/**
 * R18C3A — proposalPublicAccessRpcStore.server tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicAccessRpcStore.server.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { hashProposalPublicAccessToken } from "./proposalPublicAccessTokenHash";
import {
  parseProposalPublicAccessRecordViewRpcResult,
  parseProposalPublicAccessResolveRpcResult,
  ProposalPublicAccessRpcStoreError,
  RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1,
  recordProposalCustomerViewViaRpc,
  RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
  resolveProposalPublicAccessTokenViaRpc,
} from "./proposalPublicAccessRpcPersistence";

const RAW_TOKEN = "fielddive-r18c3a-rpc-wrapper-token";
const TOKEN_HASH = hashProposalPublicAccessToken(RAW_TOKEN);
const TOKEN_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const EXPIRES_AT = "2026-12-31T23:59:59.000Z";

function resolveSuccessRpcData() {
  return {
    ok: true,
    token_id: TOKEN_ID,
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    purpose: "customer_view",
    status: "active",
    expires_at: EXPIRES_AT,
  };
}

function recordSuccessRpcData(eventType: "first_view" | "view" = "first_view") {
  return {
    ok: true,
    event_type: eventType,
    token_id: TOKEN_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
  };
}

describe("parseProposalPublicAccessResolveRpcResult", () => {
  test("parses valid resolve success envelope", () => {
    const parsed = parseProposalPublicAccessResolveRpcResult(resolveSuccessRpcData());
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.token_id, TOKEN_ID);
      assert.equal(parsed.proposal_version_id, VERSION_ID);
      assert.equal(parsed.status, "active");
    }
  });

  test("parses resolve failure envelope", () => {
    const parsed = parseProposalPublicAccessResolveRpcResult({
      ok: false,
      code: "expired",
    });
    assert.deepEqual(parsed, { ok: false, code: "expired" });
  });
});

describe("resolveProposalPublicAccessTokenViaRpc", () => {
  test("hashes raw token before RPC", async () => {
    let rpcHash = "";
    const supabase = {
      rpc: async (_name: string, args: { p_token_hash: string }) => {
        rpcHash = args.p_token_hash;
        return { data: resolveSuccessRpcData(), error: null };
      },
    };

    await resolveProposalPublicAccessTokenViaRpc(supabase as never, RAW_TOKEN);
    assert.equal(rpcHash, TOKEN_HASH);
  });

  test("calls resolve_proposal_public_access_token_v1", async () => {
    let rpcName = "";
    const supabase = {
      rpc: async (name: string) => {
        rpcName = name;
        return { data: resolveSuccessRpcData(), error: null };
      },
    };

    await resolveProposalPublicAccessTokenViaRpc(supabase as never, RAW_TOKEN);
    assert.equal(rpcName, RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1);
  });

  test("sends p_token_hash, not raw token", async () => {
    let rpcArgs: Record<string, unknown> | undefined;
    const supabase = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        rpcArgs = args;
        return { data: resolveSuccessRpcData(), error: null };
      },
    };

    await resolveProposalPublicAccessTokenViaRpc(supabase as never, RAW_TOKEN);
    assert.equal(rpcArgs?.p_token_hash, TOKEN_HASH);
    assert.ok(!("raw_token" in (rpcArgs ?? {})));
    assert.ok(!("token" in (rpcArgs ?? {})));
    assert.ok(!Object.values(rpcArgs ?? {}).includes(RAW_TOKEN));
  });

  test("invalid raw token fails before RPC call", async () => {
    let called = false;
    const supabase = {
      rpc: async () => {
        called = true;
        return { data: null, error: null };
      },
    };

    await assert.rejects(
      () => resolveProposalPublicAccessTokenViaRpc(supabase as never, "   "),
      ProposalPublicAccessRpcStoreError
    );
    assert.equal(called, false);
  });

  test("RPC transport error is normalized", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "permission denied" } }),
    };

    await assert.rejects(
      () => resolveProposalPublicAccessTokenViaRpc(supabase as never, RAW_TOKEN),
      ProposalPublicAccessRpcStoreError
    );
  });

  test("returned wrapper result does not expose raw token or token_hash", async () => {
    const supabase = {
      rpc: async () => ({ data: resolveSuccessRpcData(), error: null }),
    };

    const result = await resolveProposalPublicAccessTokenViaRpc(
      supabase as never,
      RAW_TOKEN
    );
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(RAW_TOKEN));
    assert.ok(!serialized.includes("token_hash"));
    assert.ok(!("token_hash" in (result as object)));
  });
});

describe("recordProposalCustomerViewViaRpc", () => {
  test("hashes raw token before RPC", async () => {
    let rpcHash = "";
    const supabase = {
      rpc: async (_name: string, args: { p_token_hash: string }) => {
        rpcHash = args.p_token_hash;
        return { data: recordSuccessRpcData(), error: null };
      },
    };

    await recordProposalCustomerViewViaRpc(supabase as never, RAW_TOKEN);
    assert.equal(rpcHash, TOKEN_HASH);
  });

  test("calls record_proposal_customer_view_v1", async () => {
    let rpcName = "";
    const supabase = {
      rpc: async (name: string) => {
        rpcName = name;
        return { data: recordSuccessRpcData(), error: null };
      },
    };

    await recordProposalCustomerViewViaRpc(supabase as never, RAW_TOKEN);
    assert.equal(rpcName, RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1);
  });

  test("passes optional metadata with DB argument names", async () => {
    let rpcArgs: Record<string, unknown> | undefined;
    const ipHash = hashProposalPublicAccessToken("client-ip-salt-example");
    const supabase = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        rpcArgs = args;
        return { data: recordSuccessRpcData("view"), error: null };
      },
    };

    await recordProposalCustomerViewViaRpc(supabase as never, RAW_TOKEN, {
      ipHash,
      userAgent: "TestAgent/1.0",
      referrerHost: "example.com",
      payloadJson: { source: "test" },
    });

    assert.equal(rpcArgs?.p_token_hash, TOKEN_HASH);
    assert.equal(rpcArgs?.p_ip_hash, ipHash);
    assert.equal(rpcArgs?.p_user_agent, "TestAgent/1.0");
    assert.equal(rpcArgs?.p_referrer_host, "example.com");
    assert.deepEqual(rpcArgs?.p_payload_json, { source: "test" });
    assert.ok(!Object.values(rpcArgs ?? {}).includes(RAW_TOKEN));
  });

  test("invalid raw token fails before RPC call", async () => {
    let called = false;
    const supabase = {
      rpc: async () => {
        called = true;
        return { data: null, error: null };
      },
    };

    await assert.rejects(
      () => recordProposalCustomerViewViaRpc(supabase as never, ""),
      ProposalPublicAccessRpcStoreError
    );
    assert.equal(called, false);
  });

  test("invalid ipHash fails before RPC call", async () => {
    let called = false;
    const supabase = {
      rpc: async () => {
        called = true;
        return { data: null, error: null };
      },
    };

    const result = await recordProposalCustomerViewViaRpc(supabase as never, RAW_TOKEN, {
      ipHash: "not-a-valid-sha256-hex",
    });

    assert.deepEqual(result, { ok: false, code: "invalid_ip_hash" });
    assert.equal(called, false);
  });

  test("RPC transport error is normalized", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "rpc failed" } }),
    };

    await assert.rejects(
      () => recordProposalCustomerViewViaRpc(supabase as never, RAW_TOKEN),
      ProposalPublicAccessRpcStoreError
    );
  });

  test("returned wrapper result does not expose raw token or token_hash", async () => {
    const supabase = {
      rpc: async () => ({ data: recordSuccessRpcData(), error: null }),
    };

    const result = await recordProposalCustomerViewViaRpc(supabase as never, RAW_TOKEN);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(RAW_TOKEN));
    assert.ok(!serialized.includes("token_hash"));
  });
});

describe("parseProposalPublicAccessRecordViewRpcResult", () => {
  test("parses valid record success envelope", () => {
    const parsed = parseProposalPublicAccessRecordViewRpcResult(
      recordSuccessRpcData("view")
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.event_type, "view");
    }
  });
});

describe("R18C3A server wrapper guardrails", () => {
  test("persistence module has no public route, mint, or lifecycle references", () => {
    const source = readFileSync(
      new URL("./proposalPublicAccessRpcPersistence.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /\/p\/\[|app\/p\//);
    assert.doesNotMatch(source, /generatePublicToken|mint.*token|create.*public.*token/i);
    assert.doesNotMatch(source, /getProposalVersionGraph|proposalPublicGraphDto/);
    assert.doesNotMatch(source, /send_email|payment|sign_|lifecycle/);
    assert.doesNotMatch(source, /import "server-only"/);
    assert.doesNotMatch(source, /createAdminClient/);
  });

  test("server entry module imports server-only and createAdminClient", () => {
    const source = readFileSync(
      new URL("./proposalPublicAccessRpcStore.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /import "server-only"/);
    assert.match(source, /createAdminClient/);
    assert.doesNotMatch(source, /\/p\/\[|generatePublicToken/);
  });
});
