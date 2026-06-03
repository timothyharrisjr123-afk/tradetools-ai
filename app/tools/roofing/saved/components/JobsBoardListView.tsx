"use client";

import type { RoofingEstimate } from "@/app/lib/estimateStore";
import {
  buildJobsBoardCardModel,
  formatCentsToCurrency,
  getBoardColumnKeyForJob,
  getBoardStageLabelForJob,
  timeInStageToneClass,
  toEstimateTotalCents,
} from "../jobsBoardUtils";

type JobsBoardListViewProps = {
  jobs: RoofingEstimate[];
  batchStatuses: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>;
  onOpenJob: (job: RoofingEstimate) => void;
};

function statusParts(
  job: RoofingEstimate,
  columnKey: ReturnType<typeof getBoardColumnKeyForJob>,
  batchStatuses: JobsBoardListViewProps["batchStatuses"]
): string {
  if (!columnKey) return "—";
  const model = buildJobsBoardCardModel(job, batchStatuses, { columnKey });
  const parts = [model.reportStatus.label, model.proposalStatus.label].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function JobsBoardListView({ jobs, batchStatuses, onOpenJob }: JobsBoardListViewProps) {
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => {
              const columnKey = getBoardColumnKeyForJob(job);
              const model =
                columnKey !== null
                  ? buildJobsBoardCardModel(job, batchStatuses, { columnKey })
                  : null;
              const valueCents = toEstimateTotalCents(job);
              const summary = statusParts(job, columnKey, batchStatuses);

              return (
                <tr
                  key={job.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenJob(job)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenJob(job);
                    }
                  }}
                  className="cursor-pointer transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {job.customerName ||
                      (job as { name?: string }).name ||
                      (job as { customer?: string }).customer ||
                      "Unnamed customer"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                    {(job.address || "").trim() || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{getBoardStageLabelForJob(job)}</td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
