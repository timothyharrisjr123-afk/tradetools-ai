/**
 * Payment Stage 1 — proposal payment terms, send readiness, accept/pay,
 * job-level ledger, supersession, payment-method language lock.
 *
 * Run: npx tsx --test app/lib/paymentStage1.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  additionalDepositCents,
  DEFAULT_PROPOSAL_PAYMENT_TERMS,
  formatPaymentTermsCustomerCopy,
  jobPaymentGrossReceivedCents,
  jobPaymentNetReceivedCents,
  jobPaymentRefundedCents,
  jobPaymentRemainingCents,
  PUBLIC_PAY_DEPOSIT_CTA,
  PUBLIC_PAY_REMAINING_BALANCE_CTA,
  resolveDepositObligationCents,
  SETTINGS_PAYMENTS_STRIPE_COPY,
  termsRequireOnlineDeposit,
} from "./proposalPaymentTerms";
import { resolveOnlineDepositSendReadiness } from "./proposalPaymentSendReadiness";
import {
  buildProposalSendGateReadinessViewModel,
  isSendPrepReadinessBlocking,
} from "./proposalSendGateReadiness";
import {
  buildPublicPaymentViewModel,
  publicPaymentTitle,
} from "./jobPaymentReadModel";
import {
  formatStripePaymentMethodDisplay,
  stripePaymentMethodFromObject,
} from "./jobPaymentMethodDisplay";
import type { ProposalSendFreezeReadiness } from "./proposalSendFreezeReadiness";

const ROOT = process.cwd();
const SQL_044 = join(ROOT, "supabase/migrations/20260816_044_job_payments.sql");
const SQL_047 = join(ROOT, "supabase/migrations/20260823_047_job_work_complete.sql");
const SQL_048 = join(
  ROOT,
  "supabase/migrations/20260826_048_proposal_payment_terms_and_job_ledger.sql"
);
const SQL_047_SHA =
  "FFE33FDD562742519BB92568CD5C55528537EA756540D1C6C906F8694B974979";

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function readySendFreeze(): ProposalSendFreezeReadiness {
  return {
    ready: true,
    blockingReasons: [],
    warnings: [],
    summary: {
      scopeSummary: { hiddenLineCount: 0, excludedLineCount: 0, hiddenPageCount: 0 },
      selectedTemplateOptionId: "opt-a",
      pricingComplete: true,
      blockingLineCount: 0,
      estimatePagePresent: true,
      customerVisiblePageCount: 2,
      hasLatestSentVersion: true,
      displaySettingsResolvable: true,
    },
  };
}

describe("Payment Stage 1 migration lock", () => {
  test("048 exists; 039 absent; 044 and 047 hashes unchanged", () => {
    assert.equal(existsSync(SQL_048), true);
    const migrations = readdirSync(join(ROOT, "supabase/migrations"));
    assert.ok(!migrations.some((name) => name.includes("_039_")));
    assert.equal(existsSync(SQL_044), true);
    const sha047 = createHash("sha256").update(readFileSync(SQL_047)).digest("hex").toUpperCase();
    assert.equal(sha047, SQL_047_SHA);
    const sql044 = readFileSync(SQL_044, "utf8");
    assert.match(sql044, /create or replace function public\.create_job_payment_request_v1/);
    assert.match(sql044, /job_not_approved/);
  });

  test("048 is additive terms + ledger and replaces live request/checkout", () => {
    const sql = readFileSync(SQL_048, "utf8");
    assert.match(sql, /proposal_version_payment_terms/);
    assert.match(sql, /job_payment_net_received_cents_v1/);
    assert.match(sql, /job_payment_additional_deposit_cents_v1/);
    assert.match(sql, /open_job_deposit_from_acceptance_v1/);
    assert.match(sql, /create or replace function public\.create_job_payment_request_v1/);
    assert.doesNotMatch(sql, /job_not_approved/);
    assert.match(sql, /Approve is lifecycle only/);
    assert.match(sql, /code', 'superseded'/);
    assert.doesNotMatch(sql, /create or replace function public\.persist_proposal_send_freeze_v1/);
  });
});

describe("PAYMENT TERMS", () => {
  test("default none", () => {
    assert.equal(DEFAULT_PROPOSAL_PAYMENT_TERMS.depositMode, "none");
    assert.equal(termsRequireOnlineDeposit(DEFAULT_PROPOSAL_PAYMENT_TERMS), false);
    const copy = formatPaymentTermsCustomerCopy(DEFAULT_PROPOSAL_PAYMENT_TERMS);
    assert.match(copy.depositLine, /No deposit required/);
    assert.match(copy.balanceLine, /completion/i);
  });

  test("default percent and fixed resolve cents", () => {
    assert.equal(
      resolveDepositObligationCents({
        mode: "percent",
        percentBps: 3000,
        fixedCents: null,
        acceptedTotalCents: 1500000,
      }),
      450000
    );
    assert.equal(
      resolveDepositObligationCents({
        mode: "fixed",
        percentBps: null,
        fixedCents: 300000,
        acceptedTotalCents: 1500000,
      }),
      300000
    );
  });

  test("public copy for percent, fixed, none", () => {
    assert.match(
      formatPaymentTermsCustomerCopy(
        { ...DEFAULT_PROPOSAL_PAYMENT_TERMS, depositMode: "percent", depositPercentBps: 3000 },
        1000000
      ).depositLine,
      /30% deposit \(\$3,000\.00\) due upon agreement/
    );
    assert.match(
      formatPaymentTermsCustomerCopy({
        ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
        depositMode: "fixed",
        depositFixedCents: 300000,
      }).depositLine,
      /\$3,000\.00 deposit due upon agreement/
    );
  });
});

describe("SEND READINESS", () => {
  test("no deposit → Send unaffected", () => {
    const readiness = resolveOnlineDepositSendReadiness({
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      chargesEnabled: false,
    });
    assert.equal(readiness.blocked, false);
    assert.equal(
      isSendPrepReadinessBlocking({
        sendFreezeReadiness: readySendFreeze(),
        previewReadiness: { blockingLineCount: 0, pricingComplete: true },
        recipientEmail: "jane@example.com",
        paymentTerms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
        chargesEnabled: false,
      }),
      false
    );
  });

  test("online deposit + charge-enabled → Send allowed", () => {
    const terms = {
      ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
      depositMode: "percent" as const,
      depositPercentBps: 3000,
    };
    assert.equal(
      resolveOnlineDepositSendReadiness({ terms, chargesEnabled: true }).blocked,
      false
    );
  });

  test("unknown terms → Send blocked (fail-closed)", () => {
    const readiness = resolveOnlineDepositSendReadiness({
      terms: null,
      chargesEnabled: true,
      termsKnown: false,
    });
    assert.equal(readiness.blocked, true);
    assert.equal(readiness.termsKnown, false);
    assert.match(readiness.message ?? "", /could not be verified/i);
  });

  test("online deposit + not connected → Send blocked", () => {
    const terms = {
      ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
      depositMode: "fixed" as const,
      depositFixedCents: 300000,
    };
    const readiness = resolveOnlineDepositSendReadiness({
      terms,
      chargesEnabled: false,
    });
    assert.equal(readiness.blocked, true);
    const vm = buildProposalSendGateReadinessViewModel({
      hasSentSnapshot: true,
      sendFreezeReadiness: readySendFreeze(),
      previewReadiness: { blockingLineCount: 0, pricingComplete: true, warnings: [] },
      recipientEmail: "jane@example.com",
      customerFirstName: "Jane",
      companyName: "Summit Roofing",
      projectAddress: null,
      emailDeliveryConfigured: true,
      paymentTerms: terms,
      chargesEnabled: false,
    });
    assert.equal(vm.canSend, false);
    assert.equal(vm.canPrepareCustomerLink, false);
    assert.equal(vm.paymentsSetupRequired, true);
    assert.match(vm.disabledReason, /Connect payments/);
  });
});

describe("ACCEPT/PAY and ledger", () => {
  test("additional deposit counts net received toward revision terms", () => {
    const terms = {
      ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
      depositMode: "percent" as const,
      depositPercentBps: 3000,
    };
    assert.equal(
      additionalDepositCents({
        terms,
        acceptedTotalCents: 1700000,
        netReceivedCents: 500000,
      }),
      10000
    );
    assert.equal(
      additionalDepositCents({
        terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
        acceptedTotalCents: 1700000,
        netReceivedCents: 500000,
      }),
      0
    );
  });

  test("pending and failed captures are excluded from received", () => {
    const rows = [
      { kind: "capture", status: "succeeded", amount_cents: 500000 },
      { kind: "capture", status: "failed", amount_cents: 500000 },
      { kind: "refund", status: "refunded", amount_cents: 100000 },
    ];
    assert.equal(jobPaymentGrossReceivedCents(rows), 500000);
    assert.equal(jobPaymentRefundedCents(rows), 100000);
    assert.equal(jobPaymentNetReceivedCents({ transactions: rows }), 400000);
    assert.equal(
      jobPaymentRemainingCents({
        contractualTotalCents: 1700000,
        netReceivedCents: 400000,
      }),
      1300000
    );
  });

  test("Pay CTA is method-agnostic", () => {
    assert.equal(PUBLIC_PAY_DEPOSIT_CTA, "Pay deposit");
    assert.equal(PUBLIC_PAY_REMAINING_BALANCE_CTA, "Pay remaining balance");
    const due = buildPublicPaymentViewModel({
      requests: [
        {
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
          kind: "deposit",
          accepted_total_cents_snapshot: 1850000,
          option_label_snapshot: "Premium",
          provider_account_id: "acct_test",
          provider_checkout_session_id: null,
          status: "open",
          requested_at: "2026-08-16T12:00:00.000Z",
          paid_at: null,
          cancelled_at: null,
        },
      ],
    });
    assert.equal(due?.ctaLabel, "Pay deposit");
    assert.doesNotMatch(due?.ctaLabel ?? "", /card|debit|ACH|Cash App/i);
  });

  test("pending ACH is never Received", () => {
    const pending = buildPublicPaymentViewModel({
      requests: [
        {
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
          kind: "deposit",
          accepted_total_cents_snapshot: 1850000,
          option_label_snapshot: "Premium",
          provider_account_id: "acct_test",
          provider_checkout_session_id: null,
          status: "processing",
          requested_at: "2026-08-16T12:00:00.000Z",
          paid_at: null,
          cancelled_at: null,
        },
      ],
    });
    assert.equal(pending?.state, "pending");
    assert.equal(publicPaymentTitle("pending", "deposit"), "Deposit pending");
    assert.notEqual(publicPaymentTitle("pending", "deposit"), "Deposit received");
  });

  test("authoritative method may display after payment", () => {
    assert.equal(
      formatStripePaymentMethodDisplay({ type: "card", brand: "visa", last4: "4242" }),
      "Visa •••• 4242"
    );
    assert.equal(
      formatStripePaymentMethodDisplay({ type: "cashapp" }),
      "Cash App Pay"
    );
    assert.equal(
      formatStripePaymentMethodDisplay({ type: "us_bank_account", last4: "6789" }),
      "Bank payment •••• 6789"
    );
    const fromObject = stripePaymentMethodFromObject({
      payment_method_details: { type: "card", card: { brand: "visa", last4: "4242" } },
    });
    assert.equal(formatStripePaymentMethodDisplay(fromObject), "Visa •••• 4242");
  });
});

describe("architecture source locks", () => {
  test("Checkout prefers Stripe-managed methods with card fallback", () => {
    const stripe = read("app/lib/jobPaymentStripe.server.ts");
    assert.match(stripe, /automatic_payment_methods: \{ enabled: true \}/);
    assert.match(stripe, /payment_method_types: \["card"\]/);
    assert.doesNotMatch(stripe, /cashapp/);
    assert.doesNotMatch(stripe, /payment_method_types: \["card", "us_bank_account"\]/);
  });

  test("Accept and sign open deposit after success", () => {
    assert.match(read("app/api/proposals/accept/route.ts"), /openJobDepositFromAcceptanceViaAdmin/);
    assert.match(read("app/api/proposals/sign/route.ts"), /openJobDepositFromAcceptanceViaAdmin/);
  });

  test("Settings copy does not fake method lists", () => {
    const settings = read("app/tools/settings/payments/SettingsPaymentsClient.tsx");
    assert.doesNotMatch(settings, /Credit card \+ ACH enabled/);
    assert.match(settings, /Stripe Checkout/);
    assert.match(SETTINGS_PAYMENTS_STRIPE_COPY, /Stripe Checkout/);
  });

  test("Board and Calendar stay free of payment chrome", () => {
    const board = read("app/tools/roofing/saved/jobsBoardUtils.ts");
    assert.doesNotMatch(board, /deposit badge|paid badge|balance badge/i);
    const calendar = read("app/tools/roofing/calendar/page.tsx");
    assert.doesNotMatch(calendar, /Pay deposit|Deposit due/);
  });

  test("packet shows terms and a single Pay control", () => {
    const packet = read("app/components/proposal-packet/ProposalPacket.tsx");
    assert.match(packet, /ProposalPaymentTermsBlock/);
    assert.equal((packet.match(/<ProposalPacketPayment/g) ?? []).length, 1);
    assert.doesNotMatch(packet, /variant="banner"/);
  });

  test("Builder and Preview host payment terms", () => {
    assert.match(
      read("app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"),
      /ProposalBuilderPaymentTerms/
    );
    assert.match(
      read("app/tools/roofing/proposals/preview/ProposalCustomerPreviewDocument.tsx"),
      /ProposalPaymentTermsBlock/
    );
  });
});
