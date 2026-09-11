import { Suspense } from "react";
import ProposalV2fCompleteReviewHarness from "@/app/tools/roofing/proposals/preview/ProposalV2fCompleteReviewHarness";

/** Review-only harness (not a product screen). Restores historical /dev-harness/v2f-complete for D1 visual gates. */
export default function V2fCompleteHarnessPage() {
  return (
    <Suspense fallback={null}>
      <ProposalV2fCompleteReviewHarness />
    </Suspense>
  );
}
