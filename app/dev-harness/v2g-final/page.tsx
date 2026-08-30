import { Suspense } from "react";
import ProposalV2gFinalReviewHarness from "./ProposalV2gFinalReviewHarness";

export const dynamic = "force-dynamic";

/** Read-only visual fixture for V2G package comparison surfaces. */
export default function V2gFinalReviewPage() {
  return (
    <Suspense fallback={null}>
      <ProposalV2gFinalReviewHarness />
    </Suspense>
  );
}
