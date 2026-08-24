"use client";

type JobsBoardErrorStateProps = {
  onRetry: () => void;
  refreshFailed?: boolean;
};

export default function JobsBoardErrorState({
  onRetry,
  refreshFailed = false,
}: JobsBoardErrorStateProps) {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center"
      data-jobs-board-error
      data-jobs-board-refresh-error={refreshFailed ? "true" : "false"}
    >
      <h2 className="text-base font-semibold text-slate-900">
        {refreshFailed ? "Could not refresh jobs." : "Could not load jobs."}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        {refreshFailed
          ? "Showing the last jobs we successfully loaded. Retry to refresh."
          : "Jobs could not be loaded. This is not an empty company."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-9 items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        data-jobs-board-retry
      >
        Retry
      </button>
    </div>
  );
}
