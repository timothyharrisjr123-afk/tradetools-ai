"use client";

import { useState } from "react";
import type { ProposalCustomerPacketCompanyIdentity } from "@/app/lib/proposalCustomerPacketViewModel";

type ProposalPacketCompanyMarkProps = {
  company: ProposalCustomerPacketCompanyIdentity;
  variant?: "hero" | "default";
};

export default function ProposalPacketCompanyMark({
  company,
  variant = "default",
}: ProposalPacketCompanyMarkProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(company.logoUrl) && !logoFailed;
  const showMonogram = !showLogo && Boolean(company.logoMonogram);

  if (!showLogo && !showMonogram) {
    return null;
  }

  const heroClass = "h-12 w-12 rounded-xl text-base font-bold";
  const defaultClass = "h-10 w-10 rounded-lg text-sm font-bold";

  if (showLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={company.logoUrl!}
        alt=""
        className={`${variant === "hero" ? heroClass : defaultClass} shrink-0 border border-slate-200/60 bg-white object-contain p-1`}
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${variant === "hero" ? heroClass : defaultClass} shrink-0 items-center justify-center bg-[#071f3a] font-semibold tracking-tight text-white`}
      aria-hidden
    >
      {company.logoMonogram}
    </div>
  );
}
