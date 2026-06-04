import { buildFormattedAddress } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";

export type JobCardIdentityDisplay = {
  displayName: string;
  phone: string;
  email: string;
  hasAddress: boolean;
  addressLine: string;
};

export function resolveJobCardIdentityFromRecord(job: JobRecord): JobCardIdentityDisplay {
  const displayName =
    (job.contact?.customer_name ?? "").trim() ||
    (job.job_name ?? "").trim() ||
    "New roofing job";
  const phone = (job.contact?.customer_phone ?? "").trim();
  const email = (job.contact?.customer_email ?? "").trim();
  const line1 = (job.address?.line1 ?? "").trim();
  const hasAddress = line1.length > 0;
  const formatted = buildFormattedAddress(job.address ?? undefined);
  const addressLine = hasAddress
    ? formatted?.trim() ||
      [line1, [job.address?.city, job.address?.state].filter(Boolean).join(", "), job.address?.zip]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join(", ")
    : "Property details not complete";

  return { displayName, phone, email, hasAddress, addressLine };
}
