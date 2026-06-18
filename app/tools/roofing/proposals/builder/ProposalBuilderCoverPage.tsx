"use client";

import { useState, type ReactNode } from "react";
import type { ProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import {
  BUILDER_CANVAS,
  BUILDER_CANVAS_HERO_DIVIDER,
  BUILDER_CANVAS_KICKER,
  BUILDER_COVER_DRAFT_NOTICE,
  BUILDER_COVER_IDENTITY_INCOMPLETE,
  BUILDER_COVER_SECTION_LABEL,
} from "./proposalBuilderConstants";

type ProposalBuilderCoverPageProps = {
  viewModel: ProposalCoverViewModel;
};

function CoverDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-[15px] leading-snug text-slate-800">{value}</p>
    </div>
  );
}

function CoverSection({
  title,
  visible,
  children,
}: {
  title: string;
  visible: boolean;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <section className="space-y-3">
      <h3 className={BUILDER_COVER_SECTION_LABEL}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function ProposalBuilderCoverPage({ viewModel }: ProposalBuilderCoverPageProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const accentColor =
    viewModel.company.brandPrimaryColor ?? PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;
  const showLogo = Boolean(viewModel.company.logoUrl) && !logoFailed;
  const showMonogram = !showLogo && Boolean(viewModel.company.logoMonogram);

  const titleMetaParts = [
    viewModel.meta.proposalCreatedDate,
    viewModel.meta.proposalNumber ? `#${viewModel.meta.proposalNumber}` : null,
  ].filter(Boolean) as string[];

  const preparedForVisible = viewModel.customer.hasAnyField;
  const projectVisible = viewModel.project.hasAnyField;

  return (
    <article className={BUILDER_CANVAS}>
      <div
        className="h-1.5 w-full shrink-0"
        style={{ backgroundColor: accentColor }}
        aria-hidden
      />

      <header className={BUILDER_CANVAS_HERO_DIVIDER}>
        <div className="space-y-6 px-7 pb-6 pt-6">
          <p className={BUILDER_CANVAS_KICKER}>Proposal document</p>

          {viewModel.documentIdentityIncomplete ? (
            <p className={BUILDER_COVER_IDENTITY_INCOMPLETE}>
              {viewModel.documentIdentityIncompleteMessage}
            </p>
          ) : null}

          {/* 1. Company identity */}
          {viewModel.company.hasAnyField ? (
            <div className="flex min-w-0 items-start gap-4">
              {showLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewModel.company.logoUrl!}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg border border-slate-200/80 bg-white object-contain p-1"
                  onError={() => setLogoFailed(true)}
                />
              ) : showMonogram ? (
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                  aria-hidden
                >
                  {viewModel.company.logoMonogram}
                </div>
              ) : null}

              <div className="min-w-0 space-y-0.5">
                {viewModel.company.companyName ? (
                  <p className="text-lg font-semibold tracking-tight text-slate-950">
                    {viewModel.company.companyName}
                  </p>
                ) : null}
                {viewModel.company.address ? (
                  <p className="text-sm text-slate-600">{viewModel.company.address}</p>
                ) : null}
                {viewModel.company.phone ? (
                  <p className="text-sm text-slate-600">{viewModel.company.phone}</p>
                ) : null}
                {viewModel.company.website ? (
                  <p className="text-sm text-slate-500">{viewModel.company.website}</p>
                ) : null}
                {viewModel.company.license ? (
                  <p className="text-xs text-slate-500">License {viewModel.company.license}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 2. Proposal title / meta */}
          <div className="space-y-1 border-t border-slate-100 pt-5">
            <h2 className="text-[2rem] font-semibold leading-tight tracking-tight text-slate-950">
              {viewModel.headline}
            </h2>
            {titleMetaParts.length > 0 ? (
              <p className="text-sm text-slate-500">{titleMetaParts.join(" · ")}</p>
            ) : null}
            {viewModel.measurementSummary ? (
              <p className="text-sm text-slate-500">{viewModel.measurementSummary}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="space-y-8 px-7 pb-8 pt-6">
        <div className="grid gap-8 md:grid-cols-2">
          {/* 3. Prepared for */}
          <CoverSection title="Prepared for" visible={preparedForVisible}>
            {viewModel.customer.customerName ? (
              <p className="text-[15px] font-medium leading-snug text-slate-800">
                {viewModel.customer.customerName}
              </p>
            ) : null}
            {viewModel.customer.customerEmail ? (
              <CoverDetailRow label="Email" value={viewModel.customer.customerEmail} />
            ) : null}
            {viewModel.customer.customerPhone ? (
              <CoverDetailRow label="Phone" value={viewModel.customer.customerPhone} />
            ) : null}
            {viewModel.customer.customerAddress ? (
              <CoverDetailRow label="Mailing address" value={viewModel.customer.customerAddress} />
            ) : null}
          </CoverSection>

          {/* 4. Project */}
          <CoverSection title="Project" visible={projectVisible}>
            {viewModel.project.jobName ? (
              <p className="text-[15px] font-medium leading-snug text-slate-800">
                {viewModel.project.jobName}
              </p>
            ) : null}
            {viewModel.project.jobAddress ? (
              <CoverDetailRow label="Site address" value={viewModel.project.jobAddress} />
            ) : null}
          </CoverSection>
        </div>

        {/* 5. Investment summary */}
        {(viewModel.packageSummary.packageName ||
          viewModel.packageSummary.totalDisplay ||
          viewModel.packageSummary.pricingIncompleteMessage) && (
          <section className="border-t border-slate-100 pt-6">
            <h3 className={BUILDER_COVER_SECTION_LABEL}>Investment summary</h3>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                {viewModel.packageSummary.packageName ? (
                  <p className="text-sm font-medium text-slate-700">
                    {viewModel.packageSummary.packageName}
                  </p>
                ) : null}
                {viewModel.packageSummary.pricingIncompleteMessage ? (
                  <p className="text-sm text-slate-500">
                    {viewModel.packageSummary.pricingIncompleteMessage}
                  </p>
                ) : null}
              </div>
              {viewModel.packageSummary.totalDisplay ? (
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-950">
                  {viewModel.packageSummary.totalDisplay}
                </p>
              ) : null}
            </div>
          </section>
        )}

        {/* 6. Draft / read-only note */}
        <p className={BUILDER_COVER_DRAFT_NOTICE}>
          Draft document — not sent. Preview, send, and signature remain unavailable in this stage.
        </p>
      </div>
    </article>
  );
}
