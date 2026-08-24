"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProposalCustomerRequests,
  PROPOSAL_CUSTOMER_REQUESTS_CHANGED_EVENT,
  updateProposalCustomerRequestStatus,
} from "@/app/lib/proposalCustomerRequestReviewClient";
import type { CustomerRequestReviewItemView } from "@/app/lib/proposalCustomerRequestReviewViewModel";
import type { ProposalCustomerRequestReviewStatus } from "@/app/lib/proposalCustomerRequestPersistence";
import { applyCustomerRequestFetchFailure } from "@/app/lib/surfaceReadFailureSemantics";

export function useProposalCustomerRequests(input: {
  proposalId: string | null | undefined;
  jobId: string | null | undefined;
  enabled?: boolean;
}) {
  const proposalId = (input.proposalId ?? "").trim();
  const jobId = (input.jobId ?? "").trim();
  const enabled = input.enabled !== false && proposalId.length > 0 && jobId.length > 0;

  const [requests, setRequests] = useState<CustomerRequestReviewItemView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const requestOwnerRef = useRef("");

  const reload = useCallback(async () => {
    if (!enabled) {
      setRequests([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const ownerKey = `${jobId}::${proposalId}`;
    const result = await fetchProposalCustomerRequests(proposalId, jobId);
    if (!result.ok) {
      setRequests((previous) => {
        const applied = applyCustomerRequestFetchFailure({
          previousRequests: requestOwnerRef.current === ownerKey ? previous : [],
          error: result.error,
        });
        setError(applied.error);
        return applied.requests;
      });
      setLoading(false);
      return;
    }
    requestOwnerRef.current = ownerKey;
    setRequests(result.requests);
    setLoading(false);
  }, [enabled, jobId, proposalId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onChanged = () => {
      void reload();
    };
    window.addEventListener(PROPOSAL_CUSTOMER_REQUESTS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(
        PROPOSAL_CUSTOMER_REQUESTS_CHANGED_EVENT,
        onChanged
      );
    };
  }, [enabled, reload]);

  const updateStatus = useCallback(
    async (requestId: string, status: ProposalCustomerRequestReviewStatus) => {
      if (!enabled) return { ok: false as const, error: "disabled" };
      setPendingRequestId(requestId);
      setActionError(null);
      const result = await updateProposalCustomerRequestStatus({
        requestId,
        status,
        proposalId,
        jobId,
      });
      setPendingRequestId(null);
      if (!result.ok) {
        setActionError(result.error);
        return result;
      }
      setRequests((prev) =>
        prev.map((row) => (row.id === result.request.id ? result.request : row))
      );
      return result;
    },
    [enabled, jobId, proposalId]
  );

  return {
    requests,
    loading,
    error,
    actionError,
    pendingRequestId,
    reload,
    markSeen: (requestId: string) => updateStatus(requestId, "seen"),
    dismiss: (requestId: string) => updateStatus(requestId, "dismissed"),
  };
}

export function useJobProposalCustomerRequests(input: {
  proposalIds: readonly string[];
  jobId: string | null | undefined;
  enabled?: boolean;
}) {
  const jobId = (input.jobId ?? "").trim();
  const proposalIds = input.proposalIds.map((id) => id.trim()).filter(Boolean);
  const enabled = input.enabled !== false && jobId.length > 0 && proposalIds.length > 0;

  const [requests, setRequests] = useState<CustomerRequestReviewItemView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const requestOwnerRef = useRef("");

  const proposalKey = proposalIds.join(",");

  const reload = useCallback(async () => {
    if (!enabled) {
      setRequests([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const ownerKey = `${jobId}::${proposalKey}`;
    const ids = proposalKey.split(",").filter(Boolean);
    const results = await Promise.all(
      ids.map((proposalId) => fetchProposalCustomerRequests(proposalId, jobId))
    );
    const merged: CustomerRequestReviewItemView[] = [];
    for (const result of results) {
      if (!result.ok) {
        setRequests((previous) => {
          const applied = applyCustomerRequestFetchFailure({
            previousRequests:
              requestOwnerRef.current === ownerKey ? previous : [],
            error: result.error,
          });
          setError(applied.error);
          return applied.requests;
        });
        setLoading(false);
        return;
      }
      merged.push(...result.requests);
    }
    merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    requestOwnerRef.current = ownerKey;
    setRequests(merged);
    setLoading(false);
  }, [enabled, jobId, proposalKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onChanged = () => {
      void reload();
    };
    window.addEventListener(PROPOSAL_CUSTOMER_REQUESTS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(
        PROPOSAL_CUSTOMER_REQUESTS_CHANGED_EVENT,
        onChanged
      );
    };
  }, [enabled, reload]);

  const updateStatus = useCallback(
    async (requestId: string, status: ProposalCustomerRequestReviewStatus) => {
      const current = requests.find((row) => row.id === requestId);
      if (!current || !enabled) return { ok: false as const, error: "disabled" };
      setPendingRequestId(requestId);
      setActionError(null);
      const result = await updateProposalCustomerRequestStatus({
        requestId,
        status,
        proposalId: current.proposalId,
        jobId,
      });
      setPendingRequestId(null);
      if (!result.ok) {
        setActionError(result.error);
        return result;
      }
      setRequests((prev) =>
        prev.map((row) => (row.id === result.request.id ? result.request : row))
      );
      return result;
    },
    [enabled, jobId, requests]
  );

  return {
    requests,
    loading,
    error,
    actionError,
    pendingRequestId,
    reload,
    markSeen: (requestId: string) => updateStatus(requestId, "seen"),
    dismiss: (requestId: string) => updateStatus(requestId, "dismissed"),
  };
}
