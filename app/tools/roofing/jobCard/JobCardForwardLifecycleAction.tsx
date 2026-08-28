"use client";

import type { JobCardOverviewForwardAction } from "@/app/lib/jobCardForwardLifecycleAction";

const PRIMARY_BUTTON =
  "inline-flex min-h-[44px] items-center justify-center rounded-md bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

type JobCardForwardLifecycleActionProps = {
  action: JobCardOverviewForwardAction | null;
  busy?: boolean;
  onApproveJob?: () => void;
  onSchedule?: () => void;
};

export default function JobCardForwardLifecycleAction({
  action,
  busy = false,
  onApproveJob,
  onSchedule,
}: JobCardForwardLifecycleActionProps) {
  if (!action) return null;
  const onClick =
    action.kind === "approve_job" ? onApproveJob : onSchedule;
  if (!onClick) return null;

  return (
    <div className="mt-4 flex justify-end" data-jobcard-overview-forward={action.kind}>
      <button
        type="button"
        className={PRIMARY_BUTTON}
        disabled={busy}
        onClick={onClick}
        data-jobcard-overview-forward-action={action.kind}
      >
        {busy && action.kind === "approve_job" ? "Approving…" : action.label}
      </button>
    </div>
  );
}
