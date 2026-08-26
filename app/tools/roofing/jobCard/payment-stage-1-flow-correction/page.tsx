import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import PaymentStage1FlowCorrectionReviewHarness from "./PaymentStage1FlowCorrectionReviewHarness";

export default function PaymentStage1FlowCorrectionReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading flow correction review…</div>}>
        <PaymentStage1FlowCorrectionReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
