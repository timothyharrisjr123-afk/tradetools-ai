import { Suspense } from "react";
import PaymentStage2B2ReviewHarness from "@/app/tools/roofing/jobCard/payment-stage-2b2-review/PaymentStage2B2ReviewHarness";

/** Review-only harness for Phase 2B2 acceptance / deposit partial-success visuals. */
export default function PaymentPhase2B2PartialSuccessHarnessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentStage2B2ReviewHarness />
    </Suspense>
  );
}
