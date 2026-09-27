/**
 * Company membership roles (Phase 13B-A authority reconciliation).
 *
 * company_memberships.role is read strictly: only the five stable keys are valid.
 * Anything else (null, empty, aliases, casing variants, future keys) resolves to
 * `invalid_role`, which holds no capabilities. Capabilities are decided only by the
 * database policy engine (Phase 13B-C). Custody (the one company Owner) is
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
  office_sales: "Sales",
  production_lead: "Production Lead",
  field_user: "Field",
  invalid_role: "Access needs attention",
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

/**
 * Field users and invalid roles get the restricted (non-commercial) presentation.
 * Presentation only: capabilities come from the database policy engine
 * (app/lib/access), never from the role key.
 */
export function isRestrictedFieldRole(role: unknown): boolean {
  const resolved = resolveCompanyMembershipRole(role);
  return resolved === "field_user" || resolved === INVALID_COMPANY_MEMBERSHIP_ROLE;
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
