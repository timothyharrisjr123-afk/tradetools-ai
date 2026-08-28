import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import PaymentStage2EReviewHarness from "./PaymentStage2EReviewHarness";

export default function PaymentStage2EReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading payments review…</div>}>
        <p className="border-b border-slate-200 bg-slate-50 px-6 py-2 text-sm text-slate-600">
          Stage 2E Payment History fixtures. Query <code>?show=</code> empty,
          current-open, failed-retry, sequential, refund, long-history, activity.
        </p>
        <PaymentStage2EReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
