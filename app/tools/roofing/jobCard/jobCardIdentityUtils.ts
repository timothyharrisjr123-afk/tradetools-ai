import {
  resolveJobIdentityDisplay,
  type JobIdentityDisplay,
} from "@/app/lib/jobIdentityDisplay";
import type { JobRecord } from "@/app/lib/jobTypes";

/** @deprecated Prefer JobIdentityDisplay from jobIdentityDisplay — kept for Job Card call sites. */
export type JobCardIdentityDisplay = {
  displayName: string;
  phone: string;
  email: string;
  hasAddress: boolean;
  addressLine: string;
};

export function resolveJobCardIdentityFromRecord(job: JobRecord): JobCardIdentityDisplay {
  const identity: JobIdentityDisplay = resolveJobIdentityDisplay(job);
  return {
    displayName: identity.primaryLabel,
    phone: identity.phone,
    email: identity.email,
    hasAddress: identity.hasAddress,
    addressLine: identity.secondaryAddress ?? "Property details not complete",
  };
}
