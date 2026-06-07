"use client";

import {
  Clock,
  FileSignature,
  FileText,
  ListChecks,
  MapPin,
  UserCircle,
} from "lucide-react";
import type { CardStatusBadge, JobsBoardCardModel } from "../jobsBoardUtils";
import { statusMetaTextClass, timeInStageToneClass } from "../jobsBoardUtils";

type JobsBoardCardProps = {
  model: JobsBoardCardModel;
  onOpen: () => void;
};

function MetaField({
  icon: Icon,
  label,
  valueClassName = "text-slate-600",
}: {
  icon: typeof ListChecks;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-400/90" strokeWidth={1.75} aria-hidden />
      <span className={`truncate text-xs leading-snug ${valueClassName}`}>{label}</span>
    </div>
  );
}

function StatusMetaField({ icon: Icon, status }: { icon: typeof FileText; status: CardStatusBadge }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-400/90" strokeWidth={1.75} aria-hidden />
      <span className={`truncate text-xs leading-snug ${statusMetaTextClass(status.tone)}`}>{status.label}</span>
    </div>
  );
}

export default function JobsBoardCard({ model, onOpen }: JobsBoardCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex min-h-[152px] w-full cursor-pointer flex-col rounded-lg border border-slate-200/70 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition hover:border-slate-300/80 hover:shadow-[0_2px_6px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/50"
    >
      {/* Top: customer name + value */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold leading-snug text-slate-900">
              {model.customerName}
            </h3>
            {model.sourceBadge ? (
              <span className="shrink-0 rounded border border-amber-200/90 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                {model.sourceBadge}
              </span>
            ) : null}
          </div>
        </div>
        {model.valueLabel ? (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">{model.valueLabel}</span>
        ) : null}
      </div>

      {/* Address with map pin */}
      <div className="mt-2 flex min-w-0 items-start gap-1.5">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400/90" strokeWidth={1.75} aria-hidden />
        {model.address ? (
          <p className="min-w-0 truncate text-xs leading-snug text-slate-500">{model.address}</p>
        ) : (
          <p className="text-xs text-slate-400">—</p>
        )}
      </div>

      {/* Icon metadata grid — Roofr anatomy */}
      <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-slate-100/90 pt-3.5">
        <MetaField icon={ListChecks} label={`Tasks ${model.tasksLabel}`} valueClassName="text-slate-500" />
        <StatusMetaField icon={FileText} status={model.reportStatus} />
        <StatusMetaField icon={FileSignature} status={model.proposalStatus} />
        <div className="flex min-w-0 items-center gap-2">
          <UserCircle className="h-4 w-4 shrink-0 text-slate-400/90" strokeWidth={1.75} aria-hidden />
          {model.assigneeInitials ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200/80 text-[10px] font-medium text-slate-600">
              {model.assigneeInitials}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      </div>

      {/* Footer: time in stage + last updated */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100/90 pt-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400/80" strokeWidth={1.75} aria-hidden />
          <span className={`truncate text-[11px] leading-none ${timeInStageToneClass(model.timeInStageTone)}`}>
            {model.timeInStage ?? "—"}
          </span>
        </div>
        {model.lastUpdatedDisplay ? (
          <span className="shrink-0 truncate text-[11px] leading-none text-slate-400/80">
            {model.lastUpdatedDisplay}
          </span>
        ) : null}
      </div>
    </article>
  );
}
