"use client";

import { useSearchParams } from "next/navigation";
import ProposalPacket from "@/app/components/proposal-packet/ProposalPacket";
import {
  buildProspectiveDepositPaymentViewModel,
  buildPublicPaymentViewModel,
} from "@/app/lib/jobPaymentReadModel";
import type { JobPaymentRequestRow } from "@/app/lib/jobPaymentReadModel";
import type { ProposalCustomerPacketViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import type { ProposalPaymentTerms } from "@/app/lib/proposalPaymentTerms";

/**
 * Premium Cohesion Cut 1 — Phase 1 visual review harness.
 *
 * Renders the real customer ProposalPacket against frozen fixtures so the
 * purchase experience can be reviewed at desktop and 390 without a live token.
 */

const PERCENT_TERMS: ProposalPaymentTerms = {
  depositMode: "percent",
  depositPercentBps: 3000,
  depositFixedCents: null,
  depositDueTrigger: "on_acceptance",
  balanceDueTrigger: "on_completion",
};

const NO_DEPOSIT_TERMS: ProposalPaymentTerms = {
  depositMode: "none",
  depositPercentBps: null,
  depositFixedCents: null,
  depositDueTrigger: "on_acceptance",
  balanceDueTrigger: "on_completion",
};

const PREMIUM_TOTAL_CENTS = 1500000;
const STANDARD_TOTAL_CENTS = 1180000;
const ESSENTIAL_TOTAL_CENTS = 940000;

const COVER = {
  proposalLabel: "Your roofing proposal",
  headline: "1842 Bellview Terrace",
  confidenceCopy: "A clear roof replacement proposal prepared for your home.",
  coverMediaUrl: null,
  company: {
    companyName: "Anderson Roofing",
    preparedByLabel: "Anderson Roofing",
    logoUrl: null,
    logoMonogram: "AR",
    brandPrimaryColor: null,
    brandSecondaryColor: null,
  },
  preparedFor: {
    customerName: "Jane Whitfield",
    customerEmail: "jane@example.com",
    customerPhone: null,
    hasAnyField: true,
  },
  project: {
    jobName: "Full roof replacement",
    propertyAddress: "1842 Bellview Terrace, Tulsa, OK 74104",
    hasAnyField: true,
  },
};

const CONTACT = {
  supportMessage:
    "We're happy to walk through anything in this proposal before you decide.",
  companyName: "Anderson Roofing",
  phone: "(918) 555-0142",
  email: "hello@andersonroofing.com",
  website: "andersonroofing.com",
  license: "OK-RC-40219",
  address: "220 S Elgin Ave, Tulsa, OK",
};

const DETAILS = {
  tabs: [
    {
      id: "warranty",
      title: "Warranty",
      body: "25-year manufacturer material warranty and a 10-year Anderson Roofing workmanship warranty.",
      isEmpty: false,
    },
    {
      id: "terms",
      title: "Terms",
      body: "Work begins once the deposit is received and the schedule is confirmed. Remaining balance is due on completion.",
      isEmpty: false,
    },
  ],
};

const FOOTER_METADATA = {
  proposalDateLabel: "August 26, 2026",
  proposalReferenceLabel: "P-1042",
  licenseLabel: "OK-RC-40219",
  insuredLabel: "Fully insured",
  hasAnyField: true,
};

const PREMIUM_ESTIMATE = {
  optionKey: "premium",
  label: "Premium",
  description: "Designer shingles with the longest protection we offer.",
  bullets: ["Designer architectural shingles", "25-year warranty", "Upgraded ice & water shield"],
  accent: "premium" as const,
  totalInvestmentLabel: "$15,000",
  confidenceCopy: "Built for lasting protection.",
  scopeGroupSummaries: [
    { title: "Tear-off & disposal", itemCount: 3, previewLabel: "Full tear-off to deck" },
    { title: "Roofing system", itemCount: 6, previewLabel: "Designer shingles" },
    { title: "Ventilation", itemCount: 2, previewLabel: "Ridge vent system" },
  ],
  includedDetails: [
    {
      title: "Roofing system",
      lines: [
        { name: "Designer architectural shingles", valueLabel: "Included", kind: "included" as const },
        { name: "Synthetic underlayment", valueLabel: "Included", kind: "included" as const },
        { name: "Ice & water shield", valueLabel: "Included", kind: "included" as const },
      ],
    },
  ],
};

const COMPARISON = {
  dimensions: [
    { label: "Shingle" },
    { label: "Warranty" },
    { label: "Underlayment" },
    { label: "Ventilation" },
  ],
  options: [
    {
      optionKey: "essential",
      label: "Essential",
      description: "A solid, code-compliant replacement.",
      bullets: ["Architectural shingles", "15-year warranty"],
      cells: [
        { valueLabel: "Architectural", availability: "included" as const },
        { valueLabel: "15 years", availability: "included" as const },
        { valueLabel: "Felt", availability: "included" as const },
        { valueLabel: "Standard vents", availability: "included" as const },
      ],
      totalInvestmentLabel: "$9,400",
      totalCents: ESSENTIAL_TOTAL_CENTS,
      accent: "standard" as const,
      isCurrent: false,
    },
    {
      optionKey: "standard",
      label: "Standard",
      description: "Better underlayment and improved airflow.",
      bullets: ["Architectural shingles", "20-year warranty", "Synthetic underlayment"],
      cells: [
        { valueLabel: "Architectural", availability: "included" as const },
        { valueLabel: "20 years", availability: "included" as const },
        { valueLabel: "Synthetic", availability: "included" as const },
        { valueLabel: "Ridge vent", availability: "included" as const },
      ],
      totalInvestmentLabel: "$11,800",
      totalCents: STANDARD_TOTAL_CENTS,
      accent: "standard" as const,
      isCurrent: false,
    },
    {
      optionKey: "premium",
      label: "Premium",
      description: "Designer shingles with the longest protection we offer.",
      bullets: ["Designer shingles", "25-year warranty", "Upgraded ice & water shield"],
      cells: [
        { valueLabel: "Designer", availability: "included" as const },
        { valueLabel: "25 years", availability: "included" as const },
        { valueLabel: "Synthetic", availability: "included" as const },
        { valueLabel: "Ridge vent + intake", availability: "included" as const },
      ],
      totalInvestmentLabel: "$15,000",
      totalCents: PREMIUM_TOTAL_CENTS,
      accent: "premium" as const,
      isCurrent: true,
    },
  ],
};

const UPGRADES = {
  items: [
    { name: "Ridge vent upgrade", valueLabel: "Included" },
    { name: "Gutter guard package", valueLabel: "Included" },
  ],
};

const PAID_REQUEST: JobPaymentRequestRow = {
  id: "req-premium-cohesion",
  company_id: "company-1",
  job_id: "job-1",
  proposal_id: "proposal-1",
  proposal_version_id: "version-1",
  proposal_option_id: "option-premium",
  proposal_acceptance_id: "acceptance-1",
  proposal_signature_id: null,
  amount_cents: 450000,
  currency: "usd",
  kind: "deposit",
  accepted_total_cents_snapshot: PREMIUM_TOTAL_CENTS,
  option_label_snapshot: "Premium",
  provider_account_id: "acct_test",
  provider_checkout_session_id: "cs_test",
  status: "open",
  requested_at: "2026-08-26T15:00:00.000Z",
  paid_at: null,
  cancelled_at: null,
  settled_payment_method_label: null,
};

function basePacket(): ProposalCustomerPacketViewModel {
  return {
    cover: COVER,
    estimate: PREMIUM_ESTIMATE,
    comparison: null,
    upgrades: UPGRADES,
    details: DETAILS,
    contact: CONTACT,
    footerMetadata: FOOTER_METADATA,
    acceptance: { status: "open", acceptedOnLabel: null },
    payment: null,
    paymentTerms: null,
    selectedTotalCents: PREMIUM_TOTAL_CENTS,
  };
}

function singleOfferDeposit(): ProposalCustomerPacketViewModel {
  return {
    ...basePacket(),
    paymentTerms: PERCENT_TERMS,
    payment: buildProspectiveDepositPaymentViewModel({
      terms: PERCENT_TERMS,
      selectedTotalCents: PREMIUM_TOTAL_CENTS,
    }),
  };
}

function multiOffer(): ProposalCustomerPacketViewModel {
  return { ...singleOfferDeposit(), comparison: COMPARISON };
}

function noDeposit(): ProposalCustomerPacketViewModel {
  return { ...basePacket(), paymentTerms: NO_DEPOSIT_TERMS, payment: null };
}

function pending(): ProposalCustomerPacketViewModel {
  return {
    ...basePacket(),
    paymentTerms: PERCENT_TERMS,
    acceptance: { status: "accepted", acceptedOnLabel: "August 26, 2026" },
    payment: buildPublicPaymentViewModel({
      requests: [{ ...PAID_REQUEST, status: "processing" }],
    }),
  };
}

function received(): ProposalCustomerPacketViewModel {
  return {
    ...basePacket(),
    paymentTerms: PERCENT_TERMS,
    acceptance: { status: "accepted", acceptedOnLabel: "August 26, 2026" },
    payment: buildPublicPaymentViewModel({
      requests: [
        {
          ...PAID_REQUEST,
          status: "paid",
          paid_at: "2026-08-26T16:12:00.000Z",
          settled_payment_method_label: "Visa •••• 4242",
        },
      ],
    }),
  };
}

function failed(): ProposalCustomerPacketViewModel {
  return {
    ...basePacket(),
    paymentTerms: PERCENT_TERMS,
    payment: buildPublicPaymentViewModel({
      requests: [{ ...PAID_REQUEST, status: "failed" }],
    }),
  };
}

const SCENARIOS: Record<string, () => ProposalCustomerPacketViewModel> = {
  "single-deposit": singleOfferDeposit,
  "multi-option": multiOffer,
  "no-deposit": noDeposit,
  pending,
  received,
  failed,
};

export default function PremiumCohesionCustomerHarness() {
  const params = useSearchParams();
  const requested = (params.get("show") ?? "single-deposit").trim();
  const build = SCENARIOS[requested] ?? singleOfferDeposit;

  return (
    <ProposalPacket packet={build()} mode="public" publicAccessToken="premium-cohesion-harness" />
  );
}
