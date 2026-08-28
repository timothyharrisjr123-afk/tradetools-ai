import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import ActivityChronologyReviewHarness from "./ActivityChronologyReviewHarness";

/**
 * Visual-only Activity chronology fixture route.
 * Not the live Job Card. Developer review only.
 */
export default function ActivityChronologyReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading activity review…</div>}>
        <ActivityChronologyReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
