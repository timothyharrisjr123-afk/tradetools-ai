import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { hasCompanyCapability } from "@/app/lib/companyMembershipRoles";
import { buildJobCardCloseoutViewModel } from "@/app/lib/jobCardCloseoutViewModel";
import { buildPublicPaymentViewModel } from "@/app/lib/jobPaymentCustomerPresenter";
import type {
  JobPaymentRefundRow,
  JobPaymentRequestRow,
  JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";
import {
  PUBLIC_PAYMENT_PAID_IN_FULL_EXPLANATION,
  PUBLIC_PAYMENT_PAID_IN_FULL_PROJECT_EXPLANATION,
  PUBLIC_PAYMENT_PAYMENTS_COMPLETE_PROJECT_EXPLANATION,
} from "@/app/lib/jobPaymentTypes";
import { publicSafeMediaUrl } from "@/app/lib/proposalCustomerPacketPresenter";
import {
  buildPublicProjectRecordViewModel,
  formatProjectRecordDate,
  PUBLIC_PROJECT_RECORD_MONEY_UNAVAILABLE,
  type BuildPublicProjectRecordInput,
  type PublicProjectRecordScopeChangeInput,
} from "@/app/lib/publicProjectRecordViewModel";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const COMPANY = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const OTHER_JOB = "33333333-3333-4333-8333-333333333333";
const TZ = "America/Los_Angeles";

function request(over: Partial<JobPaymentRequestRow> = {}): JobPaymentRequestRow {
  return {
    id: "req-1",
    company_id: COMPANY,
    job_id: JOB,
    proposal_id: "p",
    proposal_version_id: "v",
    proposal_option_id: "o",
    proposal_acceptance_id: "a",
    proposal_signature_id: null,
    amount_cents: 300_000,
    currency: "usd",
    kind: "deposit",
    accepted_total_cents_snapshot: 1_000_000,
    option_label_snapshot: "Core",
    provider_account_id: "acct",
    provider_checkout_session_id: null,
    status: "paid",
    requested_at: "2026-09-01T16:00:00.000Z",
    paid_at: "2026-09-02T16:00:00.000Z",
    cancelled_at: null,
    ...over,
  };
}

function capture(id: string, cents: number, requestId = "req-1"): JobPaymentTransactionRow {
  return {
    id,
    payment_request_id: requestId,
    kind: "capture",
    status: "succeeded",
    amount_cents: cents,
    occurred_at: "2026-09-02T16:00:00.000Z",
    provider_event_id: `evt-${id}`,
    provider_payment_intent_id: `pi-${id}`,
  };
}

function refund(over: Partial<JobPaymentRefundRow> = {}): JobPaymentRefundRow {
  return {
    id: "ref-1",
    company_id: COMPANY,
    job_id: JOB,
    payment_request_id: "req-1",
    canonical_capture_transaction_id: "t1",
    amount_cents: 50_000,
    status: "succeeded",
    initiated_at: "2026-09-10T16:00:00.000Z",
    pending_at: null,
    requires_action_at: null,
    succeeded_at: "2026-09-11T16:00:00.000Z",
    failed_at: null,
    canceled_at: null,
    created_at: "2026-09-10T16:00:00.000Z",
    updated_at: "2026-09-11T16:00:00.000Z",
    ...over,
  };
}

function change(over: Partial<PublicProjectRecordScopeChangeInput> = {}): PublicProjectRecordScopeChangeInput {
  return {
    id: "sc-1",
    company_id: COMPANY,
    job_id: JOB,
    status: "authorized",
    reason: "Replace rotted decking",
    authorized_at: "2026-09-05T18:00:00.000Z",
    price_delta_cents: 120_000,
    lines: [
      {
        id: "l1",
        change_kind: "add",
        description: "Decking replacement",
        quantity: 4,
        unit: "sheets",
        line_delta_cents: 150_000,
        sort_order: 0,
      },
      {
        id: "l2",
        change_kind: "remove",
        description: "Ridge vent upgrade",
        quantity: null,
        unit: null,
        line_delta_cents: -30_000,
        sort_order: 1,
      },
    ],
    approval: { approved_at: "2026-09-05T18:00:00.000Z", approved_by_name: "Dana Homeowner" },
    ...over,
  };
}

function base(over: Partial<BuildPublicProjectRecordInput> = {}): BuildPublicProjectRecordInput {
  return {
    companyId: COMPANY,
    jobId: JOB,
    acceptance: { acceptedAt: "2026-09-01T17:00:00.000Z", signedAt: null, signerPrintedName: null },
    packageLabel: "Core Protection",
    scopeChanges: [],
    originalAgreementCents: 1_000_000,
    currentContractCents: 1_000_000,
    requests: [],
    transactions: [],
    refunds: [],
    job: { stage: "approved", completedAt: null },
    timeZone: TZ,
    ...over,
  };
}

describe("Phase 12 — customer project record read model", () => {
  test("no record before acceptance (progressive, never precedes agreement)", () => {
    assert.equal(buildPublicProjectRecordViewModel(base({ acceptance: null })), null);
  });

  test("accepted + not complete: agreement, no completion, unsigned download, no fake signature", () => {
    const vm = buildPublicProjectRecordViewModel(base())!;
    assert.equal(vm.agreement.packageLabel, "Core Protection");
    assert.equal(vm.agreement.acceptedLabel, "Accepted September 1, 2026");
    assert.equal(vm.agreement.signedLabel, null);
    assert.equal(vm.agreement.downloadLabel, "Download agreement");
    assert.equal(vm.completion, null);
    assert.equal(vm.contract, null, "normal job without changes shows no $0 changes row");
    assert.deepEqual(vm.approvedChanges, []);
  });

  test("signed agreement shows date + printed name and the signed download", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({
        acceptance: {
          acceptedAt: "2026-09-01T17:00:00.000Z",
          signedAt: "2026-09-01T17:05:00.000Z",
          signerPrintedName: "Dana Homeowner",
        },
      })
    )!;
    assert.equal(vm.agreement.signedLabel, "Signed September 1, 2026 · Dana Homeowner");
    assert.equal(vm.agreement.downloadLabel, "Download signed agreement");
  });

  test("approved changes: authorized only, same company + job, lines and approver", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({
        currentContractCents: 1_120_000,
        scopeChanges: [
          change(),
          change({ id: "draft", status: "draft" }),
          change({ id: "proposed", status: "proposed" }),
          change({ id: "voided", status: "voided" }),
          change({ id: "declined", status: "declined" }),
          change({ id: "other-job", job_id: OTHER_JOB }),
          change({ id: "other-co", company_id: "99999999-9999-4999-8999-999999999999" }),
        ],
      })
    )!;
    assert.deepEqual(vm.approvedChanges.map((row) => row.id), ["sc-1"]);
    const [only] = vm.approvedChanges;
    assert.equal(only.dateLabel, "September 5, 2026");
    assert.equal(only.reason, "Replace rotted decking");
    assert.equal(only.approvedByLabel, "Approved by Dana Homeowner");
    assert.equal(only.totalDeltaLabel, "+$1,200.00");
    assert.deepEqual(
      only.lines.map((line) => [line.actionLabel, line.description, line.quantityLabel, line.deltaLabel]),
      [
        ["Add", "Decking replacement", "4 sheets", "+$1,500.00"],
        ["Remove", "Ridge vent upgrade", null, "−$300.00"],
      ]
    );
    assert.deepEqual(vm.contract, {
      originalLabel: "$10,000.00",
      changesLabel: "+$1,200.00",
      currentLabel: "$11,200.00",
    });
  });

  test("complete + unpaid balance: Work complete in company timezone, balance remaining", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({
        job: { stage: "complete", completedAt: "2026-09-24T03:00:00.000Z" },
        requests: [request()],
        transactions: [capture("t1", 300_000)],
      })
    )!;
    assert.deepEqual(vm.completion, { label: "Work complete", dateLabel: "September 23, 2026" });
    assert.equal(vm.money?.state, "available");
    if (vm.money?.state !== "available") return;
    assert.equal(vm.money.currentContractLabel, "$10,000.00");
    assert.equal(vm.money.paymentsReceivedLabel, "$3,000.00");
    assert.equal(vm.money.refundedLabel, null);
    assert.equal(vm.money.balanceLabel, "Balance remaining $7,000.00");
    assert.equal(vm.history.length, 1, "history shows with a single payment");
    assert.deepEqual(vm.history[0], {
      id: "payment:req-1",
      label: "Payment received",
      kindLabel: "Deposit",
      amountLabel: "$3,000.00",
      dateLabel: "September 2, 2026",
    });
  });

  test("complete + open request: balance still shown, request is not counted as paid", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({
        job: { stage: "complete", completedAt: "2026-09-20T18:00:00.000Z" },
        requests: [request(), request({ id: "req-2", kind: "balance", status: "open", paid_at: null, amount_cents: 700_000 })],
        transactions: [capture("t1", 300_000)],
      })
    )!;
    assert.equal(vm.money?.state === "available" && vm.money.balanceLabel, "Balance remaining $7,000.00");
    assert.equal(vm.history.length, 1);
  });

  test("complete + paid in full: No balance remaining", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({
        job: { stage: "complete", completedAt: "2026-09-20T18:00:00.000Z" },
        requests: [request(), request({ id: "req-2", kind: "balance", amount_cents: 700_000, paid_at: "2026-09-21T18:00:00.000Z" })],
        transactions: [capture("t1", 300_000), capture("t2", 700_000, "req-2")],
      })
    )!;
    assert.equal(vm.money?.state === "available" && vm.money.balanceLabel, "No balance remaining");
    assert.deepEqual(vm.history.map((row) => row.label), ["Payment received", "Payment received"]);
  });

  test("refunds are shown but never reopen the balance; processing vs sent are dated", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({
        job: { stage: "complete", completedAt: "2026-09-20T18:00:00.000Z" },
        requests: [request({ amount_cents: 1_000_000, kind: "balance" })],
        transactions: [capture("t1", 1_000_000)],
        refunds: [
          refund(),
          refund({ id: "ref-2", status: "pending", succeeded_at: null, pending_at: "2026-09-12T16:00:00.000Z", amount_cents: 10_000 }),
          refund({ id: "ref-3", status: "failed", succeeded_at: null }),
        ],
      })
    )!;
    if (vm.money?.state !== "available") throw new Error("money expected");
    assert.equal(vm.money.refundedLabel, "$500.00");
    assert.equal(vm.money.balanceLabel, "No balance remaining");
    assert.deepEqual(
      vm.history.map((row) => [row.label, row.dateLabel]),
      [
        ["Payment received", "September 2, 2026"],
        ["Refund sent", "September 11, 2026"],
        ["Refund processing", "September 12, 2026"],
      ]
    );
    assert.doesNotMatch(JSON.stringify(vm), /net|invoice|overdue|late|final payment/i);
  });

  test("closed but NOT complete shows no completion; complete + closed still shows Work complete", () => {
    const closed = buildPublicProjectRecordViewModel(base({ job: { stage: "production", completedAt: null } }))!;
    assert.equal(closed.completion, null);
    const completeClosed = buildPublicProjectRecordViewModel(
      base({ job: { stage: "complete", completedAt: "2026-09-20T18:00:00.000Z" } })
    )!;
    assert.equal(completeClosed.completion?.label, "Work complete");
  });

  test("lost / on_hold never produce disposition wording", () => {
    for (const stage of ["approved", "scheduled", "production"]) {
      const vm = buildPublicProjectRecordViewModel(base({ job: { stage, completedAt: null } }))!;
      assert.equal(vm.completion, null);
      assert.doesNotMatch(JSON.stringify(vm), /lost|on[ _]hold|closed|disposition/i);
    }
  });

  test("contract unavailable: no fake $0, Paid, or No balance", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({ currentContractCents: null, requests: [request()], transactions: [capture("t1", 300_000)] })
    )!;
    assert.deepEqual(vm.money, { state: "unavailable", message: PUBLIC_PROJECT_RECORD_MONEY_UNAVAILABLE });
    assert.equal(vm.contract, null);
    assert.doesNotMatch(JSON.stringify(vm.money), /\$0|No balance|Paid/);
  });

  test("legacy proposal with no job: agreement only", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({ jobId: null, job: null, scopeChanges: [change()], requests: [request()] })
    )!;
    assert.equal(vm.money, null);
    assert.equal(vm.contract, null);
    assert.deepEqual(vm.approvedChanges, []);
    assert.deepEqual(vm.history, []);
    assert.equal(vm.completion, null);
    assert.equal(vm.agreement.acceptedLabel, "Accepted September 1, 2026");
  });

  test("payload exposes no attachment URLs, storage paths, or file metadata", () => {
    const vm = buildPublicProjectRecordViewModel(
      base({
        job: { stage: "complete", completedAt: "2026-09-20T18:00:00.000Z" },
        scopeChanges: [change()],
        currentContractCents: 1_120_000,
        requests: [request()],
        transactions: [capture("t1", 300_000)],
        refunds: [refund()],
      })
    );
    const json = JSON.stringify(vm);
    assert.doesNotMatch(
      json,
      /https?:|job-attachments|storage_path|storage_bucket|signedUrl|signed_url|mime|file_size|thumbnail|photo|attachment/i
    );
  });

  test("bad timezone falls back to UTC instead of throwing", () => {
    assert.equal(formatProjectRecordDate("2026-09-24T03:00:00.000Z", "Not/AZone"), "September 24, 2026");
  });
});

describe("Phase 12 — public payment presenter truth", () => {
  test("contract unavailable ignores snapshot fallback and never shows Paid", () => {
    const vm = buildPublicPaymentViewModel({
      requests: [request({ kind: "balance", amount_cents: 1_000_000 })],
      transactions: [capture("t1", 1_000_000)],
      accepted: true,
      contractTotalCents: null,
      contractTotalUnavailable: true,
    });
    assert.equal(vm?.state, "payment_unavailable");
    assert.equal(vm?.contractSummary, null);
  });

  test("paid-in-full copy speaks of the project when authorized changes exist", () => {
    const common = {
      requests: [request({ kind: "balance", amount_cents: 1_120_000 })],
      transactions: [capture("t1", 1_120_000)],
      accepted: true,
      contractTotalCents: 1_120_000,
      originalAgreementCents: 1_000_000,
    };
    assert.equal(buildPublicPaymentViewModel(common)?.explanation, PUBLIC_PAYMENT_PAID_IN_FULL_EXPLANATION);
    assert.equal(
      buildPublicPaymentViewModel({ ...common, hasAuthorizedChanges: true })?.explanation,
      PUBLIC_PAYMENT_PAID_IN_FULL_PROJECT_EXPLANATION
    );
    assert.equal(
      buildPublicPaymentViewModel({ ...common, refunds: [refund()], hasAuthorizedChanges: true })?.explanation,
      PUBLIC_PAYMENT_PAYMENTS_COMPLETE_PROJECT_EXPLANATION
    );
  });
});

describe("Phase 12 — contractor Review closeout", () => {
  const workspace = {
    contractTotalCents: 1_120_000,
    receivedGrossCents: 1_120_000,
    refundedCents: 50_000,
    collectibleRemainingCents: 0,
  };

  test("only when canonically Complete", () => {
    for (const stage of ["approved", "scheduled", "production", null]) {
      assert.equal(
        buildJobCardCloseoutViewModel({
          stage,
          completedAt: null,
          timeZone: TZ,
          accepted: true,
          signed: true,
          workspace,
          scopeChanges: [],
        }),
        null
      );
    }
  });

  test("same truth as /p: agreement, changes, contract, collected, refunded, remaining", () => {
    const vm = buildJobCardCloseoutViewModel({
      stage: "complete",
      completedAt: "2026-09-24T03:00:00.000Z",
      timeZone: TZ,
      accepted: true,
      signed: true,
      workspace,
      scopeChanges: [
        { status: "authorized", priceDeltaCents: 120_000 },
        { status: "proposed", priceDeltaCents: 999_999 },
      ],
    })!;
    assert.equal(vm.completionLabel, "Work complete · September 23, 2026");
    assert.equal(vm.balanceLabel, "No balance remaining");
    assert.deepEqual(
      vm.rows.map((row) => [row.label, row.value]),
      [
        ["Agreement", "Signed · $10,000.00"],
        ["Approved changes", "1 · +$1,200.00"],
        ["Current contract total", "$11,200.00"],
        ["Collected", "$11,200.00"],
        ["Refunded", "$500.00"],
        ["Remaining", "None"],
      ]
    );
    assert.doesNotMatch(JSON.stringify(vm), /ready|shared|sent|closed/i);
  });

  test("unavailable workspace never invents a balance", () => {
    const vm = buildJobCardCloseoutViewModel({
      stage: "complete",
      completedAt: "2026-09-24T03:00:00.000Z",
      timeZone: TZ,
      accepted: true,
      signed: false,
      workspace: null,
      scopeChanges: [],
    })!;
    // Contractor surface: no customer-facing "contact your contractor" copy.
    assert.equal(vm.balanceLabel, "Payment information unavailable");
    assert.doesNotMatch(vm.balanceLabel, /contractor|\$0/);
  });
});

describe("Phase 12 — share authority, tokens, and exposure boundaries", () => {
  test("proposal_author: Owner/Admin and Office/Sales only", () => {
    assert.equal(hasCompanyCapability("owner", "proposal_author"), true);
    assert.equal(hasCompanyCapability("admin", "proposal_author"), true);
    assert.equal(hasCompanyCapability("office_sales", "proposal_author"), true);
    assert.equal(hasCompanyCapability("production_lead", "proposal_author"), false);
    assert.equal(hasCompanyCapability("field_user", "proposal_author"), false);
  });

  test("Copy customer link route: server-enforced proposal_author, mints only, mutates nothing", () => {
    const route = read("app/api/jobs/[jobId]/customer-record-link/route.ts");
    assert.match(route, /requireCapabilitySession\(supabase, user\.id, "proposal_author"\)/);
    assert.match(route, /source: "customer_record_share"/);
    assert.match(route, /getUserCompanyId/);
    assert.doesNotMatch(route, /\.update\(|\.insert\(|\.delete\(|\.rpc\(|req\.json|searchParams/);
    const helper = read("app/lib/jobPaymentPublicLink.server.ts");
    assert.match(helper, /source: "customer_record_share"/);
    assert.match(helper, /\.eq\("id", jobId\)\s*\.eq\("company_id", companyId\)/);
    assert.match(helper, /\.eq\("company_id", companyId\)\s*\.eq\("job_id", jobId\)/);
    assert.match(helper, /mintProposalPublicAccessToken\(/);
    assert.doesNotMatch(helper, /mintAndSupersede/);
    assert.match(helper, /buildPublicReviewLinkExpiresAt\(\)/);
  });

  test("payment link keeps its own capability and source", () => {
    const route = read("app/api/jobs/[jobId]/payment-link/route.ts");
    assert.match(route, /"payment_request"/);
    assert.doesNotMatch(route, /customer_record_share/);
  });

  test("public loader scopes job facts to the token company + proposal job and never reads attachments", () => {
    const src = read("app/lib/proposalPublicAccessOrchestrator.server.ts");
    assert.match(src, /from\("jobs"\)[\s\S]*?\.eq\("company_id", input\.companyId\)[\s\S]*?\.eq\("id", input\.jobId\)/);
    assert.match(src, /from\("proposals"\)[\s\S]*?\.eq\("id", result\.tracking\.proposal_id\)[\s\S]*?\.eq\("company_id", result\.tracking\.company_id\)/);
    assert.doesNotMatch(src, /job_attachments|JOB_ATTACHMENTS_BUCKET|createSignedUrl|storage\./);
    assert.match(src, /listAuthorizedScopeChangesWithApprovals/);
    assert.match(src, /fetchJobContractTotalCentsOrNull/);
  });

  test("cover and logo media reject private job attachments and signed object URLs", () => {
    assert.equal(
      publicSafeMediaUrl("https://x.supabase.co/storage/v1/object/sign/job-attachments/a/b.jpg?token=t"),
      null
    );
    assert.equal(publicSafeMediaUrl("https://cdn.example.com/job-attachments/a.jpg"), null);
    assert.equal(publicSafeMediaUrl("https://cdn.example.com/brand/logo.png"), "https://cdn.example.com/brand/logo.png");
    assert.equal(publicSafeMediaUrl("javascript:alert(1)"), null);
    const presenter = read("app/lib/proposalCustomerPacketPresenter.ts");
    assert.match(presenter, /logoUrl: safeLogoUrl/);
  });

  test("attachment visibility constraint is untouched by Phase 12", () => {
    const migration = read(
      "supabase/migrations/20260924150000_activity_event_type_constraint_canonical.sql"
    );
    assert.doesNotMatch(migration, /job_attachments|visibility/);
  });

  test("purchase panel defers contract + history to the record; Pay action unchanged", () => {
    const packet = read("app/components/proposal-packet/ProposalPacket.tsx");
    assert.match(packet, /recordOwnsDetails=\{packet\.projectRecord != null\}/);
    assert.match(packet, /<ProposalPacketProjectRecord/);
    const purchase = read("app/components/proposal-packet/ProposalPacketPurchase.tsx");
    assert.match(purchase, /data-public-pay=/);
    assert.match(purchase, /payment\?\.contractSummary && !recordOwnsDetails/);
  });

  test("Job Card closeout: proposal_author gates Copy link; no editor or share status", () => {
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(client, /canShareCustomerLink=\{companyMembers\.canAuthorProposals\}/);
    assert.match(client, /const jobCardCloseout = suppressCommercial\s*\? null/);
    const summary = read("app/tools/roofing/jobCard/JobCardCloseoutSummary.tsx");
    assert.doesNotMatch(summary, /<input|<textarea|contentEditable/);
    assert.match(summary, /customer-record-link/);
  });
});
