"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import {
  CUSTOMER_PREVIEW_REQUEST_AWARENESS_ACTION,
} from "@/app/lib/proposalBuilderDocumentIa";
import {
  partitionCustomerRequestReviewItems,
} from "@/app/lib/proposalCustomerRequestReviewViewModel";
import { useProposalCustomerRequests } from "@/app/lib/useProposalCustomerRequests";

type ProposalPreviewRequestAwarenessProps = {
  proposalId: string;
  jobId: string;
};

/**
 * V2C3 — Preview request awareness only.
 * Read-only notice when an active customer request exists.
 * Mark seen / Dismiss / attention remain Job Card-owned.
 */
export default function ProposalPreviewRequestAwareness({
  proposalId,
  jobId,
}: ProposalPreviewRequestAwarenessProps) {
  const { requests, loading } = useProposalCustomerRequests({
    proposalId,
    jobId,
  });

  const { active } = partitionCustomerRequestReviewItems(requests);
  const primary = active[0] ?? null;

  if (loading || !primary) {
    return null;
  }

  const jobCardHref = buildJobCardHref(jobId, { tab: "proposals" });

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4"
      data-preview-request-awareness
      data-preview-customer-requests
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <MessageSquare
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
          aria-hidden
        />
        <div className="min-w-0">
          <p
            className="text-[13px] font-semibold text-slate-900"
            data-preview-request-awareness-headline
          >
            {primary.headline}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">
            Non-binding interest · review and confirm on Job Card
          </p>
        </div>
      </div>
      <Link
        href={jobCardHref}
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg px-2 text-[13px] font-semibold text-blue-600 transition hover:text-blue-700 sm:min-h-0"
        data-preview-request-review-on-job-card
      >
        {CUSTOMER_PREVIEW_REQUEST_AWARENESS_ACTION}
      </Link>
    </div>
  );
}
