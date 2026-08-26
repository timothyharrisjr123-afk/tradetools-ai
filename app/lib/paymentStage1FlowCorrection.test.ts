/**
 * Payment Stage 1 flow correction — select → pay, send fail-closed, nav, Overview.
 *
 * Run: npx tsx --test app/lib/paymentStage1FlowCorrection.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  DEFAULT_PROPOSAL_PAYMENT_TERMS,
  formatPaymentTermsCustomerCopy,
  termsRequireOnlineDeposit,
} from "./proposalPaymentTerms";
import {
  resolveOnlineDepositSendReadiness,
  SEND_GATE_PAYMENTS_TERMS_UNKNOWN_BODY,
} from "./proposalPaymentSendReadiness";
import {
  buildProspectiveDepositPaymentViewModel,
  buildJobCardPaymentViewModel,
  buildPublicPaymentViewModel,
} from "./jobPaymentReadModel";
import { hasNavHref } from "../tools/roofing/fieldDiveNavConfig";

const ROOT = process.cwd();
const SQL_048 = join(
  ROOT,
  "supabase/migrations/20260826_048_proposal_payment_terms_and_job_ledger.sql"
);
const SQL_048_SHA =
  "72B46B61050287B094478485986772898BB0753FC0F1712D2825D9581A4BDCF0";

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("Payment Stage 1 flow correction", () => {
  test("048 unchanged", () => {
    const sha = createHash("sha256").update(readFileSync(SQL_048)).digest("hex").toUpperCase();
    assert.equal(sha, SQL_048_SHA);
  });

  test("prospective deposit shows Pay before acceptance", () => {
    const terms = {
      ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
      depositMode: "percent" as const,
      depositPercentBps: 3000,
    };
    const vm = buildProspectiveDepositPaymentViewModel({
      terms,
      selectedTotalCents: 1500000,
    });
    assert.ok(vm);
    assert.equal(vm?.state, "due");
    assert.equal(vm?.ctaLabel, "Pay deposit");
    assert.equal(vm?.amountLabel, "$4,500.00");
    assert.equal(buildPublicPaymentViewModel({ requests: [] }), null);
  });

  test("no-deposit terms do not show prospective Pay", () => {
    assert.equal(
      buildProspectiveDepositPaymentViewModel({
        terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
        selectedTotalCents: 1500000,
      }),
      null
    );
  });

  test("send readiness fails closed when terms unknown", () => {
    const blocked = resolveOnlineDepositSendReadiness({
      terms: null,
      chargesEnabled: true,
      termsKnown: false,
    });
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.termsKnown, false);
    assert.match(blocked.message ?? "", /could not be verified/i);

    const noDeposit = resolveOnlineDepositSendReadiness({
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      chargesEnabled: false,
      termsKnown: true,
    });
    assert.equal(noDeposit.blocked, false);
    assert.equal(termsRequireOnlineDeposit(DEFAULT_PROPOSAL_PAYMENT_TERMS), false);
  });

  test("payment terms copy uses agreement language", () => {
    const copy = formatPaymentTermsCustomerCopy(
      {
        ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
        depositMode: "percent",
        depositPercentBps: 3000,
      },
      1500000
    );
    assert.match(copy.depositLine, /due upon agreement/);
    assert.doesNotMatch(copy.depositLine, /due upon acceptance/);
  });

  test("Job Card manual Request deposit hidden from visible product", () => {
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
    assert.equal(view.canRequestDeposit, false);
    assert.equal(view.action, null);
  });

  test("standalone Payments nav removed; route remains deep-linkable", () => {
    assert.equal(hasNavHref("/tools/settings/payments"), false);
    assert.equal(hasNavHref("/tools/settings"), true);
    // Cohesion Cut 1 moved Payments into the Company Settings focused editor.
    const settings = read("app/tools/settings/CompanySettingsClient.tsx");
    assert.match(settings, /CompanySettingsPaymentsEditor/);
    assert.match(
      read("app/tools/settings/payments/page.tsx"),
      /redirect\("\/tools\/settings\?edit=payments"\)/
    );
  });

  test("Overview no dollar amounts — strip removed from Job Card", () => {
    const jobCard = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.doesNotMatch(jobCard, /JobCardPaymentsStrip/);
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.doesNotMatch(roofing, /JobCardPaymentsStrip/);
  });

  test("orchestrator injects prospective deposit when no request yet", () => {
    const orchestrator = read("app/lib/proposalPublicAccessOrchestrator.server.ts");
    assert.match(orchestrator, /buildProspectiveDepositPaymentViewModel/);
  });

  test("send readiness unknown message is exported", () => {
    assert.match(SEND_GATE_PAYMENTS_TERMS_UNKNOWN_BODY, /verified/i);
  });
});
