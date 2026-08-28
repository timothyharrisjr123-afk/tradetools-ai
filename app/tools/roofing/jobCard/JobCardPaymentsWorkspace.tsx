"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Clock3,
  DollarSign,
  Minus,
} from "lucide-react";
import JobCardCollectPaymentSheet from "@/app/tools/roofing/jobCard/JobCardCollectPaymentSheet";
import {
  formatJobPaymentWorkspaceAmount,
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

function TimelineIcon({ event }: { event: JobPaymentWorkspaceTimelineEvent }) {
  if (event.type === "received") {
    return (
      <DollarSign
        className="h-4 w-4 text-emerald-600"
        aria-label="Received"
      />
    );
  }
  if (event.type === "processing") {
    return <Clock3 className="h-4 w-4 text-slate-500" aria-label="Processing" />;
  }
  if (event.type === "failed") {
    return (
      <AlertTriangle className="h-4 w-4 text-amber-600" aria-label="Failed" />
    );
  }
  if (event.type === "refund") {
    return <Minus className="h-4 w-4 text-slate-500" aria-label="Refund" />;
  }
  return <span className="h-4 w-4" aria-hidden />;
}

function TimelineAmount({ event }: { event: JobPaymentWorkspaceTimelineEvent }) {
  const amount = formatJobPaymentWorkspaceAmount(event.amountCents);
  if (event.type === "refund") {
    return <span className="font-medium tabular-nums text-slate-800">-{amount}</span>;
  }
  return (
    <span
      className={`font-medium tabular-nums ${
        event.settled ? "text-emerald-800" : "text-slate-800"
      }`}
    >
      {amount}
    </span>
  );
}

function currentStatusLabel(status: string): string {
  if (status === "processing") return "Processing";
  return "Open";
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

  return (
    <div className="flex flex-col gap-6" data-jobcard-payments-workspace>
      <section aria-labelledby="job-card-payments-status">
        <p
          id="job-card-payments-status"
          className="text-sm font-medium text-slate-900"
          data-jobcard-payments-status={workspace.state}
        >
          {workspace.statusLabel}
        </p>
        <dl className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
          {workspace.summaryRows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <dt className="text-sm text-slate-500">
                {row.label === "Received"
                  ? "Collected"
                  : row.label === "Contract"
                    ? "Contract total"
                    : row.label}
              </dt>
              <dd
                className="text-sm font-medium tabular-nums text-slate-900"
                data-jobcard-payments-summary={row.label.toLowerCase()}
              >
                {formatJobPaymentWorkspaceAmount(row.cents)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {current ? (
        <section aria-labelledby="job-card-payments-current" data-jobcard-payments-current>
          <h3
            id="job-card-payments-current"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Current request
          </h3>
          <p className="mt-1.5 text-sm font-medium text-slate-900">
            {jobPaymentCurrentRequestKindLabel(current.kind)}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-slate-700">
            {formatJobPaymentWorkspaceAmount(current.amountCents)}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{currentStatusLabel(current.status)}</p>
          <div className="mt-3 flex flex-col gap-2">
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
            {copyError ? (
              <p className="text-sm text-slate-600" data-jobcard-payments-copy-error>
                {copyError}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {showCollect ? (
        <div className="flex flex-col gap-2">
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
      ) : workspace.nextStep && !current ? (
        <section aria-labelledby="job-card-payments-next">
          <h3
            id="job-card-payments-next"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Next step
          </h3>
          <p className="mt-1.5 text-sm text-slate-800" data-jobcard-payments-next>
            {workspace.nextStep.label}
          </p>
          {workspace.nextStep.detail ? (
            <p className="mt-0.5 text-sm text-slate-500">{workspace.nextStep.detail}</p>
          ) : null}
          {workspace.nextStep.connectHref ? (
            <p className="mt-2">
              <a
                href={workspace.nextStep.connectHref}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
                data-jobcard-payments-connect
              >
                Connect payments
              </a>
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="job-card-payments-timeline">
        <h3
          id="job-card-payments-timeline"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          History
        </h3>
        {workspace.timeline.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600" data-jobcard-payments-timeline-empty>
            No payment activity yet.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col" data-jobcard-payments-timeline>
            {workspace.timeline.map((event) => (
              <li
                key={event.id}
                className="flex gap-3 border-t border-slate-100 py-3 first:border-t-0"
                data-jobcard-payments-event={event.type}
              >
                <div className="mt-0.5 shrink-0">
                  <TimelineIcon event={event} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <p className="text-sm font-medium text-slate-900">{event.title}</p>
                    <TimelineAmount event={event} />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {[event.methodLabel, event.occurredAtLabel]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
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
