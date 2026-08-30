"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL,
  CUSTOMER_PREVIEW_PAGE_TITLE,
} from "@/app/lib/proposalBuilderDocumentIa";
import type { ProposalPreviewSentFrozenChrome } from "@/app/lib/proposalPreviewSentFrozenChrome";
import type { ProposalPreviewSentRecordChrome } from "@/app/lib/proposalPreviewSentRecord";
import {
  PREVIEW_SENT_RECORD_BACK_LABEL,
} from "@/app/lib/proposalPreviewSentRecord";
import ProposalPreviewActionGroup from "./ProposalPreviewActionGroup";
import ProposalPreviewPdfActions from "./ProposalPreviewPdfActions";
import { PREVIEW_HEADER, PREVIEW_HEADER_INNER } from "./proposalPreviewWorkspaceStyles";

type ProposalPreviewHeaderProps = {
  builderHref: string;
  customerName: string;
  projectAddress: string | null;
  selectedPackageLabel: string | null;
  totalLabel: string | null;
  sentFrozenChrome: ProposalPreviewSentFrozenChrome;
  onSendSharing: () => void;
  showSendSharing: boolean;
  backHref?: string;
  sentRecordChrome?: ProposalPreviewSentRecordChrome | null;
  /** Exact frozen version for sent-record PDF download. */
  pdfDownload?: {
    companyId: string;
    proposalId: string;
    versionId: string;
  } | null;
};

function compactPackageLabel(label: string | null): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+package$/i, "").trim() || trimmed;
}

/**
 * V2C1/V2C4 — Compact contractor review command bar.
 * Status chrome distinguishes unsent draft vs draft-after-sent using latest_sent_version_id.
 * Sent-record mode (`sentRecordChrome`) is an explicit read-only frozen view.
 */
export default function ProposalPreviewHeader({
  builderHref,
  customerName,
  projectAddress,
  selectedPackageLabel,
  totalLabel,
  sentFrozenChrome,
  onSendSharing,
  showSendSharing,
  backHref,
  sentRecordChrome = null,
  pdfDownload = null,
}: ProposalPreviewHeaderProps) {
  const packageLabel = compactPackageLabel(selectedPackageLabel);
  const isSentRecord = Boolean(sentRecordChrome);
  const statusLabel = sentRecordChrome?.statusLabel ?? sentFrozenChrome.statusLabel;
  const showPdfActions =
    isSentRecord &&
    pdfDownload != null &&
    Boolean(pdfDownload.companyId) &&
    Boolean(pdfDownload.proposalId) &&
    Boolean(pdfDownload.versionId);

  return (
    <header
      className={PREVIEW_HEADER}
      data-preview-contractor-header
      data-preview-command-bar
      data-preview-sent-record={isSentRecord ? "true" : "false"}
    >
      <div className={PREVIEW_HEADER_INNER}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={backHref ?? builderHref}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-blue-600 transition hover:text-blue-700 sm:min-h-0"
              data-preview-back-to-builder={isSentRecord ? undefined : "true"}
              data-preview-back-to-job-card={isSentRecord ? "true" : undefined}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {isSentRecord
                ? PREVIEW_SENT_RECORD_BACK_LABEL
                : CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL}
            </Link>
            <h1 className="sr-only" data-preview-page-title>
              {CUSTOMER_PREVIEW_PAGE_TITLE}
            </h1>
          </div>

          <p
            className="mt-1 truncate text-[14px] font-semibold text-slate-900 sm:mt-1.5"
            data-preview-job-primary-identity
          >
            {customerName}
            {projectAddress ? (
              <span className="font-normal text-slate-600"> · {projectAddress}</span>
            ) : null}
          </p>

          <p
            className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-slate-500"
            data-preview-command-meta
          >
            {packageLabel ? (
              <span className="font-medium text-slate-700" data-preview-header-package>
                {packageLabel}
              </span>
            ) : null}
            {packageLabel && totalLabel ? (
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
            ) : null}
            {totalLabel ? (
              <span className="font-medium text-slate-700" data-preview-header-total>
                {totalLabel}
              </span>
            ) : null}
            {(packageLabel || totalLabel) ? (
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
            ) : null}
            <span
              className="font-medium text-slate-600"
              data-preview-draft-status={isSentRecord ? undefined : "true"}
              data-preview-sent-record-status={isSentRecord ? "true" : undefined}
              data-preview-sent-frozen-kind={
                isSentRecord ? "sent_record" : sentFrozenChrome.kind
              }
              data-preview-has-latest-sent={
                sentFrozenChrome.hasLatestSentVersion ? "true" : "false"
              }
            >
              {statusLabel}
            </span>
            {sentRecordChrome?.sentAtLabel ? (
              <>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <span data-preview-sent-record-at>{sentRecordChrome.sentAtLabel}</span>
              </>
            ) : null}
            {sentRecordChrome?.deliveryLabel ? (
              <>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <span data-preview-sent-record-delivery>
                  {sentRecordChrome.deliveryLabel}
                </span>
              </>
            ) : null}
          </p>
        </div>

        {showSendSharing && !isSentRecord ? (
          <ProposalPreviewActionGroup
            onSendSharing={onSendSharing}
            showSendSharing={showSendSharing}
          />
        ) : null}
        {showPdfActions && pdfDownload ? (
          <ProposalPreviewPdfActions
            companyId={pdfDownload.companyId}
            proposalId={pdfDownload.proposalId}
            versionId={pdfDownload.versionId}
          />
        ) : null}
      </div>
    </header>
  );
}
