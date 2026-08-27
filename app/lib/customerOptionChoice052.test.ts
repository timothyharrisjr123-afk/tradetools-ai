/**
 * Cohesion A recovery — durable pre-pay customer package choice (052)
 * plus deposit RPC error propagation.
 *
 * Run: npx tsx --test app/lib/customerOptionChoice052.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

type OpenJobDepositRpc = Pick<SupabaseClient, "rpc">["rpc"];

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");

const SQL_044 = join(MIGRATIONS, "20260816_044_job_payments.sql");
const SQL_047 = join(MIGRATIONS, "20260823_047_job_work_complete.sql");
const SQL_048 = join(MIGRATIONS, "20260826_048_proposal_payment_terms_and_job_ledger.sql");
const SQL_049 = join(MIGRATIONS, "20260826_049_proposal_customer_option_choice.sql");
const SQL_050 = join(
  MIGRATIONS,
  "20260827_050_job_payment_request_customer_choice_binding.sql"
);
const SQL_051 = join(MIGRATIONS, "20260827_051_public_deposit_created_by_user.sql");
const SQL_052 = join(
  MIGRATIONS,
  "20260827_052_proposal_public_option_choice_persistence.sql"
);

const SHA_044 = "9E098700C57228442B28C44E6177C5630456912A207CA55B1A5DCB1F7CBDB09F";
const SHA_047 = "FFE33FDD562742519BB92568CD5C55528537EA756540D1C6C906F8694B974979";
const SHA_048 = "72B46B61050287B094478485986772898BB0753FC0F1712D2825D9581A4BDCF0";
const SHA_049 = "36337F5F0032F2CBD6CC43DB6CC708C6FF82BBC78CF010FE5E8992F76FC6E2B4";
const SHA_050 = "719673DCE6147C1899E760AADAE0CEC22333D48E2F2C5855AFCB442D0A43162D";
const SHA_051 = "7384BB14759A4D7C8AA6E7728E71286F5A0D614C3FA383F1D3A18E3F0EF31783";
const SHA_052 = "B5EC89909B1C593E2F5DFD122FB2C40F037EE42B32D7249CF9D754E1158C62ED";

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("052 — historical live migrations immutable", () => {
  test("039 remains absent", () => {
    const names = readdirSync(MIGRATIONS);
    assert.ok(!names.some((name) => name.includes("_039_")));
  });

  test("044, 047, 048, 049, 050, 051 SHAs unchanged", () => {
    assert.equal(sha(SQL_044), SHA_044);
    assert.equal(sha(SQL_047), SHA_047);
    assert.equal(sha(SQL_048), SHA_048);
    assert.equal(sha(SQL_049), SHA_049);
    assert.equal(sha(SQL_050), SHA_050);
    assert.equal(sha(SQL_051), SHA_051);
    assert.equal(sha(SQL_052), SHA_052);
  });

  test("052 exists and 049-052 are the only migrations after 048", () => {
    assert.equal(existsSync(SQL_052), true);
    const names = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"));
    const above048 = names.filter((n) => /_0(49|5\d)_/.test(n)).sort();
    assert.deepEqual(above048, [
      "20260826_049_proposal_customer_option_choice.sql",
      "20260827_050_job_payment_request_customer_choice_binding.sql",
      "20260827_051_public_deposit_created_by_user.sql",
      "20260827_052_proposal_public_option_choice_persistence.sql",
    ]);
  });
});

describe("052 — durable choice ownership", () => {
  const sql = readFileSync(SQL_052, "utf8");

  test("adds a dedicated table keyed to company + proposal + frozen version", () => {
    assert.match(sql, /create table if not exists public\.proposal_public_option_choices/);
    assert.match(sql, /constraint proposal_public_option_choices_offer_unique/);
    assert.match(
      sql,
      /unique \(company_id, proposal_id, proposal_version_id\)/
    );
  });

  test("does not mutate frozen versions or contractor option columns", () => {
    assert.doesNotMatch(sql, /update public\.proposal_versions/i);
    assert.doesNotMatch(sql, /update public\.proposal_options/i);
    assert.doesNotMatch(sql, /update public\.jobs/i);
    assert.doesNotMatch(sql, /set\s+stage\s*=/i);
    assert.doesNotMatch(sql, /alter table public\.proposal_acceptances/i);
  });

  test("write RPC is token-gated and service_role only", () => {
    assert.match(sql, /record_proposal_public_option_choice_v1/);
    assert.match(sql, /proposal_assert_public_access_token_active_v1/);
    assert.match(
      sql,
      /revoke all on function public\.record_proposal_public_option_choice_v1\(text, text\)\s*\n\s*from public, anon, authenticated/
    );
    assert.match(
      sql,
      /grant execute on function public\.record_proposal_public_option_choice_v1\(text, text\)\s*\n\s*to service_role/
    );
  });

  test("resolves option against the bound frozen version", () => {
    assert.match(sql, /proposal_resolve_customer_chosen_option_v1/);
    assert.match(sql, /'invalid_option_choice'/);
  });

  test("same selection is idempotent and switch is allowed until acceptance", () => {
    assert.match(sql, /'idempotent_replay', true/);
    assert.match(sql, /'choice_locked'/);
    assert.match(sql, /cannot change after acceptance/);
  });

  test("concurrent writers serialize on an advisory lock", () => {
    assert.match(sql, /pg_advisory_xact_lock/);
    assert.match(sql, /proposal_public_option_choice:/);
  });

  test("anon and public cannot write the table", () => {
    assert.match(sql, /revoke all on table public\.proposal_public_option_choices from anon/);
    assert.match(sql, /revoke all on table public\.proposal_public_option_choices from public/);
    assert.match(sql, /enable row level security/);
  });
});

describe("052 — app write/read contract", () => {
  test("public packet persists through the server endpoint, never browser storage", () => {
    const packet = read("app/components/proposal-packet/ProposalPacket.tsx");
    assert.match(packet, /\/api\/proposals\/public-option-choice/);
    assert.match(packet, /persistChoice/);
    assert.doesNotMatch(packet, /sessionStorage|localStorage/);
    const comparison = read("app/components/proposal-packet/ProposalPacketComparison.tsx");
    assert.doesNotMatch(comparison, /sessionStorage|localStorage/);
    assert.match(comparison, /disabled=\{pending\}/);
  });

  test("failed persist rolls back the visible choice", () => {
    const packet = read("app/components/proposal-packet/ProposalPacket.tsx");
    assert.match(packet, /setChosenKey\(previous\)/);
    assert.match(packet, /PROPOSAL_CUSTOMER_PACKET_CHOICE_SAVE_ERROR/);
  });

  test("route never trusts client amounts or bindings", () => {
    const route = read("app/api/proposals/public-option-choice/route.ts");
    assert.match(route, /amount_tamper/);
    assert.match(route, /body\?\.proposalId/);
    assert.match(route, /recordProposalPublicOptionChoice\(token\.trim\(\), optionKey\)/);
  });

  test("orchestrator hydrates accepted choice then durable provisional then contractor default", () => {
    const core = read("app/lib/proposalPublicAccessOrchestrator.ts");
    assert.match(core, /resolveCustomerDisplayOptionKey/);
    assert.match(core, /durableKey \?\? contractorDefaultKey/);
    const server = read("app/lib/proposalPublicAccessOrchestrator.server.ts");
    assert.match(server, /customer_chosen_option_id/);
    assert.match(server, /readProposalPublicOptionChoiceCurrent/);
    assert.match(server, /DEFAULT_PROPOSAL_PAYMENT_TERMS/);
    assert.match(server, /termsRequireOnlineDeposit/);
  });

  test("acceptance prefers durable choice over a stale client key", () => {
    const lib = read("app/lib/proposalAcceptancePersistence.ts");
    assert.match(lib, /readProposalPublicOptionChoiceCurrent/);
    assert.match(lib, /commitOptionKey = durable\.option_key/);
    assert.match(lib, /customer_option_key: commitOptionKey/);
  });

  test("checkout uses durable choice through acceptance and refuses a failed deposit open", () => {
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(checkout, /openJobDepositFromAcceptanceViaAdmin/);
    assert.match(checkout, /if \(!deposit\.ok\)/);
  });
});

describe("052 — deposit RPC error propagation", () => {
  test("helper returns a structured failure instead of swallowing", () => {
    const lib = read("app/lib/proposalPaymentTermsPersistence.ts");
    assert.match(lib, /export type OpenJobDepositFromAcceptanceResult/);
    assert.match(lib, /code: "deposit_open_failed"/);
    assert.doesNotMatch(
      lib,
      /Acceptance must remain valid if deposit open fails/
    );
    assert.match(lib, /\[open_job_deposit\] rpc error/);
  });

  test("accept and checkout both refuse when deposit open fails", () => {
    const accept = read("app/api/proposals/accept/route.ts");
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(accept, /if \(!deposit\.ok\)/);
    assert.match(checkout, /if \(!deposit\.ok\)/);
  });

  test("RPC error class is a structured failure, never a silent success", async () => {
    const { openJobDepositFromAcceptanceViaAdmin } = await import(
      "./proposalPaymentTermsPersistence"
    );
    const companyId = "11111111-1111-4111-8111-111111111111";
    const acceptanceId = "22222222-2222-4222-8222-222222222222";

    const rpcError = await openJobDepositFromAcceptanceViaAdmin({
      companyId,
      acceptanceId,
      admin: {
        rpc: (async () => ({
          data: null,
          error: {
            code: "23502",
            message: "null value in column created_by_user_id violates not-null constraint",
          },
        })) as unknown as OpenJobDepositRpc,
      },
    });
    assert.deepEqual(rpcError, { ok: false, code: "deposit_open_failed" });

    const rpcRejected = await openJobDepositFromAcceptanceViaAdmin({
      companyId,
      acceptanceId,
      admin: {
        rpc: (async () => ({
          data: {
            ok: false,
            code: "job_payment_requests binding must match the acceptance row",
          },
          error: null,
        })) as unknown as OpenJobDepositRpc,
      },
    });
    assert.deepEqual(rpcRejected, { ok: false, code: "deposit_open_failed" });

    const noDeposit = await openJobDepositFromAcceptanceViaAdmin({
      companyId,
      acceptanceId,
      admin: {
        rpc: (async () => ({
          data: { ok: true, skipped: true, code: "no_deposit" },
          error: null,
        })) as unknown as OpenJobDepositRpc,
      },
    });
    assert.equal(noDeposit.ok, true);
    if (noDeposit.ok) {
      assert.equal(noDeposit.skipped, true);
      assert.equal(noDeposit.code, "no_deposit");
    }
  });
});
