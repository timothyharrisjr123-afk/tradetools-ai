"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobCardPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import { isUuidLike } from "@/app/lib/jobStore";
import { prefillDepositCents } from "@/app/lib/jobPaymentMoney";
import type { CompanyPaymentDepositMode, JobPaymentKind } from "@/app/lib/jobPaymentTypes";

export type JobPaymentsState = {
  view: JobCardPaymentViewModel | null;
  prefillDepositCents: number | null;
  reload: () => Promise<void>;
  requestPayment: (
    kind: JobPaymentKind,
    amountCents: number
  ) => Promise<{ ok: boolean; code?: string }>;
};

async function fetchJobPayments(jobId: string): Promise<{
  view: JobCardPaymentViewModel;
  prefill: number | null;
} | null> {
  const paymentRes = await fetch(`/api/jobs/${jobId}/payment-requests`);
  const payment = (await paymentRes.json()) as {
    ok?: boolean;
    view?: JobCardPaymentViewModel;
  };
  if (!paymentRes.ok || !payment.view) return null;

  let defaultDepositMode: CompanyPaymentDepositMode = "none";
  let percentBps: number | null = null;
  let fixedCents: number | null = null;
  try {
    const settingsRes = await fetch("/api/company/payments/status", {
      signal: AbortSignal.timeout(4000),
    });
    const settings = (await settingsRes.json()) as {
      ok?: boolean;
      settings?: {
        defaultDepositMode?: CompanyPaymentDepositMode;
        defaultDepositPercentBps?: number | null;
        defaultDepositFixedCents?: number | null;
      };
    };
    defaultDepositMode = settings.settings?.defaultDepositMode ?? "none";
    percentBps = settings.settings?.defaultDepositPercentBps ?? null;
    fixedCents = settings.settings?.defaultDepositFixedCents ?? null;
  } catch {
    // Prefill is optional. Job Card payment truth must not wait on Stripe refresh.
  }

  return {
    view: payment.view,
    prefill: prefillDepositCents({
      mode: defaultDepositMode,
      percentBps,
      fixedCents,
      acceptedTotalCents: payment.view.acceptedTotalCents ?? 0,
      remainingCents: payment.view.remainingCents,
    }),
  };
}

export function useJobPayments(jobId: string | null | undefined): JobPaymentsState {
  const [view, setView] = useState<JobCardPaymentViewModel | null>(null);
  const [prefill, setPrefill] = useState<number | null>(null);
  const id = (jobId ?? "").trim();

  const apply = useCallback(
    (result: { view: JobCardPaymentViewModel; prefill: number | null } | null) => {
      if (!result) {
        setView(null);
        setPrefill(null);
        return;
      }
      setView(result.view);
      setPrefill(result.prefill);
    },
    []
  );

  const reload = useCallback(async () => {
    if (!isUuidLike(id)) {
      apply(null);
      return;
    }
    apply(await fetchJobPayments(id));
  }, [apply, id]);

  useEffect(() => {
    if (!isUuidLike(id)) return;
    let cancelled = false;
    void fetchJobPayments(id).then((result) => {
      if (cancelled) return;
      apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, id]);

  const requestPayment = useCallback(
    async (kind: JobPaymentKind, amountCents: number) => {
      if (!isUuidLike(id)) return { ok: false, code: "invalid_payload" };
      const response = await fetch("/api/jobs/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id, kind, amountCents }),
      });
      const payload = (await response.json()) as { ok?: boolean; code?: string };
      if (payload.ok) apply(await fetchJobPayments(id));
      return { ok: payload.ok === true, code: payload.code };
    },
    [apply, id]
  );

  return { view, prefillDepositCents: prefill, reload, requestPayment };
}
