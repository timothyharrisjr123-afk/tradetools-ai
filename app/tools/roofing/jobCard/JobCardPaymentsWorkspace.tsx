"use client";

import { useMemo, useState } from "react";
import JobCardCollectPaymentSheet from "@/app/tools/roofing/jobCard/JobCardCollectPaymentSheet";
import {
  formatJobPaymentWorkspaceAmount,
  groupJobPaymentHistory,
  jobPaymentCurrentRequestKindLabel,
  type JobPaymentWorkspaceTimelineEvent,
  type JobPaymentWorkspaceView,
} from "@/app/lib/jobPaymentWorkspace";
import {
  JOB_CARD_PAYMENTS_CANCEL_REQUEST_CTA,
  JOB_CARD_PAYMENTS_COLLECT_CTA,
  JOB_CARD_PAYMENTS_COPY_LINK_CTA,
  type CollectAmountMode,
} from "@/app/lib/jobPaymentTypes";

type JobCardPaymentsWorkspaceProps = {
  workspace: JobPaymentWorkspaceView | null;
  onCollectPayment?: (input: {
    amountMode: CollectAmountMode;
    percentageBps?: number;
    fixedAmount?: string;
  }) => Promise<{ ok: boolean; code?: string }>;
  onCancelCurrentRequest?: () => Promise<{ ok: boolean; code?: string }>;
  onCopyPaymentLink?: () => Promise<{ ok: boolean; url?: string; code?: string }>;
  collectBusy?: boolean;
  collectError?: string | null;
  cancelBusy?: boolean;
  copyBusy?: boolean;
  copyError?: string | null;
};

function currentStatusLabel(status: string): string {
  if (status === "processing") return "Processing";
  return "Open";
}

function summaryLabel(label: string): string {
  if (label === "Received") return "Collected";
  if (label === "Contract") return "Contract total";
  return label;
}

function HistoryAmount({ event }: { event: JobPaymentWorkspaceTimelineEvent }) {
  const amount = formatJobPaymentWorkspaceAmount(event.amountCents);
  const display = event.type === "refund" ? `−${amount}` : amount;
  return (
    <span
      className={`text-sm font-medium tabular-nums ${
        event.tone === "muted" ? "text-slate-500" : "text-slate-900"
      }`}
    >
      {display}
    </span>
  );
}

function HistoryRow({ event }: { event: JobPaymentWorkspaceTimelineEvent }) {
  const when = event.occurredAtTimeLabel ?? event.occurredAtLabel;
  return (
    <li
      className="border-t border-slate-100 py-3 first:border-t-0"
      data-jobcard-payments-event={event.type}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
            event.type === "received"
              ? "bg-slate-800"
              : event.type === "failed" || event.type === "cancelled"
                ? "bg-slate-400"
                : "bg-slate-300"
          }`}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{event.title}</p>
            {event.subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500">{event.subtitle}</p>
            ) : null}
            {when ? <p className="mt-0.5 text-xs text-slate-400">{when}</p> : null}
          </div>
          <p className="sm:text-right">
            <HistoryAmount event={event} />
          </p>
        </div>
      </div>
    </li>
  );
}

export default function JobCardPaymentsWorkspace({
  workspace,
  onCollectPayment,
  onCancelCurrentRequest,
  onCopyPaymentLink,
  collectBusy = false,
  collectError = null,
  cancelBusy = false,
  copyBusy = false,
  copyError = null,
}: JobCardPaymentsWorkspaceProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const historyGroups = useMemo(
    () => (workspace ? groupJobPaymentHistory(workspace.timeline) : []),
    [workspace]
  );

  if (!workspace) {
    return (
      <p className="text-sm text-slate-600" data-jobcard-payments-empty>
        Payment details will appear here after a proposal is accepted.
      </p>
    );
  }

  const current = workspace.currentRequest;
  const showCollect =
    workspace.canCollectPayment && onCollectPayment && current == null;
  const showQuietStatus = current == null && workspace.statusLabel.length > 0;
  const summaryCols =
    workspace.summaryRows.length > 3
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : "sm:grid-cols-3";

  return (
    <div className="flex flex-col gap-8" data-jobcard-payments-workspace>
      <section aria-labelledby="job-card-payments-summary">
        <h3 id="job-card-payments-summary" className="sr-only">
          Payment summary
        </h3>
        {showQuietStatus ? (
          <p
            className="mb-4 text-sm text-slate-600"
            data-jobcard-payments-status={workspace.state}
          >
            {workspace.statusLabel}
          </p>
        ) : (
          <p className="sr-only" data-jobcard-payments-status={workspace.state}>
            {workspace.statusLabel}
          </p>
        )}
        <dl className={`grid grid-cols-1 gap-x-8 gap-y-3 ${summaryCols}`}>
          {workspace.summaryRows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {summaryLabel(row.label)}
              </dt>
              <dd
                className="mt-1 text-base font-semibold tabular-nums text-slate-900"
                data-jobcard-payments-summary={row.label.toLowerCase()}
              >
                {formatJobPaymentWorkspaceAmount(row.cents)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {current ? (
        <section
          aria-labelledby="job-card-payments-current"
          data-jobcard-payments-current
        >
          <h3
            id="job-card-payments-current"
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
          >
            Current payment
          </h3>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {jobPaymentCurrentRequestKindLabel(current.kind)}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-slate-900">
            {formatJobPaymentWorkspaceAmount(current.amountCents)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{currentStatusLabel(current.status)}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {onCopyPaymentLink ? (
              <button
                type="button"
                disabled={copyBusy}
                onClick={() => {
                  void onCopyPaymentLink();
                }}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                data-jobcard-payments-copy-link
              >
                {copyBusy ? "Copying…" : JOB_CARD_PAYMENTS_COPY_LINK_CTA}
              </button>
            ) : null}
            {current.status === "open" && onCancelCurrentRequest ? (
              <button
                type="button"
                disabled={cancelBusy}
                onClick={() => {
                  void onCancelCurrentRequest();
                }}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                data-jobcard-payments-cancel
              >
                {cancelBusy ? "Cancelling…" : JOB_CARD_PAYMENTS_CANCEL_REQUEST_CTA}
              </button>
            ) : null}
          </div>
          {copyError ? (
            <p className="mt-2 text-sm text-slate-600" data-jobcard-payments-copy-error>
              {copyError}
            </p>
          ) : null}
        </section>
      ) : null}

      {showCollect ? (
        <section aria-labelledby="job-card-payments-collect">
          <h3
            id="job-card-payments-collect"
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
          >
            Collect payment
          </h3>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={collectBusy}
              onClick={() => setSheetOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              data-jobcard-payments-collect
            >
              {JOB_CARD_PAYMENTS_COLLECT_CTA}
            </button>
            {collectError && !sheetOpen ? (
              <p className="text-sm text-slate-600" data-jobcard-payments-collect-error>
                {collectError}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {!showCollect && !current && workspace.nextStep?.connectHref ? (
        <p className="mt-0">
          <a
            href={workspace.nextStep.connectHref}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
            data-jobcard-payments-connect
          >
            Connect payments
          </a>
        </p>
      ) : null}

      <section aria-labelledby="job-card-payments-history">
        <h3
          id="job-card-payments-history"
          className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
        >
          Payment history
        </h3>
        {workspace.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500" data-jobcard-payments-timeline-empty>
            No payment activity yet.
          </p>
        ) : (
          <div className="mt-3" data-jobcard-payments-timeline data-jobcard-payments-history>
            {historyGroups.map((group) => (
              <section
                key={group.heading}
                aria-labelledby={`job-card-payments-history-${group.heading.replace(/\s+/g, "-").toLowerCase()}`}
                className="mt-5 first:mt-0"
              >
                <h4
                  id={`job-card-payments-history-${group.heading.replace(/\s+/g, "-").toLowerCase()}`}
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  {group.heading}
                </h4>
                <ol className="mt-1">
                  {group.events.map((event) => (
                    <HistoryRow key={event.id} event={event} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </section>

      {sheetOpen && onCollectPayment ? (
        <JobCardCollectPaymentSheet
          open
          collectibleCents={workspace.collectibleRemainingCents}
          contractTotalCents={workspace.contractTotalCents}
          submitting={collectBusy}
          error={collectError}
          onClose={() => {
            if (collectBusy) return;
            setSheetOpen(false);
          }}
          onSubmit={(input) => {
            void onCollectPayment(input).then((result) => {
              if (result.ok) setSheetOpen(false);
            });
          }}
        />
      ) : null}
    </div>
  );
}
