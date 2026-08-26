import { Suspense } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import PaymentStage1ReviewHarness from "./PaymentStage1ReviewHarness";

export default function PaymentStage1ReviewPage() {
  return (
    <FieldDiveAppShell activeNav="jobs">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading payment review…</div>}>
        <PaymentStage1ReviewHarness />
      </Suspense>
    </FieldDiveAppShell>
  );
}
