import { Suspense } from "react";
import PremiumCohesionCustomerHarness from "./PremiumCohesionCustomerHarness";

/**
 * Phase 1 visual review. Rendered without the contractor shell so the customer
 * proposal is reviewed exactly as a homeowner would see it.
 */
export default function PremiumCohesionCustomerReviewPage() {
  return (
    <div className="min-h-screen bg-[#e8eef5] text-slate-900 antialiased">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading customer proposal…</div>}>
        <PremiumCohesionCustomerHarness />
      </Suspense>
    </div>
  );
}
