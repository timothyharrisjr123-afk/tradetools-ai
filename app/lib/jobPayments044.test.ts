/**
 * R3E — Job payments 044 schema and isolation contracts.
 *
 * Run: npx tsx --test app/lib/jobPayments044.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CREATE_JOB_PAYMENT_REQUEST_RPC_V1,
  JOB_CARD_PAYMENTS_REQUEST_DEPOSIT_CTA,
  RECORD_JOB_PAYMENT_PROVIDER_EVENT_RPC_V1,
} from "./jobPaymentTypes";
import {
  mapStripeConnectEventToCommand,
  nextRequestStatusFromPrecedence,
} from "./jobPaymentWebhookMapper";
import {
  buildJobCardPaymentViewModel,
  buildPublicPaymentViewModel,
  composeJobPaymentActivityItems,
} from "./jobPaymentReadModel";
import { prefillDepositCents, remainingAcceptedCents } from "./jobPaymentMoney";
import { composeJobActivityItems } from "./jobActivityComposer";

const ROOT = process.cwd();
const SQL_044 = join(ROOT, "supabase/migrations/20260816_044_job_payments.sql");
const SQL_043 = join(ROOT, "supabase/migrations/20260816_043_proposal_signatures.sql");
const SQL_042 = join(
  ROOT,
  "supabase/migrations/20260816_042_proposal_freeze_timestamp_authority.sql"
);
const SQL_041 = join(
  ROOT,
  "supabase/migrations/20260816_041_proposal_draft_content_changed_at.sql"
);
const SQL_040 = join(
  ROOT,
  "supabase/migrations/20260816_040_proposal_formal_acceptance.sql"
);
const SQL_039 = join(
  ROOT,
  "supabase/migrations/20260816_039_proposal_formal_acceptance.sql"
);
const SQL_038 = join(
  ROOT,
  "supabase/migrations/20260816_038_job_lifecycle_foundation.sql"
);

const HASH_038 =
  "46027df3711a52814234d551ed9e5a08661eeb8cebe377ce4e58c694a95fd40b";
const HASH_040 =
  "0c9929393e1662626357e72521792fa0a805e169de242073f43c5bd75be81256";
const HASH_041 =
  "fc5f394c67f7b4d8e5417db4bf2c63d0fb8ff79088f15b0c816bdc5c7409c883";
const HASH_042 =
  "2d0d7210b0e8002e027b4f5c1b2bf167fac434df26dfe2b76f357668aae1ee20";
const HASH_043 =
  "2b7d86548ecb20365f83b8b0882b7f2c4f17a4c6eb7f77a3b30d47fd73bdef60";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const sql044 = readFileSync(SQL_044, "utf8");
const createFn = sql044.slice(
  sql044.indexOf("create or replace function public.create_job_payment_request_v1")
);
const eventFn = sql044.slice(
  sql044.indexOf("create or replace function public.record_job_payment_provider_event_v1")
);

describe("044 filename and locked prior migrations", () => {
  test("044 exists; 039 absent; 038-043 untouched", () => {
    assert.equal(existsSync(SQL_044), true);
    assert.equal(existsSync(SQL_039), false);
    assert.equal(sha256File(SQL_038), HASH_038);
    assert.equal(sha256File(SQL_040), HASH_040);
    assert.equal(sha256File(SQL_041), HASH_041);
    assert.equal(sha256File(SQL_042), HASH_042);
    assert.equal(existsSync(SQL_043), true);
    assert.equal(sha256File(SQL_043), HASH_043);
    assert.match(sql044, /039 remains reserved/);
  });
});

describe("044 schema", () => {
  test("creates the four R3E tables with integer cents", () => {
    assert.match(sql044, /create table if not exists public\.company_payment_accounts/);
    assert.match(sql044, /create table if not exists public\.company_payment_settings/);
    assert.match(sql044, /create table if not exists public\.job_payment_requests/);
    assert.match(sql044, /create table if not exists public\.job_payment_transactions/);
    assert.match(sql044, /amount_cents integer not null/);
    assert.match(sql044, /currency text not null default 'usd'/);
    assert.match(sql044, /proposal_signature_id uuid null/);
    assert.doesNotMatch(sql044, /require_signature_before_payment/);
    assert.doesNotMatch(sql044, /application_fee/);
    assert.doesNotMatch(sql044, /estimate_id/);
  });

  test("RLS on; authenticated select only; no anon writes", () => {
    for (const table of [
      "company_payment_accounts",
      "company_payment_settings",
      "job_payment_requests",
      "job_payment_transactions",
    ]) {
      assert.match(sql044, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(sql044, new RegExp(`grant select on table public\\.${table} to authenticated`));
      assert.match(
        sql044,
        new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`)
      );
    }
  });

  test("immutability: amount and signature cannot change; transactions append-only", () => {
    assert.match(sql044, /job_payment_requests financial identity is immutable/);
    assert.match(sql044, /paid job_payment_requests cannot regress/);
    assert.match(sql044, /job_payment_transactions rows cannot be updated/);
    assert.match(sql044, /job_payment_transactions rows cannot be deleted/);
  });
});

describe("create request guards", () => {
  test("requires approved + active + acceptance; signature optional", () => {
    assert.match(createFn, /job_not_approved/);
    assert.match(createFn, /job_not_active/);
    assert.match(createFn, /no_acceptance/);
    assert.match(createFn, /not_connected/);
    assert.match(createFn, /v_signature_id := v_matched_signature/);
    assert.match(createFn, /signature_mismatch/);
    assert.doesNotMatch(createFn, /insert into public\.proposal_signatures/);
    assert.doesNotMatch(createFn, /update public\.proposal_signatures/);
    assert.doesNotMatch(createFn, /update public\.jobs/);
    assert.match(createFn, /job payment request must not change job stage/);
    assert.equal(CREATE_JOB_PAYMENT_REQUEST_RPC_V1, "create_job_payment_request_v1");
  });

  test("does not block unsigned proposals", () => {
    assert.doesNotMatch(createFn, /unsigned/);
    assert.doesNotMatch(createFn, /signature_required/);
    assert.match(createFn, /proposal_signature_id,[\s\S]*v_signature_id/);
  });
});

describe("webhook settlement", () => {
  test("card paid maps from checkout paid or payment_intent.succeeded", () => {
    const card = mapStripeConnectEventToCommand({
      id: "evt_card",
      type: "checkout.session.completed",
      created: 1,
      account: "acct_test",
      data: {
        object: {
          id: "cs_test",
          payment_status: "paid",
          amount_total: 500000,
          metadata: { payment_request_id: "11111111-1111-4111-8111-111111111111" },
        },
      },
    });
    assert.equal("ignore" in card, false);
    if (!("ignore" in card)) {
      assert.equal(card.apply_request_status, "paid");
      assert.equal(card.transaction_kind, "capture");
    }
  });

  test("ACH checkout completion stays processing; async success pays", () => {
    const started = mapStripeConnectEventToCommand({
      id: "evt_ach_start",
      type: "checkout.session.completed",
      account: "acct_test",
      data: {
        object: {
          id: "cs_ach",
          payment_status: "unpaid",
          amount_total: 500000,
          metadata: { payment_request_id: "11111111-1111-4111-8111-111111111111" },
        },
      },
    });
    assert.equal("ignore" in started, false);
    if (!("ignore" in started)) {
      assert.equal(started.apply_request_status, "processing");
      assert.equal(started.transaction_kind, null);
    }
    const succeeded = mapStripeConnectEventToCommand({
      id: "evt_ach_ok",
      type: "checkout.session.async_payment_succeeded",
      account: "acct_test",
      data: {
        object: {
          id: "cs_ach",
          amount_total: 500000,
          metadata: { payment_request_id: "11111111-1111-4111-8111-111111111111" },
        },
      },
    });
    if (!("ignore" in succeeded)) {
      assert.equal(succeeded.apply_request_status, "paid");
    }
    const failed = mapStripeConnectEventToCommand({
      id: "evt_ach_fail",
      type: "checkout.session.async_payment_failed",
      account: "acct_test",
      data: {
        object: {
          id: "cs_ach",
          metadata: { payment_request_id: "11111111-1111-4111-8111-111111111111" },
        },
      },
    });
    if (!("ignore" in failed)) {
      assert.equal(failed.apply_request_status, "failed");
    }
  });

  test("duplicate event id is unique in SQL; paid does not regress", () => {
    assert.match(sql044, /unique \(provider, provider_event_id\)/);
    assert.equal(
      nextRequestStatusFromPrecedence({ current: "paid", apply: "failed" }),
      "paid"
    );
    assert.equal(
      nextRequestStatusFromPrecedence({ current: "processing", apply: "paid" }),
      "paid"
    );
    assert.equal(
      nextRequestStatusFromPrecedence({ current: "open", apply: "processing" }),
      "processing"
    );
    assert.equal(RECORD_JOB_PAYMENT_PROVIDER_EVENT_RPC_V1, "record_job_payment_provider_event_v1");
    assert.match(eventFn, /idempotent_replay/);
    assert.match(eventFn, /job payment provider event must not change job stage/);
  });

  test("unknown signed event is ignored; bad signature is a route concern", () => {
    const ignored = mapStripeConnectEventToCommand({
      id: "evt_noise",
      type: "customer.created",
      data: { object: {} },
    });
    assert.equal("ignore" in ignored && ignored.ignore, true);
    const webhook = readFileSync(
      join(ROOT, "app/api/webhooks/stripe/connect/route.ts"),
      "utf8"
    );
    assert.match(webhook, /verifyStripeConnectWebhook/);
    assert.match(webhook, /invalid_signature/);
    assert.doesNotMatch(webhook, /console\.log/);
  });
});

describe("amount ownership and defaults", () => {
  test("remaining and percent/fixed prefills never rewrite requests", () => {
    assert.equal(
      remainingAcceptedCents({ acceptedTotalCents: 1850000, netPaidCents: 500000 }),
      1350000
    );
    assert.equal(
      prefillDepositCents({
        mode: "percent",
        percentBps: 2000,
        fixedCents: null,
        acceptedTotalCents: 1850000,
        remainingCents: 1850000,
      }),
      370000
    );
    assert.equal(
      prefillDepositCents({
        mode: "fixed",
        percentBps: null,
        fixedCents: 500000,
        acceptedTotalCents: 1850000,
        remainingCents: 1850000,
      }),
      500000
    );
    assert.match(sql044, /Changing defaults never rewrites existing payment requests/);
  });
});

describe("Job Card and Public states", () => {
  const request = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    job_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    proposal_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    proposal_version_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    proposal_option_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    proposal_acceptance_id: "99999999-9999-4999-8999-999999999999",
    proposal_signature_id: null,
    amount_cents: 500000,
    currency: "usd",
    kind: "deposit" as const,
    accepted_total_cents_snapshot: 1850000,
    option_label_snapshot: "Premium",
    provider_account_id: "acct_test",
    provider_checkout_session_id: null,
    status: "open" as const,
    requested_at: "2026-08-16T12:00:00.000Z",
    paid_at: null,
    cancelled_at: null,
  };

  test("Accepted+Approved+unsigned allows Request deposit", () => {
    const view = buildJobCardPaymentViewModel({
      jobStage: "approved",
      jobDisposition: "active",
      accepted: true,
      signed: false,
      account: {
        charges_enabled: true,
        onboarding_status: "complete",
        details_submitted: true,
        payouts_enabled: true,
      },
      requests: [],
      transactions: [],
      acceptedTotalCents: 1850000,
    });
    assert.equal(view.canRequestDeposit, true);
    assert.equal(view.unsignedApprovedEligible, true);
    assert.equal(view.action, "request_deposit");
    assert.equal(JOB_CARD_PAYMENTS_REQUEST_DEPOSIT_CTA, "Request deposit");
  });

  test("public due / pending / received", () => {
    assert.equal(
      buildPublicPaymentViewModel({ requests: [request] })?.state,
      "due"
    );
    assert.equal(
      buildPublicPaymentViewModel({
        requests: [{ ...request, status: "processing" }],
      })?.state,
      "pending"
    );
    assert.equal(
      buildPublicPaymentViewModel({
        requests: [
          {
            ...request,
            status: "paid",
            paid_at: "2026-08-16T13:00:00.000Z",
          },
        ],
      })?.state,
      "received"
    );
    assert.equal(
      buildPublicPaymentViewModel({
        requests: [
          {
            ...request,
            status: "paid",
            paid_at: "2026-08-16T13:00:00.000Z",
          },
        ],
        transactions: [
          {
            id: "txn-refund",
            payment_request_id: request.id,
            kind: "refund",
            status: "refunded",
            amount_cents: 500000,
            occurred_at: "2026-08-16T14:00:00.000Z",
            provider_event_id: "evt_refund",
          },
        ],
      })?.state,
      "refunded"
    );
  });

  test("activity dedupes by request id and transaction id", () => {
    const items = composeJobPaymentActivityItems({
      requests: [request, request],
      transactions: [
        {
          id: "txn-1",
          payment_request_id: request.id,
          kind: "capture",
          status: "succeeded",
          amount_cents: 500000,
          occurred_at: "2026-08-16T13:00:00.000Z",
          provider_event_id: "evt_1",
        },
      ],
    });
    const composed = composeJobActivityItems({
      paymentItems: items,
    });
    const received = composed.filter((row) => row.label === "Payment received");
    const requested = composed.filter((row) => row.label === "Payment requested");
    assert.equal(requested.length, 1);
    assert.equal(received.length, 1);
  });
});

describe("legacy isolation and no stage write", () => {
  test("new webhook is not the legacy payments webhook", () => {
    const connect = readFileSync(
      join(ROOT, "app/api/webhooks/stripe/connect/route.ts"),
      "utf8"
    );
    const legacy = readFileSync(join(ROOT, "app/api/payments/webhook/route.ts"), "utf8");
    assert.match(connect, /R3E Stripe Connect webhook/);
    assert.doesNotMatch(connect, /estimateId/);
    assert.match(legacy, /estimateId/);
    assert.doesNotMatch(sql044, /update public\.jobs/);
    assert.doesNotMatch(eventFn, /transition_job_stage/);
  });

  test("Jobs Board still hides deposit_paid lane", () => {
    const board = readFileSync(
      join(ROOT, "app/tools/roofing/saved/jobsBoardUtils.ts"),
      "utf8"
    );
    assert.match(board, /JOBS_BOARD_RETIRED_LANE_KEYS/);
    assert.match(sql044, /Payment NEVER becomes Job stage/);
  });

  test("Checkout uses connected-account direct charges and no application fee", () => {
    const stripe = readFileSync(
      join(ROOT, "app/lib/jobPaymentStripe.server.ts"),
      "utf8"
    );
    assert.match(stripe, /stripeAccount: input\.connectedAccountId/);
    assert.match(stripe, /must not set application fees/);
    assert.match(stripe, /payment_method_types: \["card", "us_bank_account"\]/);
    assert.match(stripe, /R3E refuses live Stripe keys/);
    assert.match(stripe, /findReusableCheckoutSessionForRequest/);
    assert.match(stripe, /timeoutMs \?\? 8000/);
    assert.match(stripe, /stripe_retrieve_timeout/);
    assert.match(stripe, /withPaymentReturnHint/);
    const contractorCheckout = readFileSync(
      join(ROOT, "app/api/jobs/payment-requests/[id]/checkout/route.ts"),
      "utf8"
    );
    assert.match(contractorCheckout, /withPaymentReturnHint\(returnPath, "pending"\)/);
    assert.doesNotMatch(
      contractorCheckout,
      /returnPath\}\?payment=/
    );
    const checkout = readFileSync(
      join(ROOT, "app/lib/jobPaymentCheckout.server.ts"),
      "utf8"
    );
    assert.match(checkout, /findReusableCheckoutSessionForRequest/);
    assert.match(checkout, /Webhook metadata \+ session list recover the bind/);
  });

  test("Settings status uses stored flags and does not retrieve Stripe on GET", () => {
    const status = readFileSync(
      join(ROOT, "app/api/company/payments/status/route.ts"),
      "utf8"
    );
    assert.doesNotMatch(status, /retrieveConnectedAccount/);
    assert.match(status, /Does not block the UI on a live Stripe retrieve/);
    const hook = readFileSync(join(ROOT, "app/lib/useJobPayments.ts"), "utf8");
    assert.match(hook, /AbortSignal\.timeout\(4000\)/);
    assert.match(hook, /must not wait on Stripe refresh/);
  });

  test("public checkout rejects amount tamper", () => {
    const route = readFileSync(
      join(ROOT, "app/api/public/payment-requests/checkout/route.ts"),
      "utf8"
    );
    assert.match(route, /amount_tamper/);
    assert.match(route, /hashProposalPublicAccessToken/);
  });

  test("public packet loads refund transactions", () => {
    const server = readFileSync(
      join(ROOT, "app/lib/proposalPublicAccessOrchestrator.server.ts"),
      "utf8"
    );
    assert.match(server, /job_payment_transactions/);
    assert.match(server, /transactions: loaded\.transactions/);
  });
});
