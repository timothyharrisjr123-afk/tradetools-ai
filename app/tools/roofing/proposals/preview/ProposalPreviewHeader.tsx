"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL,
  CUSTOMER_PREVIEW_PAGE_TITLE,
} from "@/app/lib/proposalBuilderDocumentIa";
import type { ProposalPreviewSentFrozenChrome } from "@/app/lib/proposalPreviewSentFrozenChrome";
import ProposalPreviewActionGroup from "./ProposalPreviewActionGroup";
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
 * Document remains the editable draft; frozen viewing is not wired here.
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
}: ProposalPreviewHeaderProps) {
  const packageLabel = compactPackageLabel(selectedPackageLabel);

  return (
    <header className={PREVIEW_HEADER} data-preview-contractor-header data-preview-command-bar>
      <div className={PREVIEW_HEADER_INNER}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={builderHref}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-blue-600 transition hover:text-blue-700 sm:min-h-0"
              data-preview-back-to-builder
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL}
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
              data-preview-draft-status
              data-preview-sent-frozen-kind={sentFrozenChrome.kind}
              data-preview-has-latest-sent={
                sentFrozenChrome.hasLatestSentVersion ? "true" : "false"
              }
            >
              {sentFrozenChrome.statusLabel}
            </span>
          </p>
        </div>

        {showSendSharing ? (
          <ProposalPreviewActionGroup
            onSendSharing={onSendSharing}
            showSendSharing={showSendSharing}
          />
        ) : null}
      </div>
    </header>
  );
}
