/**
 * Company membership roles (Phase 13B-A authority reconciliation).
 *
 * company_memberships.role is read strictly: only the five stable keys are valid.
 * Anything else (null, empty, aliases, casing variants, future keys) resolves to
 * `invalid_role`, which holds no capabilities. Custody (the one company Owner) is
 * companies.owner_user_id; the `owner` role alone never proves custody.
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

export const INVALID_COMPANY_MEMBERSHIP_ROLE = "invalid_role" as const;

export type ResolvedCompanyMembershipRole =
  | CompanyMembershipRoleValue
  | typeof INVALID_COMPANY_MEMBERSHIP_ROLE;

/** Roles an ordinary role edit may write. `owner` moves only through custody transfer. */
export const ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES = [
  "admin",
  "office_sales",
  "production_lead",
  "field_user",
] as const;

export type AssignableCompanyMembershipRole =
  (typeof ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES)[number];

export const COMPANY_MEMBERSHIP_ROLE_LABELS: Record<
  ResolvedCompanyMembershipRole,
  string
> = {
  owner: "Owner",
  admin: "Admin",
  office_sales: "Office / Sales",
  production_lead: "Production lead",
  field_user: "Field user",
  invalid_role: "Access needs attention",
};

export type CompanyCapability =
  | "company_admin"
  | "member_admin"
  /**
   * Commercial authoring (proposals + Astra G9 scope-change propose/price/send).
   * No separate scope_change capability — reuse proposal_author.
   */
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

/** Every capability today's single-owner product flows consume. */
const OWNER_CAPABILITIES: ReadonlySet<CompanyCapability> = new Set([
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
]);

const NO_CAPABILITIES: ReadonlySet<CompanyCapability> = new Set();

/**
 * Interim (Phase 13B-A): only Owner holds capabilities. Non-Owner roles are recognized
 * membership identities with no capability grant until Phase C role profiles exist;
 * they never inherit Owner-equivalent authority in the meantime.
 */
const ROLE_CAPABILITIES: Record<
  ResolvedCompanyMembershipRole,
  ReadonlySet<CompanyCapability>
> = {
  owner: OWNER_CAPABILITIES,
  admin: NO_CAPABILITIES,
  office_sales: NO_CAPABILITIES,
  production_lead: NO_CAPABILITIES,
  field_user: NO_CAPABILITIES,
  invalid_role: NO_CAPABILITIES,
};

/** Exact stable-key match only; no trimming, case folding, or alias mapping. */
export function resolveCompanyMembershipRole(
  value: unknown
): ResolvedCompanyMembershipRole {
  if (
    typeof value === "string" &&
    (COMPANY_MEMBERSHIP_ROLE_VALUES as readonly string[]).includes(value)
  ) {
    return value as CompanyMembershipRoleValue;
  }
  return INVALID_COMPANY_MEMBERSHIP_ROLE;
}

export function isAssignableCompanyMembershipRole(
  value: unknown
): value is AssignableCompanyMembershipRole {
  return (
    typeof value === "string" &&
    (ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES as readonly string[]).includes(value)
  );
}

export function capabilitiesForRole(
  role: unknown
): ReadonlySet<CompanyCapability> {
  return ROLE_CAPABILITIES[resolveCompanyMembershipRole(role)];
}

export function hasCompanyCapability(
  role: unknown,
  capability: CompanyCapability
): boolean {
  return capabilitiesForRole(role).has(capability);
}

/** Field users and invalid roles get the restricted (non-commercial) presentation. */
export function isRestrictedFieldRole(role: unknown): boolean {
  const resolved = resolveCompanyMembershipRole(role);
  return resolved === "field_user" || resolved === INVALID_COMPANY_MEMBERSHIP_ROLE;
}

export function isCommercialAuthorRole(role: unknown): boolean {
  return hasCompanyCapability(role, "proposal_author");
}

/** Custody requires both the `owner` role and the companies.owner_user_id pointer. */
export function isCompanyCustodyOwner(input: {
  userId: string | null | undefined;
  role: unknown;
  companyOwnerUserId: string | null | undefined;
}): boolean {
  const userId = typeof input.userId === "string" ? input.userId : "";
  const pointer =
    typeof input.companyOwnerUserId === "string" ? input.companyOwnerUserId : "";
  return (
    userId !== "" &&
    pointer === userId &&
    resolveCompanyMembershipRole(input.role) === "owner"
  );
}
