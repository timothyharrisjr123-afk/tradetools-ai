"use client";

import { FileSignature } from "lucide-react";
import type { JobCardDisplayModel } from "./jobCardDisplayTypes";

type JobCardMetadataStripProps = {
  display: JobCardDisplayModel;
};

export default function JobCardMetadataStrip({ display }: JobCardMetadataStripProps) {
  if (!display.proposalLabel) return null;

  return (
    <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-1.5">
        <FileSignature className="h-4 w-4 shrink-0 text-slate-400/90" strokeWidth={1.75} aria-hidden />
        <span className="truncate text-[13px] font-medium text-slate-700">
          {display.proposalLabel}
        </span>
      </div>
    </div>
  );
}
