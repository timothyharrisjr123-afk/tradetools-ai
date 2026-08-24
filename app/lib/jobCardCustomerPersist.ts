/**
 * Persist Job Card customer identity to jobs.customer_id (SMOKE-2D-CUST).
 *
 * Uses existing findOrCreateCustomer rules — email is required for lookup/create.
 * Board-origin gating is the caller's responsibility; this helper does not check it.
 */

import { isUuidLike } from "@/app/lib/uuid";
import type { JobRecord } from "@/app/lib/jobTypes";

export type JobCardCustomerPersistReason =
  | "unchanged"
  | "insufficient_customer_identity"
  | "invalid_company_or_job"
  | "customer_lookup_failed"
  | "update_failed"
  | "persisted";

export type EnsureJobCustomerPersistedResult = {
  customerId: string | null;
  updated: boolean;
  reason: JobCardCustomerPersistReason;
};

export type EnsureJobCustomerPersistedDeps = {
  findOrCreateCustomer: (args: {
    companyId: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
  }) => Promise<string | null>;
  updateJob: (
    jobId: string,
    patch: { customer_id: string }
  ) => Promise<JobRecord | null>;
};

export type EnsureJobCustomerPersistedInput = {
  companyId: string;
  jobId: string;
  existingCustomerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  deps: EnsureJobCustomerPersistedDeps;
};

function normalizeId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || !isUuidLike(trimmed)) return null;
  return trimmed;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toString().trim();
}

/**
 * Find or create a DB customer and link jobs.customer_id when needed.
 * Never throws for normal insufficient/missing customer data.
 */
export async function ensureJobCustomerPersisted(
  input: EnsureJobCustomerPersistedInput
): Promise<EnsureJobCustomerPersistedResult> {
  const companyId = normalizeText(input.companyId);
  const jobId = normalizeId(input.jobId);

  if (!companyId || !jobId) {
    return {
      customerId: null,
      updated: false,
      reason: "invalid_company_or_job",
    };
  }

  const existingCustomerId = normalizeId(input.existingCustomerId);
  if (existingCustomerId) {
    return {
      customerId: existingCustomerId,
      updated: false,
      reason: "unchanged",
    };
  }

  const email = normalizeText(input.customerEmail);
  if (!email) {
    return {
      customerId: null,
      updated: false,
      reason: "insufficient_customer_identity",
    };
  }

  const customerId = await input.deps.findOrCreateCustomer({
    companyId,
    name: normalizeText(input.customerName),
    email,
    phone: normalizeText(input.customerPhone) || undefined,
    address: normalizeText(input.customerAddress) || undefined,
  });

  if (!customerId || !isUuidLike(customerId)) {
    return {
      customerId: null,
      updated: false,
      reason: "customer_lookup_failed",
    };
  }

  if (existingCustomerId === customerId) {
    return {
      customerId,
      updated: false,
      reason: "unchanged",
    };
  }

  const updatedJob = await input.deps.updateJob(jobId, { customer_id: customerId });
  if (!updatedJob) {
    return {
      customerId,
      updated: false,
      reason: "update_failed",
    };
  }

  return {
    customerId: normalizeId(updatedJob.customer_id) ?? customerId,
    updated: true,
    reason: "persisted",
  };
}
