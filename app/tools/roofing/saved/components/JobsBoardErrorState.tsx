"use client";

import InlineNotice from "@/app/components/ui/InlineNotice";
import { buttonClass } from "@/app/components/ui/buttonStyles";

type JobsBoardErrorStateProps = {
  onRetry: () => void;
  refreshFailed?: boolean;
};

export default function JobsBoardErrorState({
  onRetry,
  refreshFailed = false,
}: JobsBoardErrorStateProps) {
  if (refreshFailed) {
    return (
      <InlineNotice
        tone="warning"
        title="Could not refresh jobs."
        data-jobs-board-error
        data-jobs-board-refresh-error="true"
        action={
          <button
            type="button"
            onClick={onRetry}
            className={buttonClass("secondary", { size: "sm" })}
            data-jobs-board-retry
          >
            Retry
          </button>
        }
      >
        Showing the last jobs we successfully loaded.
      </InlineNotice>
    );
  }
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center"
      data-jobs-board-error
      data-jobs-board-refresh-error="false"
    >
      <h2 className="text-base font-semibold text-red-900">Could not load jobs.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-red-800">
        Jobs could not be loaded. This is not an empty company.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={buttonClass("primary", { className: "mt-5" })}
        data-jobs-board-retry
      >
        Retry
      </button>
    </div>
  );
}
