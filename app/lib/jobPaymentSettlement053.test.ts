/**
 * 053 — Canonical Stripe settlement + customer contract totals.
 *
 * Financial identity is the provider payment (PaymentIntent), not the
 * Stripe event id. Customer-chosen acceptance cents govern the job ledger
 * without mutating legacy accepted_* columns.
 *
 * Run: npx tsx --test app/lib/jobPaymentSettlement053.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { mapStripeConnectEventToCommand } from "./jobPaymentWebhookMapper";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");

const SQL_044 = join(MIGRATIONS, "20260816_044_job_payments.sql");
const SQL_048 = join(
  MIGRATIONS,
  "20260826_048_proposal_payment_terms_and_job_ledger.sql"
);
const SQL_049 = join(
  MIGRATIONS,
  "20260826_049_proposal_customer_option_choice.sql"
);
const SQL_050 = join(
  MIGRATIONS,
  "20260827_050_job_payment_request_customer_choice_binding.sql"
);
const SQL_051 = join(MIGRATIONS, "20260827_051_public_deposit_created_by_user.sql");
const SQL_052 = join(
  MIGRATIONS,
  "20260827_052_proposal_public_option_choice_persistence.sql"
);
const SQL_053 = join(
  MIGRATIONS,
  "20260827_053_canonical_stripe_settlement_and_contract_total.sql"
);

const SHA_044 = "9E098700C57228442B28C44E6177C5630456912A207CA55B1A5DCB1F7CBDB09F";
const SHA_048 = "72B46B61050287B094478485986772898BB0753FC0F1712D2825D9581A4BDCF0";
const SHA_049 = "36337F5F0032F2CBD6CC43DB6CC708C6FF82BBC78CF010FE5E8992F76FC6E2B4";
const SHA_050 = "719673DCE6147C1899E760AADAE0CEC22333D48E2F2C5855AFCB442D0A43162D";
const SHA_051 = "7384BB14759A4D7C8AA6E7728E71286F5A0D614C3FA383F1D3A18E3F0EF31783";
const SHA_052 = "B5EC89909B1C593E2F5DFD122FB2C40F037EE42B32D7249CF9D754E1158C62ED";

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function eventCommand(input: {
  id: string;
  type: string;
  paymentIntent?: string;
  paymentStatus?: string;
  amount?: number;
  requestId?: string;
  sessionId?: string;
  account?: string;
}) {
  const object: Record<string, unknown> =
    input.type.startsWith("checkout.session.")
      ? {
          id: input.sessionId ?? "cs_test_session",
          payment_status: input.paymentStatus ?? "paid",
          amount_total: input.amount ?? 100000,
          payment_intent: input.paymentIntent ?? "pi_shared",
          metadata: {
            payment_request_id:
              input.requestId ?? "11111111-1111-4111-8111-111111111111",
          },
        }
      : {
          id: input.paymentIntent ?? "pi_shared",
          amount: input.amount ?? 100000,
          metadata: {
            payment_request_id:
              input.requestId ?? "11111111-1111-4111-8111-111111111111",
          },
        };
  return mapStripeConnectEventToCommand({
    id: input.id,
    type: input.type,
    created: 1,
    account: input.account ?? "acct_test",
    data: { object },
  });
}

describe("053 — historical live migrations immutable", () => {
  test("039 remains absent and reserved", () => {
    const names = readdirSync(MIGRATIONS);
    assert.ok(!names.some((name) => name.includes("_039_")));
  });

  test("044, 048, 049, 050, 051, 052 SHAs unchanged", () => {
    assert.equal(sha(SQL_044), SHA_044);
    assert.equal(sha(SQL_048), SHA_048);
    assert.equal(sha(SQL_049), SHA_049);
    assert.equal(sha(SQL_050), SHA_050);
    assert.equal(sha(SQL_051), SHA_051);
    assert.equal(sha(SQL_052), SHA_052);
  });

  test("053 exists and later live migrations are inventoried", () => {
    assert.equal(existsSync(SQL_053), true);
    const names = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"));
    const above048 = names.filter((n) => /_0(49|5\d)_/.test(n)).sort();
    assert.deepEqual(above048, [
      "20260826_049_proposal_customer_option_choice.sql",
      "20260827_050_job_payment_request_customer_choice_binding.sql",
      "20260827_051_public_deposit_created_by_user.sql",
      "20260827_052_proposal_public_option_choice_persistence.sql",
      "20260827_053_canonical_stripe_settlement_and_contract_total.sql",
      "20260827_054_job_payment_balance_request_lifecycle.sql",
      "20260827_055_payment_domain_invariants.sql",
    ]);
  });

  test("does not edit historical files or mutate financial rows", () => {
    const sql = readFileSync(SQL_053, "utf8");
    assert.doesNotMatch(sql, /049_proposal_customer_option_choice/);
    assert.doesNotMatch(sql, /drop table public\.job_payment_transactions/i);
    assert.doesNotMatch(sql, /delete from public\.job_payment_transactions/i);
    assert.doesNotMatch(sql, /update public\.job_payment_transactions/i);
    assert.doesNotMatch(sql, /accepted_total_cents\s*=/);
    assert.doesNotMatch(sql, /proposal_option_id\s*=/);
    assert.doesNotMatch(sql, /accepted_option_label\s*=/);
  });
});

describe("053 — financial identity is the provider payment", () => {
  const sql = readFileSync(SQL_053, "utf8");

  test("canonical identity prefers PaymentIntent over event id", () => {
    assert.match(sql, /create or replace function public\.job_payment_canonical_capture_identity_v1/);
    assert.match(sql, /'pi:' \|\| coalesce\(nullif\(trim\(p_provider\), ''\), 'stripe'\)/);
    assert.match(sql, /'evt:' \|\| coalesce\(nullif\(trim\(p_provider\), ''\), 'stripe'\)/);
    assert.match(
      sql,
      /when nullif\(trim\(p_provider_payment_intent_id\), ''\) is not null/
    );
  });

  test("does not unique-constrain PaymentIntent because historical dupes exist", () => {
    assert.doesNotMatch(sql, /unique \(company_id, provider, provider_payment_intent_id\)/);
    assert.match(sql, /create index if not exists idx_job_payment_transactions_canonical_capture_pi/);
    assert.match(sql, /A UNIQUE capture-per-PaymentIntent index is NOT added/);
  });

  test("does not use amount as identity", () => {
    assert.doesNotMatch(sql, /SUM\(DISTINCT amount_cents\)/i);
    assert.doesNotMatch(sql, /distinct on \(t\.amount_cents\)/);
  });

  test("settlement writer looks up existing capture by PaymentIntent before insert", () => {
    const fn = sql.slice(
      sql.indexOf("create or replace function public.record_job_payment_provider_event_v1")
    );
    const lookup = fn.indexOf("t.provider_payment_intent_id = v_pi");
    const insert = fn.indexOf("insert into public.job_payment_transactions");
    assert.ok(lookup > 0 && insert > lookup);
    assert.match(fn, /if v_txn_kind = 'capture' then/);
    assert.match(fn, /if v_txn_kind is not null and not v_replay then/);
  });

  test("same request already captured is an enrichment no-op insert", () => {
    const fn = sql.slice(
      sql.indexOf("create or replace function public.record_job_payment_provider_event_v1")
    );
    assert.match(fn, /t\.payment_request_id = v_request\.id/);
    assert.match(fn, /v_replay := true/);
  });

  test("event-id replay remains first", () => {
    const fn = sql.slice(
      sql.indexOf("create or replace function public.record_job_payment_provider_event_v1")
    );
    const eventLookup = fn.indexOf("t.provider_event_id = v_event_id");
    const piLookup = fn.indexOf("t.provider_payment_intent_id = v_pi");
    assert.ok(eventLookup > 0 && piLookup > eventLookup);
  });

  test("service_role only; no anonymous financial mutation", () => {
    assert.match(
      sql,
      /revoke all on function public\.record_job_payment_provider_event_v1\(jsonb\)\s+from public, anon, authenticated/
    );
    assert.match(
      sql,
      /grant execute on function public\.record_job_payment_provider_event_v1\(jsonb\)\s+to service_role/
    );
  });
});

describe("053 — dual Stripe events converge on one capture", () => {
  test("payment_intent.succeeded first still maps to a capture command", () => {
    const pi = eventCommand({
      id: "evt_pi_first",
      type: "payment_intent.succeeded",
      paymentIntent: "pi_shared",
    });
    assert.equal("ignore" in pi, false);
    if (!("ignore" in pi)) {
      assert.equal(pi.transaction_kind, "capture");
      assert.equal(pi.transaction_status, "succeeded");
      assert.equal(pi.apply_request_status, "paid");
      assert.equal(pi.provider_payment_intent_id, "pi_shared");
    }
  });

  test("checkout.session.completed paid afterward still maps capture for the same PI", () => {
    const cs = eventCommand({
      id: "evt_cs_second",
      type: "checkout.session.completed",
      paymentIntent: "pi_shared",
      paymentStatus: "paid",
    });
    assert.equal("ignore" in cs, false);
    if (!("ignore" in cs)) {
      assert.equal(cs.transaction_kind, "capture");
      assert.equal(cs.provider_payment_intent_id, "pi_shared");
      assert.notEqual(cs.provider_event_id, "evt_pi_first");
    }
  });

  test("reverse event order still shares the PaymentIntent identity", () => {
    const cs = eventCommand({
      id: "evt_cs_first",
      type: "checkout.session.completed",
      paymentIntent: "pi_shared",
      paymentStatus: "paid",
    });
    const pi = eventCommand({
      id: "evt_pi_second",
      type: "payment_intent.succeeded",
      paymentIntent: "pi_shared",
    });
    if (!("ignore" in cs) && !("ignore" in pi)) {
      assert.equal(cs.provider_payment_intent_id, pi.provider_payment_intent_id);
      assert.equal(cs.transaction_kind, "capture");
      assert.equal(pi.transaction_kind, "capture");
      assert.notEqual(cs.provider_event_id, pi.provider_event_id);
    }
  });

  test("two different PaymentIntents at the same amount stay distinct", () => {
    const a = eventCommand({
      id: "evt_a",
      type: "payment_intent.succeeded",
      paymentIntent: "pi_one",
      amount: 100000,
      requestId: "11111111-1111-4111-8111-111111111111",
    });
    const b = eventCommand({
      id: "evt_b",
      type: "payment_intent.succeeded",
      paymentIntent: "pi_two",
      amount: 100000,
      requestId: "22222222-2222-4222-8222-222222222222",
    });
    if (!("ignore" in a) && !("ignore" in b)) {
      assert.equal(a.amount_cents, b.amount_cents);
      assert.notEqual(a.provider_payment_intent_id, b.provider_payment_intent_id);
      assert.notEqual(a.payment_request_id, b.payment_request_id);
    }
  });
});

describe("053 — async checkout must not mint capture on incomplete funds", () => {
  test("checkout.session.completed unpaid stays processing without a capture", () => {
    const started = eventCommand({
      id: "evt_ach_start",
      type: "checkout.session.completed",
      paymentStatus: "unpaid",
      paymentIntent: "pi_ach",
    });
    assert.equal("ignore" in started, false);
    if (!("ignore" in started)) {
      assert.equal(started.apply_request_status, "processing");
      assert.equal(started.transaction_kind, null);
    }
  });

  test("async success is the ACH capture writer", () => {
    const ok = mapStripeConnectEventToCommand({
      id: "evt_ach_ok",
      type: "checkout.session.async_payment_succeeded",
      account: "acct_test",
      data: {
        object: {
          id: "cs_ach",
          amount_total: 100000,
          payment_intent: "pi_ach",
          metadata: { payment_request_id: "11111111-1111-4111-8111-111111111111" },
        },
      },
    });
    if (!("ignore" in ok)) {
      assert.equal(ok.transaction_kind, "capture");
      assert.equal(ok.apply_request_status, "paid");
      assert.equal(ok.provider_payment_intent_id, "pi_ach");
    }
  });
});

describe("053 — ledger and contract totals", () => {
  const sql = readFileSync(SQL_053, "utf8");

  test("gross received groups by canonical capture identity", () => {
    const gross = sql.slice(
      sql.indexOf("create or replace function public.job_payment_gross_received_cents_v1")
    );
    assert.match(gross, /select distinct on \(/);
    assert.match(gross, /job_payment_canonical_capture_identity_v1/);
    assert.doesNotMatch(gross.slice(0, 1200), /coalesce\(sum\(t\.amount_cents\), 0\)::integer\s+from public\.job_payment_transactions t\s+join/);
  });

  test("contract total prefers customer_chosen_total_cents", () => {
    assert.match(
      sql,
      /create or replace function public\.proposal_acceptance_contract_total_cents_v1/
    );
    assert.match(
      sql,
      /coalesce\(a\.customer_chosen_total_cents, a\.accepted_total_cents\)/
    );
  });

  test("job contractual total uses the acceptance helper, not raw accepted_total_cents", () => {
    const fn = sql.slice(
      sql.indexOf(
        "create or replace function public.job_payment_current_contractual_total_cents_v1"
      )
    );
    assert.match(fn, /proposal_acceptance_contract_total_cents_v1\(a\.company_id, a\.id\)/);
    assert.doesNotMatch(
      fn.slice(0, 900),
      /select a\.accepted_total_cents\s+from public\.proposal_acceptances a/
    );
  });

  test("refund helper is not rewritten here so refund math stays 048-owned", () => {
    assert.doesNotMatch(
      sql,
      /create or replace function public\.job_payment_refunded_cents_v1/
    );
  });
});
