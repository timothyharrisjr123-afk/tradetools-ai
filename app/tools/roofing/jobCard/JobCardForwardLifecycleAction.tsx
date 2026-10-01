"use client";

import {
  CalendarPlus,
  Check,
  CircleCheckBig,
  Play,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type {
  JobCardOverviewPrimaryAction,
  JobCardOverviewPrimaryKind,
} from "@/app/lib/jobCardForwardLifecycleAction";
import { useStickyActionYield } from "@/app/lib/stickyActionYield";

const PRIMARY_BUTTON =
  "inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 sm:w-auto";

const ACTION_ICONS: Partial<Record<JobCardOverviewPrimaryKind, LucideIcon>> = {
  approve_job: Check,
  schedule: CalendarPlus,
  start_work: Play,
  complete_job: CircleCheckBig,
  resume_job: Play,
  reopen_job: RotateCcw,
  reopen_and_complete: RotateCcw,
};

type JobCardForwardLifecycleActionProps = {
  action: JobCardOverviewPrimaryAction | null;
  busy?: boolean;
  /** Desktop/inline placement in the Overview situation area. */
  placement?: "inline" | "sticky";
  onApproveJob?: () => void;
  onSchedule?: () => void;
  onStartWork?: () => void;
  onCompleteJob?: () => void;
  onResumeJob?: () => void;
  onReopenJob?: () => void;
  onReopenAndComplete?: () => void;
};

function busyLabel(action: JobCardOverviewPrimaryAction): string {
  if (action.kind === "approve_job") return "Approving…";
  if (action.kind === "start_work") return "Starting…";
  if (action.kind === "complete_job") return "Completing…";
  if (action.kind === "resume_job") return "Resuming…";
  if (action.kind === "reopen_job") return "Reopening…";
  if (action.kind === "reopen_and_complete") return "Working…";
  return action.label;
}

export default function JobCardForwardLifecycleAction({
  action,
  busy = false,
  placement = "inline",
  onApproveJob,
  onSchedule,
  onStartWork,
  onCompleteJob,
  onResumeJob,
  onReopenJob,
  onReopenAndComplete,
}: JobCardForwardLifecycleActionProps) {
  const stickyYields = useStickyActionYield(placement === "sticky");
  if (!action) return null;
  if (placement === "sticky" && stickyYields) return null;

  const onClick =
    action.kind === "approve_job"
      ? onApproveJob
      : action.kind === "schedule"
        ? onSchedule
        : action.kind === "start_work"
          ? onStartWork
          : action.kind === "complete_job"
            ? onCompleteJob
            : action.kind === "resume_job"
              ? onResumeJob
              : action.kind === "reopen_job"
                ? onReopenJob
                : onReopenAndComplete;
  if (!onClick) return null;

  const Icon = ACTION_ICONS[action.kind] ?? null;
  const button = (
    <button
      type="button"
      className={PRIMARY_BUTTON}
      disabled={busy}
      onClick={onClick}
      data-jobcard-overview-forward-action={action.kind}
      data-jobcard-primary-lifecycle={action.kind}
    >
      {Icon && !busy ? <Icon className="h-4 w-4" strokeWidth={2} aria-hidden /> : null}
      {busy ? busyLabel(action) : action.label}
    </button>
  );

  if (placement === "sticky") {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-[55] border-t border-slate-200/90 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm min-[1200px]:hidden"
        data-jobcard-overview-forward={action.kind}
        data-jobcard-sticky-primary="true"
      >
        {button}
      </div>
    );
  }

  return (
    <div
      className="mt-3 flex shrink-0 justify-stretch sm:justify-end min-[1200px]:mt-0"
      data-jobcard-overview-forward={action.kind}
      data-jobcard-primary-inline="true"
    >
      {button}
    </div>
  );
}
