import { Suspense } from "react";
import JobCardV2f1ReviewHarness from "@/app/tools/roofing/jobCard/JobCardV2f1ReviewHarness";

export const dynamic = "force-dynamic";

/** Read-only visual fixture. No auth, no send/mint/freeze. */
export default function JobCardV2f1ReviewPage() {
  return (
    <Suspense fallback={null}>
      <JobCardV2f1ReviewHarness />
    </Suspense>
  );
}
