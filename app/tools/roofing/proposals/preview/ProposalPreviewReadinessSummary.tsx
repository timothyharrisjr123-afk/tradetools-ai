"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import {
  CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING,
  CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION,
} from "@/app/lib/proposalBuilderDocumentIa";
import { PREVIEW_READINESS_NEEDS } from "./proposalPreviewWorkspaceStyles";

type ProposalPreviewReadinessSummaryProps = {
  blockingLineCount: number;
  pricingComplete: boolean;
  hasRecipientEmail: boolean;
  builderHref: string;
  extraHints?: string[];
};

/**
 * V2C1 — Healthy Preview is quiet.
 * Only mount a concise blocker chip when existing readiness truth says review is needed.
 * Detailed blocker ownership remains V2C2 / Send drawer.
 */
export default function ProposalPreviewReadinessSummary({
  blockingLineCount,
  pricingComplete,
  hasRecipientEmail,
  builderHref,
  extraHints = [],
}: ProposalPreviewReadinessSummaryProps) {
  const needsReview =
    !pricingComplete || blockingLineCount > 0 || !hasRecipientEmail;

  if (!needsReview) {
    return null;
  }

  const hintParts: string[] = [];
  if (blockingLineCount > 0) {
    hintParts.push(
      `${blockingLineCount} estimate item${blockingLineCount === 1 ? "" : "s"} need quantities`
    );
  } else if (!pricingComplete) {
    hintParts.push("Estimate pricing needs review");
  }
  if (!hasRecipientEmail) {
    hintParts.push("Recipient email needs attention");
  }
  for (const hint of extraHints) {
    if (hint && !hintParts.includes(hint)) hintParts.push(hint);
  }

  return (
    <div
      className={PREVIEW_READINESS_NEEDS}
      data-preview-status-strip
      data-preview-readiness-summary
      data-preview-compact-readiness
      data-preview-readiness-blocked
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0">
          <p
            className="text-[13px] font-semibold text-slate-900"
            data-preview-status-readiness
          >
            {CUSTOMER_PREVIEW_NEEDS_REVIEW_HEADING}
          </p>
          {hintParts.length > 0 ? (
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-600">
              {hintParts.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        href={builderHref}
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg px-2 text-[13px] font-semibold text-blue-600 transition hover:text-blue-700 sm:min-h-0"
      >
        {CUSTOMER_PREVIEW_RETURN_TO_BUILDER_ACTION}
      </Link>
    </div>
  );
}
