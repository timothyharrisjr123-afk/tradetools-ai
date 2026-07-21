"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, PackageCheck } from "lucide-react";
import {
  CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL,
  CUSTOMER_PREVIEW_DRAFT_NOTICE,
  CUSTOMER_PREVIEW_PAGE_TITLE,
} from "@/app/lib/proposalBuilderDocumentIa";
import ProposalPreviewActionGroup from "./ProposalPreviewActionGroup";
import { PREVIEW_HEADER, PREVIEW_HEADER_INNER } from "./proposalPreviewWorkspaceStyles";

type ProposalPreviewHeaderProps = {
  builderHref: string;
  customerName: string;
  projectAddress: string | null;
  selectedPackageLabel: string | null;
  lastSavedLabel: string;
  onSendSharing: () => void;
  showSendSharing: boolean;
};

/**
 * Premium contractor command header within the review surface.
 * App title: Proposal Preview. Customer document title stays in proposal content.
 */
export default function ProposalPreviewHeader({
  builderHref,
  customerName,
  projectAddress,
  selectedPackageLabel,
  lastSavedLabel,
  onSendSharing,
  showSendSharing,
}: ProposalPreviewHeaderProps) {
  return (
    <header className={PREVIEW_HEADER} data-preview-contractor-header>
      <div className={PREVIEW_HEADER_INNER}>
        <div className="min-w-0 flex-1">
          <Link
            href={builderHref}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 transition hover:text-blue-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {CUSTOMER_PREVIEW_BACK_TO_BUILDER_LABEL}
          </Link>

          <div className="mt-2.5 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1
                className="text-[1.5rem] font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.6rem]"
                data-preview-page-title
              >
                {CUSTOMER_PREVIEW_PAGE_TITLE}
              </h1>
              <span
                className="inline-flex items-center rounded-md bg-slate-100/90 px-2 py-0.5 text-[12px] font-semibold text-slate-600"
                data-preview-draft-status
              >
                {CUSTOMER_PREVIEW_DRAFT_NOTICE}
              </span>
            </div>

            <p
              className="mt-1.5 truncate text-[14px] text-slate-600"
              data-preview-job-primary-identity
            >
              <span className="font-semibold text-slate-800">{customerName}</span>
              {projectAddress ? <span> · {projectAddress}</span> : null}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-slate-500">
              {selectedPackageLabel ? (
                <span className="inline-flex items-center gap-1.5" data-preview-header-package>
                  <PackageCheck className="h-3.5 w-3.5 text-blue-500" aria-hidden />
                  <span>
                    Package{" "}
                    <strong className="font-semibold text-slate-700">{selectedPackageLabel}</strong>
                  </span>
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5" data-preview-header-last-saved>
                <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                Saved <span className="font-medium text-slate-700">{lastSavedLabel}</span>
              </span>
              <span className="text-slate-400">Not sent yet</span>
            </div>
          </div>
        </div>

        {showSendSharing ? (
          <div className="shrink-0 self-start lg:self-center">
            <ProposalPreviewActionGroup
              onSendSharing={onSendSharing}
              showSendSharing={showSendSharing}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
