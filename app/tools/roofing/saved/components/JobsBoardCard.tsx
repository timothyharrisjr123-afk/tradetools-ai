"use client";

import {
  CalendarClock,
  Clock,
  FileSignature,
  FileText,
  ListChecks,
  MapPin,
  UserCircle,
} from "lucide-react";
import type { JobsBoardCardModel } from "../jobsBoardUtils";
import { statusMetaTextClass, timeInStageToneClass } from "../jobsBoardUtils";

type JobsBoardCardProps = {
  model: JobsBoardCardModel;
  onOpen: () => void;
  /** Muted styling for legacy estimate cards. */
  subdued?: boolean;
};

const ICON_CLASS = "h-4 w-4 shrink-0 text-slate-400/90";
const ICON_STROKE = 1.75;

function IconStatusRow({
  icon: Icon,
  label,
  textClassName = "text-slate-600",
}: {
  icon: typeof FileText;
  label: string;
  textClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />
      <span className={`min-w-0 truncate text-xs font-medium leading-snug ${textClassName}`}>{label}</span>
    </div>
  );
}

function formatTimeInStageFooter(label: string | null): string | null {
  if (!label) return null;
  if (label === "• New") return "New in stage";
  if (label.includes("in stage")) return label;
  return `${label} in stage`;
}

function assigneeDisplay(label: string | null | undefined): string {
  if (!label?.trim()) return "Unassigned";
  return label;
}

export default function JobsBoardCard({ model, onOpen, subdued = false }: JobsBoardCardProps) {
  const stageFooter = formatTimeInStageFooter(model.timeInStage);
  const updatedFooter = model.lastUpdatedDisplay ?? null;
  const assignee = assigneeDisplay(model.assigneeLabel);

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
      className={
        "flex min-h-[176px] w-full cursor-pointer flex-col rounded-lg border bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/50 " +
        (subdued
          ? "border-slate-200/70 shadow-none hover:border-slate-300/80 hover:bg-slate-50/40"
          : "border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-slate-300/90 hover:shadow-[0_2px_6px_rgba(15,23,42,0.07)]")
      }
    >
      <div className="shrink-0 px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3
            className={
              "min-w-0 flex-1 truncate text-sm font-semibold leading-snug " +
              (subdued ? "text-slate-700" : "text-slate-900")
            }
          >
            {model.customerName}
          </h3>
          {model.sourceBadge ? (
            <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {model.sourceBadge}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400/90" strokeWidth={ICON_STROKE} aria-hidden />
          {model.address ? (
            <p className="min-w-0 line-clamp-2 text-xs leading-relaxed text-slate-500">{model.address}</p>
          ) : (
            <p className="text-xs text-slate-400">No address on file</p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center border-y border-slate-100/90 bg-slate-50/35 px-4 py-3">
        <div className="grid grid-cols-1 gap-x-5 gap-y-2.5 min-[280px]:grid-cols-2 min-[280px]:gap-y-3">
          <IconStatusRow
            icon={ListChecks}
            label={`Tasks ${model.tasksLabel}`}
            textClassName="text-slate-600"
          />
          <IconStatusRow
            icon={FileText}
            label={model.reportStatus.label}
            textClassName={statusMetaTextClass(model.reportStatus.tone)}
          />
          <IconStatusRow
            icon={FileSignature}
            label={model.proposalStatus.label}
            textClassName={statusMetaTextClass(model.proposalStatus.tone)}
          />
          <IconStatusRow icon={UserCircle} label={assignee} textClassName="text-slate-500" />
        </div>
      </div>

      <footer
        className={
          "mt-auto grid shrink-0 items-center gap-4 px-4 py-2.5 text-[11px] leading-snug text-slate-500 " +
          (updatedFooter ? "grid-cols-1 min-[280px]:grid-cols-2" : "grid-cols-1")
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <Clock className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />
          <span className={`truncate ${timeInStageToneClass(model.timeInStageTone)}`}>
            {stageFooter ?? "—"}
          </span>
        </div>
        {updatedFooter ? (
          <div className="flex min-w-0 items-center gap-2 min-[280px]:justify-end">
            <CalendarClock className={ICON_CLASS} strokeWidth={ICON_STROKE} aria-hidden />
            <span className="truncate text-slate-500">{updatedFooter}</span>
          </div>
        ) : null}
      </footer>
    </article>
  );
}
