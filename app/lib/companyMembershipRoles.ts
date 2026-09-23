/**
 * Astra G7 — bounded membership role presets (not an ACL builder).
 * Maps company_memberships.role onto four product presets.
 */

export const COMPANY_MEMBERSHIP_ROLE_VALUES = [
  "owner",
  "admin",
  "office_sales",
  "production_lead",
  "field_user",
] as const;

export type CompanyMembershipRoleValue =
  (typeof COMPANY_MEMBERSHIP_ROLE_VALUES)[number];

/** Product-facing presets (Owner/Admin share one capability boundary). */
export const COMPANY_MEMBERSHIP_PRESETS = [
  "owner_admin",
  "office_sales",
  "production_lead",
  "field_user",
] as const;

export type CompanyMembershipPreset =
  (typeof COMPANY_MEMBERSHIP_PRESETS)[number];

export const COMPANY_MEMBERSHIP_PRESET_LABELS: Record<
  CompanyMembershipPreset,
  string
> = {
  owner_admin: "Owner / Admin",
  office_sales: "Office / Sales",
  production_lead: "Production lead",
  field_user: "Field user",
};

export type CompanyCapability =
  | "company_admin"
  | "member_admin"
  | "proposal_author"
  | "payment_admin"
  | "payment_request"
  | "schedule_mutate"
  | "task_assign"
  | "task_complete"
  | "lifecycle_start_complete"
  | "photo_mutate"
  | "job_assign"
  | "customers_jobs"
  /** Astra G8 — Hold / Resume (active ↔ on_hold). */
  | "job_pause_resume"
  /** Astra G8 — Lost / Close / Reopen (and composed Production+Closed recovery). */
  | "job_disposition_finalize";

const PRESET_CAPABILITIES: Record<
  CompanyMembershipPreset,
  ReadonlySet<CompanyCapability>
> = {
  owner_admin: new Set([
    "company_admin",
    "member_admin",
    "proposal_author",
    "payment_admin",
    "payment_request",
    "schedule_mutate",
    "task_assign",
    "task_complete",
    "lifecycle_start_complete",
    "photo_mutate",
    "job_assign",
    "customers_jobs",
    "job_pause_resume",
    "job_disposition_finalize",
  ]),
  office_sales: new Set([
    "proposal_author",
    "payment_request",
    "schedule_mutate",
    "task_assign",
    "task_complete",
    "lifecycle_start_complete",
    "photo_mutate",
    "job_assign",
    "customers_jobs",
    "job_pause_resume",
    "job_disposition_finalize",
  ]),
  production_lead: new Set([
    "schedule_mutate",
    "task_assign",
    "task_complete",
    "lifecycle_start_complete",
    "photo_mutate",
    "job_assign",
    "customers_jobs",
    "job_pause_resume",
  ]),
  field_user: new Set([
    "task_complete",
    "photo_mutate",
    "customers_jobs",
  ]),
};

export function normalizeCompanyMembershipRole(
  value: string | null | undefined
): CompanyMembershipRoleValue {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\//g, " ")
    .replace(/[\s-]+/g, "_");
  if (token === "owner") return "owner";
  if (token === "admin") return "admin";
  if (
    token === "office_sales" ||
    token === "office" ||
    token === "sales" ||
    token === "office/sales"
  ) {
    return "office_sales";
  }
  if (
    token === "production_lead" ||
    token === "production" ||
    token === "prod_lead"
  ) {
    return "production_lead";
  }
  if (
    token === "field_user" ||
    token === "field" ||
    token === "crew" ||
    token === "technician"
  ) {
    return "field_user";
  }
  // Unknown / empty → treat as owner for legacy single-user companies.
  return "owner";
}

export function presetFromMembershipRole(
  role: string | null | undefined
): CompanyMembershipPreset {
  const normalized = normalizeCompanyMembershipRole(role);
  if (normalized === "owner" || normalized === "admin") return "owner_admin";
  if (normalized === "office_sales") return "office_sales";
  if (normalized === "production_lead") return "production_lead";
  return "field_user";
}

export function roleValueForPreset(
  preset: CompanyMembershipPreset
): CompanyMembershipRoleValue {
  if (preset === "owner_admin") return "owner";
  return preset;
}

export function isCompanyMembershipPreset(
  value: string | null | undefined
): value is CompanyMembershipPreset {
  return (COMPANY_MEMBERSHIP_PRESETS as readonly string[]).includes(
    String(value ?? "").trim()
  );
}

export function capabilitiesForPreset(
  preset: CompanyMembershipPreset
): ReadonlySet<CompanyCapability> {
  return PRESET_CAPABILITIES[preset];
}

export function capabilitiesForRole(
  role: string | null | undefined
): ReadonlySet<CompanyCapability> {
  return capabilitiesForPreset(presetFromMembershipRole(role));
}

export function hasCompanyCapability(
  role: string | null | undefined,
  capability: CompanyCapability
): boolean {
  return capabilitiesForRole(role).has(capability);
}

export function isRestrictedFieldRole(
  role: string | null | undefined
): boolean {
  return presetFromMembershipRole(role) === "field_user";
}

export function isCommercialAuthorRole(
  role: string | null | undefined
): boolean {
  return hasCompanyCapability(role, "proposal_author");
}
