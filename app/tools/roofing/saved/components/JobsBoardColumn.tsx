"use client";

import type { RoofingEstimate } from "@/app/lib/estimateStore";
import type { BoardColumnDef, JobsBoardCardModel } from "../jobsBoardUtils";
import JobsBoardCard from "./JobsBoardCard";

type JobsBoardColumnProps = {
  column: BoardColumnDef;
  jobs: RoofingEstimate[];
  buildCardModel: (job: RoofingEstimate) => JobsBoardCardModel;
  onOpenJob: (job: RoofingEstimate) => void;
  onOpenLane: () => void;
  filterActive?: boolean;
  columnTotalLabel?: string | null;
};

export default function JobsBoardColumn({
  column,
  jobs,
  buildCardModel,
  onOpenJob,
  onOpenLane,
  filterActive = false,
  columnTotalLabel,
}: JobsBoardColumnProps) {
  const emptyMessage = filterActive ? "No matches" : "No jobs in this stage";

  return (
    <article className="flex w-72 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50/60 shadow-sm">
      <button
        type="button"
        onClick={onOpenLane}
        title={`View ${column.label} jobs`}
        className="w-full shrink-0 rounded-t-lg border-b border-slate-200/80 bg-white px-3.5 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="min-w-0 truncate text-sm font-semibold text-slate-800">{column.label}</h2>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-600">({jobs.length})</span>
        </div>
        {columnTotalLabel ? (
          <p className="mt-1 text-xs font-medium tabular-nums text-slate-500">{columnTotalLabel}</p>
        ) : null}
      </button>
      <div className="flex max-h-[min(70vh,640px)] flex-col overflow-y-auto p-2.5">
        {jobs.length === 0 ? (
          <p className="px-1 py-8 text-center text-xs text-slate-400">{emptyMessage}</p>
        ) : (
          <div className="space-y-2.5">
            {jobs.map((job) => (
              <JobsBoardCard key={job.id} model={buildCardModel(job)} onOpen={() => onOpenJob(job)} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
