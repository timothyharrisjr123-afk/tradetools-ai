"use client";

import { useState } from "react";
import type { ProposalCustomerPacketCoverViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_HEADER_DOWNLOAD_PDF_LABEL,
  PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  CUSTOMER_PDF_PREPARING_LABEL,
  CUSTOMER_PDF_UNAVAILABLE_MESSAGE,
} from "@/app/lib/proposalPdfPublicDownload";
import { downloadPublicProposalPdf } from "@/app/lib/proposalPdfPublicDownloadClient";
import ProposalPacketCompanyMark from "./ProposalPacketCompanyMark";
import { IconDownload, IconShare } from "./ProposalPacketIcons";
import { PROPOSAL_PACKET_HEADER, PROPOSAL_PACKET_HEADER_ACTION } from "./proposalPacketStyles";

type ProposalPacketHeaderProps = {
  cover: ProposalCustomerPacketCoverViewModel;
  /** Raw public access token — enables Download PDF when present. */
  publicAccessToken?: string | null;
};

function FutureActionChip({
  icon: Icon,
  label,
}: {
  icon: typeof IconDownload;
  label: string;
}) {
  return (
    <span
      className={PROPOSAL_PACKET_HEADER_ACTION}
      aria-disabled="true"
      title="Coming soon"
    >
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

export default function ProposalPacketHeader({
  cover,
  publicAccessToken = null,
}: ProposalPacketHeaderProps) {
  const token = (publicAccessToken ?? "").trim();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await downloadPublicProposalPdf({ rawToken: token });
      if (!result.ok) {
        setError(result.message || CUSTOMER_PDF_UNAVAILABLE_MESSAGE);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={PROPOSAL_PACKET_HEADER} aria-label="Proposal header">
      <div className="flex min-w-0 items-center gap-4">
        <ProposalPacketCompanyMark company={cover.company} variant="hero" />
        <div className="min-w-0">
          {cover.company.companyName ? (
            <p className="text-base font-bold tracking-tight text-[#0f172a] sm:text-lg">
              {cover.company.companyName}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs font-medium text-[#64748b] sm:text-sm">
            {PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-1 sm:items-end">
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {token ? (
            <button
              type="button"
              onClick={() => void onDownload()}
              disabled={busy}
              aria-busy={busy}
              className={`${PROPOSAL_PACKET_HEADER_ACTION} min-h-[44px] disabled:opacity-60`}
            >
              <IconDownload className="h-4 w-4" />
              {busy
                ? CUSTOMER_PDF_PREPARING_LABEL
                : PROPOSAL_CUSTOMER_PACKET_HEADER_DOWNLOAD_PDF_LABEL}
            </button>
          ) : null}
          <FutureActionChip
            icon={IconShare}
            label={PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL}
          />
        </div>
        {error ? (
          <p className="text-[12px] text-[#64748b]" role="status">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
