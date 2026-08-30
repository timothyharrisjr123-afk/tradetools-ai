"use client";

import { useState } from "react";
import type { ProposalCustomerPacketCoverViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_CUSTOMER_PACKET_HEADER_DOWNLOAD_PDF_LABEL } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  CUSTOMER_PDF_PREPARING_LABEL,
  CUSTOMER_PDF_UNAVAILABLE_MESSAGE,
} from "@/app/lib/proposalPdfPublicDownload";
import { downloadPublicProposalPdf } from "@/app/lib/proposalPdfPublicDownloadClient";
import { IconDownload } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_TOP_BAR,
  PROPOSAL_PACKET_TOP_BAR_ACTION,
  PROPOSAL_PACKET_TOP_BAR_MARK,
} from "./proposalPacketStyles";

type ProposalPacketTopBarProps = {
  cover: ProposalCustomerPacketCoverViewModel;
  /** Raw public access token — enables quiet Download PDF when present. */
  publicAccessToken?: string | null;
};

function BrandMark({ cover }: { cover: ProposalCustomerPacketCoverViewModel }) {
  const monogram = (cover.company.logoMonogram ?? "FD").slice(0, 2).toUpperCase();

  if (cover.company.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover.company.logoUrl}
        alt=""
        className={`${PROPOSAL_PACKET_TOP_BAR_MARK} bg-white object-contain p-1.5`}
      />
    );
  }

  return <div className={PROPOSAL_PACKET_TOP_BAR_MARK}>{monogram}</div>;
}

/** Dark navy contractor brand bar — approved target. */
export default function ProposalPacketTopBar({
  cover,
  publicAccessToken = null,
}: ProposalPacketTopBarProps) {
  const companyName = (cover.company.companyName ?? "").trim();
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
    <div className={PROPOSAL_PACKET_TOP_BAR} aria-label="Company brand">
      <div className="flex min-w-0 items-center gap-3.5">
        <BrandMark cover={cover} />
        {companyName ? (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[0.08em] text-white sm:text-[16px]">
              {companyName.toUpperCase()}
            </p>
            <p className="mt-0.5 text-[11px] font-medium tracking-[0.04em] text-white/55">
              Roofing proposal
            </p>
          </div>
        ) : null}
      </div>

      {token ? (
        <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={busy}
            aria-busy={busy}
            aria-label={
              busy
                ? CUSTOMER_PDF_PREPARING_LABEL
                : PROPOSAL_CUSTOMER_PACKET_HEADER_DOWNLOAD_PDF_LABEL
            }
            className={`${PROPOSAL_PACKET_TOP_BAR_ACTION} min-h-[44px] rounded-md px-2 py-2 transition-colors hover:text-white disabled:cursor-wait disabled:opacity-70`}
          >
            <IconDownload className="h-4 w-4 shrink-0 opacity-80" />
            <span className="whitespace-nowrap">
              {busy
                ? CUSTOMER_PDF_PREPARING_LABEL
                : PROPOSAL_CUSTOMER_PACKET_HEADER_DOWNLOAD_PDF_LABEL}
            </span>
          </button>
          {error ? (
            <p className="max-w-[16rem] text-[11px] font-medium text-white/55" role="status">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
