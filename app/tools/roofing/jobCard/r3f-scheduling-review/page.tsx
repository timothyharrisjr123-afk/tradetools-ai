import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import JobCardR3fSchedulingReviewHarness from "../JobCardR3fSchedulingReviewHarness";

export default function R3fSchedulingReviewPage() {
  return (
    <FieldDiveAppShell activeNav="calendar">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading R3F review…</div>}>
        <JobCardR3fSchedulingReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
