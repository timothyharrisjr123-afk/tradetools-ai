"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, Mail } from "lucide-react";
import {
  CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT,
  CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING,
  CUSTOMER_PREVIEW_READY_HEADING,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
} from "@/app/lib/proposalBuilderDocumentIa";
import {
  PREVIEW_READINESS_NEEDS,
  PREVIEW_READINESS_READY,
} from "./proposalPreviewWorkspaceStyles";

type ProposalPreviewReadinessSummaryProps = {
  blockingLineCount: number;
  pricingComplete: boolean;
  hasRecipientEmail: boolean;
  builderHref: string;
  /** When true, Send is blocked — must not show ready-to-send copy. */
  companyLogoMissing?: boolean;
  extraHints?: string[];
};

const REVIEW_BUTTON =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50";

/**
 * Compact readiness checkpoint — calm review cue, not an error banner.
 * Ready heading only when real send blockers are clear (aligns with Send/sharing).
 */
export default function ProposalPreviewReadinessSummary({
  blockingLineCount,
  pricingComplete,
  hasRecipientEmail,
  builderHref,
  companyLogoMissing = false,
  extraHints = [],
}: ProposalPreviewReadinessSummaryProps) {
  const needsReview =
    !pricingComplete ||
    blockingLineCount > 0 ||
    companyLogoMissing ||
    !hasRecipientEmail;
  const hintParts: string[] = [];
  if (blockingLineCount > 0) {
    hintParts.push(
      `${blockingLineCount} estimate item${blockingLineCount === 1 ? "" : "s"} need quantities`
    );
  } else if (!pricingComplete) {
    hintParts.push("Estimate pricing needs review");
  }
  if (companyLogoMissing) {
    hintParts.push(CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT);
  }
  for (const hint of extraHints) {
    if (hint && !hintParts.includes(hint)) hintParts.push(hint);
  }

  return (
    <div
      className={needsReview ? PREVIEW_READINESS_NEEDS : PREVIEW_READINESS_READY}
      data-preview-status-strip
      data-preview-readiness-summary
      data-preview-compact-readiness
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            needsReview
              ? "bg-amber-100/80 text-amber-700"
              : "bg-emerald-100/80 text-emerald-700"
          }`}
          aria-hidden
        >
          {needsReview ? (
            <CircleAlert className="h-4 w-4" />
          ) : (
            <CircleCheck className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <p
            className="text-[14px] font-semibold text-slate-900"
            data-preview-status-readiness
          >
            {needsReview
              ? CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING
              : CUSTOMER_PREVIEW_READY_HEADING}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-slate-600">
            {hintParts.length > 0 ? (
              hintParts.map((hint, index) => (
                <span key={hint} className="inline-flex items-center gap-2.5">
                  {index > 0 ? <span className="text-slate-300" aria-hidden>·</span> : null}
                  <span>{hint}</span>
                </span>
              ))
            ) : (
              <span>Customer proposal is ready for final review.</span>
            )}
            <span className="inline-flex items-center gap-2.5 text-slate-500">
              <span className="text-slate-300" aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                {hasRecipientEmail ? "Recipient ready" : "Recipient email needs attention"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {needsReview ? (
        <Link href={builderHref} className={REVIEW_BUTTON}>
          {CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION}
        </Link>
      ) : null}
    </div>
  );
}
