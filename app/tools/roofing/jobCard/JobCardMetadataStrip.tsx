"use client";

import { Clock, FileSignature, FileText } from "lucide-react";
import {
  jobCardTimeInStageToneClass,
  type JobCardDisplayModel,
} from "./jobCardDisplayTypes";

type JobCardMetadataStripProps = {
  display: JobCardDisplayModel;
};

type MetaCellProps = {
  icon: typeof Clock;
  label: string;
  value: string;
  valueClassName?: string;
};

function MetaCell({ icon: Icon, label, value, valueClassName = "text-slate-700" }: MetaCellProps) {
  return (
    <div className="flex min-w-[8.5rem] flex-1 flex-col gap-0.5 sm:min-w-0">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="h-4 w-4 shrink-0 text-slate-400/90" strokeWidth={1.75} aria-hidden />
        <span className={`truncate text-[13px] font-medium ${valueClassName}`}>{value}</span>
      </div>
    </div>
  );
}

export default function JobCardMetadataStrip({ display }: JobCardMetadataStripProps) {
  return (
    <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-3 sm:px-6">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {display.timeInStage ? (
          <MetaCell
            icon={Clock}
            label="Time in stage"
            value={display.timeInStage}
            valueClassName={jobCardTimeInStageToneClass(display.timeInStageTone)}
          />
        ) : null}
        {display.lastUpdatedDisplay ? (
          <MetaCell
            icon={Clock}
            label="Last updated"
            value={display.lastUpdatedDisplay.replace(/^Updated /, "")}
          />
        ) : null}
        <MetaCell icon={FileText} label="Report" value={display.reportLabel} />
        <MetaCell icon={FileSignature} label="Proposal" value={display.proposalLabel} />
      </div>
    </div>
  );
}
