/**
 * Shared job/customer identity for Job Card, Builder, and Preview chrome.
 * Primary = customer name when available; secondary = property address.
 * Pure helper — no React, store, or pricing.
 */

import { buildFormattedAddress } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";

export type JobIdentityDisplay = {
  /** Customer name when available; else job name; else fallback. */
  primaryLabel: string;
  /** Property / address line for secondary context. */
  secondaryAddress: string | null;
  phone: string;
  email: string;
  hasAddress: boolean;
};

const FALLBACK_PRIMARY = "New roofing job";

/**
 * Resolve contractor-facing identity from a job record.
 * Customer name wins over job_name so Builder matches Job Card.
 */
export function resolveJobIdentityDisplay(
  job: JobRecord | null | undefined,
  fallbackPrimary: string = FALLBACK_PRIMARY
): JobIdentityDisplay {
  if (!job) {
    return {
      primaryLabel: fallbackPrimary,
      secondaryAddress: null,
      phone: "",
      email: "",
      hasAddress: false,
    };
  }

  const customerName = (job.contact?.customer_name ?? "").trim();
  const jobName = (job.job_name ?? "").trim();
  const primaryLabel = customerName || jobName || fallbackPrimary;

  const phone = (job.contact?.customer_phone ?? "").trim();
  const email = (job.contact?.customer_email ?? "").trim();
  const line1 = (job.address?.line1 ?? "").trim();
  const hasAddress = line1.length > 0;
  const formatted = buildFormattedAddress(job.address ?? undefined);
  const secondaryAddress = hasAddress
    ? formatted?.trim() ||
      [line1, [job.address?.city, job.address?.state].filter(Boolean).join(", "), job.address?.zip]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join(", ")
    : null;

  return { primaryLabel, secondaryAddress, phone, email, hasAddress };
}

/** Compact label for return links / setup "For …" copy. */
export function formatJobIdentityReturnLabel(
  job: JobRecord | null | undefined,
  fallback = "Job"
): string {
  const identity = resolveJobIdentityDisplay(job, fallback);
  return identity.primaryLabel.trim() || fallback;
}
