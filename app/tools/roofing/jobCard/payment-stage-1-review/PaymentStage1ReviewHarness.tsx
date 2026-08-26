"use client";

import ProposalBuilderPaymentTerms from "@/app/tools/roofing/proposals/builder/ProposalBuilderPaymentTerms";
import ProposalPaymentTermsBlock from "@/app/components/proposal-packet/ProposalPaymentTermsBlock";
import ProposalPacketPayment from "@/app/components/proposal-packet/ProposalPacketPayment";
import ProposalPacketPackageInterestActions from "@/app/components/proposal-packet/ProposalPacketPackageInterestActions";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "@/app/lib/proposalPaymentTerms";
import { buildPublicPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import { useSearchParams } from "next/navigation";

const PERCENT_TERMS = {
  ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
  depositMode: "percent" as const,
  depositPercentBps: 3000,
};

const REVIEW_CONTACT = {
  supportMessage: "",
  companyName: "Anderson Roofing",
  phone: null,
  email: null,
  website: null,
  license: null,
  address: null,
};

const REQUEST = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  job_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  proposal_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  proposal_version_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  proposal_option_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  proposal_acceptance_id: "99999999-9999-4999-8999-999999999999",
  proposal_signature_id: null as string | null,
  amount_cents: 450000,
  currency: "usd",
  kind: "deposit" as const,
  accepted_total_cents_snapshot: 1500000,
  option_label_snapshot: "Premium",
  provider_account_id: "acct_test",
  provider_checkout_session_id: null as string | null,
  status: "open" as const,
  requested_at: "2026-08-26T12:00:00.000Z",
  paid_at: null as string | null,
  cancelled_at: null as string | null,
  settled_payment_method_label: null as string | null,
};

export default function PaymentStage1ReviewHarness() {
  const show = useSearchParams().get("show");
  const due = buildPublicPaymentViewModel({ requests: [REQUEST] })!;
  const pending = buildPublicPaymentViewModel({
    requests: [{ ...REQUEST, status: "processing" }],
  })!;
  const received = buildPublicPaymentViewModel({
    requests: [
      {
        ...REQUEST,
        status: "paid",
        paid_at: "2026-08-26T13:00:00.000Z",
        settled_payment_method_label: "Visa •••• 4242",
      },
    ],
  })!;

  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-white p-6">
      {show == null || show === "builder-none" ? (
        <section data-stage1-review="builder-none">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Builder — no deposit</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <ProposalBuilderPaymentTerms
              proposalId="00000000-0000-4000-8000-000000000001"
              selectedTotalCents={1500000}
              persist={false}
            />
          </div>
        </section>
      ) : null}
      {show == null || show === "builder-percent" ? (
        <section data-stage1-review="builder-percent">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Builder — percentage deposit
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <ProposalBuilderPaymentTerms
              proposalId="00000000-0000-4000-8000-000000000002"
              selectedTotalCents={1500000}
              persist={false}
              initialTerms={PERCENT_TERMS}
            />
          </div>
        </section>
      ) : null}
      {show == null || show === "terms-percent" ? (
        <section data-stage1-review="terms-percent">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Customer terms — percent</h2>
          <ProposalPaymentTermsBlock
            terms={{
              ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
              depositMode: "percent",
              depositPercentBps: 3000,
            }}
            selectedTotalCents={1500000}
          />
        </section>
      ) : null}
      {show == null || show === "terms-fixed" ? (
        <section data-stage1-review="terms-fixed">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Customer terms — fixed</h2>
          <ProposalPaymentTermsBlock
            terms={{
              ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
              depositMode: "fixed",
              depositFixedCents: 300000,
            }}
            selectedTotalCents={1500000}
          />
        </section>
      ) : null}
      {show == null || show === "terms-none" ? (
        <section data-stage1-review="terms-none">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Customer terms — none</h2>
          <ProposalPaymentTermsBlock
            terms={DEFAULT_PROPOSAL_PAYMENT_TERMS}
            selectedTotalCents={1500000}
          />
        </section>
      ) : null}
      {show == null || show === "before-accept" ? (
        <section data-stage1-review="before-accept">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Public — before accept
          </h2>
          <ProposalPaymentTermsBlock
            terms={PERCENT_TERMS}
            selectedTotalCents={1500000}
          />
          <div className="mt-4">
            <ProposalPacketPackageInterestActions
              packageLabel="Premium"
              contact={REVIEW_CONTACT}
              publicAccessToken="stage1-review-token"
              optionKey="premium"
              accepted={false}
              signed={false}
            />
          </div>
        </section>
      ) : null}
      {show == null || show === "accept-sign-pay" ? (
        <section data-stage1-review="accept-sign-pay">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Public — Accept / Sign / Pay
          </h2>
          <ProposalPaymentTermsBlock
            terms={PERCENT_TERMS}
            selectedTotalCents={1500000}
          />
          <div className="mt-4">
            <ProposalPacketPayment payment={due} publicAccessToken="stage1-review-token" />
          </div>
          <div className="mt-4">
            <ProposalPacketPackageInterestActions
              packageLabel="Premium"
              contact={REVIEW_CONTACT}
              publicAccessToken="stage1-review-token"
              optionKey="premium"
              accepted
              acceptedOnLabel="August 26, 2026"
              signed={false}
              signProminence="continuation"
            />
          </div>
        </section>
      ) : null}
      {show == null || show === "pay-deposit" ? (
        <section data-stage1-review="pay-deposit">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Public — Pay deposit</h2>
          <ProposalPacketPayment payment={due} publicAccessToken="stage1-review-token" />
        </section>
      ) : null}
      {show == null || show === "pending" ? (
        <section data-stage1-review="pending">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Public — pending</h2>
          <ProposalPacketPayment payment={pending} publicAccessToken={null} />
        </section>
      ) : null}
      {show == null || show === "received" ? (
        <section data-stage1-review="received">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Public — received</h2>
          <ProposalPacketPayment payment={received} publicAccessToken={null} />
        </section>
      ) : null}
      {show == null || show === "send-blocked" ? (
        <section
          data-stage1-review="send-blocked"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3"
        >
          <p className="text-sm font-semibold text-amber-950">Payments setup required</p>
          <p className="mt-1 text-sm text-amber-900">
            Connect payments before sending a proposal that collects a deposit online.
          </p>
          <p className="mt-2 text-sm font-semibold text-blue-700">Connect payments</p>
        </section>
      ) : null}
    </div>
  );
}
