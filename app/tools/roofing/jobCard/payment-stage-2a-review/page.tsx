import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import PaymentStage2AReviewHarness from "./PaymentStage2AReviewHarness";

export default function PaymentStage2AReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading payments review…</div>}>
        <p className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
          Historical payment-workspace fixture. Not the live Job Card.
        </p>
        <PaymentStage2AReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
