import type { ReactNode } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { NOTICE_ICON_TONE, NOTICE_TONE, type UiTone } from "@/app/components/ui/tone";

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
  const Icon = tone === "error" ? CircleAlert : tone === "warning" ? TriangleAlert : null;
  return (
    <div
      role={role}
      className={`rounded-lg border px-3 py-2.5 text-sm ${NOTICE_TONE[tone]} ${className ?? ""}`}
      {...data}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {Icon ? (
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${NOTICE_ICON_TONE[tone] ?? ""}`}
              strokeWidth={1.75}
              aria-hidden
            />
          ) : null}
          <div className="min-w-0 space-y-0.5">
            {title ? <p className="font-semibold">{title}</p> : null}
            {children ? <div className="leading-relaxed">{children}</div> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
