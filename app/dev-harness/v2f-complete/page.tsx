import { Suspense } from "react";
import { notFound } from "next/navigation";

/** Review-only harness (not a product screen). Restores historical /dev-harness/v2f-complete for D1 visual gates. */
export default async function V2fCompleteHarnessPage() {
  // Inline NODE_ENV check keeps the harness import out of production bundles (webpack dead-branch elimination).
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    const { default: ProposalV2fCompleteReviewHarness } = await import(
      "@/app/tools/roofing/proposals/preview/ProposalV2fCompleteReviewHarness"
    );
    return (
      <Suspense fallback={null}>
        <ProposalV2fCompleteReviewHarness />
      </Suspense>
    );
  }
  notFound();
}
