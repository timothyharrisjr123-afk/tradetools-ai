import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import PaymentStage2CReviewHarness from "./PaymentStage2CReviewHarness";

export default function PaymentStage2CReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading payments review…</div>}>
        <p className="border-b border-slate-200 bg-slate-50 px-6 py-2 text-sm text-slate-600">
          Stage 2C visual fixture. Use live Job Card for behavioral proof.
        </p>
        <PaymentStage2CReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
