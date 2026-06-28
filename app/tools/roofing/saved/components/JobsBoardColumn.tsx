"use client";

import type { RoofingEstimate } from "@/app/lib/estimateStore";
import type { BoardColumnDef, BoardColumnKey, JobsBoardCardModel } from "../jobsBoardUtils";
import { BOARD_STAGE_EMPTY_HINTS } from "../jobsBoardUtils";
import JobsBoardCard from "./JobsBoardCard";

type JobsBoardColumnProps = {
  column: BoardColumnDef;
  jobs: RoofingEstimate[];
  buildCardModel: (job: RoofingEstimate) => JobsBoardCardModel;
  onOpenJob: (job: RoofingEstimate) => void;
  onOpenLane: () => void;
  filterActive?: boolean;
  columnTotalLabel?: string | null;
  categoryLabel?: string | null;
};

export default function JobsBoardColumn({
  column,
  jobs,
  buildCardModel,
  onOpenJob,
  onOpenLane,
  filterActive = false,
  columnTotalLabel,
  categoryLabel,
}: JobsBoardColumnProps) {
  const stageHint = BOARD_STAGE_EMPTY_HINTS[column.key as BoardColumnKey];

  return (
    <article className="flex h-[calc(100vh-12rem)] min-h-[500px] w-[348px] shrink-0 flex-col border-r border-slate-200/50 last:border-r-0 sm:w-[360px]">
      <button
        type="button"
        onClick={onOpenLane}
        title={`View ${column.label} jobs`}
        className="w-full shrink-0 border-b border-slate-200/70 bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-3.5 text-left transition hover:from-slate-100 hover:to-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-slate-300/50"
      >
        {categoryLabel ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{categoryLabel}</p>
        ) : null}
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">{column.label}</h2>
            {columnTotalLabel ? (
              <p className="mt-0.5 text-xs font-medium tabular-nums text-slate-500">{columnTotalLabel}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700 shadow-sm">
            {jobs.length}
          </span>
        </div>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 px-3 py-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60 [&::-webkit-scrollbar-track]:bg-transparent">
        {jobs.length === 0 ? (
          <div className="mx-0.5 rounded-xl border border-dashed border-slate-200/90 bg-white/70 px-3.5 py-9 text-center">
            <p className="text-xs font-semibold text-slate-600">
              {filterActive ? "No matches in this stage" : "No jobs in this stage"}
            </p>
            {!filterActive ? (
              <>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Jobs will appear here as they move through your pipeline.
                </p>
                {stageHint ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{stageHint}</p>
                ) : null}
              </>
            ) : null}
          </div>
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
