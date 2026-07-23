/**
 * R3B1 — Customer package request persistence / contract tests.
 *
 * Run: npx tsx --test app/lib/proposalCustomerRequestPersistence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { hashProposalPublicAccessToken } from "./proposalPublicAccessTokenHash";
import {
  normalizeCustomerRequestSubmitInput,
  parseProposalCustomerRequestRpcResult,
  ProposalCustomerRequestStoreError,
  RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1,
  recordProposalCustomerRequestViaRpc,
} from "./proposalCustomerRequestPersistence";
import {
  PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUBMIT_CTA,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_BODY,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_NEXT,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_TITLE,
} from "./proposalCustomerPacketViewModel";

const RAW_TOKEN = "fielddive-r3b1-customer-request-token";
const TOKEN_HASH = hashProposalPublicAccessToken(RAW_TOKEN);
const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const OPTION_ID = "55555555-5555-4555-8555-555555555555";
const SELECTED_OPTION_ID = "66666666-6666-4666-8666-666666666666";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260723_033_create_proposal_customer_requests.sql"
);

function successRpcData() {
  return {
    ok: true,
    request_id: REQUEST_ID,
    intent: "request_package",
    status: "new",
    token_id: TOKEN_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: VERSION_ID,
    requested_option_id: OPTION_ID,
    requested_option_label: "Standard",
    proposal_status_unchanged: "sent",
    selected_option_id_unchanged: SELECTED_OPTION_ID,
  };
}

describe("parseProposalCustomerRequestRpcResult", () => {
  test("parses valid request success envelope", () => {
    const parsed = parseProposalCustomerRequestRpcResult(successRpcData());
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.request_id, REQUEST_ID);
      assert.equal(parsed.intent, "request_package");
      assert.equal(parsed.status, "new");
      assert.equal(parsed.requested_option_label, "Standard");
      assert.equal(parsed.proposal_status_unchanged, "sent");
      assert.equal(parsed.selected_option_id_unchanged, SELECTED_OPTION_ID);
    }
  });

  test("parses token failure envelopes", () => {
    for (const code of ["expired", "revoked", "not_found", "option_not_on_version"] as const) {
      const parsed = parseProposalCustomerRequestRpcResult({ ok: false, code });
      assert.deepEqual(parsed, { ok: false, code });
    }
  });
});

describe("normalizeCustomerRequestSubmitInput", () => {
  test("strips client company/proposal/version overrides from payload", () => {
    const normalized = normalizeCustomerRequestSubmitInput({
      intent: "request_package",
      requestedOptionId: OPTION_ID,
      message: "Please call me",
      payloadJson: {
        company_id: COMPANY_ID,
        proposal_id: PROPOSAL_ID,
        proposal_version_id: VERSION_ID,
        token: RAW_TOKEN,
        source: "public_packet",
      },
    });

    assert.equal(normalized.intent, "request_package");
    assert.equal(normalized.requestedOptionId, OPTION_ID);
    assert.equal(normalized.message, "Please call me");
    assert.deepEqual(normalized.payloadJson, { source: "public_packet" });
    assert.equal("company_id" in normalized.payloadJson, false);
    assert.equal("token" in normalized.payloadJson, false);
  });

  test("rejects package request without option id", () => {
    assert.throws(
      () =>
        normalizeCustomerRequestSubmitInput({
          intent: "request_package",
          requestedOptionId: null,
        }),
      ProposalCustomerRequestStoreError
    );
  });
});

describe("recordProposalCustomerRequestViaRpc", () => {
  test("hashes raw token and never sends raw token to RPC", async () => {
    let rpcName = "";
    let rpcArgs: Record<string, unknown> | null = null;
    const supabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcName = name;
        rpcArgs = args;
        return { data: successRpcData(), error: null };
      },
    };

    const result = await recordProposalCustomerRequestViaRpc(supabase as never, RAW_TOKEN, {
      intent: "request_package",
      requestedOptionId: OPTION_ID,
      message: "R3B smoke message",
      customerName: "R18D3B Email Smoke",
    });

    assert.equal(rpcName, RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1);
    assert.ok(rpcArgs);
    assert.equal(rpcArgs!.p_token_hash, TOKEN_HASH);
    assert.notEqual(rpcArgs!.p_token_hash, RAW_TOKEN);
    assert.equal(JSON.stringify(rpcArgs).includes(RAW_TOKEN), false);
    assert.equal(rpcArgs!.p_intent, "request_package");
    assert.equal(rpcArgs!.p_requested_option_id, OPTION_ID);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.request_id, REQUEST_ID);
      assert.equal(result.proposal_status_unchanged, "sent");
      assert.equal(result.selected_option_id_unchanged, SELECTED_OPTION_ID);
    }
  });

  test("returns option_not_on_version without inventing a row", async () => {
    const supabase = {
      rpc: async () => ({
        data: { ok: false, code: "option_not_on_version" },
        error: null,
      }),
    };

    const result = await recordProposalCustomerRequestViaRpc(supabase as never, RAW_TOKEN, {
      intent: "request_package",
      requestedOptionId: OPTION_ID,
    });

    assert.deepEqual(result, { ok: false, code: "option_not_on_version" });
  });

  test("returns expired/revoked token failures", async () => {
    for (const code of ["expired", "revoked"] as const) {
      const supabase = {
        rpc: async () => ({ data: { ok: false, code }, error: null }),
      };
      const result = await recordProposalCustomerRequestViaRpc(supabase as never, RAW_TOKEN, {
        intent: "request_package",
        requestedOptionId: OPTION_ID,
      });
      assert.deepEqual(result, { ok: false, code });
    }
  });
});

describe("R3B1 migration contract", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  test("creates proposal_customer_requests and record RPC", () => {
    assert.match(sql, /create table if not exists public\.proposal_customer_requests/);
    assert.match(sql, /create or replace function public\.record_proposal_customer_request_v1/);
    assert.match(sql, /status in \('new', 'seen', 'dismissed'\)/);
    assert.doesNotMatch(sql, /status in \([^)]*accepted/);
    assert.doesNotMatch(sql, /status in \([^)]*approved/);
  });

  test("RPC asserts token, validates option on version, appends only", () => {
    assert.match(sql, /proposal_assert_public_access_token_active_v1/);
    assert.match(sql, /option_not_on_version/);
    assert.match(sql, /insert into public\.proposal_customer_requests/);
    assert.match(sql, /Does not mutate proposals\.status/);
    assert.doesNotMatch(sql, /update public\.proposals/);
    assert.doesNotMatch(sql, /update public\.proposal_options/);
    assert.doesNotMatch(sql, /proposal_option_upgrade_choices/);
    assert.doesNotMatch(sql, /insert into public\.proposal_events/);
  });

  test("RPC permissions are service_role only", () => {
    assert.match(sql, /revoke all on function public\.record_proposal_customer_request_v1/);
    assert.match(sql, /grant execute on function public\.record_proposal_customer_request_v1[\s\S]*to service_role/);
  });

  test("never stores raw token keys", () => {
    assert.match(sql, /proposal_forbidden_token_json_keys/);
    assert.match(sql, /Never stores raw token/);
  });
});

describe("R3B2 non-binding copy", () => {
  test("uses request language without Accept/Approve/Sign/Pay", () => {
    const blobs = [
      PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA,
      PROPOSAL_CUSTOMER_PACKET_REQUEST_SUBMIT_CTA,
      PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_TITLE,
      PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_BODY,
      PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_NEXT,
    ].join("\n");

    assert.match(blobs, /Request this package/);
    assert.match(blobs, /Send request/);
    assert.match(blobs, /Request received/);
    assert.match(
      blobs,
      /The contractor will review the package and contact you about next steps\./
    );
    assert.match(blobs, /non-binding/i);
    assert.doesNotMatch(
      blobs,
      /\bAccept(?:ed)?\b|\bApprove(?:d)?\b|\bSign(?:ed)?\b|\bPay\b|\bPaid\b|\bSchedule(?:d)?\b/i
    );
    assert.doesNotMatch(blobs, /Package confirmed|Proposal approved|Contract accepted/i);
  });

  test("InterestActions and modal avoid acceptance language in source", () => {
    const interest = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketPackageInterestActions.tsx"),
      "utf8"
    );
    const modal = readFileSync(
      join(process.cwd(), "app/components/proposal-packet/ProposalPacketRequestModal.tsx"),
      "utf8"
    );
    const api = readFileSync(
      join(process.cwd(), "app/api/proposals/customer-request/route.ts"),
      "utf8"
    );

    for (const source of [interest, modal, api]) {
      assert.doesNotMatch(
        source,
        /Request accepted|Package confirmed|Proposal approved|Contract accepted|Pay deposit|Sign in person/i
      );
      assert.doesNotMatch(source, />\s*Accept\s*</);
      assert.doesNotMatch(source, />\s*Approve\s*</);
    }
    assert.match(
      readFileSync(
        join(process.cwd(), "app/lib/proposalCustomerPacketViewModel.ts"),
        "utf8"
      ),
      /Request received\. The contractor will review the package and contact you about next steps\./
    );
    assert.match(api, /recordProposalCustomerRequest/);
    assert.match(
      api,
      /Request received\. The contractor will review the package and contact you about next steps\./
    );
    assert.match(modal, /PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_BODY/);
    assert.match(modal, /\/api\/proposals\/customer-request/);
  });
});
