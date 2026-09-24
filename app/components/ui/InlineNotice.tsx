import type { ReactNode } from "react";
import { NOTICE_TONE, type UiTone } from "@/app/components/ui/tone";

export default function InlineNotice({
  tone = "neutral",
  title,
  children,
  action,
  className,
  ...data
}: {
  tone?: UiTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  const role = tone === "error" ? "alert" : "status";
  return (
    <div
      role={role}
      className={`rounded-lg border px-3 py-2.5 text-sm ${NOTICE_TONE[tone]} ${className ?? ""}`}
      {...data}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className="leading-relaxed">{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
