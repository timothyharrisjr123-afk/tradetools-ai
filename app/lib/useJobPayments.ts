"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobCardPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import type { JobPaymentWorkspaceView } from "@/app/lib/jobPaymentWorkspace";
import { isUuidLike } from "@/app/lib/uuid";
import { prefillDepositCents } from "@/app/lib/jobPaymentMoney";
import type { CompanyPaymentDepositMode, JobPaymentKind } from "@/app/lib/jobPaymentTypes";

export type JobPaymentsState = {
  view: JobCardPaymentViewModel | null;
  workspace: JobPaymentWorkspaceView | null;
  prefillDepositCents: number | null;
  reload: () => Promise<void>;
  requestPayment: (
    kind: JobPaymentKind,
    amountCents: number
  ) => Promise<{ ok: boolean; code?: string }>;
  collectRemainingBalance: () => Promise<{
    ok: boolean;
    code?: string;
    idempotentReplay?: boolean;
  }>;
  collectBusy: boolean;
  collectError: string | null;
};

async function fetchJobPayments(jobId: string): Promise<{
  view: JobCardPaymentViewModel;
  workspace: JobPaymentWorkspaceView | null;
  prefill: number | null;
} | null> {
  const paymentRes = await fetch(`/api/jobs/${jobId}/payment-requests`);
  const payment = (await paymentRes.json()) as {
    ok?: boolean;
    view?: JobCardPaymentViewModel;
    workspace?: JobPaymentWorkspaceView;
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
    workspace: payment.workspace ?? null,
    prefill: prefillDepositCents({
      mode: defaultDepositMode,
      percentBps,
      fixedCents,
      acceptedTotalCents:
        payment.workspace?.contractTotalCents ??
        payment.view.acceptedTotalCents ??
        0,
      remainingCents:
        payment.workspace?.collectibleRemainingCents ?? payment.view.remainingCents,
    }),
  };
}

export function useJobPayments(jobId: string | null | undefined): JobPaymentsState {
  const [view, setView] = useState<JobCardPaymentViewModel | null>(null);
  const [workspace, setWorkspace] = useState<JobPaymentWorkspaceView | null>(null);
  const [prefill, setPrefill] = useState<number | null>(null);
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const id = (jobId ?? "").trim();

  const apply = useCallback(
    (
      result: {
        view: JobCardPaymentViewModel;
        workspace: JobPaymentWorkspaceView | null;
        prefill: number | null;
      } | null
    ) => {
      if (!result) {
        setView(null);
        setWorkspace(null);
        setPrefill(null);
        return;
      }
      setView(result.view);
      setWorkspace(result.workspace);
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

  const collectRemainingBalance = useCallback(async () => {
    if (!isUuidLike(id)) return { ok: false, code: "invalid_payload" };
    setCollectBusy(true);
    setCollectError(null);
    try {
      const response = await fetch(`/api/jobs/${id}/payment-requests/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        code?: string;
        idempotentReplay?: boolean;
      };
      if (payload.ok) {
        apply(await fetchJobPayments(id));
        return { ok: true, idempotentReplay: payload.idempotentReplay === true };
      }
      const code = payload.code ?? "invalid_payload";
      setCollectError(collectBalanceErrorCopy(code));
      return { ok: false, code };
    } catch {
      setCollectError("Could not collect the remaining balance.");
      return { ok: false, code: "internal_error" };
    } finally {
      setCollectBusy(false);
    }
  }, [apply, id]);

  return {
    view,
    workspace,
    prefillDepositCents: prefill,
    reload,
    requestPayment,
    collectRemainingBalance,
    collectBusy,
    collectError,
  };
}

function collectBalanceErrorCopy(code: string): string {
  if (code === "not_complete") {
    return "Balance can be collected after the job is complete.";
  }
  if (code === "nothing_due") {
    return "Nothing remaining to collect.";
  }
  if (code === "not_connected") {
    return "Connect payments in Company Settings before collecting.";
  }
  if (code === "job_not_active") {
    return "This job is not active.";
  }
  if (code === "conflicting_request") {
    return "A payment request is already in progress.";
  }
  return "Could not collect the remaining balance.";
}
