"use client";

import { useState } from "react";
import type { ProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import {
  PACKET_BRAND_BAND,
  PACKET_BRAND_BAND_INNER,
  PACKET_BRAND_CONTACT,
  PACKET_BRAND_MONOGRAM,
  PACKET_BRAND_NAME,
  PACKET_HERO_EYEBROW,
  PACKET_HERO_META,
  PACKET_HERO_PANEL,
  PACKET_HERO_PREPARED_BY,
  PACKET_HERO_TITLE,
  PACKET_INFO_DETAIL,
  PACKET_INFO_GRID,
  PACKET_INFO_LABEL,
  PACKET_INFO_TILE,
  PACKET_INFO_VALUE,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPacketCoverProps = {
  viewModel: ProposalCoverViewModel;
  accentColor: string;
};

function resolveProposalHeroTitle(headline: string): string {
  const trimmed = headline.trim();
  if (!trimmed) return "Proposal";
  if (/\bproposal\b/i.test(trimmed)) return trimmed;
  return `${trimmed} proposal`;
}

/**
 * Branded proposal cover: solid brand band + hero + premium info tiles.
 * This is the sales document's opening composition — not plain text on white.
 */
export default function ProposalCustomerPreviewPacketCover({
  viewModel,
  accentColor,
}: ProposalCustomerPreviewPacketCoverProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const { company, customer, project, meta, measurementSummary, headline } = viewModel;
  const brand = accentColor || PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;
  const showLogo = Boolean(company.logoUrl) && !logoFailed;
  const showMonogram = !showLogo && Boolean(company.logoMonogram);
  const heroTitle = resolveProposalHeroTitle(headline);

  const metaLine = [meta.proposalCreatedDate, measurementSummary]
    .filter((part): part is string => Boolean(part))
    .join("  ·  ");

  return (
    <div data-preview-packet-cover data-preview-proposal-hero>
      {/* Solid brand cover band — company identity with real visual weight */}
      <div className={PACKET_BRAND_BAND} style={{ backgroundColor: brand }} data-preview-brand-band>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 120% at 100% 0%, #fff 0%, transparent 55%)",
          }}
          aria-hidden
        />
        <div className={PACKET_BRAND_BAND_INNER}>
          <div className="relative flex min-w-0 items-center gap-3.5">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl!}
                alt=""
                className="h-12 w-auto shrink-0 rounded-lg bg-white/95 object-contain p-1"
                onError={() => setLogoFailed(true)}
              />
            ) : showMonogram ? (
              <span
                className={PACKET_BRAND_MONOGRAM}
                style={{ backgroundColor: "#ffffff", color: brand }}
                aria-hidden
              >
                {company.logoMonogram}
              </span>
            ) : null}
            <div className="min-w-0">
              {company.companyName ? (
                <p className={PACKET_BRAND_NAME}>{company.companyName}</p>
              ) : null}
              {company.license ? (
                <p className={`${PACKET_BRAND_CONTACT} mt-0.5`}>License {company.license}</p>
              ) : null}
            </div>
          </div>
          <div className={`relative space-y-0.5 sm:text-right ${PACKET_BRAND_CONTACT}`}>
            {company.phone ? <p>{company.phone}</p> : null}
            {company.email ? <p>{company.email}</p> : null}
            {company.website ? <p>{company.website}</p> : null}
          </div>
        </div>
      </div>

      {/* Hero + prepared-for / project tiles */}
      <div className={PACKET_HERO_PANEL}>
        <p className={PACKET_HERO_EYEBROW}>Customer proposal</p>
        <h1 className={PACKET_HERO_TITLE}>{heroTitle}</h1>
        {metaLine ? <p className={PACKET_HERO_META}>{metaLine}</p> : null}
        {company.companyName ? (
          <p className={PACKET_HERO_PREPARED_BY}>Prepared by {company.companyName}</p>
        ) : null}

        {customer.hasAnyField || project.hasAnyField ? (
          <div className={PACKET_INFO_GRID}>
            {customer.hasAnyField ? (
              <div
                className={PACKET_INFO_TILE}
                style={{ borderLeftColor: brand }}
                data-preview-prepared-for
              >
                <p className={PACKET_INFO_LABEL}>Prepared for</p>
                {customer.customerName ? (
                  <p className={PACKET_INFO_VALUE}>{customer.customerName}</p>
                ) : null}
                {customer.customerEmail ? (
                  <p className={PACKET_INFO_DETAIL}>{customer.customerEmail}</p>
                ) : null}
                {customer.customerPhone ? (
                  <p className={PACKET_INFO_DETAIL}>{customer.customerPhone}</p>
                ) : null}
                {customer.customerAddress ? (
                  <p className={PACKET_INFO_DETAIL}>{customer.customerAddress}</p>
                ) : null}
              </div>
            ) : null}
            {project.hasAnyField ? (
              <div
                className={PACKET_INFO_TILE}
                style={{ borderLeftColor: brand }}
                data-preview-project-info
              >
                <p className={PACKET_INFO_LABEL}>Project</p>
                {project.jobAddress ? (
                  <p className={PACKET_INFO_VALUE}>{project.jobAddress}</p>
                ) : project.jobName ? (
                  <p className={PACKET_INFO_VALUE}>{project.jobName}</p>
                ) : null}
                {project.jobName && project.jobAddress ? (
                  <p className={PACKET_INFO_DETAIL}>{project.jobName}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
