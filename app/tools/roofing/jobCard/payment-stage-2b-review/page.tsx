import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import PaymentStage2BReviewHarness from "./PaymentStage2BReviewHarness";

export default function PaymentStage2BReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading payments review…</div>}>
        <PaymentStage2BReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
