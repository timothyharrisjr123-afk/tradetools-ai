"use client";

import CustomerRequestReviewCard from "@/app/components/proposals/CustomerRequestReviewCard";
import {
  CUSTOMER_REQUEST_HISTORY_TITLE,
  CUSTOMER_REQUEST_NONE_ACTIVE_LABEL,
  CUSTOMER_REQUEST_NONE_EVER_LABEL,
  CUSTOMER_REQUEST_REVIEW_SECTION_SUBTITLE,
  CUSTOMER_REQUEST_REVIEW_SECTION_TITLE,
  partitionCustomerRequestReviewItems,
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

  const { active, history } = partitionCustomerRequestReviewItems(requests);

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
      {loading && requests.length === 0 ? (
        <p className="text-[13px] text-slate-500">Loading customer requests…</p>
      ) : null}
      {!loading && requests.length === 0 ? (
        <p
          className="text-[13px] text-slate-500"
          data-preview-customer-requests-empty
        >
          {CUSTOMER_REQUEST_NONE_EVER_LABEL}
        </p>
      ) : null}
      {!loading && requests.length > 0 && active.length === 0 ? (
        <p
          className="text-[13px] text-slate-500"
          data-preview-customer-requests-none-active
        >
          {CUSTOMER_REQUEST_NONE_ACTIVE_LABEL}
        </p>
      ) : null}
      <div className="space-y-2" data-preview-active-customer-requests>
        {active.map((request) => (
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
      {history.length > 0 ? (
        <div
          className="space-y-2 border-t border-slate-200 pt-3"
          data-preview-customer-request-history
        >
          <p className="text-[12px] font-semibold text-slate-700">
            {CUSTOMER_REQUEST_HISTORY_TITLE}
          </p>
          {history.map((request) => (
            <CustomerRequestReviewCard key={request.id} request={request} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
