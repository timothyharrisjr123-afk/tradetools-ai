"use client";

type JobCardQuietEmptyStateProps = {
  message: string;
  testId?: string;
};

export default function JobCardQuietEmptyState({
  message,
  testId,
}: JobCardQuietEmptyStateProps) {
  return (
    <p className="text-sm text-slate-500" data-jobcard-quiet-empty={testId}>
      {message}
    </p>
  );
}
