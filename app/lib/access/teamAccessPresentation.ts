/**
 * Contractor-facing Team presentation. Labels only.
 * Authority stays in the database. This module never grants access.
 */

import { ACCESS_PACKAGES } from "@/app/lib/access/registry";
import {
  COMPANY_MEMBERSHIP_ROLE_LABELS,
  type AssignableCompanyMembershipRole,
  type ResolvedCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";

export const TEAM_MEMBERS_UNAVAILABLE = "Team members are unavailable right now.";
export const TEAM_ACCESS_UNVERIFIED = "We couldn't verify access right now.";
export const TEAM_STALE_MEMBER =
  "The team member changed since you opened this. Refresh and try again.";
export const TEAM_STRONG_AUTH =
  "This change needs a recent strong sign-in. Confirm with your authenticator app to continue.";
export const TEAM_INVITATIONS_UNAVAILABLE = "Invitations are unavailable right now.";
export const TEAM_HANDOFF_ATTENTION = "Work reassignment still needs attention.";

/** Active packages only. Reserved packages have no contractor label. */
export const TEAM_PACKAGE_LABELS: Record<string, string> = {
  request_payments: "Request payments",
  view_payment_history: "View payment history",
  manage_pricing_templates: "Manage pricing and templates",
  issue_scope_changes: "Issue scope changes",
  approve_jobs: "Approve jobs",
  coordinate_production: "Coordinate production",
  lead_assigned_work: "Lead",
  manage_customers_jobs: "Manage customers and jobs",
};

export type TeamDelegator = "owner" | "admin";

export type TeamAccessPresetKey =
  | "office_manager"
  | "lead"
  | "office_sales"
  | "production_lead"
  | "field_user";

/**
 * Contractor-facing access choices. Each is a stored role plus the packages it
 * owns. `summary` is the short phrase shown in lists and choosers; `detail` is
 * the truthful boundary shown only when someone asks what is included. Neither
 * claims more than the registry grants.
 */
export type TeamAccessPreset = {
  key: TeamAccessPresetKey;
  role: AssignableCompanyMembershipRole;
  packages: readonly string[];
  label: string;
  summary: string;
  detail: string;
  /** Primary choices are shown first; the rest sit under "Other access". */
  primary: boolean;
};

export const TEAM_ACCESS_PRESETS: readonly TeamAccessPreset[] = [
  {
    key: "office_manager",
    role: "admin",
    packages: [],
    label: "Office Manager",
    summary: "Office operations and coordination",
    detail:
      "Customers, jobs, proposals, scheduling, and the team. Payments, pricing, and money settings stay with the Owner unless you share them.",
    primary: true,
  },
  {
    key: "lead",
    role: "field_user",
    packages: ["lead_assigned_work"],
    label: "Lead",
    summary: "Assigned jobs and onsite work",
    detail:
      "Sees only the jobs you give them and manages the tasks on those jobs. No prices, payments, proposals, Calendar changes, or Team.",
    primary: true,
  },
  {
    key: "office_sales",
    role: "office_sales",
    packages: [],
    label: "Sales",
    summary: "Customers and proposals",
    detail: "Customers, jobs, measurements, and proposals across the business. No payments unless you share them.",
    primary: false,
  },
  {
    key: "production_lead",
    role: "production_lead",
    packages: [],
    label: "Production Coordinator",
    summary: "Company-wide production coordination",
    detail:
      "Schedules, starts, and completes work on every job, and assigns people to it. No prices, proposals, or payments.",
    primary: false,
  },
  {
    key: "field_user",
    role: "field_user",
    packages: [],
    label: "Field",
    summary: "Assigned field work",
    detail: "Only on jobs you give them. No prices or payments.",
    primary: false,
  },
];

export const TEAM_OWNER_SUMMARY = "Account owner";
export const TEAM_OWNER_DETAIL =
  "Owns the FieldDive account for this business. Ownership moves only by transfer.";

const PRESET_OWNED_PACKAGES = new Set(TEAM_ACCESS_PRESETS.flatMap((preset) => preset.packages));

export function teamPresetOwnsPackage(key: string): boolean {
  return PRESET_OWNED_PACKAGES.has(key);
}

export function teamAccessPreset(key: TeamAccessPresetKey): TeamAccessPreset {
  return TEAM_ACCESS_PRESETS.find((preset) => preset.key === key)!;
}

/** Office Manager is chosen only by the Owner; Admins never create or edit Admins. */
export function teamPresetChoices(delegator: TeamDelegator): TeamAccessPreset[] {
  return TEAM_ACCESS_PRESETS.filter((preset) => {
    if (delegator !== "owner" && preset.role === "admin") return false;
    return preset.packages.every((key) =>
      ACCESS_PACKAGES.some(
        (pkg) =>
          pkg.key === key &&
          pkg.status === "active" &&
          (pkg.assignableBy as readonly string[]).includes(delegator)
      )
    );
  });
}

/** The preset a stored role + packages reads as. A Field member with the Lead package is a Lead. */
export function teamPresetForAccess(
  role: ResolvedCompanyMembershipRole,
  packageKeys: readonly string[] | null | undefined
): TeamAccessPreset | null {
  const keys = new Set(packageKeys ?? []);
  const matches = TEAM_ACCESS_PRESETS.filter(
    (preset) => preset.role === role && preset.packages.every((key) => keys.has(key))
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.packages.length - a.packages.length)[0];
}

export function teamAccessLabel(
  role: ResolvedCompanyMembershipRole,
  packageKeys?: readonly string[] | null
): string {
  if (role === "owner") return COMPANY_MEMBERSHIP_ROLE_LABELS.owner;
  return teamPresetForAccess(role, packageKeys)?.label ?? COMPANY_MEMBERSHIP_ROLE_LABELS[role];
}

export function teamAccessSummary(
  role: ResolvedCompanyMembershipRole,
  packageKeys?: readonly string[] | null
): string | null {
  if (role === "owner") return TEAM_OWNER_SUMMARY;
  return teamPresetForAccess(role, packageKeys)?.summary ?? null;
}

/** Job reach in plain words. Field-based presets only reach the jobs you give them. */
export function teamJobReach(role: ResolvedCompanyMembershipRole): string {
  return role === "field_user" ? "Assigned jobs only" : "All jobs";
}

/** How many jobs a Field-based person can reach right now. */
export function teamAssignedJobCount(grantedJobCount: number): string {
  if (grantedJobCount === 1) return "1 job now";
  if (grantedJobCount > 1) return `${grantedJobCount} jobs now`;
  return "None assigned yet";
}

export type TeamListState = "loading" | "unavailable" | "ready";

export function teamListState(input: {
  loading: boolean;
  failed: boolean;
  count: number;
}): TeamListState {
  if (input.loading && input.count === 0) return "loading";
  if (input.failed && input.count === 0) return "unavailable";
  return "ready";
}

export function teamMemberStatus(input: {
  removedAt: string | null;
  openWork: number;
}): { label: "Active" | "Access removed"; attention: string | null } {
  if (input.removedAt) {
    return {
      label: "Access removed",
      attention: input.openWork > 0 ? TEAM_HANDOFF_ATTENTION : null,
    };
  }
  return { label: "Active", attention: null };
}

export function teamPackageChoices(
  role: AssignableCompanyMembershipRole,
  delegator: TeamDelegator
): { key: string; label: string }[] {
  const choices: { key: string; label: string }[] = [];
  for (const pkg of ACCESS_PACKAGES) {
    if (pkg.status !== "active") continue;
    if (PRESET_OWNED_PACKAGES.has(pkg.key)) continue;
    if (!(pkg.eligibleRoles as readonly string[]).includes(role)) continue;
    if (!(pkg.assignableBy as readonly string[]).includes(delegator)) continue;
    const label = TEAM_PACKAGE_LABELS[pkg.key];
    if (!label) continue;
    choices.push({ key: pkg.key, label });
  }
  return choices;
}

/** Special access beyond the preset. Preset-owned packages are part of the access label. */
export function teamSpecialAccessSummary(keys: readonly string[]): string | null {
  const labels: string[] = [];
  for (const key of keys) {
    if (PRESET_OWNED_PACKAGES.has(key)) continue;
    const label = TEAM_PACKAGE_LABELS[key];
    if (label) labels.push(label);
  }
  return labels.length ? labels.join(", ") : null;
}

/**
 * The preset's own packages, the selected special access, and packages this
 * person already has that the current delegator is not allowed to add or remove.
 * Packages the new role cannot hold are dropped, and preset-owned packages follow
 * the chosen preset only. The server still decides.
 */
export function packageKeysForSave(input: {
  role: AssignableCompanyMembershipRole;
  existing: readonly string[];
  selected: readonly string[];
  choices: readonly { key: string }[];
  presetPackages?: readonly string[];
}): string[] {
  const choiceKeys = new Set(input.choices.map((choice) => choice.key));
  const fitsRole = (key: string) =>
    ACCESS_PACKAGES.some(
      (pkg) => pkg.key === key && (pkg.eligibleRoles as readonly string[]).includes(input.role)
    );
  const preserved = input.existing.filter(
    (key) => !choiceKeys.has(key) && !PRESET_OWNED_PACKAGES.has(key) && fitsRole(key)
  );
  const selected = input.selected.filter((key) => choiceKeys.has(key));
  return [...new Set([...preserved, ...selected, ...(input.presetPackages ?? [])])].sort();
}

/** Special access the person loses when moved to `role`, as a sentence. */
export function teamRoleChangeDropsAccess(
  role: AssignableCompanyMembershipRole,
  existing: readonly string[],
  accessLabel: string = teamRoleLabel(role)
): string | null {
  const dropped = existing.filter(
    (key) =>
      TEAM_PACKAGE_LABELS[key] &&
      !PRESET_OWNED_PACKAGES.has(key) &&
      !ACCESS_PACKAGES.some(
        (pkg) => pkg.key === key && (pkg.eligibleRoles as readonly string[]).includes(role)
      )
  );
  if (dropped.length === 0) return null;
  const labels = dropped.map((key) => TEAM_PACKAGE_LABELS[key]).join(", ");
  const verb = dropped.length === 1 ? "doesn't" : "don't";
  return `${labels} ${verb} apply to ${accessLabel} and will be removed.`;
}

export function teamFieldAccessLine(
  role: ResolvedCompanyMembershipRole,
  grantedJobCount: number
): string | null {
  if (role !== "field_user") return null;
  if (grantedJobCount > 0) return `Assigned jobs (${grantedJobCount})`;
  return "No jobs assigned yet";
}

export function teamRoleLabel(role: ResolvedCompanyMembershipRole): string {
  return COMPANY_MEMBERSHIP_ROLE_LABELS[role];
}

export function contractorFacingMessage(
  code: unknown,
  message: unknown,
  fallback: string
): string {
  if (code === "stale_revision" || code === "stale_generation") return TEAM_STALE_MEMBER;
  if (code === "authorization_unavailable") return TEAM_ACCESS_UNVERIFIED;
  if (code === "assurance_required") return TEAM_STRONG_AUTH;
  if (code === "team_unavailable") return TEAM_MEMBERS_UNAVAILABLE;
  if (code === "invitations_unavailable") return TEAM_INVITATIONS_UNAVAILABLE;
  if (code === "invitation_pending") {
    return "An invitation is already waiting for this email. Resend it below.";
  }
  if (code === "recipient_membership_exists") {
    return "This person already belongs to the company. Reactivate access if it was removed.";
  }
  if (code === "invalid_email") return "Enter a valid email address.";
  if (code === "self_invite") return "You can\u2019t invite yourself.";
  if (
    typeof message === "string" &&
    message.trim() &&
    message.trim() !== code &&
    /\s/.test(message) &&
    !/^[a-z0-9_]+$/.test(message.trim())
  ) {
    return message.trim();
  }
  return fallback;
}
