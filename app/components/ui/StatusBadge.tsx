import type { ReactNode } from "react";
import { BADGE_TONE, type UiTone } from "@/app/components/ui/tone";

export default function StatusBadge({
  tone = "neutral",
  children,
  className,
  ...data
}: {
  tone?: UiTone;
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-semibold ${BADGE_TONE[tone]} ${className ?? ""}`}
      {...data}
    >
      {children}
    </span>
  );
}
