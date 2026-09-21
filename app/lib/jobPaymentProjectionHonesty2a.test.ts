/**
 * Phase 2A — Financial projection honesty.
 *
 * UNKNOWN ≠ ZERO ≠ NO PAYMENT REQUIRED
 * PROCESSING ≠ FAILED
 *
 * Run: npx tsx --test app/lib/jobPaymentProjectionHonesty2a.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  formatKnownUsdFromCents,
  formatUsdFromCents,
  remainingAcceptedCents,
} from "@/app/lib/jobPaymentMoney";
import {
  JOB_PAYMENT_INFORMATION_UNAVAILABLE,
  PUBLIC_PAYMENT_NO_ACTIVE_REQUEST,
  PUBLIC_PAYMENT_NO_PAYMENT_REQUIRED,
} from "@/app/lib/jobPaymentTypes";
import {
  buildPublicPaymentViewModel,
} from "@/app/lib/jobPaymentCustomerPresenter";
import {
  buildJobPaymentWorkspace,
  jobPaymentCollectibleRemainingCents,
  type JobPaymentWorkspaceRequest,
  type JobPaymentWorkspaceTransaction,
} from "@/app/lib/jobPaymentWorkspace";
import type { JobPaymentRequestRow } from "@/app/lib/jobPaymentReadModel";

const ACCOUNT = {
  company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  provider: "stripe" as const,
  provider_account_id: "acct_t",
  charges_enabled: true,
  details_submitted: true,
  updated_at: "2026-01-01T00:00:00.000Z",
};

function req(
  partial: Partial<JobPaymentWorkspaceRequest> &
    Pick<JobPaymentWorkspaceRequest, "id" | "kind" | "status" | "amount_cents">
): JobPaymentWorkspaceRequest {
  return {
    requested_at: "2026-01-01T00:00:00.000Z",
    paid_at: null,
    settled_payment_method_label: null,
    cancelled_at: null,
    ...partial,
  };
}

function txn(
  partial: Partial<JobPaymentWorkspaceTransaction> &
    Pick<
      JobPaymentWorkspaceTransaction,
      "id" | "payment_request_id" | "kind" | "status" | "amount_cents"
    >
): JobPaymentWorkspaceTransaction {
  return {
    occurred_at: "2026-01-02T00:00:00.000Z",
    provider_event_id: "evt_1",
    provider_payment_intent_id: "pi_1",
    ...partial,
  };
}

function asRequestRow(
  row: JobPaymentWorkspaceRequest & { proposal_version_id?: string }
): JobPaymentRequestRow {
  return {
    id: row.id,
    company_id: ACCOUNT.company_id,
    job_id: "jjjjjjjj-jjjj-4jjj-8jjj-jjjjjjjjjjjj",
    proposal_id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    proposal_version_id: row.proposal_version_id ?? "vvvvvvvv-vvvv-4vvv-8vvv-vvvvvvvvvvvv",
    proposal_option_id: null,
    proposal_acceptance_id: null,
    proposal_signature_id: null,
    amount_cents: row.amount_cents,
    currency: "usd",
    kind: row.kind,
    accepted_total_cents_snapshot: 2000000,
    option_label_snapshot: null,
    provider_account_id: ACCOUNT.provider_account_id,
    provider_checkout_session_id: null,
    status: row.status,
    requested_at: row.requested_at,
    paid_at: row.paid_at,
    cancelled_at: row.cancelled_at ?? null,
    settled_payment_method_label: row.settled_payment_method_label,
  };
}

describe("Phase 2A — money formatter honesty", () => {
  test("invalid formatter input does not fabricate $0.00", () => {
    assert.equal(formatUsdFromCents(Number.NaN), "—");
    assert.equal(formatUsdFromCents(12.5), "—");
    assert.equal(formatKnownUsdFromCents(null), null);
    assert.equal(formatKnownUsdFromCents(undefined), null);
    assert.equal(formatKnownUsdFromCents(Number.NaN), null);
    assert.match(formatUsdFromCents(0), /\$0\.00/);
    assert.match(formatUsdFromCents(2000000), /\$20,000\.00/);
  });

  test("remainingAcceptedCents keeps invalid inputs unknown", () => {
    assert.equal(
      remainingAcceptedCents({
        acceptedTotalCents: Number.NaN,
        netPaidCents: 0,
      }),
      null
    );
    assert.equal(
      remainingAcceptedCents({
        acceptedTotalCents: 1000,
        netPaidCents: 250,
      }),
      750
    );
  });
});

describe("Phase 2A — collectible remaining", () => {
  test("null contract → unavailable remaining (not 0)", () => {
    assert.equal(
      jobPaymentCollectibleRemainingCents({
        contractTotalCents: null,
        receivedGrossCents: 0,
      }),
      null
    );
  });

  test("known zero contract → remaining 0", () => {
    assert.equal(
      jobPaymentCollectibleRemainingCents({
        contractTotalCents: 0,
        receivedGrossCents: 0,
      }),
      0
    );
  });
});

describe("Phase 2A — workspace states", () => {
  test("1 contract unavailable when accepted without totals", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "proposal",
      accepted: true,
      account: ACCOUNT,
      requests: [],
      transactions: [],
      acceptedTotalCents: null,
      customerChosenTotalCents: null,
    });
    assert.equal(workspace.state, "contract_unavailable");
    assert.equal(workspace.collectibleRemainingCents, null);
    assert.equal(workspace.statusLabel, JOB_PAYMENT_INFORMATION_UNAVAILABLE);
    assert.equal(workspace.overviewStatusLabel, JOB_PAYMENT_INFORMATION_UNAVAILABLE);
    assert.doesNotMatch(workspace.statusLabel, /\$0|No payment required/i);
  });

  test("2 known zero contract → No payment required", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "proposal",
      accepted: true,
      account: ACCOUNT,
      requests: [],
      transactions: [],
      acceptedTotalCents: 0,
    });
    assert.equal(workspace.state, "no_payment_required");
    assert.equal(workspace.statusLabel, PUBLIC_PAYMENT_NO_PAYMENT_REQUIRED);
    assert.equal(workspace.collectibleRemainingCents, 0);
  });

  test("3 positive remaining + not due + no request → Balance remaining", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "proposal",
      accepted: true,
      account: ACCOUNT,
      requests: [],
      transactions: [],
      acceptedTotalCents: 2_000_000,
      terms: {
        depositMode: "none",
        depositPercentBps: null,
        depositFixedCents: null,
        balanceDue: "on_completion",
      },
    });
    assert.equal(workspace.state, "balance_not_yet_due");
    assert.equal(workspace.collectibleRemainingCents, 2_000_000);
    assert.equal(
      workspace.statusLabel,
      "Balance remaining · No active payment request"
    );
    assert.equal(workspace.overviewStatusLabel, "Balance remaining");
    assert.doesNotMatch(workspace.statusLabel, /Balance due/i);
    assert.doesNotMatch(workspace.statusLabel, /^No payment required$/i);
    assert.equal(workspace.currentRequest, null);
  });

  test("3b canonically due + no request → Balance due", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      requests: [],
      transactions: [],
      acceptedTotalCents: 2_000_000,
      terms: {
        depositMode: "none",
        depositPercentBps: null,
        depositFixedCents: null,
        balanceDue: "on_completion",
      },
    });
    assert.equal(workspace.state, "balance_due");
    assert.equal(workspace.collectibleRemainingCents, 2_000_000);
    assert.equal(
      workspace.statusLabel,
      "Balance due · No active payment request"
    );
    assert.equal(workspace.overviewStatusLabel, "Balance due");
    assert.doesNotMatch(workspace.statusLabel, /Balance remaining/i);
    assert.equal(workspace.currentRequest, null);
  });

  test("4 open request → requested", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "proposal",
      accepted: true,
      account: ACCOUNT,
      requests: [
        req({
          id: "r1",
          kind: "deposit",
          status: "open",
          amount_cents: 200_000,
        }),
      ],
      transactions: [],
      acceptedTotalCents: 2_000_000,
      terms: {
        depositMode: "percent",
        depositPercentBps: 1000,
        depositFixedCents: null,
        balanceDue: "on_completion",
      },
    });
    assert.equal(workspace.state, "deposit_due");
    assert.equal(workspace.currentRequest?.status, "open");
    assert.equal(workspace.currentRequest?.amountCents, 200_000);
  });

  test("5 processing → Payment processing labels", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "proposal",
      accepted: true,
      account: ACCOUNT,
      requests: [
        req({
          id: "r1",
          kind: "deposit",
          status: "processing",
          amount_cents: 200_000,
        }),
      ],
      transactions: [],
      acceptedTotalCents: 2_000_000,
    });
    assert.equal(workspace.state, "deposit_processing");
    assert.match(workspace.statusLabel, /processing/i);
    assert.doesNotMatch(workspace.statusLabel, /failed/i);
  });

  test("6 confirmed failed request", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "proposal",
      accepted: true,
      account: ACCOUNT,
      requests: [
        req({
          id: "r1",
          kind: "deposit",
          status: "failed",
          amount_cents: 200_000,
        }),
      ],
      transactions: [],
      acceptedTotalCents: 2_000_000,
      terms: {
        depositMode: "percent",
        depositPercentBps: 1000,
        depositFixedCents: null,
        balanceDue: "on_completion",
      },
    });
    assert.equal(workspace.state, "payment_failed");
    assert.equal(workspace.statusLabel, "Payment failed");
  });

  test("7–8 partial then fully collected", () => {
    const partial = buildJobPaymentWorkspace({
      jobStage: "proposal",
      accepted: true,
      account: ACCOUNT,
      requests: [
        req({
          id: "r1",
          kind: "deposit",
          status: "paid",
          amount_cents: 200_000,
          paid_at: "2026-01-02T00:00:00.000Z",
        }),
      ],
      transactions: [
        txn({
          id: "t1",
          payment_request_id: "r1",
          kind: "capture",
          status: "succeeded",
          amount_cents: 200_000,
        }),
      ],
      acceptedTotalCents: 2_000_000,
      terms: {
        depositMode: "percent",
        depositPercentBps: 1000,
        depositFixedCents: null,
        balanceDue: "on_completion",
      },
    });
    assert.ok(
      partial.state === "deposit_received" || partial.state === "partially_paid"
    );
    assert.equal(partial.receivedGrossCents, 200_000);
    assert.equal(partial.collectibleRemainingCents, 1_800_000);

    const full = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      requests: [
        req({
          id: "r1",
          kind: "deposit",
          status: "paid",
          amount_cents: 2_000_000,
          paid_at: "2026-01-02T00:00:00.000Z",
        }),
      ],
      transactions: [
        txn({
          id: "t1",
          payment_request_id: "r1",
          kind: "capture",
          status: "succeeded",
          amount_cents: 2_000_000,
        }),
      ],
      acceptedTotalCents: 2_000_000,
    });
    assert.equal(full.state, "paid_in_full");
    assert.equal(full.collectibleRemainingCents, 0);
  });

  test("9–10 refund does not reopen collectible", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      requests: [
        req({
          id: "r1",
          kind: "balance",
          status: "paid",
          amount_cents: 2_000_000,
          paid_at: "2026-01-02T00:00:00.000Z",
        }),
      ],
      transactions: [
        txn({
          id: "t1",
          payment_request_id: "r1",
          kind: "capture",
          status: "succeeded",
          amount_cents: 2_000_000,
        }),
      ],
      refunds: [
        {
          id: "rf1",
          company_id: ACCOUNT.company_id,
          job_id: "jjjjjjjj-jjjj-4jjj-8jjj-jjjjjjjjjjjj",
          payment_request_id: "r1",
          canonical_capture_transaction_id: "t1",
          amount_cents: 500_000,
      currency: "usd",
      status: "succeeded",
      initiated_at: "2026-01-03T00:00:00.000Z",
      pending_at: null,
      succeeded_at: "2026-01-03T00:01:00.000Z",
      failed_at: null,
      canceled_at: null,
      requires_action_at: null,
      created_at: "2026-01-03T00:00:00.000Z",
      updated_at: "2026-01-03T00:01:00.000Z",
        },
      ],
      acceptedTotalCents: 2_000_000,
    });
    assert.equal(workspace.receivedGrossCents, 2_000_000);
    assert.equal(workspace.refundedCents, 500_000);
    assert.equal(workspace.collectibleRemainingCents, 0);
    assert.ok(workspace.refundedCents > 0);
    assert.ok(
      workspace.state === "payments_complete" || workspace.state === "paid_in_full"
    );
    const refundEvent = workspace.timeline.find((e) => e.type === "refund");
    assert.ok(refundEvent, "refund history row presented");
    assert.equal(refundEvent?.amountCents, 500_000);
  });
});

describe("Phase 2A — public presenter", () => {
  test("15 positive balance / no request is not No payment required", () => {
    const view = buildPublicPaymentViewModel({
      requests: [],
      transactions: [],
      accepted: true,
      contractTotalCents: 2_000_000,
      terms: {
        depositMode: "none",
        depositPercentBps: null,
        depositFixedCents: null,
        balanceDue: "on_completion",
      },
    });
    assert.equal(view?.state, "no_active_request");
    assert.equal(view?.heading, PUBLIC_PAYMENT_NO_ACTIVE_REQUEST);
    assert.equal(view?.kindLabel, "Remaining balance");
    assert.equal(view?.amountLabel, "$20,000.00");
    assert.doesNotMatch(view?.heading ?? "", /No payment required/i);
    assert.doesNotMatch(view?.heading ?? "", /No payment is due right now/i);
  });

  test("16 known zero → No payment required", () => {
    const view = buildPublicPaymentViewModel({
      requests: [],
      transactions: [],
      accepted: true,
      contractTotalCents: 0,
      terms: {
        depositMode: "none",
        depositPercentBps: null,
        depositFixedCents: null,
        balanceDue: "on_completion",
      },
    });
    assert.equal(view?.state, "no_payment_due");
    assert.equal(view?.heading, PUBLIC_PAYMENT_NO_PAYMENT_REQUIRED);
    assert.equal(view?.amountLabel, null);
  });

  test("17 processing is not failed", () => {
    const view = buildPublicPaymentViewModel({
      requests: [
        asRequestRow(
          req({
            id: "r1",
            kind: "deposit",
            status: "processing",
            amount_cents: 200_000,
          })
        ),
      ],
      accepted: true,
      contractTotalCents: 2_000_000,
    });
    assert.equal(view?.state, "processing");
    assert.match(view?.heading ?? "", /processing/i);
  });

  test("contract unavailable on public", () => {
    const view = buildPublicPaymentViewModel({
      requests: [],
      accepted: true,
      contractTotalCents: null,
    });
    assert.equal(view?.state, "payment_unavailable");
    assert.equal(view?.heading, JOB_PAYMENT_INFORMATION_UNAVAILABLE);
  });
});
