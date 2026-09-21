import { Suspense } from "react";
import PaymentStage2AReviewHarness from "@/app/tools/roofing/jobCard/payment-stage-2a-review/PaymentStage2AReviewHarness";

/** Review-only harness for Phase 2A financial projection honesty visuals. */
export default function PaymentPhase2AHonestyHarnessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentStage2AReviewHarness />
    </Suspense>
  );
}
