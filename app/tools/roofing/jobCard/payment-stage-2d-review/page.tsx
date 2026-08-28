import { Suspense } from "react";
import PaymentStage2DReviewHarness from "./PaymentStage2DReviewHarness";

export default function PaymentStage2DReviewPage() {
  return (
    <div className="min-h-screen bg-[#e8eef5] text-slate-900 antialiased">
      <Suspense fallback={<div className="p-6 text-slate-500">Loading Stage 2D review…</div>}>
        <p className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
          Stage 2D customer payment fixtures. Query <code>?show=</code> deposit-due,
          progress-due, balance-due, processing, payment-received, paid-in-full,
          payments-complete, failed-deposit-retry, failed-progress, no-payment-due,
          terms-progress.
        </p>
        <PaymentStage2DReviewHarness />
      </Suspense>
    </div>
  );
}
