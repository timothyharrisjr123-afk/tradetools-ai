"use client";

import CustomerRequestReviewCard from "@/app/components/proposals/CustomerRequestReviewCard";
import {
  CUSTOMER_REQUEST_REVIEW_SECTION_SUBTITLE,
  CUSTOMER_REQUEST_REVIEW_SECTION_TITLE,
} from "@/app/lib/proposalCustomerRequestReviewViewModel";
import { useProposalCustomerRequests } from "@/app/lib/useProposalCustomerRequests";

type ProposalCustomerPreviewCustomerRequestsSectionProps = {
  proposalId: string;
  jobId: string;
};

export default function ProposalCustomerPreviewCustomerRequestsSection({
  proposalId,
  jobId,
}: ProposalCustomerPreviewCustomerRequestsSectionProps) {
  const {
    requests,
    loading,
    pendingRequestId,
    markSeen,
    dismiss,
  } = useProposalCustomerRequests({ proposalId, jobId });

  const visible = requests.filter((request) => request.status !== "dismissed");

  return (
    <div className="space-y-3" data-preview-customer-requests>
      <div>
        <p className="text-[15px] font-semibold text-slate-900">
          {CUSTOMER_REQUEST_REVIEW_SECTION_TITLE}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          {CUSTOMER_REQUEST_REVIEW_SECTION_SUBTITLE}
        </p>
      </div>
      {loading && visible.length === 0 ? (
        <p className="text-[13px] text-slate-500">Loading customer requests…</p>
      ) : null}
      {!loading && visible.length === 0 ? (
        <p
          className="text-[13px] text-slate-500"
          data-preview-customer-requests-empty
        >
          No customer package requests yet.
        </p>
      ) : null}
      <div className="space-y-2">
        {visible.map((request) => (
          <CustomerRequestReviewCard
            key={request.id}
            request={request}
            pending={pendingRequestId === request.id}
            onMarkSeen={(id) => {
              void markSeen(id);
            }}
            onDismiss={(id) => {
              void dismiss(id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
