/**
 * Contractor-facing Team presentation. Labels only.
 * Authority stays in the database. This module never grants access.
 */

import { ACCESS_PACKAGES } from "@/app/lib/access/registry";
import {
  COMPANY_MEMBERSHIP_ROLE_LABELS,
  type AssignableCompanyMembershipRole,
  type CompanyMembershipRoleValue,
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
  lead_assigned_work: "Lead assigned work",
  manage_customers_jobs: "Manage customers and jobs",
};

export const TEAM_ROLE_BLURB: Record<CompanyMembershipRoleValue, string> = {
  owner: "Owns the business.",
  admin: "Runs day-to-day operations. Not the Owner.",
  office_sales: "Prepares customers and proposals.",
  production_lead: "Coordinates schedule and production.",
  field_user: "Works assigned jobs.",
};

export type TeamDelegator = "owner" | "admin";

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
    if (!(pkg.eligibleRoles as readonly string[]).includes(role)) continue;
    if (!(pkg.assignableBy as readonly string[]).includes(delegator)) continue;
    const label = TEAM_PACKAGE_LABELS[pkg.key];
    if (!label) continue;
    choices.push({ key: pkg.key, label });
  }
  return choices;
}

export function teamSpecialAccessSummary(keys: readonly string[]): string | null {
  const labels: string[] = [];
  for (const key of keys) {
    const label = TEAM_PACKAGE_LABELS[key];
    if (label) labels.push(label);
  }
  return labels.length ? labels.join(", ") : null;
}

/**
 * Editable choices plus packages this person already has that the current
 * delegator is not allowed to add or remove. The server still decides.
 */
export function packageKeysForSave(input: {
  existing: readonly string[];
  selected: readonly string[];
  choices: readonly { key: string }[];
}): string[] {
  const choiceKeys = new Set(input.choices.map((choice) => choice.key));
  const preserved = input.existing.filter((key) => !choiceKeys.has(key));
  const selected = input.selected.filter((key) => choiceKeys.has(key));
  return [...new Set([...preserved, ...selected])].sort();
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
