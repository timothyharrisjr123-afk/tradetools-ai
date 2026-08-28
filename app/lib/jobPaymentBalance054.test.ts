/**
 * Payment Stage 2B — balance-request lifecycle (migration 054).
 *
 * Run: npx tsx --test app/lib/jobPaymentBalance054.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "./proposalPaymentTerms";
import {
  buildJobPaymentWorkspace,
  jobPaymentCollectibleRemainingCents,
  type JobPaymentWorkspaceRequest,
  type JobPaymentWorkspaceTransaction,
} from "./jobPaymentWorkspace";
import { JOB_CARD_PAYMENTS_COLLECT_BALANCE_CTA } from "./jobPaymentTypes";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

const SQL_044 = join(MIGRATIONS, "20260816_044_job_payments.sql");
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
const SQL_053 = join(
  MIGRATIONS,
  "20260827_053_canonical_stripe_settlement_and_contract_total.sql"
);
const SQL_054 = join(
  MIGRATIONS,
  "20260827_054_job_payment_balance_request_lifecycle.sql"
);

const SHA_044 = "9E098700C57228442B28C44E6177C5630456912A207CA55B1A5DCB1F7CBDB09F";
const SHA_048 = "72B46B61050287B094478485986772898BB0753FC0F1712D2825D9581A4BDCF0";
const SHA_049 = "36337F5F0032F2CBD6CC43DB6CC708C6FF82BBC78CF010FE5E8992F76FC6E2B4";
const SHA_050 = "719673DCE6147C1899E760AADAE0CEC22333D48E2F2C5855AFCB442D0A43162D";
const SHA_051 = "7384BB14759A4D7C8AA6E7728E71286F5A0D614C3FA383F1D3A18E3F0EF31783";
const SHA_052 = "B5EC89909B1C593E2F5DFD122FB2C40F037EE42B32D7249CF9D754E1158C62ED";
const SHA_053 = "1800F3C89648EB87F9B428A700ECC9F8EE26932BFB70E3CE9A8CAD4AB0B5D29B";

export const AFTER_048_MIGRATIONS = [
  "20260826_049_proposal_customer_option_choice.sql",
  "20260827_050_job_payment_request_customer_choice_binding.sql",
  "20260827_051_public_deposit_created_by_user.sql",
  "20260827_052_proposal_public_option_choice_persistence.sql",
  "20260827_053_canonical_stripe_settlement_and_contract_total.sql",
  "20260827_054_job_payment_balance_request_lifecycle.sql",
  "20260827_055_payment_domain_invariants.sql",
  "20260827_056_flexible_collect_payment.sql",
  "20260828_057_job_attachments.sql",
] as const;

const ACCOUNT = {
  charges_enabled: true,
  onboarding_status: "complete",
  details_submitted: true,
  payouts_enabled: true,
};

const DEPOSIT_TERMS = {
  ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
  depositMode: "fixed" as const,
  depositFixedCents: 100000,
};

function request(
  overrides: Partial<JobPaymentWorkspaceRequest> = {}
): JobPaymentWorkspaceRequest {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "deposit",
    status: "open",
    amount_cents: 100000,
    requested_at: "2026-08-26T12:00:00.000Z",
    paid_at: null,
    settled_payment_method_label: null,
    ...overrides,
  };
}

function txn(
  overrides: Partial<JobPaymentWorkspaceTransaction> = {}
): JobPaymentWorkspaceTransaction {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    payment_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "capture",
    status: "succeeded",
    amount_cents: 100000,
    occurred_at: "2026-08-26T13:00:00.000Z",
    provider_event_id: "evt_pi_succeeded",
    provider_payment_intent_id: "pi_shared",
    ...overrides,
  };
}

describe("054 — historical migrations immutable", () => {
  test("039 remains absent and reserved", () => {
    const names = readdirSync(MIGRATIONS);
    assert.ok(!names.some((name) => name.includes("_039_")));
  });

  test("044 and 048-053 SHAs unchanged", () => {
    assert.equal(sha(SQL_044), SHA_044);
    assert.equal(sha(SQL_048), SHA_048);
    assert.equal(sha(SQL_049), SHA_049);
    assert.equal(sha(SQL_050), SHA_050);
    assert.equal(sha(SQL_051), SHA_051);
    assert.equal(sha(SQL_052), SHA_052);
    assert.equal(sha(SQL_053), SHA_053);
  });

  test("054 exists after 053; 055 is inventoried after 054", () => {
    assert.equal(existsSync(SQL_054), true);
    const names = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"));
    const above048 = names.filter((n) => /_0(49|5\d)_/.test(n)).sort();
    assert.deepEqual(above048, [...AFTER_048_MIGRATIONS]);
  });
});

describe("054 — balance request contract", () => {
  const sql = readFileSync(SQL_054, "utf8");
  const createFn = sql.slice(
    sql.indexOf("create or replace function public.create_job_payment_request_v1")
  );

  test("collectible is contract minus gross, not net", () => {
    assert.match(sql, /create or replace function public\.job_payment_collectible_cents_v1/);
    assert.match(
      sql,
      /job_payment_current_contractual_total_cents_v1\(p_company_id, p_job_id\)\s*\n\s*- public\.job_payment_gross_received_cents_v1/
    );
    assert.doesNotMatch(
      sql.slice(0, sql.indexOf("create or replace function public.create_job_payment_request_v1")),
      /job_payment_net_received_cents_v1/
    );
  });

  test("Complete gate and no-deposit gross-zero balance", () => {
    assert.match(createFn, /v_kind = 'balance'/);
    assert.match(createFn, /v_before_stage is distinct from 'complete'/);
    assert.match(createFn, /'not_complete'/);
    assert.match(createFn, /v_amount := v_collectible/);
    assert.match(createFn, /'nothing_due'/);
    assert.doesNotMatch(createFn, /deposit_required/);
  });

  test("client amount is not authoritative for balance", () => {
    const balanceBlock = createFn.slice(createFn.indexOf("if v_kind = 'balance' then"));
    assert.match(balanceBlock, /v_amount := v_collectible/);
    const route = read("app/api/jobs/[jobId]/payment-requests/balance/route.ts");
    assert.match(route, /collectJobRemainingBalanceViaRpc/);
    assert.doesNotMatch(route, /req\.json|body\?\.amount|amountCents\s*=/);
    const persist = read("app/lib/jobPaymentPersistence.ts");
    const collectFn = persist.slice(
      persist.indexOf("collectJobRemainingBalanceViaRpc"),
      persist.indexOf("export async function collectJobPaymentViaRpc")
    );
    assert.doesNotMatch(collectFn, /amountCents|amount_cents/);
  });

  test("open/processing replay; failed rows are not amount-mutated", () => {
    assert.match(createFn, /idempotent_replay', true/);
    assert.match(createFn, /status in \('open', 'processing'\)/);
    const balanceFailed = createFn.slice(createFn.indexOf("if v_kind = 'deposit' then"));
    assert.match(balanceFailed, /if v_kind = 'deposit' then/);
    assert.doesNotMatch(createFn, /set[\s\S]{0,80}amount_cents\s*=/);
  });

  test("053 contract snapshot and no stage mutation", () => {
    assert.match(createFn, /proposal_acceptance_contract_option_v1/);
    assert.match(createFn, /v_contract_total/);
    assert.doesNotMatch(createFn, /update public\.jobs/i);
    assert.match(createFn, /job payment request must not change job stage/);
  });

  test("least-privilege grants", () => {
    assert.match(
      sql,
      /revoke all on function public\.job_payment_collectible_cents_v1\(uuid, uuid\)\s+from public, anon/
    );
    assert.match(
      sql,
      /grant execute on function public\.create_job_payment_request_v1\(jsonb\)\s+to authenticated, service_role/
    );
    assert.doesNotMatch(
      sql,
      /grant execute on function public\.create_job_payment_request_v1\(jsonb\) to public, anon/
    );
  });
});

describe("2B presenter CTA states", () => {
  test("Approved / Scheduled / Production cannot collect", () => {
    for (const stage of ["approved", "scheduled", "production"] as const) {
      const workspace = buildJobPaymentWorkspace({
        jobStage: stage,
        accepted: true,
        account: ACCOUNT,
        terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
        customerChosenTotalCents: 1500000,
        acceptedTotalCents: 1500000,
        requests: [],
        transactions: [],
      });
      assert.equal(workspace.canCollectRemainingBalance, false, stage);
      assert.notEqual(workspace.state, "balance_due", stage);
    }
  });

  test("Complete + remaining > 0 shows Collect remaining balance", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2702860,
      requests: [request({ status: "paid", paid_at: "2026-08-26T13:00:00.000Z" })],
      transactions: [txn()],
    });
    assert.equal(workspace.state, "balance_due");
    assert.equal(workspace.canCollectRemainingBalance, true);
    assert.equal(
      workspace.collectibleRemainingCents,
      jobPaymentCollectibleRemainingCents({
        contractTotalCents: 2702860,
        receivedGrossCents: 100000,
      })
    );
    assert.equal(JOB_CARD_PAYMENTS_COLLECT_BALANCE_CTA, "Collect remaining balance");
  });

  test("no-deposit Complete + gross 0 can collect full contract", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1500000,
      acceptedTotalCents: 1500000,
      requests: [],
      transactions: [],
    });
    assert.equal(workspace.receivedGrossCents, 0);
    assert.equal(workspace.collectibleRemainingCents, 1500000);
    assert.equal(workspace.state, "balance_due");
    assert.equal(workspace.canCollectRemainingBalance, true);
  });

  test("open balance request is Balance requested with no second CTA", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2702860,
      requests: [
        request({ status: "paid", paid_at: "2026-08-26T13:00:00.000Z" }),
        request({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "balance",
          status: "open",
          amount_cents: 2602860,
          requested_at: "2026-08-27T16:00:00.000Z",
        }),
      ],
      transactions: [txn()],
    });
    assert.equal(workspace.state, "balance_requested");
    assert.equal(workspace.statusLabel, "Balance requested");
    assert.equal(workspace.overviewStatusLabel, "Balance requested");
    assert.equal(workspace.canCollectRemainingBalance, false);
    assert.equal(workspace.nextStep, null);
    assert.equal(
      workspace.timeline.some((row) => row.title === "Remaining balance requested"),
      true
    );
  });

  test("processing balance has no Collect CTA", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2702860,
      requests: [
        request({ status: "paid", paid_at: "2026-08-26T13:00:00.000Z" }),
        request({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "balance",
          status: "processing",
          amount_cents: 2602860,
        }),
      ],
      transactions: [txn()],
    });
    assert.equal(workspace.state, "balance_processing");
    assert.equal(workspace.canCollectRemainingBalance, false);
  });

  test("refund concession does not reopen Collect", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2000000,
      acceptedTotalCents: 1850000,
      requests: [
        request({ status: "paid", paid_at: "2026-08-26T13:00:00.000Z" }),
        request({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "balance",
          status: "paid",
          amount_cents: 1900000,
          paid_at: "2026-08-27T13:00:00.000Z",
        }),
      ],
      transactions: [
        txn(),
        txn({
          id: "22222222-2222-4222-8222-222222222222",
          payment_request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          amount_cents: 1900000,
          provider_event_id: "evt_balance",
          provider_payment_intent_id: "pi_balance",
        }),
        txn({
          id: "33333333-3333-4333-8333-333333333333",
          kind: "refund",
          status: "refunded",
          amount_cents: 50000,
          provider_event_id: "evt_refund",
          provider_payment_intent_id: "pi_balance",
        }),
      ],
    });
    assert.equal(workspace.receivedGrossCents, 2000000);
    assert.equal(workspace.refundedCents, 50000);
    assert.equal(workspace.collectibleRemainingCents, 0);
    assert.equal(workspace.state, "payments_complete");
    assert.equal(workspace.canCollectRemainingBalance, false);
    assert.equal(workspace.collectibleRemainingCents, 0);
  });

  test("later contract increase after paid deposit can collect the new remainder", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 3000000,
      acceptedTotalCents: 1850000,
      requests: [request({ status: "paid", paid_at: "2026-08-26T13:00:00.000Z" })],
      transactions: [txn()],
    });
    assert.equal(workspace.collectibleRemainingCents, 2900000);
    assert.equal(workspace.canCollectRemainingBalance, true);
  });

  test("Overview stays quiet and Board is untouched", () => {
    const overview = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");
    assert.doesNotMatch(overview, /Collect remaining balance/);
    assert.doesNotMatch(overview, /formatUsdFromCents/);
    const board = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
    assert.doesNotMatch(board, /Collect remaining balance/);
    assert.doesNotMatch(board, /canCollectRemainingBalance/);
    const ui = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    assert.match(ui, /JOB_CARD_PAYMENTS_COLLECT_CTA/);
    assert.match(ui, /canCollectPayment/);
    assert.doesNotMatch(ui, /Send payment link/);
  });
});
