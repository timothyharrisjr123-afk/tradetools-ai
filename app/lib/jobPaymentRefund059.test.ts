/**
 * Refunds V1 backend-focused tests.
 *
 * Run: npx tsx --test app/lib/jobPaymentRefund059.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  mapStripeConnectEventToCommand,
  mapStripeRefundObjectToCommand,
} from "./jobPaymentWebhookMapper";
import {
  JOB_PAYMENT_REFUND_STATUSES,
  RECONCILE_JOB_PAYMENT_REFUND_RESULT_RPC_V1,
  RECORD_JOB_PAYMENT_REFUND_EVENT_RPC_V1,
  RESERVE_JOB_PAYMENT_REFUND_RPC_V1,
} from "./jobPaymentTypes";

const ROOT = process.cwd();
const read = (relativePath: string) =>
  readFileSync(join(ROOT, relativePath), "utf8");
const sql = read("supabase/migrations/20260828_059_job_payment_refunds.sql").replace(
  /\r\n/g,
  "\n"
);

function section(start: string, end: string): string {
  const startIndex = sql.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = sql.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return sql.slice(startIndex, endIndex);
}

const refundTable = section(
  "create table public.job_payment_refunds (",
  "create unique index idx_job_payment_refunds_provider_refund"
);
const receiptTable = section(
  "create table public.job_payment_refund_event_receipts (",
  "create index idx_job_payment_refund_events_company"
);
const rowGuard = section(
  "create or replace function public.job_payment_refunds_row_guard_v1()",
  "create trigger job_payment_refunds_row_guard"
);
const reserveRpc = section(
  "create or replace function public.reserve_job_payment_refund_v1(",
  "revoke all on function public.reserve_job_payment_refund_v1"
);
const reconcileRpc = section(
  "create or replace function public.reconcile_job_payment_refund_result_v1(",
  "revoke all on function public.reconcile_job_payment_refund_result_v1"
);
const eventRpc = section(
  "create or replace function public.record_job_payment_refund_event_v1(",
  "revoke all on function public.record_job_payment_refund_event_v1"
);

describe("059 — schema and security contracts", () => {
  test("defines durable refund identity, provider fields, lifecycle timestamps, and checks", () => {
    for (const field of [
      "id uuid primary key",
      "company_id uuid not null",
      "job_id uuid not null",
      "payment_request_id uuid not null",
      "canonical_capture_transaction_id uuid not null",
      "provider_account_id text not null",
      "provider_payment_intent_id text not null",
      "provider_charge_id text null",
      "provider_refund_id text null",
      "amount_cents integer not null",
      "idempotency_key text not null",
      "last_provider_event_created_at timestamptz null",
      "initiated_at timestamptz null",
      "pending_at timestamptz null",
      "requires_action_at timestamptz null",
      "succeeded_at timestamptz null",
      "failed_at timestamptz null",
      "canceled_at timestamptz null",
    ]) {
      assert.ok(refundTable.includes(field), field);
    }
    assert.match(refundTable, /check \(amount_cents > 0\)/);
    assert.match(refundTable, /check \(currency = 'usd'\)/);
    assert.match(refundTable, /origin in \('fielddive', 'stripe_dashboard'\)/);
    assert.match(
      refundTable,
      /status in \([\s\S]*'initiating',\s*'pending',\s*'requires_action',\s*'succeeded',\s*'failed',\s*'canceled'/
    );
  });

  test("binds refund and receipt rows with composite company-safe foreign keys", () => {
    assert.match(
      refundTable,
      /foreign key \(payment_request_id, company_id\)[\s\S]*references public\.job_payment_requests \(id, company_id\)/
    );
    assert.match(
      refundTable,
      /foreign key \(\s*canonical_capture_transaction_id,\s*company_id,\s*payment_request_id\s*\)[\s\S]*references public\.job_payment_transactions \(\s*id,\s*company_id,\s*payment_request_id/
    );
    assert.match(
      refundTable,
      /foreign key \(job_id, company_id\)[\s\S]*references public\.jobs \(id, company_id\)/
    );
    assert.match(
      receiptTable,
      /foreign key \(refund_id, company_id\)[\s\S]*references public\.job_payment_refunds \(id, company_id\)/
    );
  });

  test("guards immutable financial identity, bound Stripe ids, timestamps, and deletion", () => {
    assert.match(rowGuard, /if tg_op = 'DELETE' then[\s\S]*rows cannot be deleted/);
    for (const field of [
      "id",
      "company_id",
      "job_id",
      "payment_request_id",
      "canonical_capture_transaction_id",
      "provider_account_id",
      "provider_payment_intent_id",
      "amount_cents",
      "currency",
      "origin",
      "created_by_user_id",
      "internal_reason",
      "idempotency_key",
      "created_at",
    ]) {
      assert.ok(
        rowGuard.includes(`new.${field} is distinct from old.${field}`),
        field
      );
    }
    assert.match(rowGuard, /old\.provider_charge_id is not null[\s\S]*Stripe charge id is immutable/);
    assert.match(rowGuard, /old\.provider_refund_id is not null[\s\S]*Stripe refund id is immutable/);
    assert.match(rowGuard, /refund lifecycle timestamps cannot be cleared or rewritten/);
    assert.match(
      sql,
      /job_payment_refund_event_receipts rows cannot be updated[\s\S]*rows cannot be deleted/
    );
  });

  test("enables company-scoped read RLS while denying authenticated direct writes", () => {
    assert.match(sql, /alter table public\.job_payment_refunds enable row level security/);
    assert.match(sql, /alter table public\.job_payment_refund_event_receipts enable row level security/);
    assert.match(
      sql,
      /job_payment_refunds_select_company_scope[\s\S]*company_memberships[\s\S]*cm\.user_id = auth\.uid\(\)/
    );
    assert.match(
      sql,
      /revoke all on table public\.job_payment_refunds\s*from public, anon, authenticated, service_role/
    );
    assert.match(sql, /grant select on table public\.job_payment_refunds to authenticated/);
    assert.doesNotMatch(sql, /grant (?:insert|update|delete|all).*job_payment_refunds.*authenticated/i);
  });

  test("keeps reconciliation and event mutation service-only", () => {
    for (const fn of [
      "reconcile_job_payment_refund_result_v1",
      "record_job_payment_refund_event_v1",
    ]) {
      assert.match(
        sql,
        new RegExp(
          `revoke all on function public\\.${fn}\\(jsonb\\)\\s*from public, anon, authenticated`
        )
      );
      assert.match(
        sql,
        new RegExp(`grant execute on function public\\.${fn}\\(jsonb\\)\\s*to service_role`)
      );
      assert.doesNotMatch(
        sql,
        new RegExp(`grant execute on function public\\.${fn}\\(jsonb\\)[\\s\\S]{0,40}authenticated`)
      );
    }
  });
});

describe("059 — accounting, ordering, and isolation contracts", () => {
  test("totals only succeeded refunds and availability reserves all in-flight states", () => {
    const refundedFn = section(
      "create or replace function public.job_payment_refunded_cents_v1(",
      "create or replace function public.job_payment_net_received_cents_v1("
    );
    const refundableFn = section(
      "create or replace function public.job_payment_capture_refundable_cents_v1(",
      "revoke all on function public.job_payment_refunded_cents_v1"
    );
    assert.match(refundedFn, /and r\.status = 'succeeded'/);
    assert.doesNotMatch(refundedFn, /pending|requires_action|initiating/);
    assert.match(
      refundableFn,
      /r\.status in \([\s\S]*'initiating',\s*'pending',\s*'requires_action',\s*'succeeded'\s*\)/
    );
    assert.doesNotMatch(refundableFn, /'failed'|'canceled'/);
  });

  test("serializes per capture and computes succeeded plus in-flight before insert", () => {
    assert.match(
      reserveRpc,
      /pg_advisory_xact_lock\([\s\S]*hashtextextended\([\s\S]*'job_payment_refund:' \|\| v_company_id::text \|\| ':' \|\| v_capture_id::text/
    );
    assert.match(
      reserveRpc,
      /sum\(r\.amount_cents\) filter \(where r\.status = 'succeeded'\)[\s\S]*where r\.status in \('initiating', 'pending', 'requires_action'\)/
    );
    assert.match(reserveRpc, /v_succeeded \+ v_inflight \+ v_amount > v_capture\.amount_cents/);
    assert.match(
      reserveRpc,
      /greatest\(0, v_capture\.amount_cents - v_succeeded - v_inflight\)/
    );
  });

  test("idempotent replay preserves immutable identity while allowing a later-bound charge", () => {
    const replay = section("if found then", "return jsonb_build_object('ok', false, 'code', 'idempotency_mismatch')");
    for (const field of [
      "company_id",
      "job_id",
      "payment_request_id",
      "canonical_capture_transaction_id",
      "provider_account_id",
      "provider_payment_intent_id",
      "amount_cents",
      "created_by_user_id",
      "internal_reason",
      "idempotency_key",
    ]) {
      assert.ok(replay.includes(`v_existing.${field} is not distinct from`), field);
    }
    assert.match(
      replay,
      /v_capture\.provider_charge_id is null\s*or v_existing\.provider_charge_id is not distinct from v_capture\.provider_charge_id/
    );
    assert.doesNotMatch(
      replay,
      /^\s*and v_existing\.provider_charge_id is not distinct from v_capture\.provider_charge_id$/m
    );
    assert.match(replay, /'idempotent_replay', true/);
    assert.match(reserveRpc, /'idempotency_key_conflict'/);
  });

  test("dedupes event delivery by connected account and event id before mutation", () => {
    assert.match(
      receiptTable,
      /unique \(provider_account_id, provider_event_id\)/
    );
    const replayIndex = eventRpc.indexOf("if found then");
    const updateIndex = eventRpc.indexOf("update public.job_payment_refunds");
    assert.ok(replayIndex >= 0 && updateIndex > replayIndex);
    assert.match(
      eventRpc.slice(replayIndex, updateIndex),
      /'idempotent_replay', true/
    );
  });

  test("prevents terminal-to-inflight regression even from newer out-of-order events", () => {
    const terminalRule =
      /v_refund\.status in \('succeeded', 'failed', 'canceled'\)[\s\S]*and v_status in \('pending', 'requires_action'\)/;
    assert.match(reconcileRpc, terminalRule);
    assert.match(eventRpc, terminalRule);
    assert.match(
      rowGuard,
      /old\.status in \('succeeded', 'failed', 'canceled'\)[\s\S]*new\.status not in \('succeeded', 'failed', 'canceled'\)/
    );
  });

  test("projects Dashboard refunds only through account plus canonical PI/charge correlation", () => {
    assert.match(
      eventRpc,
      /r\.provider_account_id = v_account[\s\S]*t\.provider = 'stripe'[\s\S]*t\.kind = 'capture'[\s\S]*t\.status = 'succeeded'/
    );
    assert.match(eventRpc, /v_correlation := case when v_pi is not null then 'payment_intent' else 'charge' end/);
    assert.match(eventRpc, /'stripe_dashboard'[\s\S]*'stripe-refund:' \|\| v_provider_refund_id/);
    assert.match(eventRpc, /v_reserved \+ v_amount <= v_capture\.amount_cents/);
  });

  test("never reads cumulative charge refunds or guesses legacy refund identity", () => {
    assert.doesNotMatch(eventRpc, /amount_refunded/i);
    assert.doesNotMatch(eventRpc, /job_payment_transactions[\s\S]*kind\s*=\s*'refund'/);
    const legacyView = section(
      "create or replace view public.job_payment_legacy_refund_review_v1",
      "revoke all on table public.job_payment_legacy_refund_review_v1"
    );
    assert.match(legacyView, /'ambiguous_missing_provider_refund_id'/);
    assert.doesNotMatch(legacyView, /insert|update|delete/i);
  });

  test("refund RPCs do not write job stage or unrelated domain tables", () => {
    const executable = [reserveRpc, reconcileRpc, eventRpc]
      .join("\n")
      .replace(/^\s*--.*$/gm, "");
    assert.doesNotMatch(executable, /update\s+public\.jobs|set\s+stage\s*=/i);
    assert.doesNotMatch(
      executable,
      /(?:insert into|update|delete from)\s+public\.(?!job_payment_refunds|job_payment_refund_event_receipts)\w+/i
    );
    assert.match(executable, /job_stage_unchanged/);
  });
});

describe("059 — refund mapper lifecycle", () => {
  test("maps one Stripe Refund identity, amount, status, and command metadata", () => {
    const mapped = mapStripeConnectEventToCommand({
      id: "evt_refund_updated",
      type: "refund.updated",
      created: 1_788_000_000,
      account: "acct_connected",
      data: {
        object: {
          id: "re_individual",
          object: "refund",
          amount: 2500,
          status: "pending",
          pending_reason: "processing",
          payment_intent: "pi_capture",
          charge: "ch_capture",
          created: 1_787_999_900,
          metadata: { fielddive_refund_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        },
      },
    });
    assert.ok(!("ignore" in mapped));
    assert.equal(mapped.refund_event?.provider_refund_id, "re_individual");
    assert.equal(mapped.refund_event?.amount_cents, 2500);
    assert.equal(mapped.refund_event?.status, "pending");
    assert.equal(mapped.refund_event?.provider_payment_intent_id, "pi_capture");
    assert.equal(mapped.refund_event?.provider_charge_id, "ch_capture");
    assert.equal(
      mapped.refund_event?.metadata_refund_command_id,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
    assert.equal(mapped.transaction_kind, null);
  });

  test("maps failed refund reason without inventing success", () => {
    const mapped = mapStripeRefundObjectToCommand({
      object: {
        id: "re_failed",
        amount: 100,
        status: "failed",
        failure_reason: "lost_or_stolen_card",
        payment_intent: { id: "pi_capture" },
        charge: { id: "ch_capture" },
      },
      providerEventId: "evt_failed",
      rawType: "refund.failed",
      eventCreated: 1_788_000_000,
      connectedAccountId: "acct_connected",
    });
    assert.equal(mapped.status, "failed");
    assert.equal(mapped.provider_reason_code, "lost_or_stolen_card");
    assert.equal(mapped.provider_reason_message, "lost_or_stolen_card");
  });

  test("maps every Stripe refund status and preserves the connected account", () => {
    for (const status of [
      "pending",
      "requires_action",
      "succeeded",
      "failed",
      "canceled",
    ] as const) {
      const mapped = mapStripeRefundObjectToCommand({
        object: { id: `re_${status}`, amount: 100, status },
        providerEventId: `evt_${status}`,
        rawType: "refund.updated",
        eventCreated: 1_788_000_000,
        connectedAccountId: "acct_connected",
      });
      assert.equal(mapped.status, status);
      assert.equal(mapped.provider_account_id, "acct_connected");
    }
  });

  test("missing metadata stays unbound and legacy metadata aliases are not guessed", () => {
    for (const metadata of [
      undefined,
      {},
      { refund_command_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { fielddive_refund_command_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ]) {
      const mapped = mapStripeRefundObjectToCommand({
        object: {
          id: "re_no_metadata",
          amount: 100,
          status: "pending",
          ...(metadata === undefined ? {} : { metadata }),
        },
        providerEventId: "evt_no_metadata",
        rawType: "refund.updated",
        eventCreated: 1_788_000_000,
        connectedAccountId: "acct_connected",
      });
      assert.equal(mapped.metadata_refund_command_id, null);
    }
  });

  test("charge.refunded is reconciliation-only and never uses cumulative money", () => {
    const mapped = mapStripeConnectEventToCommand({
      id: "evt_charge_refunded",
      type: "charge.refunded",
      created: 1_788_000_000,
      account: "acct_connected",
      data: {
        object: {
          id: "ch_capture",
          amount: 10000,
          amount_refunded: 7000,
          payment_intent: "pi_capture",
        },
      },
    });
    assert.ok(!("ignore" in mapped));
    assert.equal(mapped.amount_cents, null);
    assert.equal(mapped.transaction_kind, null);
    assert.equal(mapped.reconcile_charge_refunds?.provider_charge_id, "ch_capture");
  });
});

describe("059 — RPC, Stripe, webhook, and API source contracts", () => {
  test("exports exact Refunds V1 RPC constants and statuses", () => {
    assert.equal(RESERVE_JOB_PAYMENT_REFUND_RPC_V1, "reserve_job_payment_refund_v1");
    assert.equal(
      RECONCILE_JOB_PAYMENT_REFUND_RESULT_RPC_V1,
      "reconcile_job_payment_refund_result_v1"
    );
    assert.equal(RECORD_JOB_PAYMENT_REFUND_EVENT_RPC_V1, "record_job_payment_refund_event_v1");
    assert.deepEqual(JOB_PAYMENT_REFUND_STATUSES, [
      "initiating",
      "pending",
      "requires_action",
      "succeeded",
      "failed",
      "canceled",
    ]);
  });

  test("Stripe refund uses PI, amount, exact metadata, connected account, and exact key", () => {
    const stripe = read("app/lib/jobPaymentStripe.server.ts");
    const start = stripe.indexOf("export async function createDirectPaymentRefund");
    const end = stripe.indexOf("export async function retrieveDirectPaymentRefund", start);
    const fn = stripe.slice(start, end);
    assert.match(fn, /payment_intent: input\.paymentIntentId/);
    assert.match(fn, /amount: input\.amountCents/);
    assert.match(fn, /fielddive_refund_id: input\.refundCommandId/);
    assert.match(fn, /stripeAccount: input\.connectedAccountId/);
    assert.match(fn, /idempotencyKey: `job-refund:\$\{input\.refundCommandId\}:v1`/);
    assert.doesNotMatch(fn, /reverse_transfer|refund_application_fee|transfer_data|application_fee/);
  });

  test("webhook records individual listed refunds with deterministic delivery keys", () => {
    const webhook = read("app/api/webhooks/stripe/connect/route.ts");
    assert.match(webhook, /listDirectChargeRefunds/);
    assert.match(webhook, /providerEventId: `\$\{signal\.provider_event_id\}:\$\{refund\.id\}`/);
    assert.match(webhook, /recordJobPaymentRefundEventViaRpc/);
    assert.doesNotMatch(webhook, /amount_refunded/);
  });

  test("refund API validates cents and UUID, derives request, and reserves before Stripe", () => {
    const route = read(
      "app/api/jobs/[jobId]/payments/[paymentId]/refunds/route.ts"
    );
    assert.match(route, /Number\.isSafeInteger\(amountCents\)/);
    assert.match(route, /amountCents < 1/);
    assert.match(route, /isUuidLike\(commandId\)/);
    assert.match(route, /\.from\("job_payment_transactions"\)/);
    assert.match(route, /\.from\("job_payment_requests"\)/);
    assert.match(route, /const idempotencyKey = `job-refund:\$\{commandId\}:v1`/);
    assert.ok(
      route.indexOf("reserveJobPaymentRefundViaRpc") <
        route.indexOf("createDirectPaymentRefund")
    );
    assert.match(route, /stripeRefundErrorIsDefinitive/);
    assert.match(route, /status: 202/);
  });

  test("refund API maps all lifecycle statuses and separates ambiguous from definitive errors", () => {
    const route = read(
      "app/api/jobs/[jobId]/payments/[paymentId]/refunds/route.ts"
    );
    assert.match(
      route,
      /status === "initiating" \|\| status === "pending" \|\| status === "requires_action"\) return 202/
    );
    assert.match(route, /status === "failed" \|\| status === "canceled"\) return 422/);
    assert.match(route, /return 200/);
    assert.match(
      route,
      /if \(!stripeRefundErrorIsDefinitive\(error\)\)[\s\S]*"initiating"[\s\S]*status: 202/
    );
    assert.match(
      route,
      /status: "failed"[\s\S]*providerReasonCode: safe\.code[\s\S]*code: "refund_failed"[\s\S]*status: 422/
    );
  });
});
