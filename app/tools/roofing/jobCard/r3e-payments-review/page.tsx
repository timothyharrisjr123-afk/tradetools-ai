import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import JobCardR3ePaymentsReviewHarness from "../JobCardR3ePaymentsReviewHarness";

export default function R3ePaymentsReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading R3E review…</div>}>
        <JobCardR3ePaymentsReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
