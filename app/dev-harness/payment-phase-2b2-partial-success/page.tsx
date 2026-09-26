import { Suspense } from "react";
import { notFound } from "next/navigation";

/** Review-only harness for Phase 2B2 acceptance / deposit partial-success visuals. */
export default async function PaymentPhase2B2PartialSuccessHarnessPage() {
  // Inline NODE_ENV check keeps the harness import out of production bundles (webpack dead-branch elimination).
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    const { default: PaymentStage2B2ReviewHarness } = await import(
      "@/app/tools/roofing/jobCard/payment-stage-2b2-review/PaymentStage2B2ReviewHarness"
    );
    return (
      <Suspense fallback={null}>
        <PaymentStage2B2ReviewHarness />
      </Suspense>
    );
  }
  notFound();
}
