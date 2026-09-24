import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  action,
  className,
  ...data
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <div
      className={`rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center ${className ?? ""}`}
      {...data}
    >
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
