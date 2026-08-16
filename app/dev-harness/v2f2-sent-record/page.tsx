import { Suspense } from "react";
import ProposalSentRecordReviewHarness from "@/app/tools/roofing/proposals/preview/ProposalSentRecordReviewHarness";

export const dynamic = "force-dynamic";

/** Read-only visual fixture. Reuses the Preview document presenter. No auth, send, mint, or freeze. */
export default function V2f2SentRecordReviewPage() {
  return (
    <Suspense fallback={null}>
      <ProposalSentRecordReviewHarness />
    </Suspense>
  );
}
