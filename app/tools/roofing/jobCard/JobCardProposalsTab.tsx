"use client";

import CustomerRequestReviewCard from "@/app/components/proposals/CustomerRequestReviewCard";
import { useJobProposalCustomerRequests } from "@/app/lib/useProposalCustomerRequests";
import type {
  JobCardProposalActionView,
  JobCardProposalRowView,
} from "./jobCardProposalsTabModel";
import {
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_ADD_QUIET_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_CURRENT_SENT_MARKER,
  JOB_CARD_PROPOSALS_EARLIER_LABEL,
  JOB_CARD_PROPOSALS_EMPTY_BODY,
  JOB_CARD_PROPOSALS_EMPTY_TITLE,
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_ROW_PRIMARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_SENT_HISTORY_LABEL,
  JOB_CARD_PROPOSALS_WORKING_CURRENT_MARKER,
  formatJobCardProposalRowPackageBadge,
  partitionJobCardProposalRows,
} from "./jobCardProposalsTabModel";
import { useEffect } from "react";

type JobCardProposalsTabProps = {
  rows: readonly JobCardProposalRowView[];
  jobId?: string | null;
  /** Gate for Block 3 Continue — measurement/template/package ready. */
  createReadyForBlock3?: boolean;
  onAddProposal: () => void;
  onProposalAction: (action: JobCardProposalActionView, proposalId: string) => void;
  focusedRequestId?: string | null;
  sentHistoryDefaultOpen?: boolean;
  listStatus?: "idle" | "loading" | "ready_empty" | "ready_items" | "error";
  listError?: string | null;
};

function AddProposalButton({
  onClick,
  label = JOB_CARD_PROPOSALS_ADD_LABEL,
  compact,
  quiet,
}: {
  onClick: () => void;
  label?: string;
  compact?: boolean;
  quiet?: boolean;
}) {
  const base = quiet
    ? JOB_CARD_PROPOSALS_ADD_QUIET_BUTTON_CLASS
    : JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS;
  return (
    <button
      type="button"
      className={compact ? base : `${base} w-full sm:w-auto`}
      data-jobcard-add-proposal
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ProposalActionButton({
  action,
  proposalId,
  primary,
  prominent,
  onProposalAction,
}: {
  action: JobCardProposalActionView;
  proposalId: string;
  primary?: boolean;
  prominent?: boolean;
  onProposalAction: (action: JobCardProposalActionView, proposalId: string) => void;
}) {
  return (
    <button
      type="button"
      className={
        primary
          ? prominent
            ? JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS
            : JOB_CARD_PROPOSALS_ROW_PRIMARY_BUTTON_CLASS
          : JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS
      }
      disabled={!action.enabled}
      title={action.enabled ? undefined : action.unavailableReason ?? undefined}
      aria-disabled={action.enabled ? undefined : true}
      data-jobcard-proposal-action={action.id}
      data-jobcard-proposal-action-enabled={action.enabled ? "true" : "false"}
      onClick={() => {
        if (!action.enabled) return;
        onProposalAction(action, proposalId);
      }}
    >
      {action.label}
    </button>
  );
}

function shouldRenderProposalAction(action: JobCardProposalActionView): boolean {
  if (action.id === "view_sent" || action.id === "view_last_sent") {
    return action.enabled;
  }
  return true;
}

function ProposalListRow({
  row,
  requests,
  focusedRequestId,
  sentHistoryDefaultOpen,
  onProposalAction,
  quiet,
  markCurrent,
}: {
  row: JobCardProposalRowView;
  requests: ReturnType<typeof useJobProposalCustomerRequests>["requests"];
  focusedRequestId: string | null;
  sentHistoryDefaultOpen: boolean;
  onProposalAction: (action: JobCardProposalActionView, proposalId: string) => void;
  quiet?: boolean;
  markCurrent?: boolean;
}) {
  const showCurrent = markCurrent === true || row.isCurrent;
  const packageBadge = formatJobCardProposalRowPackageBadge(row.packageLabel);
  const rowRequests = requests.filter(
    (request) =>
      request.proposalId === row.proposalId && request.status !== "dismissed"
  );
  const primaryRequest =
    rowRequests.find((request) => request.id === focusedRequestId) ??
    rowRequests[0] ??
    null;
  const additionalActiveCount = Math.max(0, rowRequests.length - 1);
  const showHistory = row.sentHistory.length > 1;
  const visibleActions = [row.primaryAction, ...row.secondaryActions].filter(
    shouldRenderProposalAction
  );
  const visiblePrimary = visibleActions[0] ?? null;
  const visibleSecondary = visibleActions.slice(1);

  return (
    <div
      className={
        quiet
          ? "space-y-2 border-b border-slate-100 px-1 py-2.5 last:border-b-0"
          : "space-y-2 border-b border-slate-200 px-1 py-3 last:border-b-0"
      }
      data-jobcard-proposal-list-row
      data-proposal-id={row.proposalId}
      data-jobcard-proposal-lifecycle={row.lifecycleKind}
      data-jobcard-proposal-current={showCurrent ? "true" : "false"}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className={
                quiet
                  ? "text-[13px] font-medium text-slate-700"
                  : "text-[15px] font-semibold text-slate-950"
              }
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
            {showCurrent ? (
              <span
                className="text-[11px] font-medium text-slate-500"
                data-jobcard-proposal-current-marker
              >
                {JOB_CARD_PROPOSALS_WORKING_CURRENT_MARKER}
              </span>
            ) : null}
          </div>
          <p
            className="mt-0.5 text-[12px] font-medium text-slate-600"
            data-jobcard-proposal-row-status
          >
            {row.statusLabel}
          </p>
          <p
            className="mt-0.5 truncate whitespace-nowrap text-[12px] text-slate-400"
            data-jobcard-proposal-row-meta
          >
            {row.lastSentAtLabel
              ? `Last sent ${row.lastSentAtLabel}`
              : row.updatedLabel
                ? `Updated ${row.updatedLabel}`
                : row.metaLine}
          </p>
        </div>
        {visiblePrimary ? (
          <div
            className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end"
            data-jobcard-proposal-actions
          >
            <ProposalActionButton
              action={visiblePrimary}
              proposalId={row.proposalId}
              primary
              prominent={showCurrent && !quiet}
              onProposalAction={onProposalAction}
            />
            {visibleSecondary.map((secondary) => (
              <ProposalActionButton
                key={secondary.id}
                action={secondary}
                proposalId={row.proposalId}
                onProposalAction={onProposalAction}
              />
            ))}
          </div>
        ) : null}
      </div>
      {showHistory ? (
        <details
          className="pt-0.5"
          data-jobcard-sent-history
          open={sentHistoryDefaultOpen || undefined}
        >
          <summary
            className="cursor-pointer text-[12px] font-medium text-slate-500"
            data-jobcard-sent-history-toggle
          >
            {JOB_CARD_PROPOSALS_SENT_HISTORY_LABEL}
          </summary>
          <ul className="mt-1 space-y-0.5" data-jobcard-sent-history-list>
            {row.sentHistory.map((entry, index) => (
              <li
                key={`${entry.sentAtLabel}-${index}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-500"
                data-jobcard-sent-history-row
                data-jobcard-sent-history-current={
                  entry.isCurrent ? "true" : "false"
                }
              >
                {entry.href ? (
                  <a
                    href={entry.href}
                    className="text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
                    data-jobcard-sent-history-open
                  >
                    Sent {entry.sentAtLabel}
                  </a>
                ) : (
                  <span>Sent {entry.sentAtLabel}</span>
                )}
                {entry.packageLabel ? (
                  <span data-jobcard-sent-history-package>
                    {entry.packageLabel}
                  </span>
                ) : null}
                {entry.deliveryStatusLabel ? (
                  <span data-jobcard-sent-history-delivery>
                    {entry.deliveryStatusLabel}
                  </span>
                ) : null}
                {entry.isCurrent ? (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    data-jobcard-sent-history-current-marker
                  >
                    {JOB_CARD_PROPOSALS_CURRENT_SENT_MARKER}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {primaryRequest ? (
        <div
          tabIndex={-1}
          className="outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          data-jobcard-customer-request
          data-customer-request-id={primaryRequest.id}
        >
          <CustomerRequestReviewCard request={primaryRequest} compact />
          {additionalActiveCount > 0 ? (
            <p
              className="mt-1 text-[11px] text-slate-500"
              data-jobcard-additional-active-requests
            >
              {additionalActiveCount} additional active{" "}
              {additionalActiveCount === 1 ? "request" : "requests"} available
              in the Job Card attention area above.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function JobCardProposalsTab({
  rows,
  jobId = null,
  createReadyForBlock3 = false,
  onAddProposal,
  onProposalAction,
  focusedRequestId = null,
  sentHistoryDefaultOpen = false,
  listStatus = rows.length > 0 ? "ready_items" : "ready_empty",
  listError = null,
}: JobCardProposalsTabProps) {
  const hasRows = rows.length > 0;
  const showUnavailable = listStatus === "error" && !hasRows;
  const showEmpty = listStatus === "ready_empty" && !hasRows;
  const showLoading = (listStatus === "loading" || listStatus === "idle") && !hasRows;
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

  const { current, earlier } = partitionJobCardProposalRows(rows);

  return (
    <div
      className="space-y-4"
      data-jobcard-proposals-tab
      data-jobcard-proposals-v1
      data-jobcard-create-ready-for-block3={createReadyForBlock3 ? "true" : "false"}
      data-jobcard-proposals-status={listStatus}
    >
      {listStatus === "error" && hasRows ? (
        <p
          className="text-[12px] text-amber-700"
          data-jobcard-proposals-refresh-error
        >
          {listError ?? "Could not refresh proposals. Showing last known list."}
        </p>
      ) : null}
      {hasRows ? (
        <div className="space-y-5" data-jobcard-proposal-list>
          {current ? (
            <div data-jobcard-proposal-current-block>
              <ProposalListRow
                row={current}
                requests={requests}
                focusedRequestId={focusedRequestId}
                sentHistoryDefaultOpen={sentHistoryDefaultOpen}
                onProposalAction={onProposalAction}
                markCurrent
              />
            </div>
          ) : (
            rows.map((row) => (
              <ProposalListRow
                key={row.proposalId}
                row={row}
                requests={requests}
                focusedRequestId={focusedRequestId}
                sentHistoryDefaultOpen={sentHistoryDefaultOpen}
                onProposalAction={onProposalAction}
              />
            ))
          )}
          {current && earlier.length > 0 ? (
            <div data-jobcard-proposal-earlier>
              <p
                className="mb-1 text-[12px] font-medium text-slate-400"
                data-jobcard-proposal-earlier-heading
              >
                {JOB_CARD_PROPOSALS_EARLIER_LABEL}
              </p>
              <div className="space-y-1">
                {earlier.map((row) => (
                  <ProposalListRow
                    key={row.proposalId}
                    row={row}
                    requests={requests}
                    focusedRequestId={focusedRequestId}
                    sentHistoryDefaultOpen={sentHistoryDefaultOpen}
                    onProposalAction={onProposalAction}
                    quiet
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : showUnavailable ? (
        <div
          className="rounded-lg border border-dashed border-red-200 bg-red-50/40 px-4 py-8 text-center"
          data-jobcard-proposals-unavailable
          role="alert"
        >
          <p className="text-[15px] font-semibold text-slate-900">
            Proposals unavailable
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-600">
            {listError ?? "Proposals could not be loaded. This is not an empty list."}
          </p>
        </div>
      ) : showLoading ? (
        <div
          className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center"
          data-jobcard-proposals-loading
        >
          <p className="text-[15px] font-semibold text-slate-900">
            Loading proposals
          </p>
        </div>
      ) : showEmpty ? (
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
      ) : null}
    </div>
  );
}

export function JobCardProposalsAddHeaderButton({
  onClick,
  quiet = false,
}: {
  onClick: () => void;
  quiet?: boolean;
}) {
  return <AddProposalButton onClick={onClick} compact quiet={quiet} />;
}
