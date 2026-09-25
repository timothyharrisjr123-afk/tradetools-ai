"use client";

import type { RoofingEstimate } from "@/app/lib/estimateStore";
import { CircleAlert } from "lucide-react";
import {
  getBoardColumnKeyForJob,
  getBoardStageLabelForJob,
  type BoardColumnKey,
  type JobsBoardCardModel,
} from "../jobsBoardUtils";

type JobsBoardListViewProps = {
  jobs: RoofingEstimate[];
  buildCardModel: (
    job: RoofingEstimate,
    columnKey: BoardColumnKey
  ) => JobsBoardCardModel;
  onOpenJob: (job: RoofingEstimate) => void;
  onStartWork?: (job: RoofingEstimate) => void;
  onCompleteJob?: (job: RoofingEstimate) => void;
  onScheduleJob?: (job: RoofingEstimate) => void;
  onApproveJob?: (job: RoofingEstimate) => void;
  /** When set, shown on every row (legacy section). */
  sourceBadge?: string | null;
};

function listRowDate(model: JobsBoardCardModel | null): string | null {
  if (!model) return null;
  if (model.completedAtLabel) return `Completed ${model.completedAtLabel}`;
  if (model.scheduleLabel) return model.scheduleLabel;
  return model.lastUpdatedDisplay ?? null;
}

function jobDisplayName(job: RoofingEstimate): string {
  return (
    job.customerName ||
    (job as { name?: string }).name ||
    (job as { customer?: string }).customer ||
    "Unnamed customer"
  );
}

function MobileRowAction({
  job,
  model,
  onStartWork,
  onCompleteJob,
  onScheduleJob,
  onApproveJob,
}: {
  job: RoofingEstimate;
  model: JobsBoardCardModel | null;
  onStartWork?: (job: RoofingEstimate) => void;
  onCompleteJob?: (job: RoofingEstimate) => void;
  onScheduleJob?: (job: RoofingEstimate) => void;
  onApproveJob?: (job: RoofingEstimate) => void;
}) {
  const cls =
    "inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-800 disabled:text-slate-400";
  if (model?.showApproveAction && onApproveJob) {
    return (
      <button type="button" className={cls} disabled={model.approveBusy} onClick={() => onApproveJob(job)}>
        {model.approveBusy ? "Approving…" : "Approve"}
      </button>
    );
  }
  if (model?.showScheduleAction && onScheduleJob) {
    return (
      <button type="button" className={cls} onClick={() => onScheduleJob(job)}>
        Schedule job
      </button>
    );
  }
  if (model?.showStartWorkAction && onStartWork) {
    return (
      <button type="button" className={cls} disabled={model.startWorkBusy} onClick={() => onStartWork(job)}>
        {model.startWorkBusy ? "Starting…" : "Start work"}
      </button>
    );
  }
  if (model?.showCompleteJobAction && onCompleteJob) {
    return (
      <button type="button" className={cls} disabled={model.completeJobBusy} onClick={() => onCompleteJob(job)}>
        {model.completeJobBusy ? "Completing…" : "Complete job"}
      </button>
    );
  }
  return null;
}

/**
 * Astra G6 hierarchy: identity → action → date → owner.
 * Stage remains as operational truth; value/status metadata are not primary.
 */
export default function JobsBoardListView({
  jobs,
  buildCardModel,
  onOpenJob,
  onStartWork,
  onCompleteJob,
  onScheduleJob,
  onApproveJob,
  sourceBadge,
}: JobsBoardListViewProps) {
  if (jobs.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200/60 bg-white px-4 py-10 text-center text-sm text-slate-500">
        No jobs match your filters.
      </p>
    );
  }

  return (
    <>
    <ul
      className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200/60 bg-white sm:hidden"
      data-board-list-mobile
    >
      {jobs.map((job) => {
        const columnKey = getBoardColumnKeyForJob(job);
        const model = columnKey !== null ? buildCardModel(job, columnKey) : null;
        const owner = model?.assigneeLabel?.trim() || null;
        const date = listRowDate(model);
        const name = jobDisplayName(job);
        return (
          <li key={job.id} className="space-y-1.5 px-4 py-3" data-board-list-mobile-row>
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70"
                aria-label={`Open job card for ${name}`}
                data-board-list-open-job
                onClick={() => onOpenJob(job)}
              >
                <span className="block truncate text-base font-semibold text-slate-900">
                  {name}
                </span>
                <span className="block truncate text-sm text-slate-500">
                  {(job.address || "").trim() || "No address on file"}
                </span>
              </button>
              <span className="shrink-0 text-[13px] text-slate-500">
                {getBoardStageLabelForJob(job)}
              </span>
            </div>
            {model?.attention ? (
              <p
                className={`flex items-center gap-1.5 text-[13px] font-semibold ${
                  model.showApproveAction ? "text-slate-700" : "text-amber-800"
                }`}
                aria-label={model.attention.accessibleLabel}
              >
                {model.showApproveAction ? null : (
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span className="truncate">{model.attention.label}</span>
              </p>
            ) : null}
            {model?.dispositionLabel ? (
              <p className="text-[13px] font-medium text-slate-600">{model.dispositionLabel}</p>
            ) : null}
            {date || owner ? (
              <p className="text-[13px] text-slate-500">
                {[date, owner ? `Production lead · ${owner}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            <MobileRowAction
              job={job}
              model={model}
              onStartWork={onStartWork}
              onCompleteJob={onCompleteJob}
              onScheduleJob={onScheduleJob}
              onApproveJob={onApproveJob}
            />
          </li>
        );
      })}
    </ul>
    <div className="hidden overflow-hidden rounded-lg border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:block">
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/70 [&::-webkit-scrollbar-track]:bg-transparent">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Address</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Production lead</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => {
              const columnKey = getBoardColumnKeyForJob(job);
              const model =
                columnKey !== null
                  ? buildCardModel(job, columnKey)
                  : null;
              const owner = model?.assigneeLabel?.trim() || null;

              return (
                <tr
                  key={job.id}
                  className="transition hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        className="truncate text-left font-medium text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70"
                        data-board-list-open-job
                        aria-label={`Open job card for ${
                          job.customerName ||
                          (job as { name?: string }).name ||
                          (job as { customer?: string }).customer ||
                          "Unnamed customer"
                        }`}
                        onClick={() => onOpenJob(job)}
                      >
                        {job.customerName ||
                          (job as { name?: string }).name ||
                          (job as { customer?: string }).customer ||
                          "Unnamed customer"}
                      </button>
                      {sourceBadge ? (
                        <span className="shrink-0 rounded border border-amber-200/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          {sourceBadge}
                        </span>
                      ) : null}
                    </div>
                    {model?.attention ? (
                      <span
                        className={
                          model.showApproveAction
                            ? "mt-1 inline-flex max-w-full items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                            : "mt-1 inline-flex max-w-full items-center gap-1.5 text-[11px] font-semibold text-amber-800"
                        }
                        aria-label={model.attention.accessibleLabel}
                        data-jobs-list-attention
                        data-attention-treatment={
                          model.showApproveAction ? "normal" : "warning"
                        }
                      >
                        {model.showApproveAction ? null : (
                          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        <span className="truncate">{model.attention.label}</span>
                        {model.attention.activeCount > 1 ? (
                          <span
                            className={
                              model.showApproveAction
                                ? "shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-600"
                                : "shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 tabular-nums"
                            }
                          >
                            {model.attention.activeCount}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                    {(job.address || "").trim() || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {model?.showApproveAction && onApproveJob ? (
                      <button
                        type="button"
                        disabled={model.approveBusy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onApproveJob(job);
                        }}
                        className="font-semibold text-slate-800 hover:text-slate-950"
                        data-board-list-approve-job
                      >
                        {model.approveBusy ? "Approving…" : "Approve"}
                      </button>
                    ) : model?.showScheduleAction && onScheduleJob ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onScheduleJob(job);
                        }}
                        className="font-semibold text-slate-800 hover:text-slate-950"
                        data-board-list-schedule-job
                      >
                        Schedule job
                      </button>
                    ) : model?.showStartWorkAction && onStartWork ? (
                      <button
                        type="button"
                        disabled={model.startWorkBusy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onStartWork(job);
                        }}
                        className="font-semibold text-slate-800 hover:text-slate-950"
                        data-board-list-start-work
                      >
                        {model.startWorkBusy ? "Starting…" : "Start work"}
                      </button>
                    ) : model?.showCompleteJobAction && onCompleteJob ? (
                      <button
                        type="button"
                        disabled={model.completeJobBusy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onCompleteJob(job);
                        }}
                        className="font-semibold text-slate-800 hover:text-slate-950"
                        data-board-list-complete-job
                      >
                        {model.completeJobBusy ? "Completing…" : "Complete job"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {listRowDate(model) ?? "—"}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-600"
                    data-board-list-owner
                  >
                    {owner ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    <span>{getBoardStageLabelForJob(job)}</span>
                    {model?.dispositionLabel ? (
                      <span
                        className="ml-2 text-xs font-medium text-slate-500"
                        data-board-disposition={model.dispositionLabel}
                      >
                        {model.dispositionLabel}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
