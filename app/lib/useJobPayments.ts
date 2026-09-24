"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobCardPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import type { JobPaymentWorkspaceView } from "@/app/lib/jobPaymentWorkspace";
import type { CollectAmountMode } from "@/app/lib/jobPaymentTypes";
import { isUuidLike } from "@/app/lib/uuid";

export type JobPaymentDeliveryAttemptView = {
  id: string;
  status: string;
  attemptNumber: number;
  recipientRedacted: string | null;
  contractorNote: string | null;
  errorMessage: string | null;
  createdAt: string;
  providerAcceptedAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  bouncedAt: string | null;
};

export type JobPaymentsLoadStatus = "idle" | "loading" | "ready" | "error";

export type JobPaymentsState = {
  view: JobCardPaymentViewModel | null;
  workspace: JobPaymentWorkspaceView | null;
  deliveryAttemptsByRequestId: Record<string, JobPaymentDeliveryAttemptView[]>;
  /** Transport/projection load status — never invents business money truth. */
  loadStatus: JobPaymentsLoadStatus;
  reload: () => Promise<void>;
  collectPayment: (input: {
    amountMode: CollectAmountMode;
    percentageBps?: number;
    fixedAmount?: string;
  }) => Promise<{ ok: boolean; code?: string; requestId?: string }>;
  emailPaymentRequest: (input: {
    paymentRequestId: string;
    contractorNote?: string | null;
    resend?: boolean;
  }) => Promise<{ ok: boolean; code?: string; message?: string }>;
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
  emailBusy: boolean;
  emailError: string | null;
  emailSuccess: string | null;
  cancelBusy: boolean;
  copyBusy: boolean;
  copyError: string | null;
  refundBusy: boolean;
  refundError: string | null;
};

async function fetchJobPayments(jobId: string): Promise<{
  view: JobCardPaymentViewModel;
  workspace: JobPaymentWorkspaceView | null;
  deliveryAttemptsByRequestId: Record<string, JobPaymentDeliveryAttemptView[]>;
} | null> {
  const paymentRes = await fetch(`/api/jobs/${jobId}/payment-requests`);
  const payment = (await paymentRes.json()) as {
    ok?: boolean;
    view?: JobCardPaymentViewModel;
    workspace?: JobPaymentWorkspaceView;
    deliveryAttemptsByRequestId?: Record<string, JobPaymentDeliveryAttemptView[]>;
  };
  if (!paymentRes.ok || !payment.view) return null;
  return {
    view: payment.view,
    workspace: payment.workspace ?? null,
    deliveryAttemptsByRequestId: payment.deliveryAttemptsByRequestId ?? {},
  };
}

export function useJobPayments(jobId: string | null | undefined): JobPaymentsState {
  const [view, setView] = useState<JobCardPaymentViewModel | null>(null);
  const [workspace, setWorkspace] = useState<JobPaymentWorkspaceView | null>(null);
  const [deliveryAttemptsByRequestId, setDeliveryAttemptsByRequestId] = useState<
    Record<string, JobPaymentDeliveryAttemptView[]>
  >({});
  const [loadStatus, setLoadStatus] = useState<JobPaymentsLoadStatus>("idle");
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const id = (jobId ?? "").trim();

  const applySuccess = useCallback(
    (result: {
      view: JobCardPaymentViewModel;
      workspace: JobPaymentWorkspaceView | null;
      deliveryAttemptsByRequestId: Record<string, JobPaymentDeliveryAttemptView[]>;
    }) => {
      setView(result.view);
      setWorkspace(result.workspace);
      setDeliveryAttemptsByRequestId(result.deliveryAttemptsByRequestId);
      setLoadStatus("ready");
    },
    []
  );

  const applyError = useCallback(() => {
    setView(null);
    setWorkspace(null);
    setDeliveryAttemptsByRequestId({});
    setLoadStatus("error");
  }, []);

  const reload = useCallback(async () => {
    if (!isUuidLike(id)) {
      setView(null);
      setWorkspace(null);
      setDeliveryAttemptsByRequestId({});
      setLoadStatus("idle");
      return;
    }
    setLoadStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    const result = await fetchJobPayments(id);
    if (!result) {
      applyError();
      return;
    }
    applySuccess(result);
  }, [applyError, applySuccess, id]);

  useEffect(() => {
    if (!isUuidLike(id)) {
      setView(null);
      setWorkspace(null);
      setDeliveryAttemptsByRequestId({});
      setLoadStatus("idle");
      return;
    }
    let cancelled = false;
    setLoadStatus("loading");
    void fetchJobPayments(id).then((result) => {
      if (cancelled) return;
      if (!result) {
        applyError();
        return;
      }
      applySuccess(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyError, applySuccess, id]);

  // Bounded Phase 2A: reuse focus/pageshow refresh so returning to the tab
  // does not keep obviously stale financial projection.
  useEffect(() => {
    if (!isUuidLike(id)) return;
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void reload();
    };
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, reload]);

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
        const payload = (await response.json()) as {
          ok?: boolean;
          code?: string;
          id?: string;
        };
        if (payload.ok) {
          await reload();
          return { ok: true, requestId: payload.id };
        }
        const code = payload.code ?? "invalid_payload";
        setCollectError(collectErrorCopy(code));
        await reload();
        return { ok: false, code };
      } catch {
        setCollectError("Could not create the payment request.");
        return { ok: false, code: "internal_error" };
      } finally {
        setCollectBusy(false);
      }
    },
    [id, reload]
  );

  const emailPaymentRequest = useCallback(
    async (input: {
      paymentRequestId: string;
      contractorNote?: string | null;
      resend?: boolean;
    }) => {
      if (!isUuidLike(id) || !isUuidLike(input.paymentRequestId)) {
        return { ok: false, code: "invalid_payload" };
      }
      setEmailBusy(true);
      setEmailError(null);
      setEmailSuccess(null);
      try {
        const response = await fetch(
          `/api/jobs/${id}/payment-requests/${input.paymentRequestId}/email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contractorNote: input.contractorNote ?? null,
              resend: input.resend === true,
            }),
          }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          code?: string;
          message?: string;
          replayed?: boolean;
        };
        await reload();
        if (payload.ok) {
          setEmailSuccess(
            payload.replayed
              ? "Payment request email already sent."
              : "Payment request emailed."
          );
          return { ok: true };
        }
        const code = payload.code ?? "invalid_payload";
        const message =
          payload.message ??
          (code === "missing_customer_email"
            ? "Add a customer email before emailing. You can still copy the payment link."
            : "Could not email the payment request.");
        setEmailError(message);
        return { ok: false, code, message };
      } catch {
        setEmailError("Could not email the payment request.");
        return { ok: false, code: "internal_error" };
      } finally {
        setEmailBusy(false);
      }
    },
    [id, reload]
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
      await reload();
      if (payload.ok) return { ok: true };
      return { ok: false, code: payload.code ?? "invalid_payload" };
    } catch {
      return { ok: false, code: "internal_error" };
    } finally {
      setCancelBusy(false);
    }
  }, [id, reload, workspace?.currentRequest?.id]);

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
        await reload();
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
    [id, reload]
  );

  return {
    view,
    workspace,
    deliveryAttemptsByRequestId,
    loadStatus,
    reload,
    collectPayment,
    emailPaymentRequest,
    cancelCurrentRequest,
    copyPaymentLink,
    issueRefund,
    collectBusy,
    collectError,
    emailBusy,
    emailError,
    emailSuccess,
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
