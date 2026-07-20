"use client";

import { useState } from "react";
import type { ProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import {
  PACKET_DIVIDER,
  PACKET_HERO_META,
  PACKET_HERO_TITLE,
  PACKET_IDENTITY_CONTACT,
  PACKET_IDENTITY_NAME,
  PACKET_INFO_DETAIL,
  PACKET_INFO_LABEL,
  PACKET_INFO_VALUE,
  PACKET_SECTION_PAD,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPacketCoverProps = {
  viewModel: ProposalCoverViewModel;
};

/**
 * Block 5C — packet cover: brand identity + proposal hero + prepared-for/project.
 *
 * The proposal title is the one hero moment in the document — largest and
 * boldest text on the page. No card border around this zone; it is the top
 * of the single continuous paper surface.
 */
export default function ProposalCustomerPreviewPacketCover({
  viewModel,
}: ProposalCustomerPreviewPacketCoverProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const { company, customer, project, meta, measurementSummary, headline } = viewModel;
  const accentColor = company.brandPrimaryColor ?? PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;
  const showLogo = Boolean(company.logoUrl) && !logoFailed;
  const showMonogram = !showLogo && Boolean(company.logoMonogram);

  const metaLine = [meta.proposalCreatedDate, measurementSummary]
    .filter((part): part is string => Boolean(part))
    .join("  ·  ");

  return (
    <div data-preview-packet-cover>
      {company.hasAnyField ? (
        <div
          className={`${PACKET_SECTION_PAD} flex flex-col gap-3 pb-6 pt-7 sm:flex-row sm:items-start sm:justify-between sm:gap-6`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoUrl!}
                alt=""
                className="h-10 w-auto shrink-0 object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : showMonogram ? (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                style={{ backgroundColor: accentColor }}
                aria-hidden
              >
                {company.logoMonogram}
              </span>
            ) : null}
            {company.companyName ? (
              <p className={PACKET_IDENTITY_NAME}>{company.companyName}</p>
            ) : null}
          </div>
          <div className={`space-y-0.5 sm:shrink-0 sm:text-right ${PACKET_IDENTITY_CONTACT}`}>
            {company.phone ? <p>{company.phone}</p> : null}
            {company.website ? <p>{company.website}</p> : null}
            {company.license ? <p>License {company.license}</p> : null}
          </div>
        </div>
      ) : null}

      <div className={PACKET_DIVIDER} />

      <div className={`${PACKET_SECTION_PAD} pb-8 pt-8`}>
        <h1 className={PACKET_HERO_TITLE}>{headline}</h1>
        {metaLine ? <p className={`mt-2.5 ${PACKET_HERO_META}`}>{metaLine}</p> : null}

        {customer.hasAnyField || project.hasAnyField ? (
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {customer.hasAnyField ? (
              <div>
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
              <div>
                <p className={PACKET_INFO_LABEL}>Project</p>
                {project.jobAddress ? (
                  <p className={PACKET_INFO_VALUE}>{project.jobAddress}</p>
                ) : project.jobName ? (
                  <p className={PACKET_INFO_VALUE}>{project.jobName}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
