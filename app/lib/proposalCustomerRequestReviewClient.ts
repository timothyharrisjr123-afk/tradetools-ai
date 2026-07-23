/**
 * R3B3 — Client helpers for contractor customer-request review.
 */

import type { CustomerRequestReviewItemView } from "@/app/lib/proposalCustomerRequestReviewViewModel";
import type { ProposalCustomerRequestReviewStatus } from "@/app/lib/proposalCustomerRequestPersistence";

export const PROPOSAL_CUSTOMER_REQUESTS_API_PATH =
  "/api/proposals/customer-requests";

/** Browser event so Job Card Proposals + Activity hooks stay in sync after mark seen/dismiss. */
export const PROPOSAL_CUSTOMER_REQUESTS_CHANGED_EVENT =
  "fielddive:proposal-customer-requests-changed";

export function notifyProposalCustomerRequestsChanged(detail?: {
  proposalId?: string;
  jobId?: string;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PROPOSAL_CUSTOMER_REQUESTS_CHANGED_EVENT, { detail })
  );
}

export type ProposalCustomerRequestsFetchResult =
  | { ok: true; requests: CustomerRequestReviewItemView[] }
  | { ok: false; error: string };

export type ProposalCustomerRequestStatusUpdateClientResult =
  | {
      ok: true;
      request: CustomerRequestReviewItemView;
      proposal_status_unchanged: string | null;
      selected_option_id_unchanged: string | null;
      job_stage_unchanged: string | null;
    }
  | { ok: false; error: string };

export function buildProposalCustomerRequestsRequestUrl(
  proposalId: string,
  jobId: string
): string {
  const params = new URLSearchParams({
    proposalId: proposalId.trim(),
    jobId: jobId.trim(),
  });
  return `${PROPOSAL_CUSTOMER_REQUESTS_API_PATH}?${params.toString()}`;
}

export function parseProposalCustomerRequestsResponse(
  payload: unknown
): ProposalCustomerRequestsFetchResult {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: "invalid_response" };
  }
  const record = payload as Record<string, unknown>;
  if (record.ok === true && Array.isArray(record.requests)) {
    return {
      ok: true,
      requests: record.requests as CustomerRequestReviewItemView[],
    };
  }
  const error =
    typeof record.error === "string" && record.error.trim()
      ? record.error
      : "load_failed";
  return { ok: false, error };
}

export async function fetchProposalCustomerRequests(
  proposalId: string,
  jobId: string
): Promise<ProposalCustomerRequestsFetchResult> {
  try {
    const res = await fetch(
      buildProposalCustomerRequestsRequestUrl(proposalId, jobId),
      { method: "GET", credentials: "same-origin" }
    );
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const parsed = parseProposalCustomerRequestsResponse(payload);
      if (!parsed.ok) return parsed;
      return { ok: false, error: "load_failed" };
    }
    return parseProposalCustomerRequestsResponse(payload);
  } catch {
    return { ok: false, error: "load_failed" };
  }
}

export async function updateProposalCustomerRequestStatus(
  input: {
    requestId: string;
    status: ProposalCustomerRequestReviewStatus;
    proposalId: string;
    jobId: string;
  }
): Promise<ProposalCustomerRequestStatusUpdateClientResult> {
  try {
    const res = await fetch(PROPOSAL_CUSTOMER_REQUESTS_API_PATH, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: input.requestId,
        status: input.status,
        proposalId: input.proposalId,
        jobId: input.jobId,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (payload == null || typeof payload !== "object") {
      return { ok: false, error: "invalid_response" };
    }
    const record = payload as Record<string, unknown>;
    if (record.ok === true && record.request != null && typeof record.request === "object") {
      notifyProposalCustomerRequestsChanged({
        proposalId: input.proposalId,
        jobId: input.jobId,
      });
      return {
        ok: true,
        request: record.request as CustomerRequestReviewItemView,
        proposal_status_unchanged:
          record.proposal_status_unchanged == null
            ? null
            : String(record.proposal_status_unchanged),
        selected_option_id_unchanged:
          record.selected_option_id_unchanged == null
            ? null
            : String(record.selected_option_id_unchanged),
        job_stage_unchanged:
          record.job_stage_unchanged == null
            ? null
            : String(record.job_stage_unchanged),
      };
    }
    return {
      ok: false,
      error:
        typeof record.error === "string" && record.error.trim()
          ? record.error
          : "update_failed",
    };
  } catch {
    return { ok: false, error: "update_failed" };
  }
}
