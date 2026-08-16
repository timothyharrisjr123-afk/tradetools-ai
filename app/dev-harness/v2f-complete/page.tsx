import { Suspense } from "react";
import ProposalV2fCompleteReviewHarness from "@/app/tools/roofing/proposals/preview/ProposalV2fCompleteReviewHarness";

export const dynamic = "force-dynamic";

/** Read-only visual fixture. Reuses production Job Card, Preview, sent-record, and Public presenters. */
export default function V2fCompleteReviewPage() {
  return (
    <Suspense fallback={null}>
      <ProposalV2fCompleteReviewHarness />
    </Suspense>
  );
}
