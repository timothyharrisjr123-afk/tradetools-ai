"use client";

import type { RoofingEstimate } from "@/app/lib/estimateStore";
import type { BoardColumnDef, JobsBoardCardModel } from "../jobsBoardUtils";
import JobsBoardCard from "./JobsBoardCard";

type JobsBoardColumnProps = {
  column: BoardColumnDef;
  jobs: RoofingEstimate[];
  buildCardModel: (job: RoofingEstimate) => JobsBoardCardModel;
  onOpenJob: (job: RoofingEstimate) => void;
};

export default function JobsBoardColumn({ column, jobs, buildCardModel, onOpenJob }: JobsBoardColumnProps) {
  return (
    <article
      className={`flex w-[min(100%,260px)] shrink-0 flex-col rounded-xl border xl:w-[min(100%,calc((100%-4.5rem)/7))] xl:min-w-[200px] ${column.columnClass}`}
    >
      <header className="border-b border-black/[0.05] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className={`text-[11px] font-bold uppercase tracking-wide leading-tight ${column.labelClass}`}>
            {column.label}
          </h2>
          <span className={`text-sm font-bold tabular-nums ${column.countClass}`}>{jobs.length}</span>
        </div>
      </header>
      <div className="flex max-h-[min(72vh,680px)] min-h-[220px] flex-1 flex-col overflow-y-auto p-2">
        {jobs.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-500">No jobs in this stage</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobsBoardCard
                key={job.id}
                model={buildCardModel(job)}
                onOpen={() => onOpenJob(job)}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
