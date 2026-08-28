"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobCardPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import type { JobPaymentWorkspaceView } from "@/app/lib/jobPaymentWorkspace";
import type { CollectAmountMode } from "@/app/lib/jobPaymentTypes";
import { isUuidLike } from "@/app/lib/uuid";

export type JobPaymentsState = {
  view: JobCardPaymentViewModel | null;
  workspace: JobPaymentWorkspaceView | null;
  reload: () => Promise<void>;
  collectPayment: (input: {
    amountMode: CollectAmountMode;
    percentageBps?: number;
    fixedAmount?: string;
  }) => Promise<{ ok: boolean; code?: string }>;
  cancelCurrentRequest: () => Promise<{ ok: boolean; code?: string }>;
  copyPaymentLink: () => Promise<{ ok: boolean; url?: string; code?: string }>;
  issueRefund: (
    captureId: string,
    amountCents: number,
    reason: string,
    commandId: string
  ) => Promise<{ ok: boolean; code?: string }>;
  collectBusy: boolean;
  collectError: string | null;
  cancelBusy: boolean;
  copyBusy: boolean;
  copyError: string | null;
  refundBusy: boolean;
  refundError: string | null;
};

async function fetchJobPayments(jobId: string): Promise<{
  view: JobCardPaymentViewModel;
  workspace: JobPaymentWorkspaceView | null;
} | null> {
  const paymentRes = await fetch(`/api/jobs/${jobId}/payment-requests`);
  const payment = (await paymentRes.json()) as {
    ok?: boolean;
    view?: JobCardPaymentViewModel;
    workspace?: JobPaymentWorkspaceView;
  };
  if (!paymentRes.ok || !payment.view) return null;
  return {
    view: payment.view,
    workspace: payment.workspace ?? null,
  };
}

export function useJobPayments(jobId: string | null | undefined): JobPaymentsState {
  const [view, setView] = useState<JobCardPaymentViewModel | null>(null);
  const [workspace, setWorkspace] = useState<JobPaymentWorkspaceView | null>(null);
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const id = (jobId ?? "").trim();

  const apply = useCallback(
    (
      result: {
        view: JobCardPaymentViewModel;
        workspace: JobPaymentWorkspaceView | null;
      } | null
    ) => {
      if (!result) {
        setView(null);
        setWorkspace(null);
        return;
      }
      setView(result.view);
      setWorkspace(result.workspace);
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

  const collectPayment = useCallback(
    async (input: {
      amountMode: CollectAmountMode;
      percentageBps?: number;
      fixedAmount?: string;
    }) => {
      if (!isUuidLike(id)) return { ok: false, code: "invalid_payload" };
      setCollectBusy(true);
      setCollectError(null);
      try {
        const body: Record<string, unknown> = { amountMode: input.amountMode };
        if (input.amountMode === "percentage") body.percentageBps = input.percentageBps;
        if (input.amountMode === "fixed") body.fixedAmount = input.fixedAmount;
        const response = await fetch(`/api/jobs/${id}/payment-requests/collect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as { ok?: boolean; code?: string };
        if (payload.ok) {
          apply(await fetchJobPayments(id));
          return { ok: true };
        }
        const code = payload.code ?? "invalid_payload";
        setCollectError(collectErrorCopy(code));
        apply(await fetchJobPayments(id));
        return { ok: false, code };
      } catch {
        setCollectError("Could not create the payment request.");
        return { ok: false, code: "internal_error" };
      } finally {
        setCollectBusy(false);
      }
    },
    [apply, id]
  );

  const cancelCurrentRequest = useCallback(async () => {
    const requestId = workspace?.currentRequest?.id;
    if (!isUuidLike(id) || !requestId) return { ok: false, code: "invalid_payload" };
    setCancelBusy(true);
    try {
      const response = await fetch(`/api/jobs/payment-requests/${requestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { ok?: boolean; code?: string };
      apply(await fetchJobPayments(id));
      if (payload.ok) return { ok: true };
      return { ok: false, code: payload.code ?? "invalid_payload" };
    } catch {
      return { ok: false, code: "internal_error" };
    } finally {
      setCancelBusy(false);
    }
  }, [apply, id, workspace?.currentRequest?.id]);

  const copyPaymentLink = useCallback(async () => {
    if (!isUuidLike(id)) return { ok: false, code: "invalid_payload" };
    setCopyBusy(true);
    setCopyError(null);
    try {
      const response = await fetch(`/api/jobs/${id}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        publicUrl?: string;
        code?: string;
      };
      if (!payload.ok || !payload.publicUrl) {
        setCopyError("Could not copy the payment link.");
        return { ok: false, code: payload.code ?? "invalid_payload" };
      }
      await navigator.clipboard.writeText(payload.publicUrl);
      return { ok: true, url: payload.publicUrl };
    } catch {
      setCopyError("Could not copy the payment link.");
      return { ok: false, code: "internal_error" };
    } finally {
      setCopyBusy(false);
    }
  }, [id]);

  const issueRefund = useCallback(
    async (
      captureId: string,
      amountCents: number,
      reason: string,
      commandId: string
    ) => {
      if (!isUuidLike(id) || !isUuidLike(captureId) || !isUuidLike(commandId)) {
        return { ok: false, code: "invalid_payload" };
      }
      setRefundBusy(true);
      setRefundError(null);
      try {
        const response = await fetch(
          `/api/jobs/${id}/payments/${captureId}/refunds`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amountCents, reason, commandId }),
          }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          code?: string;
        };
        apply(await fetchJobPayments(id));
        if (payload.ok) return { ok: true };
        const code = payload.code ?? "invalid_payload";
        setRefundError(refundErrorCopy(code));
        return { ok: false, code };
      } catch {
        setRefundError("Could not issue the refund.");
        return { ok: false, code: "internal_error" };
      } finally {
        setRefundBusy(false);
      }
    },
    [apply, id]
  );

  return {
    view,
    workspace,
    reload,
    collectPayment,
    cancelCurrentRequest,
    copyPaymentLink,
    issueRefund,
    collectBusy,
    collectError,
    cancelBusy,
    copyBusy,
    copyError,
    refundBusy,
    refundError,
  };
}

function refundErrorCopy(code: string): string {
  if (code === "amount_exceeds_refundable" || code === "overrefund_conflict") {
    return "That amount is no longer refundable.";
  }
  if (code === "invalid_capture" || code === "noncanonical_capture") {
    return "This payment can’t be refunded.";
  }
  return "Could not issue the refund.";
}

function collectErrorCopy(code: string): string {
  if (code === "amount_exceeds_collectible") {
    return "You have less remaining than that amount.";
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
  if (code === "invalid_amount" || code === "invalid_percentage") {
    return "Enter a valid amount.";
  }
  return "Could not create the payment request.";
}
