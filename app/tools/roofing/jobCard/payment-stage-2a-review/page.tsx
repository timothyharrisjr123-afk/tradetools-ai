import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import PaymentStage2AReviewHarness from "./PaymentStage2AReviewHarness";

export default function PaymentStage2AReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading payments review…</div>}>
        <PaymentStage2AReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
