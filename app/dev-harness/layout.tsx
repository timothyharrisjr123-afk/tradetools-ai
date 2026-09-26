import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isInternalReviewSurfaceEnabled } from "@/app/lib/internalSurfaceGuard";

export default function DevHarnessLayout({ children }: { children: ReactNode }) {
  if (!isInternalReviewSurfaceEnabled(process.env.NODE_ENV)) {
    notFound();
  }
  return children;
}
