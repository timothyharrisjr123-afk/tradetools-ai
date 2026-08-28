"use client";

import type { RoofingEstimate } from "@/app/lib/estimateStore";
import { CircleAlert } from "lucide-react";
import {
  formatCentsToCurrency,
  getBoardColumnKeyForJob,
  getBoardStageLabelForJob,
  timeInStageToneClass,
  toEstimateTotalCents,
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

function statusParts(
  model: JobsBoardCardModel | null
): string {
  if (!model) return "—";
  const parts = [model.reportStatus?.label, model.proposalStatus.label].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

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
        No jobs match your search or filters.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/70 [&::-webkit-scrollbar-track]:bg-transparent">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Address</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Value</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
              <th className="px-4 py-2.5 font-medium">Time in stage</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => {
              const columnKey = getBoardColumnKeyForJob(job);
              const model =
                columnKey !== null
                  ? buildCardModel(job, columnKey)
                  : null;
              const valueCents = toEstimateTotalCents(job);
              const summary = statusParts(model);

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
                        className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[11px] font-semibold text-amber-800"
                        aria-label={model.attention.accessibleLabel}
                        data-jobs-list-attention
                      >
                        <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{model.attention.label}</span>
                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 tabular-nums">
                          {model.attention.activeCount}
                        </span>
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                    {(job.address || "").trim() || "—"}
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
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                    {valueCents > 0 ? formatCentsToCurrency(valueCents) : "—"}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-600">{summary}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {model?.lastUpdatedDisplay ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {model?.timeInStage ? (
                      <span className={timeInStageToneClass(model.timeInStageTone)}>{model.timeInStage}</span>
                    ) : (
                      "—"
                    )}
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
                        className="font-semibold text-cyan-700 hover:text-cyan-900"
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
