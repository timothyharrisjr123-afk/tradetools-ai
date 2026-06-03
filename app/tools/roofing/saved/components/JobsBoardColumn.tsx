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
  const emptyMessage = filterActive ? "No matches" : "No jobs";

  return (
    <article className="flex h-[calc(100vh-10.5rem)] min-h-[480px] w-[352px] shrink-0 flex-col border-r border-slate-200/45 last:border-r-0">
      <button
        type="button"
        onClick={onOpenLane}
        title={`View ${column.label} jobs`}
        className="w-full shrink-0 border-b border-slate-200/35 bg-[#f2f3f4] px-3.5 py-2.5 text-left transition hover:bg-[#eaecee] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-slate-300/40"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="min-w-0 truncate text-sm font-medium text-slate-800">{column.label}</h2>
          <span className="shrink-0 text-xs tabular-nums text-slate-500">{jobs.length}</span>
        </div>
        {columnTotalLabel ? (
          <p className="mt-0.5 text-xs font-medium tabular-nums text-slate-500">{columnTotalLabel}</p>
        ) : null}
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f2f3f4]/55 px-2.5 py-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/55 [&::-webkit-scrollbar-track]:bg-transparent">
        {jobs.length === 0 ? (
          <p className="px-2 py-10 text-center text-xs text-slate-400">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobsBoardCard key={job.id} model={buildCardModel(job)} onOpen={() => onOpenJob(job)} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
