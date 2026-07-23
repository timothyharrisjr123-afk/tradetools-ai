"use client";

import {
  CUSTOMER_REQUEST_BUILDER_BANNER_HINT,
  CUSTOMER_REQUEST_MARK_SEEN_LABEL,
} from "@/app/lib/proposalCustomerRequestReviewViewModel";
import { useProposalCustomerRequests } from "@/app/lib/useProposalCustomerRequests";

type ProposalBuilderCustomerRequestBannerProps = {
  proposalId: string | null | undefined;
  jobId: string | null | undefined;
};

export default function ProposalBuilderCustomerRequestBanner({
  proposalId,
  jobId,
}: ProposalBuilderCustomerRequestBannerProps) {
  const { requests, pendingRequestId, markSeen } = useProposalCustomerRequests({
    proposalId,
    jobId,
  });

  const openRequest =
    requests.find((row) => row.status === "new") ??
    requests.find((row) => row.status === "seen") ??
    null;

  if (!openRequest) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
      data-builder-customer-request-banner
      data-customer-request-id={openRequest.id}
      data-customer-request-status={openRequest.status}
    >
      <div className="min-w-0">
        <p className="font-semibold" data-builder-customer-request-headline>
          {openRequest.headline}
        </p>
        <p className="mt-0.5 text-[13px] text-amber-900/80">
          {CUSTOMER_REQUEST_BUILDER_BANNER_HINT}
        </p>
      </div>
      {openRequest.canMarkSeen ? (
        <button
          type="button"
          disabled={pendingRequestId === openRequest.id}
          onClick={() => {
            void markSeen(openRequest.id);
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-60"
          data-builder-customer-request-mark-seen
        >
          {CUSTOMER_REQUEST_MARK_SEEN_LABEL}
        </button>
      ) : null}
    </div>
  );
}
