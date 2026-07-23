"use client";

import type { CustomerRequestReviewItemView } from "@/app/lib/proposalCustomerRequestReviewViewModel";
import {
  CUSTOMER_REQUEST_DISMISS_LABEL,
  CUSTOMER_REQUEST_MARK_SEEN_LABEL,
} from "@/app/lib/proposalCustomerRequestReviewViewModel";

type CustomerRequestReviewCardProps = {
  request: CustomerRequestReviewItemView;
  pending?: boolean;
  onMarkSeen?: (requestId: string) => void;
  onDismiss?: (requestId: string) => void;
  compact?: boolean;
};

function statusPillClass(status: CustomerRequestReviewItemView["status"]): string {
  if (status === "new") return "bg-amber-100 text-amber-900";
  if (status === "seen") return "bg-slate-100 text-slate-700";
  return "bg-slate-50 text-slate-500";
}

export default function CustomerRequestReviewCard({
  request,
  pending = false,
  onMarkSeen,
  onDismiss,
  compact = false,
}: CustomerRequestReviewCardProps) {
  return (
    <div
      className={`rounded-md border border-amber-200/80 bg-amber-50/50 ${
        compact ? "px-3 py-2" : "px-3 py-2.5"
      }`}
      data-customer-request-review-card
      data-customer-request-id={request.id}
      data-customer-request-status={request.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className="text-[13px] font-semibold text-slate-900"
              data-customer-request-headline
            >
              {request.headline}
            </p>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPillClass(
                request.status
              )}`}
              data-customer-request-status-pill
            >
              {request.statusPill}
            </span>
          </div>
          {request.createdAtLabel ? (
            <p
              className="mt-0.5 text-[11px] text-slate-500"
              data-customer-request-timestamp
            >
              {request.createdAtLabel}
            </p>
          ) : null}
          {request.messagePreview ? (
            <p
              className="mt-1 text-[12px] leading-snug text-slate-600"
              data-customer-request-message
            >
              {request.messagePreview}
            </p>
          ) : null}
        </div>
        {(request.canMarkSeen || request.canDismiss) && (onMarkSeen || onDismiss) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {request.canMarkSeen && onMarkSeen ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onMarkSeen(request.id)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                data-customer-request-mark-seen
              >
                {CUSTOMER_REQUEST_MARK_SEEN_LABEL}
              </button>
            ) : null}
            {request.canDismiss && onDismiss ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onDismiss(request.id)}
                className="rounded-md border border-transparent px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800 disabled:opacity-60"
                data-customer-request-dismiss
              >
                {CUSTOMER_REQUEST_DISMISS_LABEL}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
