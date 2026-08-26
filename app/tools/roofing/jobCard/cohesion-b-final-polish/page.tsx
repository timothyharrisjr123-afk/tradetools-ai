import { Suspense } from "react";
import CohesionBFinalPolishHarness from "./CohesionBFinalPolishHarness";

/** Cohesion B final polish visual review — fixture data only, no production writes. */
export default function CohesionBFinalPolishReviewPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading review…</div>}>
      <CohesionBFinalPolishHarness />
    </Suspense>
  );
}
