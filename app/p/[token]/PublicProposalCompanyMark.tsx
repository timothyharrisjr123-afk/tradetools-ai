"use client";

import { useState } from "react";
import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import type { ProposalPublicCompanyBrandingBlock } from "@/app/lib/proposalPublicProposalViewModel";

type PublicProposalCompanyMarkProps = {
  company: ProposalPublicCompanyBrandingBlock;
  size?: "sm" | "md";
};

export default function PublicProposalCompanyMark({
  company,
  size = "md",
}: PublicProposalCompanyMarkProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const accentColor = company.brandPrimaryColor ?? PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;
  const showLogo = Boolean(company.logoUrl) && !logoFailed;
  const showMonogram = !showLogo && Boolean(company.logoMonogram);
  const dimension = size === "sm" ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm";

  if (!showLogo && !showMonogram) {
    return null;
  }

  if (showLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={company.logoUrl!}
        alt=""
        className={`${dimension} shrink-0 rounded-lg border border-slate-200/80 bg-white object-contain p-1`}
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${dimension} shrink-0 items-center justify-center rounded-lg font-semibold text-white`}
      style={{ backgroundColor: accentColor }}
      aria-hidden
    >
      {company.logoMonogram}
    </div>
  );
}
