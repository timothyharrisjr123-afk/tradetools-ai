import { Suspense } from "react";
import { notFound } from "next/navigation";

/** Review-only harness for Phase 2A financial projection honesty visuals. */
export default async function PaymentPhase2AHonestyHarnessPage() {
  // Inline NODE_ENV check keeps the harness import out of production bundles (webpack dead-branch elimination).
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    const { default: PaymentStage2AReviewHarness } = await import(
      "@/app/tools/roofing/jobCard/payment-stage-2a-review/PaymentStage2AReviewHarness"
    );
    return (
      <Suspense fallback={null}>
        <PaymentStage2AReviewHarness />
      </Suspense>
    );
  }
  notFound();
}
