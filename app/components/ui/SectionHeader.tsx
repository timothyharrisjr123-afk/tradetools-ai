import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  description,
  action,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const size =
    Heading === "h1"
      ? "text-2xl font-semibold tracking-tight"
      : Heading === "h2"
        ? "text-lg font-semibold"
        : "text-base font-semibold";
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 ${className ?? ""}`}
    >
      <div className="min-w-0 space-y-1">
        <Heading className={`${size} text-slate-950`}>{title}</Heading>
        {description ? (
          <p className="text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
