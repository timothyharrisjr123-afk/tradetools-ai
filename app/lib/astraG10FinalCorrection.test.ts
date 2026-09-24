/**
 * Phase 11 final correction — public current-contract truth + email action wording.
 *
 * Run: npx tsx --test app/lib/astraG10FinalCorrection.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildPublicContractSummary,
  buildPublicPaymentViewModel,
} from "./jobPaymentCustomerPresenter";
import type { JobPaymentRequestRow } from "./jobPaymentReadModel";
import {
  PAYMENT_REQUEST_EMAIL_ACTION_LABELS,
  resolvePaymentRequestEmailAction,
} from "./jobPaymentRequestEmailAction";
import type { ProposalPaymentTerms } from "./proposalPaymentTerms";

const ROOT = process.cwd();
const VERSION = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ACCEPTANCE = "22222222-2222-4222-8222-222222222222";

const NONE_TERMS: ProposalPaymentTerms = {
  depositMode: "none",
  depositPercentBps: null,
  depositFixedCents: null,
  depositDueTrigger: "on_acceptance",
  balanceDueTrigger: "on_completion",
};

function progressRequest(
  overrides: Partial<JobPaymentRequestRow> = {}
): JobPaymentRequestRow {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    job_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    proposal_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    proposal_version_id: VERSION,
    proposal_option_id: "11111111-1111-4111-8111-111111111111",
    proposal_acceptance_id: ACCEPTANCE,
    proposal_signature_id: null,
    amount_cents: 45000,
    currency: "usd",
    kind: "progress",
    accepted_total_cents_snapshot: 1850000,
    option_label_snapshot: "Premium",
    provider_account_id: "acct_1",
    provider_checkout_session_id: null,
    status: "open",
    requested_at: "2026-09-24T18:00:00.000Z",
    paid_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function attempt(status: string, attemptNumber: number) {
  return { status, attemptNumber };
}

describe("Phase 11 final — email action from durable delivery history", () => {
  test("A: no attempts → Email request", () => {
    const action = resolvePaymentRequestEmailAction([]);
    assert.equal(action, "email");
    assert.equal(PAYMENT_REQUEST_EMAIL_ACTION_LABELS[action], "Email request");
  });

  test("B: provider rejected / never submitted → Retry email", () => {
    for (const status of ["failed", "attempted", "prepared"]) {
      const action = resolvePaymentRequestEmailAction([attempt(status, 1)]);
      assert.equal(action, "retry", status);
      assert.equal(PAYMENT_REQUEST_EMAIL_ACTION_LABELS[action], "Retry email");
    }
  });

  test("C: submitted or delivered → Resend email", () => {
    for (const status of ["provider_accepted", "delayed", "delivered"]) {
      const action = resolvePaymentRequestEmailAction([attempt(status, 1)]);
      assert.equal(action, "resend", status);
      assert.equal(PAYMENT_REQUEST_EMAIL_ACTION_LABELS[action], "Resend email");
    }
  });

  test("D: bounced (actually submitted) → Resend email", () => {
    assert.equal(resolvePaymentRequestEmailAction([attempt("bounced", 1)]), "resend");
    assert.equal(resolvePaymentRequestEmailAction([attempt("complained", 1)]), "resend");
  });

  test("latest attempt by attemptNumber wins, regardless of array order", () => {
    assert.equal(
      resolvePaymentRequestEmailAction([attempt("failed", 3), attempt("delivered", 1)]),
      "retry"
    );
    assert.equal(
      resolvePaymentRequestEmailAction([attempt("failed", 1), attempt("delivered", 2)]),
      "resend"
    );
  });

  test("Job Card wires the resolver; retry and resend both reuse the same request", () => {
    const src = readFileSync(
      join(ROOT, "app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx"),
      "utf8"
    );
    assert.match(src, /resolvePaymentRequestEmailAction\(deliveryAttempts\)/);
    assert.match(src, /PAYMENT_REQUEST_EMAIL_ACTION_LABELS\[emailAction\]/);
    assert.match(src, /resend: emailAction !== "email"/);
    assert.match(src, /data-jobcard-payments-email-retry-hint/);
    assert.match(src, /This payment request is still open/);
  });

  test("resolver module is client-safe (no node: imports)", () => {
    const src = readFileSync(join(ROOT, "app/lib/jobPaymentRequestEmailAction.ts"), "utf8");
    assert.doesNotMatch(src, /from "node:/);
  });
});

describe("Phase 11 final — public current-contract truth", () => {
  test("summary: $18,500 original + $450 authorized = $18,950 current", () => {
    const summary = buildPublicContractSummary({
      originalAgreementCents: 1850000,
      currentContractCents: 1895000,
    });
    assert.ok(summary);
    assert.equal(summary.originalAgreementLabel, "$18,500.00");
    assert.equal(summary.authorizedChangesLabel, "+$450.00");
    assert.equal(summary.currentContractLabel, "$18,950.00");
  });

  test("summary: no clutter when there are no authorized changes or data is missing", () => {
    assert.equal(
      buildPublicContractSummary({ originalAgreementCents: 1850000, currentContractCents: 1850000 }),
      null
    );
    assert.equal(
      buildPublicContractSummary({ originalAgreementCents: 1850000, currentContractCents: null }),
      null
    );
    assert.equal(
      buildPublicContractSummary({ originalAgreementCents: undefined, currentContractCents: 1895000 }),
      null
    );
  });

  test("summary: negative authorized change renders a minus delta", () => {
    const summary = buildPublicContractSummary({
      originalAgreementCents: 1850000,
      currentContractCents: 1800000,
    });
    assert.ok(summary);
    assert.equal(summary.authorizedChangesLabel, "−$500.00");
  });

  test("public VM: frozen $450 request + current contract summary, snapshot untouched", () => {
    const req = progressRequest();
    const before = JSON.stringify(req);
    const vm = buildPublicPaymentViewModel({
      accepted: true,
      terms: NONE_TERMS,
      contractTotalCents: 1895000,
      originalAgreementCents: 1850000,
      proposalVersionId: VERSION,
      acceptanceId: ACCEPTANCE,
      requests: [req],
    });
    assert.ok(vm);
    assert.equal(vm.amountLabel, "$450.00");
    assert.ok(vm.contractSummary);
    assert.equal(vm.contractSummary.originalAgreementLabel, "$18,500.00");
    assert.equal(vm.contractSummary.currentContractLabel, "$18,950.00");
    assert.equal(JSON.stringify(req), before);
    assert.equal(req.accepted_total_cents_snapshot, 1850000);
  });

  test("public VM: normal job with no scope changes has no contract summary", () => {
    const vm = buildPublicPaymentViewModel({
      accepted: true,
      terms: NONE_TERMS,
      contractTotalCents: 1850000,
      originalAgreementCents: 1850000,
      proposalVersionId: VERSION,
      acceptanceId: ACCEPTANCE,
      requests: [progressRequest()],
    });
    assert.ok(vm);
    assert.equal(vm.contractSummary, null);
  });

  test("public VM: not accepted → no contract summary", () => {
    const vm = buildPublicPaymentViewModel({
      accepted: false,
      terms: NONE_TERMS,
      contractTotalCents: 1895000,
      originalAgreementCents: 1850000,
      proposalVersionId: VERSION,
      acceptanceId: ACCEPTANCE,
      requests: [],
    });
    assert.equal(vm?.contractSummary ?? null, null);
  });

  test("public loader reads the Phase 10 rollup and keeps the option total as original", () => {
    const src = readFileSync(
      join(ROOT, "app/lib/proposalPublicAccessOrchestrator.server.ts"),
      "utf8"
    );
    assert.match(src, /fetchJobContractTotalCents\(/);
    assert.match(src, /customer_chosen_total_cents,accepted_total_cents/);
    assert.match(src, /acceptance\?\.contractTotalCents \?\? selectedTotalCents/);
    assert.match(src, /contractTotalCents: currentContractCents \?\? originalAgreementCents/);
  });

  test("public purchase panel renders the summary rows", () => {
    const src = readFileSync(
      join(ROOT, "app/components/proposal-packet/ProposalPacketPurchase.tsx"),
      "utf8"
    );
    assert.match(src, /data-public-contract-summary/);
    assert.match(src, /data-public-current-contract/);
    assert.match(src, /PUBLIC_PAYMENT_ORIGINAL_AGREEMENT_LABEL/);
    assert.match(src, /PUBLIC_PAYMENT_CURRENT_CONTRACT_LABEL/);
  });
});
