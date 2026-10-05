import type { JobCardStageProgress as JobCardStageProgressModel } from "@/app/lib/jobCardStageProgress";

/** Informational only: where the job stands. Never clickable, never a stage control. */
export default function JobCardStageProgress({
  progress,
}: {
  progress: JobCardStageProgressModel;
}) {
  const { muted } = progress;
  return (
    <div
      className="min-w-0"
      data-jobcard-stage={progress.currentLabel}
      data-jobcard-stage-progress={muted ? "muted" : "active"}
    >
      <p className="sr-only">Current stage: {progress.currentLabel}</p>
      <ol className="flex min-w-0 items-center" aria-hidden>
        {progress.steps.map((step, index) => {
          const current = step.state === "current";
          const done = step.state === "done";
          const dot = current
            ? muted
              ? "h-2.5 w-2.5 bg-slate-500 ring-4 ring-slate-100"
              : "h-2.5 w-2.5 bg-blue-600 ring-4 ring-blue-100"
            : done
              ? muted
                ? "h-2 w-2 bg-slate-400"
                : "h-2 w-2 bg-blue-500"
              : "h-2 w-2 bg-slate-300";
          const label = current
            ? "font-semibold text-slate-900"
            : done
              ? "hidden text-slate-600 sm:inline"
              : "hidden text-slate-400 sm:inline";
          return (
            <li
              key={step.stage}
              className={`flex items-center ${index < progress.steps.length - 1 ? "min-w-0 flex-1" : "shrink-0"}`}
              data-jobcard-stage-step={step.stage}
              data-state={step.state}
            >
              <span className="flex shrink-0 items-center gap-2">
                <span className={`shrink-0 rounded-full ${dot}`} />
                <span className={`whitespace-nowrap text-[13px] ${label}`}>{step.label}</span>
              </span>
              {index < progress.steps.length - 1 ? (
                <span
                  className={`mx-2 h-px min-w-3 flex-1 ${done && !muted ? "bg-blue-200" : "bg-slate-200"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
