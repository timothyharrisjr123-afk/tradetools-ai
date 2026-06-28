"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import JobsBoardCard from "./JobsBoardCard";
import type { JobsBoardCardModel } from "../jobsBoardUtils";
import type { RoofingEstimate } from "@/app/lib/estimateStore";

type JobsBoardLegacySectionProps = {
  count: number;
  jobs: RoofingEstimate[];
  buildCardModel: (job: RoofingEstimate, columnKey: import("../jobsBoardUtils").BoardColumnKey) => JobsBoardCardModel;
  getColumnKey: (job: RoofingEstimate) => import("../jobsBoardUtils").BoardColumnKey;
  onOpenJob: (job: RoofingEstimate) => void;
  searchEmpty: boolean;
};

export default function JobsBoardLegacySection({
  count,
  jobs,
  buildCardModel,
  getColumnKey,
  onOpenJob,
  searchEmpty,
}: JobsBoardLegacySectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-xl border border-slate-200/70 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-100/50"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-sm font-medium text-slate-600">Legacy estimates</h2>
            <span className="text-xs tabular-nums text-slate-400">
              {count} record{count !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Older saved estimates remain available here. For new proposals, start from a job and create
            the proposal from the Job Card.
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="border-t border-slate-200/60 px-4 pb-4 pt-3">
          {searchEmpty ? (
            <p className="text-sm text-slate-500">No legacy estimates match your search.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((est) => {
                const columnKey = getColumnKey(est);
                return (
                  <JobsBoardCard
                    key={est.id}
                    model={buildCardModel(est, columnKey)}
                    onOpen={() => onOpenJob(est)}
                    subdued
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
