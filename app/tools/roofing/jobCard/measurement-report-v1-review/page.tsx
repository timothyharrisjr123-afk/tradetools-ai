import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import MeasurementReportV1ReviewHarness from "./MeasurementReportV1ReviewHarness";

/**
 * Visual-only measurement report fixture route.
 * Not the live Job Card. No product warning chrome — final proof must match FieldDive quiet UI.
 */
export default function MeasurementReportV1ReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading measurement review…</div>}>
        <MeasurementReportV1ReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
