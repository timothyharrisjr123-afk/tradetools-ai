"use client";

import { useState } from "react";
import { Home, MapPin, Ruler, ShieldCheck } from "lucide-react";
import type { ProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import {
  PACKET_ACCENT_RULE,
  PACKET_HERO_EYEBROW,
  PACKET_HERO_META,
  PACKET_HERO_PANEL,
  PACKET_HERO_TITLE,
  PACKET_IDENTITY_CONTACT,
  PACKET_IDENTITY_NAME,
  PACKET_IDENTITY_ROW,
  PACKET_INFO_CELL,
  PACKET_INFO_DETAIL,
  PACKET_INFO_GRID,
  PACKET_INFO_LABEL,
  PACKET_INFO_VALUE,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPacketCoverProps = {
  viewModel: ProposalCoverViewModel;
  accentColor: string;
  selectedPackageLabel: string | null;
};

function resolveProposalHeroTitle(headline: string): string {
  const trimmed = headline.trim();
  if (!trimmed) return "Proposal";
  if (/\bproposal\b/i.test(trimmed)) return trimmed;
  return `${trimmed} proposal`;
}

/**
 * Customer-safe proposal opening — company identity, title, prepared-for / project.
 * No FieldDive controls. No oversized marketing hero.
 */
export default function ProposalCustomerPreviewPacketCover({
  viewModel,
  accentColor,
  selectedPackageLabel,
}: ProposalCustomerPreviewPacketCoverProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const { company, customer, project, meta, measurementSummary, headline } = viewModel;
  const brand = accentColor || PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;
  const showLogo = Boolean(company.logoUrl) && !logoFailed;
  const showMonogram = !showLogo && Boolean(company.logoMonogram);
  const heroTitle = resolveProposalHeroTitle(headline);
  const projectLabel = headline.trim().replace(/\s+proposal$/i, "") || "Roof replacement";

  const metaLine = meta.proposalCreatedDate;

  return (
    <div data-preview-packet-cover data-preview-proposal-hero>
      <div className={PACKET_ACCENT_RULE} style={{ backgroundColor: brand }} aria-hidden />

      {company.hasAnyField ? (
        <div className={`${PACKET_IDENTITY_ROW} mt-5`} data-preview-compact-identity>
          <div className="flex min-w-0 items-center gap-3">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl!}
                alt=""
                className="h-9 w-auto max-w-[9rem] shrink-0 object-contain"
                onError={() => setLogoFailed(true)}
                onLoad={(event) => {
                  if (event.currentTarget.naturalWidth < 2) {
                    setLogoFailed(true);
                  }
                }}
              />
            ) : showMonogram ? (
              <span
                className="text-[13px] font-semibold tracking-[0.14em] text-slate-800"
                data-preview-brand-fallback="initials"
                aria-hidden
              >
                {company.logoMonogram}
              </span>
            ) : null}
            <div className="min-w-0" data-preview-brand-wordmark="">
              {company.companyName ? (
                <p className={PACKET_IDENTITY_NAME}>{company.companyName}</p>
              ) : null}
              {company.license ? (
                <p className={PACKET_IDENTITY_CONTACT}>License {company.license}</p>
              ) : null}
            </div>
          </div>
          <div className={`space-y-0.5 sm:text-right ${PACKET_IDENTITY_CONTACT}`}>
            {company.phone ? <p>{company.phone}</p> : null}
            {company.email ? <p>{company.email}</p> : null}
            {company.website ? <p>{company.website}</p> : null}
          </div>
        </div>
      ) : null}

      <div className={PACKET_HERO_PANEL}>
        <p className={PACKET_HERO_EYEBROW} data-preview-document-eyebrow>
          Proposal
        </p>
        <h2 className={PACKET_HERO_TITLE} data-preview-document-title>
          {heroTitle}
        </h2>
        {metaLine ? <p className={PACKET_HERO_META}>{metaLine}</p> : null}

        {customer.hasAnyField || project.hasAnyField || selectedPackageLabel ? (
          <div className={PACKET_INFO_GRID} data-preview-project-snapshot>
            {customer.hasAnyField ? (
              <div className={PACKET_INFO_CELL} data-preview-prepared-for>
                <div className="flex items-center gap-2">
                  <Home className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                  <p className={PACKET_INFO_LABEL}>Prepared for</p>
                </div>
                {customer.customerName ? (
                  <p className={PACKET_INFO_VALUE}>{customer.customerName}</p>
                ) : null}
                {customer.customerEmail ? (
                  <p className={PACKET_INFO_DETAIL}>{customer.customerEmail}</p>
                ) : null}
                {customer.customerPhone ? (
                  <p className={PACKET_INFO_DETAIL}>{customer.customerPhone}</p>
                ) : null}
              </div>
            ) : null}

            {project.hasAnyField || customer.customerAddress ? (
              <div className={PACKET_INFO_CELL} data-preview-project-info>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                  <p className={PACKET_INFO_LABEL}>Property</p>
                </div>
                <p className={PACKET_INFO_VALUE}>
                  {project.jobAddress ?? customer.customerAddress ?? project.jobName}
                </p>
              </div>
            ) : null}

            <div className={PACKET_INFO_CELL} data-preview-project-scope>
              <div className="flex items-center gap-2">
                <Ruler className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                <p className={PACKET_INFO_LABEL}>Project</p>
              </div>
              <p className={PACKET_INFO_VALUE}>{projectLabel}</p>
              {measurementSummary ? (
                <p className={PACKET_INFO_DETAIL}>{measurementSummary}</p>
              ) : null}
            </div>

            {selectedPackageLabel ? (
              <div className={PACKET_INFO_CELL} data-preview-project-package>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                  <p className={PACKET_INFO_LABEL}>Package</p>
                </div>
                <p className={PACKET_INFO_VALUE}>{selectedPackageLabel}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
