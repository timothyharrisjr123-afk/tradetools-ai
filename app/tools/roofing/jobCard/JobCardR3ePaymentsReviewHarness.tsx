"use client";

import JobCardPaymentsStrip from "./JobCardPaymentsStrip";
import JobCardRequestPaymentModal from "./JobCardRequestPaymentModal";
import JobCardActivityPanel from "./JobCardActivityPanel";
import ProposalPacketPayment from "@/app/components/proposal-packet/ProposalPacketPayment";
import {
  buildJobCardPaymentViewModel,
  buildPublicPaymentViewModel,
  composeJobPaymentActivityItems,
} from "@/app/lib/jobPaymentReadModel";
import { composeJobActivityItems } from "@/app/lib/jobActivityComposer";
import {
  SETTINGS_CARD,
  SETTINGS_FIELD_HELP,
  SETTINGS_INPUT,
  SETTINGS_LABEL,
  SETTINGS_PRIMARY_BUTTON,
  SETTINGS_SECTION_DESC,
  SETTINGS_SECTION_TITLE,
} from "@/app/tools/settings/settingsConstants";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const ACCOUNT = {
  charges_enabled: true,
  onboarding_status: "complete",
  details_submitted: true,
  payouts_enabled: true,
};

const OPEN_DEPOSIT = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  job_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  proposal_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  proposal_version_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  proposal_option_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  proposal_acceptance_id: "99999999-9999-4999-8999-999999999999",
  proposal_signature_id: null as string | null,
  amount_cents: 500000,
  currency: "usd",
  kind: "deposit" as const,
  accepted_total_cents_snapshot: 1850000,
  option_label_snapshot: "Premium",
  provider_account_id: "acct_test",
  provider_checkout_session_id: null as string | null,
  status: "open" as const,
  requested_at: "2026-08-16T12:00:00.000Z",
  paid_at: null as string | null,
  cancelled_at: null as string | null,
};

const REVIEW_TOKEN = "r3e-review-token";

function SettingsPaymentsMock({
  connected,
}: {
  connected: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-slate-50 p-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Company setup
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Payments
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
          Connect your Stripe account to request deposits and remaining balances on
          accepted, approved jobs. FieldDive does not take a fee and does not hold
          customer funds.
        </p>
      </header>
      <section className={`${SETTINGS_CARD} space-y-3`}>
        <h2 className={SETTINGS_SECTION_TITLE}>Stripe connection</h2>
        <p className={SETTINGS_SECTION_DESC}>
          {connected ? "Connected" : "Not connected"}
        </p>
        <button type="button" className={SETTINGS_PRIMARY_BUTTON} disabled={connected}>
          {connected ? "Connected" : "Connect Stripe"}
        </button>
      </section>
      <section className={`${SETTINGS_CARD} space-y-4`}>
        <div>
          <h2 className={SETTINGS_SECTION_TITLE}>Default deposit</h2>
          <p className={SETTINGS_SECTION_DESC}>
            Prefills the request-deposit amount. Contractors can edit before creating
            a request. Changing this does not change existing payment requests.
          </p>
        </div>
        <label className={SETTINGS_LABEL}>
          Mode
          <select className={`${SETTINGS_INPUT} mt-1`} defaultValue={connected ? "percent" : "none"}>
            <option value="none">No default</option>
            <option value="percent">Percent of accepted total</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </label>
        {connected ? (
          <label className={SETTINGS_LABEL}>
            Percent
            <input className={`${SETTINGS_INPUT} mt-1`} defaultValue="20" readOnly />
            <span className={SETTINGS_FIELD_HELP}>Example: 20 for a 20% deposit.</span>
          </label>
        ) : null}
        <button type="button" className={SETTINGS_PRIMARY_BUTTON}>
          Save deposit default
        </button>
      </section>
    </div>
  );
}

export default function JobCardR3ePaymentsReviewHarness() {
  const surface = useSearchParams().get("surface");
  const show = (name: string) => !surface || surface === name;
  const [modalOpen, setModalOpen] = useState(
    surface === "request-deposit-modal"
  );
  const notRequested = buildJobCardPaymentViewModel({
    jobStage: "approved",
    jobDisposition: "active",
    accepted: true,
    signed: false,
    account: ACCOUNT,
    requests: [],
    transactions: [],
    acceptedTotalCents: 1850000,
  });
  const depositDue = buildJobCardPaymentViewModel({
    jobStage: "approved",
    jobDisposition: "active",
    accepted: true,
    signed: false,
    account: ACCOUNT,
    requests: [OPEN_DEPOSIT],
    transactions: [],
    acceptedTotalCents: 1850000,
  });
  const received = buildJobCardPaymentViewModel({
    jobStage: "approved",
    jobDisposition: "active",
    accepted: true,
    signed: true,
    account: ACCOUNT,
    requests: [
      {
        ...OPEN_DEPOSIT,
        status: "paid",
        paid_at: "2026-08-16T13:00:00.000Z",
        amount_cents: 1850000,
      },
    ],
    transactions: [],
    acceptedTotalCents: 1850000,
  });
  const due = buildPublicPaymentViewModel({ requests: [OPEN_DEPOSIT] })!;
  const pending = buildPublicPaymentViewModel({
    requests: [{ ...OPEN_DEPOSIT, status: "processing" }],
  })!;
  const paid = buildPublicPaymentViewModel({
    requests: [
      { ...OPEN_DEPOSIT, status: "paid", paid_at: "2026-08-16T13:00:00.000Z" },
    ],
  })!;
  const activityItems = composeJobActivityItems({
    paymentItems: composeJobPaymentActivityItems({
      requests: [
        {
          ...OPEN_DEPOSIT,
          status: "paid",
          paid_at: "2026-08-16T13:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "txn-review-1",
          payment_request_id: OPEN_DEPOSIT.id,
          kind: "capture",
          status: "succeeded",
          amount_cents: 500000,
          occurred_at: "2026-08-16T13:00:00.000Z",
          provider_event_id: "evt_review_1",
        },
      ],
    }),
  });

  return (
    <div className="space-y-8 bg-slate-50 p-6">
      {show("settings-payments-disconnected") ? (
      <section data-r3e-review="settings-payments-disconnected">
        <SettingsPaymentsMock connected={false} />
      </section>
      ) : null}
      {show("settings-payments-connected") ? (
      <section data-r3e-review="settings-payments-connected">
        <SettingsPaymentsMock connected />
      </section>
      ) : null}
      {show("job-card-not-requested") ? (
      <section data-r3e-review="job-card-not-requested">
        <JobCardPaymentsStrip view={notRequested} />
      </section>
      ) : null}
      {show("job-card-deposit-due") ? (
      <section data-r3e-review="job-card-deposit-due">
        <JobCardPaymentsStrip view={depositDue} />
      </section>
      ) : null}
      {show("job-card-payment-received") ? (
      <section data-r3e-review="job-card-payment-received">
        <JobCardPaymentsStrip view={received} />
      </section>
      ) : null}
      {show("job-card-payment-strip") ? (
      <section data-r3e-review="job-card-payment-strip">
        <JobCardPaymentsStrip view={depositDue} />
      </section>
      ) : null}
      {show("request-deposit-modal") ? (
      <section data-r3e-review="request-deposit-modal">
        <div className="relative h-[80px]">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
            data-r3e-open-request-modal
            onClick={() => setModalOpen(true)}
          >
            Open request deposit
          </button>
          <JobCardRequestPaymentModal
            open={modalOpen}
            kind="deposit"
            prefillCents={500000}
            remainingCents={1850000}
            acceptedTotalCents={1850000}
            unsigned
            onClose={() => setModalOpen(false)}
            onSubmit={() => undefined}
          />
        </div>
      </section>
      ) : null}
      {show("public-payment-due") ? (
      <section data-r3e-review="public-payment-due">
        <ProposalPacketPayment payment={due} publicAccessToken={REVIEW_TOKEN} />
      </section>
      ) : null}
      {show("public-payment-pending") ? (
      <section data-r3e-review="public-payment-pending">
        <ProposalPacketPayment payment={pending} publicAccessToken={null} />
      </section>
      ) : null}
      {show("public-payment-received") ? (
      <section data-r3e-review="public-payment-received">
        <ProposalPacketPayment payment={paid} publicAccessToken={null} />
      </section>
      ) : null}
      {show("activity-payment-received") ? (
      <section data-r3e-review="activity-payment-received" className="h-[280px]">
        <JobCardActivityPanel items={activityItems} />
      </section>
      ) : null}
    </div>
  );
}
