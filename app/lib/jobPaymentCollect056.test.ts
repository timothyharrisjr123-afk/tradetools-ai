/**
 * Stage 2C Flexible Collect (migration 056).
 *
 * Run: npx tsx --test app/lib/jobPaymentCollect056.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { AFTER_048_MIGRATIONS } from "./jobPaymentBalance054.test";
import {
  collectPercentageAmountCents,
  deriveCollectRequestKind,
  parseCollectFixedAmountToCents,
  checkoutLineLabel,
} from "./jobPaymentMoney";
import {
  COLLECT_AMOUNT_MODES,
  JOB_PAYMENT_KINDS,
  PUBLIC_PAYMENT_PROGRESS_LABEL,
} from "./jobPaymentTypes";
import { buildJobPaymentWorkspace } from "./jobPaymentWorkspace";
import { buildPublicPaymentViewModel } from "./jobPaymentReadModel";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "./proposalPaymentTerms";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();

const SQL_055 = join(MIGRATIONS, "20260827_055_payment_domain_invariants.sql");
const SQL_056 = join(MIGRATIONS, "20260827_056_flexible_collect_payment.sql");
const SHA_055 = "25199B71D913D02E4F02B9F4FC6855E370F797600D9E89B88C395CDD9C25F5A2";

function sliceFn(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = sql.indexOf("create or replace function public.", start + 1);
  return next >= 0 ? sql.slice(start, next) : sql.slice(start);
}

const ACCOUNT = {
  charges_enabled: true,
  onboarding_status: "complete",
  details_submitted: true,
  payouts_enabled: true,
};

function request(
  overrides: Partial<{
    id: string;
    kind: "deposit" | "progress" | "balance";
    status: "open" | "processing" | "paid" | "cancelled" | "expired" | "failed";
    amount_cents: number;
  }> = {}
) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "progress" as const,
    status: "open" as const,
    amount_cents: 400000,
    requested_at: "2026-08-27T18:00:00.000Z",
    paid_at: null,
    settled_payment_method_label: null,
    ...overrides,
  };
}

describe("056 — historical migrations immutable", () => {
  test("039 remains reserved; 044-055 unchanged; 056 is next", () => {
    const names = readdirSync(MIGRATIONS);
    assert.ok(!names.some((name) => name.includes("_039_")));
    assert.equal(existsSync(SQL_056), true);
    assert.equal(sha(SQL_055), SHA_055);
    const above048 = names.filter((n) => n.endsWith(".sql") && /_0(49|5\d)_/.test(n)).sort();
    assert.deepEqual(above048, [...AFTER_048_MIGRATIONS]);
    assert.match(readFileSync(SQL_056, "utf8"), /039 remains\s+reserved/);
    assert.doesNotMatch(
      readFileSync(SQL_056, "utf8"),
      /create unique index if not exists idx_job_payment_requests_one_active_per_job/
    );
    assert.doesNotMatch(
      readFileSync(SQL_056, "utf8"),
      /drop index if exists public\.idx_job_payment_requests_one_active_per_job/
    );
  });
});

describe("056 — kind CHECK, metadata, collect RPC", () => {
  const sql = readFileSync(SQL_056, "utf8");
  const collectFn = sliceFn(sql, "collect_job_payment_v1");

  test("progress is a valid request kind; 055 uniqueness is not rewritten", () => {
    assert.match(sql, /kind in \('deposit', 'progress', 'balance'\)/);
    assert.doesNotMatch(sql, /drop index if exists public\.idx_job_payment_requests_one_active_per_job/);
    assert.doesNotMatch(sql, /create unique index/);
  });

  test("amount_mode and percentage_bps are explanatory only", () => {
    assert.match(sql, /add column if not exists amount_mode text null/);
    assert.match(sql, /add column if not exists percentage_bps integer null/);
    assert.match(sql, /Never used to recalculate amount_cents/);
    assert.match(collectFn, /v_amount_mode not in \('remaining', 'percentage', 'fixed'\)/);
    assert.match(collectFn, /amount_exceeds_collectible/);
    assert.doesNotMatch(collectFn, /least\(|greatest\(/);
  });

  test("Collect never mints deposit and never takes client kind", () => {
    assert.match(collectFn, /p_payload \? 'kind'/);
    assert.match(collectFn, /v_kind := 'progress'/);
    assert.match(collectFn, /v_kind := 'balance'/);
    assert.match(collectFn, /if v_kind = 'deposit' then/);
    assert.match(collectFn, /deposit_not_generic/);
    assert.doesNotMatch(collectFn, /v_kind := 'deposit'/);
    assert.doesNotMatch(collectFn, /update public\.jobs/i);
  });

  test("percentage is original contract floor math, remaining is collectible", () => {
    assert.match(
      collectFn,
      /v_amount := \(\(v_contract_total::bigint \* v_percentage_bps::bigint\) \/ 10000\)::integer/
    );
    assert.match(collectFn, /proposal_acceptance_contract_total_cents_v1/);
    assert.match(collectFn, /v_amount := v_collectible/);
    assert.match(collectFn, /job_payment_collectible_cents_v1/);
  });

  test("Complete exact collectible is balance; otherwise progress", () => {
    assert.match(collectFn, /v_before_stage is distinct from 'complete'/);
    assert.match(collectFn, /v_amount = v_collectible/);
    assert.match(collectFn, /job_not_active/);
    assert.match(collectFn, /coalesce\(v_job.status, 'active'\) <> 'active'/);
  });

  test("grants are contractor/server only", () => {
    assert.match(sql, /revoke all on function public\.collect_job_payment_v1\(jsonb\) from public, anon/);
    assert.match(
      sql,
      /grant execute on function public\.collect_job_payment_v1\(jsonb\)\s+to authenticated, service_role/
    );
  });
});

describe("056 — kind derivation (A–G)", () => {
  test("Complete + exact collectible is balance for every mode", () => {
    assert.equal(
      deriveCollectRequestKind({ jobComplete: true, amountCents: 400000, collectibleCents: 400000 }),
      "balance"
    );
  });

  test("Complete + partial is progress", () => {
    assert.equal(
      deriveCollectRequestKind({ jobComplete: true, amountCents: 200000, collectibleCents: 400000 }),
      "progress"
    );
  });

  test("pre-Complete exact remaining is progress", () => {
    assert.equal(
      deriveCollectRequestKind({ jobComplete: false, amountCents: 400000, collectibleCents: 400000 }),
      "progress"
    );
  });

  test("Collect never derives deposit", () => {
    assert.notEqual(
      deriveCollectRequestKind({ jobComplete: true, amountCents: 400000, collectibleCents: 400000 }),
      "deposit"
    );
    assert.deepEqual(COLLECT_AMOUNT_MODES, ["remaining", "percentage", "fixed"]);
    assert.ok(JOB_PAYMENT_KINDS.includes("progress"));
  });
});

describe("056 — percentage of original contract", () => {
  test("50% of $20,000 is $10,000 even with $2,000 collected", () => {
    assert.equal(
      collectPercentageAmountCents({ contractTotalCents: 2000000, percentageBps: 5000 }),
      1000000
    );
  });

  test("floor rounding is deterministic", () => {
    assert.equal(
      collectPercentageAmountCents({ contractTotalCents: 2000000, percentageBps: 3350 }),
      670000
    );
  });

  test("invalid bps rejected", () => {
    assert.equal(collectPercentageAmountCents({ contractTotalCents: 2000000, percentageBps: 0 }), null);
    assert.equal(collectPercentageAmountCents({ contractTotalCents: 2000000, percentageBps: 10001 }), null);
  });
});

describe("056 — fixed server parse", () => {
  test("decimal strings convert exactly", () => {
    assert.equal(parseCollectFixedAmountToCents("10"), 1000);
    assert.equal(parseCollectFixedAmountToCents("10.5"), 1050);
    assert.equal(parseCollectFixedAmountToCents("10.50"), 1050);
    assert.equal(parseCollectFixedAmountToCents("1250.50"), 125050);
  });

  test("malformed, exponent, negative, extra decimals rejected", () => {
    assert.equal(parseCollectFixedAmountToCents("10.999"), null);
    assert.equal(parseCollectFixedAmountToCents("1e2"), null);
    assert.equal(parseCollectFixedAmountToCents("1E2"), null);
    assert.equal(parseCollectFixedAmountToCents("-10"), null);
    assert.equal(parseCollectFixedAmountToCents("0"), 0);
    assert.equal(parseCollectFixedAmountToCents(""), null);
    assert.equal(parseCollectFixedAmountToCents("abc"), null);
    assert.equal(parseCollectFixedAmountToCents("0.99"), 99);
  });
});

describe("056 — API / UI / copy-link contracts", () => {
  test("collect route rejects kind and client amountCents; parses fixedAmount", () => {
    const route = read("app/api/jobs/[jobId]/payment-requests/collect/route.ts");
    assert.match(route, /body\?\.kind != null/);
    assert.match(route, /body\?\.amountCents != null/);
    assert.match(route, /parseCollectFixedAmountToCents/);
    assert.match(route, /collectJobPaymentViaRpc/);
    assert.doesNotMatch(route, /amountMode: body\.kind/);
  });

  test("cancel route wraps existing RPC", () => {
    const route = read("app/api/jobs/payment-requests/[id]/cancel/route.ts");
    assert.match(route, /cancelJobPaymentRequestViaRpc/);
    assert.match(route, /processing_not_cancellable/);
  });

  test("Copy payment link uses accepted version mint, not send-prep", () => {
    const helper = read("app/lib/jobPaymentPublicLink.server.ts");
    assert.match(helper, /proposal_acceptances/);
    assert.match(helper, /mintProposalPublicAccessToken/);
    assert.doesNotMatch(helper, /from "@\/app\/lib\/proposalPublicReviewLink\.server"/);
    assert.doesNotMatch(helper, /resolveProposalSendSnapshotVersion/);
    assert.doesNotMatch(helper, /freezeDraft/);
    const route = read("app/api/jobs/[jobId]/payment-link/route.ts");
    assert.match(route, /createAcceptedPaymentPublicLink/);
    assert.doesNotMatch(route, /public-review-link/);
  });

  test("Job Card Collect is not the Stage 1 modal or generic POST", () => {
    const hook = read("app/lib/useJobPayments.ts");
    assert.match(hook, /payment-requests\/collect/);
    assert.doesNotMatch(hook, /requestPayment/);
    assert.doesNotMatch(hook, /prefillDepositCents/);
    assert.doesNotMatch(hook, /\/api\/jobs\/payment-requests"/);
    const jobCard = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.doesNotMatch(jobCard, /JobCardRequestPaymentModal/);
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.doesNotMatch(roofing, /JobCardRequestPaymentModal/);
    const sheet = read("app/tools/roofing/jobCard/JobCardCollectPaymentSheet.tsx");
    assert.match(sheet, /role="radiogroup"/);
    assert.match(sheet, /You have .* remaining to collect/);
    const workspaceUi = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    assert.match(workspaceUi, /JOB_CARD_PAYMENTS_COLLECT_CTA/);
    assert.doesNotMatch(workspaceUi, />Next step</);
    assert.doesNotMatch(workspaceUi, /Collect remaining balance/);
  });

  test("Settings Default deposit is gone; Stripe copy remains", () => {
    const settings = read("app/tools/settings/CompanySettingsPaymentsEditor.tsx");
    assert.doesNotMatch(settings, /Default deposit/);
    assert.match(settings, /Customers pay securely through Stripe Checkout/);
    const summary = read("app/lib/companySettingsSummary.ts");
    assert.doesNotMatch(summary, /default deposit/);
    const twoA = read("app/tools/roofing/jobCard/payment-stage-2a-review/page.tsx");
    const twoB = read("app/tools/roofing/jobCard/payment-stage-2b-review/page.tsx");
    assert.match(twoA, /Historical payment-workspace fixture/);
    assert.match(twoB, /Historical payment-workspace fixture/);
    const twoC = read(
      "app/tools/roofing/jobCard/payment-stage-2c-review/PaymentStage2CReviewHarness.tsx"
    );
    assert.match(twoC, /progress-processing/);
    assert.match(twoC, /failed-collect/);
    assert.match(twoC, /onCopyPaymentLink/);
  });

  test("public progress labels and checkout typing", () => {
    assert.equal(checkoutLineLabel("progress"), "Progress payment");
    assert.equal(PUBLIC_PAYMENT_PROGRESS_LABEL, "Progress payment");
    const checkout = read("app/api/public/payment-requests/checkout/route.ts");
    assert.match(checkout, /progress/);
    assert.match(checkout, /not_found/);
    const resolveFirst = checkout.indexOf("resolvePublicJobPaymentCheckoutViaRpc");
    const depositMint = checkout.indexOf("openCanonicalDepositFromAcceptedProposal");
    assert.ok(resolveFirst >= 0 && depositMint > resolveFirst);
    const purchase = read("app/components/proposal-packet/useProposalPurchaseAction.ts");
    assert.match(purchase, /payableNow \|\| requiresDeposit/);
    const vm = buildPublicPaymentViewModel({
      requests: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          job_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          proposal_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          proposal_version_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          proposal_option_id: "11111111-1111-4111-8111-111111111111",
          proposal_acceptance_id: "22222222-2222-4222-8222-222222222222",
          proposal_signature_id: null,
          amount_cents: 1000000,
          currency: "usd",
          kind: "progress",
          accepted_total_cents_snapshot: 2000000,
          option_label_snapshot: "Core",
          provider_account_id: "acct_1",
          provider_checkout_session_id: null,
          status: "open",
          requested_at: "2026-08-27T18:00:00.000Z",
          paid_at: null,
          cancelled_at: null,
        },
      ],
    });
    assert.equal(vm?.kind, "progress");
    assert.equal(vm?.kindLabel, "Progress payment");
    assert.equal(vm?.ctaLabel, "Pay");
  });
});

describe("056 — workspace current request and Collect eligibility", () => {
  test("failed is not current; Collect remains available", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "approved",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 2000000,
      acceptedTotalCents: 2000000,
      requests: [request({ kind: "progress", status: "failed" })],
      transactions: [],
    });
    assert.equal(workspace.currentRequest, null);
    assert.equal(workspace.state, "payment_failed");
    assert.equal(workspace.canCollectPayment, true);
  });

  test("open request suppresses Collect; processing has no cancel in UI", () => {
    const open = buildJobPaymentWorkspace({
      jobStage: "production",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 2000000,
      requests: [request({ status: "open" })],
      transactions: [],
    });
    assert.equal(open.currentRequest?.status, "open");
    assert.equal(open.canCollectPayment, false);

    const processing = buildJobPaymentWorkspace({
      jobStage: "production",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 2000000,
      requests: [request({ status: "processing" })],
      transactions: [],
    });
    assert.equal(processing.currentRequest?.status, "processing");
    assert.equal(processing.canCollectPayment, false);
    const ui = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    assert.match(ui, /current.status === "open"/);
  });

  test("Approved/Production can collect; on_hold presenter uses jobPaymentActive", () => {
    const production = buildJobPaymentWorkspace({
      jobStage: "production",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 2000000,
      requests: [],
      transactions: [],
    });
    assert.equal(production.canCollectPayment, true);
    assert.equal(production.canCollectRemainingBalance, false);

    const held = buildJobPaymentWorkspace({
      jobStage: "production",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 2000000,
      requests: [],
      transactions: [],
      jobPaymentActive: false,
    });
    assert.equal(held.canCollectPayment, false);
  });
});
