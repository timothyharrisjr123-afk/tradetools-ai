"use client";

type JobCardOverviewTasksSummaryProps = {
  openCount: number;
  loading?: boolean;
  error?: string | null;
  previewTitles?: readonly string[];
  onOpenTasks: () => void;
};

export default function JobCardOverviewTasksSummary({
  openCount,
  loading = false,
  error = null,
  previewTitles = [],
  onOpenTasks,
}: JobCardOverviewTasksSummaryProps) {
  if (loading) {
    return (
      <section
        data-jobcard-overview-tasks
        data-jobcard-overview-tasks-loading="true"
        className="border-t border-slate-100 pt-4"
      >
        <p className="text-sm text-slate-500">Loading tasks…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        data-jobcard-overview-tasks
        className="border-t border-slate-100 pt-4"
        role="alert"
      >
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={onOpenTasks}
          className="mt-2 text-sm font-medium text-slate-700 hover:text-slate-950"
        >
          Open Tasks
        </button>
      </section>
    );
  }

  if (openCount === 0) {
    return (
      <section
        data-jobcard-overview-tasks
        data-jobcard-overview-tasks-empty="true"
        className="border-t border-slate-100 pt-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Tasks
        </p>
        <p className="mt-1 text-sm text-slate-500">No open tasks</p>
      </section>
    );
  }

  return (
    <section
      data-jobcard-overview-tasks
      className="border-t border-slate-100 pt-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Open tasks
        </p>
        <button
          type="button"
          onClick={onOpenTasks}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
          data-jobcard-overview-tasks-open
        >
          View all
        </button>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-900">
        {openCount} open
      </p>
      {previewTitles.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {previewTitles.slice(0, 3).map((title) => (
            <li
              key={title}
              className="truncate text-sm text-slate-600"
              title={title}
            >
              {title}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
