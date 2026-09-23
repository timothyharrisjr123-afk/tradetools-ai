/**
 * Persist Job Card customer identity to jobs.customer_id.
 *
 * Phase 6 / FD-P1-01: supported path never silently findOrCreates by email.
 * - existing customer_id → unchanged
 * - missing customer_id → explicit_selection_required (safe no-op)
 * Old/null jobs keep snapshot contact fields; they are not auto-linked.
 */

import { isUuidLike } from "@/app/lib/uuid";
import type { JobRecord } from "@/app/lib/jobTypes";

export type JobCardCustomerPersistReason =
  | "unchanged"
  | "insufficient_customer_identity"
  | "explicit_selection_required"
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
  /** @deprecated Phase 6 — ignored; kept optional for call-site compatibility during cutover. */
  findOrCreateCustomer?: (args: {
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
 * Link jobs.customer_id only when already known. Never email-collapse.
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

  // Phase 6: do not invent a customer_id from email/name snapshots.
  // Missing pointer stays missing until an explicit select/create path sets it.
  void input.customerEmail;
  void input.customerName;
  void input.customerPhone;
  void input.customerAddress;
  void input.deps.findOrCreateCustomer;

  return {
    customerId: null,
    updated: false,
    reason: "explicit_selection_required",
  };
}
