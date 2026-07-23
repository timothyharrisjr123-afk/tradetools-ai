"use client";

import CustomerRequestReviewCard from "@/app/components/proposals/CustomerRequestReviewCard";
import { useJobProposalCustomerRequests } from "@/app/lib/useProposalCustomerRequests";
import type { JobCardProposalRowView } from "./jobCardProposalsTabModel";
import {
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_EMPTY_BODY,
  JOB_CARD_PROPOSALS_EMPTY_TITLE,
  JOB_CARD_PROPOSALS_OPEN_LABEL,
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  formatJobCardProposalRowPackageBadge,
} from "./jobCardProposalsTabModel";
import { useEffect } from "react";

type JobCardProposalsTabProps = {
  rows: readonly JobCardProposalRowView[];
  jobId?: string | null;
  /** Gate for Block 3 Continue — measurement/template/package ready. */
  createReadyForBlock3?: boolean;
  onAddProposal: () => void;
  onOpenProposal: (proposalId: string) => void;
  focusedRequestId?: string | null;
};

function AddProposalButton({
  onClick,
  label = JOB_CARD_PROPOSALS_ADD_LABEL,
  compact,
}: {
  onClick: () => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS
          : `${JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS} w-full sm:w-auto`
      }
      data-jobcard-add-proposal
    >
      {label}
    </button>
  );
}

export default function JobCardProposalsTab({
  rows,
  jobId = null,
  createReadyForBlock3 = false,
  onAddProposal,
  onOpenProposal,
  focusedRequestId = null,
}: JobCardProposalsTabProps) {
  const hasRows = rows.length > 0;
  const proposalIds = rows.map((row) => row.proposalId);
  const { requests } = useJobProposalCustomerRequests({
    proposalIds,
    jobId,
    enabled: hasRows,
  });

  useEffect(() => {
    const requestId = focusedRequestId?.trim();
    if (!requestId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-jobcard-customer-request][data-customer-request-id="${requestId}"]`
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedRequestId, requests]);

  return (
    <div
      className="space-y-4"
      data-jobcard-proposals-tab
      data-jobcard-proposals-v1
      data-jobcard-create-ready-for-block3={createReadyForBlock3 ? "true" : "false"}
    >
      {hasRows ? (
        <div className="space-y-2" data-jobcard-proposal-list>
          {rows.map((row) => {
            const packageBadge = formatJobCardProposalRowPackageBadge(row.packageLabel);
            const rowRequests = requests.filter(
              (request) =>
                request.proposalId === row.proposalId &&
                request.status !== "dismissed"
            );
            const primaryRequest =
              rowRequests.find((request) => request.id === focusedRequestId) ??
              rowRequests[0] ??
              null;
            const additionalActiveCount = Math.max(0, rowRequests.length - 1);

            return (
              <div
                key={row.proposalId}
                className="space-y-2 border-b border-slate-100 px-1 py-3 last:border-b-0"
                data-jobcard-proposal-list-row
                data-proposal-id={row.proposalId}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p
                        className="truncate text-[14px] font-semibold text-slate-900"
                        data-jobcard-proposal-row-title
                      >
                        {row.title}
                      </p>
                      {packageBadge ? (
                        <span
                          className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                          data-jobcard-proposal-row-package
                        >
                          {packageBadge}
                        </span>
                      ) : null}
                    </div>
                    <p
                      className="mt-0.5 truncate text-[12px] text-slate-400"
                      data-jobcard-proposal-row-meta
                    >
                      {row.metaLine}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={() => onOpenProposal(row.proposalId)}
                    data-jobcard-proposal-open
                  >
                    {JOB_CARD_PROPOSALS_OPEN_LABEL}
                  </button>
                </div>
                {primaryRequest ? (
                  <div
                    tabIndex={-1}
                    className="outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    data-jobcard-customer-request
                    data-customer-request-id={primaryRequest.id}
                  >
                    <CustomerRequestReviewCard
                      request={primaryRequest}
                      compact
                    />
                    {additionalActiveCount > 0 ? (
                      <p
                        className="mt-1 text-[11px] text-slate-500"
                        data-jobcard-additional-active-requests
                      >
                        {additionalActiveCount} additional active{" "}
                        {additionalActiveCount === 1 ? "request" : "requests"}{" "}
                        available in the Job Card attention area above.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center"
          data-jobcard-proposals-empty
        >
          <p className="text-[15px] font-semibold text-slate-900">
            {JOB_CARD_PROPOSALS_EMPTY_TITLE}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-600">
            {JOB_CARD_PROPOSALS_EMPTY_BODY}
          </p>
          <div className="mt-4 flex justify-center">
            <AddProposalButton
              onClick={onAddProposal}
              label={JOB_CARD_PROPOSALS_CREATE_LABEL}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function JobCardProposalsAddHeaderButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return <AddProposalButton onClick={onClick} compact />;
}
