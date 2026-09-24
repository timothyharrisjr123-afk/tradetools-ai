"use client";

import { useState } from "react";
import {
  CUSTOMER_PDF_PREPARING_LABEL,
  CUSTOMER_PDF_UNAVAILABLE_MESSAGE,
} from "@/app/lib/proposalPdfPublicDownload";
import { downloadPublicProposalPdf } from "@/app/lib/proposalPdfPublicDownloadClient";
import {
  PUBLIC_PROJECT_RECORD_AGREEMENT_HEADING,
  PUBLIC_PROJECT_RECORD_CHANGES_HEADING,
  PUBLIC_PROJECT_RECORD_CHANGES_TOTAL_LABEL,
  PUBLIC_PROJECT_RECORD_CHANGE_TOTAL_LABEL,
  PUBLIC_PROJECT_RECORD_CURRENT_LABEL,
  PUBLIC_PROJECT_RECORD_HEADING,
  PUBLIC_PROJECT_RECORD_HISTORY_HEADING,
  PUBLIC_PROJECT_RECORD_MONEY_HEADING,
  PUBLIC_PROJECT_RECORD_ORIGINAL_LABEL,
  PUBLIC_PROJECT_RECORD_RECEIVED_LABEL,
  PUBLIC_PROJECT_RECORD_REFUNDED_LABEL,
  type PublicProjectRecordViewModel,
} from "@/app/lib/publicProjectRecordViewModel";
import { IconCheck, IconDownload } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_CTA_SECONDARY,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_PURCHASE_DIVIDER,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketProjectRecordProps = {
  record: PublicProjectRecordViewModel;
  /** Raw public access token — the only authority for the agreement PDF. */
  publicAccessToken: string | null;
};

function Row({
  label,
  value,
  strong = false,
  dataAttr,
}: {
  label: string;
  value: string;
  strong?: boolean;
  dataAttr?: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-baseline justify-between gap-4 ${strong ? "font-semibold" : ""}`}
      {...(dataAttr ? { [dataAttr]: "" } : {})}
    >
      <dt className={strong ? "text-[#0b1f33]" : "text-[#64748b]"}>{label}</dt>
      <dd className={`shrink-0 tabular-nums ${strong ? "text-[#0b1f33]" : "text-[#334155]"}`}>
        {value}
      </dd>
    </div>
  );
}

/** Customer project record — dated facts only, composed server-side. */
export default function ProposalPacketProjectRecord({
  record,
  publicAccessToken,
}: ProposalPacketProjectRecordProps) {
  const token = (publicAccessToken ?? "").trim();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await downloadPublicProposalPdf({ rawToken: token });
      if (!result.ok) setError(result.message || CUSTOMER_PDF_UNAVAILABLE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const { agreement, approvedChanges, contract, money, history, completion } = record;

  return (
    <div data-public-project-record>
      <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>{PUBLIC_PROJECT_RECORD_HEADING}</h2>

      {completion ? (
        <p
          className="mt-2 flex flex-wrap items-center gap-x-2 text-[14px] font-medium text-emerald-700"
          data-public-project-record-completion
        >
          <IconCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {completion.dateLabel ? `${completion.label} · ${completion.dateLabel}` : completion.label}
          </span>
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-6">
        <section aria-label={PUBLIC_PROJECT_RECORD_AGREEMENT_HEADING} data-public-project-record-agreement>
          <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PUBLIC_PROJECT_RECORD_AGREEMENT_HEADING}</p>
          {agreement.packageLabel ? (
            <p className="mt-1.5 text-[15px] font-semibold text-[#0b1f33] [overflow-wrap:anywhere]">
              {agreement.packageLabel}
            </p>
          ) : null}
          <p className="mt-1 text-[13.5px] text-[#475569]">{agreement.acceptedLabel}</p>
          {agreement.signedLabel ? (
            <p className="mt-0.5 text-[13.5px] text-[#475569] [overflow-wrap:anywhere]" data-public-project-record-signed>
              {agreement.signedLabel}
            </p>
          ) : null}
          {token ? (
            <div className="mt-3">
              <button
                type="button"
                className={`${PROPOSAL_PACKET_CTA_SECONDARY} gap-2 disabled:cursor-wait disabled:opacity-70`}
                onClick={() => void onDownload()}
                disabled={busy}
                aria-busy={busy || undefined}
                data-public-project-record-download
              >
                <IconDownload className="h-4 w-4 shrink-0 opacity-80" />
                <span>{busy ? CUSTOMER_PDF_PREPARING_LABEL : agreement.downloadLabel}</span>
              </button>
              {error ? (
                <p className="mt-1.5 text-[12.5px] text-[#64748b]" role="status">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {money ? (
          <section aria-label={PUBLIC_PROJECT_RECORD_MONEY_HEADING} data-public-project-record-money>
            <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PUBLIC_PROJECT_RECORD_MONEY_HEADING}</p>
            {money.state === "unavailable" ? (
              <p className="mt-1.5 text-[13.5px] text-[#475569]" data-public-project-record-money-unavailable>
                {money.message}
              </p>
            ) : (
              <dl className="mt-1.5 space-y-1.5 text-[13.5px]">
                {contract ? (
                  <>
                    <Row label={PUBLIC_PROJECT_RECORD_ORIGINAL_LABEL} value={contract.originalLabel} />
                    <Row label={PUBLIC_PROJECT_RECORD_CHANGES_TOTAL_LABEL} value={contract.changesLabel} />
                  </>
                ) : null}
                <Row
                  label={PUBLIC_PROJECT_RECORD_CURRENT_LABEL}
                  value={money.currentContractLabel}
                  strong
                  dataAttr="data-public-project-record-current"
                />
                <Row label={PUBLIC_PROJECT_RECORD_RECEIVED_LABEL} value={money.paymentsReceivedLabel} />
                {money.refundedLabel ? (
                  <Row label={PUBLIC_PROJECT_RECORD_REFUNDED_LABEL} value={money.refundedLabel} />
                ) : null}
                <div className="pt-1">
                  <p
                    className={`text-[13.5px] font-semibold ${money.hasBalance ? "text-[#0b1f33]" : "text-emerald-700"}`}
                    data-public-project-record-balance
                  >
                    {money.balanceLabel}
                  </p>
                </div>
              </dl>
            )}
          </section>
        ) : null}
      </div>

      {approvedChanges.length > 0 ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <section aria-label={PUBLIC_PROJECT_RECORD_CHANGES_HEADING} data-public-project-record-changes>
            <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PUBLIC_PROJECT_RECORD_CHANGES_HEADING}</p>
            <ul className="mt-2 space-y-3">
              {approvedChanges.map((change) => (
                <li
                  key={change.id}
                  className="rounded-[12px] border border-[#e6ecf3] bg-white px-4 py-3"
                  data-public-project-record-change
                >
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="min-w-0 text-[14px] font-semibold text-[#0b1f33] [overflow-wrap:anywhere]">
                      {change.reason ?? PUBLIC_PROJECT_RECORD_CHANGES_HEADING}
                    </p>
                    {change.dateLabel ? (
                      <p className="shrink-0 text-[12.5px] text-[#64748b]">{change.dateLabel}</p>
                    ) : null}
                  </div>
                  <ul className="mt-2 space-y-1 text-[13px]">
                    {change.lines.map((line) => (
                      <li key={line.id} className="flex min-w-0 items-baseline justify-between gap-3">
                        <span className="min-w-0 text-[#334155] [overflow-wrap:anywhere]">
                          <span className="font-medium">{line.actionLabel}</span> · {line.description}
                          {line.quantityLabel ? (
                            <span className="text-[#64748b]"> · {line.quantityLabel}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums text-[#334155]">{line.deltaLabel}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-[#eef2f6] pt-2 text-[13px]">
                    <span className="text-[#64748b]">{change.approvedByLabel ?? ""}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-[#0b1f33]">
                      {PUBLIC_PROJECT_RECORD_CHANGE_TOTAL_LABEL} {change.totalDeltaLabel}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {history.length > 0 ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <section aria-label={PUBLIC_PROJECT_RECORD_HISTORY_HEADING} data-public-project-record-history>
            <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PUBLIC_PROJECT_RECORD_HISTORY_HEADING}</p>
            <ul className="mt-2 divide-y divide-[#eef2f6] text-[13.5px]">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 items-baseline justify-between gap-4 py-1.5"
                  data-public-project-record-history-item={item.label}
                >
                  <span className="min-w-0 text-[#334155]">
                    {item.label}
                    {item.kindLabel ? <span className="text-[#64748b]"> · {item.kindLabel}</span> : null}
                    {item.dateLabel ? <span className="text-[#64748b]"> · {item.dateLabel}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-[#334155]">{item.amountLabel}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
