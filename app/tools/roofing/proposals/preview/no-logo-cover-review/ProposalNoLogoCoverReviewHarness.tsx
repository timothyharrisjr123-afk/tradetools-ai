"use client";

import ProposalCustomerPreviewPacketCover from "@/app/tools/roofing/proposals/preview/ProposalCustomerPreviewPacketCover";
import type { ProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";

/**
 * Visual component proof — true no-logo cover (logoUrl absent).
 * Labeled harness only; does not mutate production company branding.
 */
const NO_LOGO_COVER: ProposalCoverViewModel = {
  headline: "1842 Oak Ridge Dr",
  company: {
    companyName: "Anderson Roofing",
    logoUrl: null,
    logoMonogram: "AR",
    phone: "(512) 555-0142",
    email: "hello@andersonroofing.example",
    license: null,
    address: "Austin, TX",
    website: null,
    brandPrimaryColor: null,
    brandSecondaryColor: null,
    hasAnyField: true,
  },
  customer: {
    customerName: "Jordan Ellis",
    customerEmail: "jordan@example.com",
    customerPhone: null,
    customerAddress: null,
    mailingAddressDeduped: true,
    hasAnyField: true,
  },
  project: {
    jobName: "1842 Oak Ridge Dr",
    jobAddress: "1842 Oak Ridge Dr, Austin, TX 78704",
    hasAnyField: true,
  },
  meta: {
    proposalNumber: "FD-NOLOGO-VISUAL",
    proposalCreatedDate: "Sep 3, 2026",
    templateName: "Standard",
    hasAnyField: true,
  },
  packageSummary: {
    packageName: "Standard package",
    totalDisplay: null,
    pricingComplete: false,
    pricingIncompleteMessage: null,
  },
  measurementSummary: null,
  documentIdentityIncomplete: false,
  documentIdentityIncompleteMessage: null,
};

export default function ProposalNoLogoCoverReviewHarness() {
  return (
    <div
      className="mx-auto max-w-3xl bg-white px-5 py-8 sm:px-8"
      data-preview-nologo-cover-harness
      data-preview-nologo-proof="component"
    >
      <p
        className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
        data-preview-nologo-proof-label
      >
        Visual component proof · logoUrl absent
      </p>
      <ProposalCustomerPreviewPacketCover
        viewModel={NO_LOGO_COVER}
        accentColor={PROPOSAL_COVER_DEFAULT_BRAND_ACCENT}
        selectedPackageLabel="Standard package"
      />
    </div>
  );
}
