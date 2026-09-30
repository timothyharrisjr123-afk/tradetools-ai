import {
  COMPANY_MEMBERSHIP_ROLE_LABELS,
  resolveCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";
import { teamAccessLabel, teamPresetOwnsPackage } from "@/app/lib/access/teamAccessPresentation";
import {
  buildLoginHrefWithReturn,
  buildSignupHrefWithReturn,
} from "@/app/lib/safeInternalRedirect";

export const INVITATION_NOT_SENT_MESSAGE =
  "Invitation wasn't sent. Check the email address, then resend.";

const PACKAGE_LABELS: Record<string, string> = {
  request_payments: "Request payments",
  view_payment_history: "View payment history",
  manage_pricing_templates: "Manage pricing and templates",
  issue_scope_changes: "Issue scope changes",
  approve_jobs: "Approve jobs",
  coordinate_production: "Coordinate production",
  manage_customers_jobs: "Manage customers and jobs",
};

const JOIN_OUTCOMES = new Set([
  "accepted",
  "already_accepted",
  "accepted_disabled",
  "already_member",
  "membership_conflict",
  "email_mismatch",
  "unverified_email",
  "expired",
  "revoked",
  "not_found",
  "reauthorization_required",
  "authorization_unavailable",
  "unauthorized",
]);

export type InvitationPreviewState =
  | "pending"
  | "expired"
  | "revoked"
  | "accepted"
  | "not_found"
  | "unavailable";

export type InvitationPreview = {
  state: InvitationPreviewState;
  companyLabel: string | null;
  role: string | null;
  expiresAt: string | null;
  inviterDisplayName: string | null;
  recipientEmail: string | null;
  hasAdditionalAccess: boolean;
  packageKeys: string[];
  acceptedBySelf: boolean;
};

export type InvitationViewer = {
  signedIn: boolean;
  email: string | null;
  emailVerified: boolean;
};

export type InvitationJoinView = {
  heading: string;
  body: string;
  companyLabel: string | null;
  roleLabel: string | null;
  accessSummary: string | null;
  expiryLabel: string | null;
  inviterLabel: string | null;
  showAccept: boolean;
  acceptToken: string | null;
  acceptInvitationId: string | null;
  signInHref: string | null;
  signUpHref: string | null;
  switchAccountHref: string | null;
  continueHref: string | null;
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canonicalEmail(value: string | null): string | null {
  if (!value) return null;
  const canonical = value.trim().toLowerCase();
  return canonical.length > 0 ? canonical : null;
}

/** Access label for an invitation; a Field invitation with the Lead package reads as Lead. */
export function roleLabel(role: string | null, packageKeys: readonly string[] = []): string | null {
  if (!role) return null;
  if (role in COMPANY_MEMBERSHIP_ROLE_LABELS) {
    return teamAccessLabel(resolveCompanyMembershipRole(role), packageKeys);
  }
  return null;
}

/**
 * Plain labels only. Unknown keys are omitted so internal names never reach the
 * screen or the email; packages that define the access label (Lead) are not
 * repeated as extra access.
 */
export function plainAccessSummary(packageKeys: string[], hasAdditionalAccess: boolean): string | null {
  const extra = packageKeys.filter((key) => !teamPresetOwnsPackage(key));
  const labels = extra
    .map((key) => PACKAGE_LABELS[key])
    .filter((label): label is string => Boolean(label));
  if (labels.length > 0) return labels.join(", ");
  if (hasAdditionalAccess && (packageKeys.length === 0 || extra.length > 0)) {
    return "Includes additional approved access.";
  }
  return null;
}

export function parseInvitationPreview(data: unknown): InvitationPreview {
  const unavailable: InvitationPreview = {
    state: "unavailable",
    companyLabel: null,
    role: null,
    expiresAt: null,
    inviterDisplayName: null,
    recipientEmail: null,
    hasAdditionalAccess: false,
    packageKeys: [],
    acceptedBySelf: false,
  };
  if (!data || typeof data !== "object") return unavailable;
  const row = data as Record<string, unknown>;
  if (row.ok !== true) return unavailable;
  const state = row.state;
  if (
    state !== "pending" &&
    state !== "expired" &&
    state !== "revoked" &&
    state !== "accepted" &&
    state !== "not_found"
  ) {
    return unavailable;
  }
  const packageKeys = Array.isArray(row.package_keys)
    ? row.package_keys.filter((key): key is string => typeof key === "string")
    : [];
  return {
    state,
    companyLabel: textOrNull(row.company_label),
    role: textOrNull(row.role),
    expiresAt: textOrNull(row.expires_at),
    inviterDisplayName: textOrNull(row.inviter_display_name),
    recipientEmail: canonicalEmail(textOrNull(row.recipient_email)),
    hasAdditionalAccess: row.has_additional_access === true,
    packageKeys,
    acceptedBySelf: row.accepted_by_self === true,
  };
}

export function parseInvitationOutcome(value: string | null | undefined): string | null {
  if (!value || !JOIN_OUTCOMES.has(value)) return null;
  return value;
}

function expiryLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const day = expiresAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `Expires ${day}` : null;
}

function screenExpiryLabel(expiresAt: string | null, expired: boolean): string | null {
  const at = expiresAt ? new Date(expiresAt) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  const day = at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${expired ? "Expired" : "Expires"} ${day}`;
}

export function buildInvitationJoinView(input: {
  preview: InvitationPreview;
  viewer: InvitationViewer;
  outcome: string | null;
  token: string | null;
  invitationId: string | null;
  returnPath: string;
}): InvitationJoinView {
  const outcome = input.outcome;
  const preview = input.preview;
  const viewerEmail = canonicalEmail(input.viewer.email);
  const emailMatches =
    input.viewer.signedIn &&
    input.viewer.emailVerified &&
    viewerEmail != null &&
    preview.recipientEmail != null &&
    viewerEmail === preview.recipientEmail;

  const revealed =
    preview.state === "pending" ||
    preview.state === "expired" ||
    preview.state === "revoked" ||
    (preview.state === "accepted" && preview.acceptedBySelf);

  const companyLabel = revealed ? preview.companyLabel : null;
  const shownRole = roleLabel(revealed ? preview.role : null, preview.packageKeys);
  const summary = !revealed
    ? null
    : emailMatches
      ? plainAccessSummary(preview.packageKeys, preview.hasAdditionalAccess)
      : preview.hasAdditionalAccess
        ? "Includes additional approved access."
        : null;
  const inviterLabel = revealed && preview.inviterDisplayName
    ? `Invited by ${preview.inviterDisplayName}`
    : null;

  const base: InvitationJoinView = {
    heading: "Invitation",
    body: "",
    companyLabel,
    roleLabel: shownRole,
    accessSummary: summary,
    expiryLabel:
      preview.state === "pending" || preview.state === "expired"
        ? screenExpiryLabel(preview.expiresAt, preview.state === "expired")
        : null,
    inviterLabel,
    showAccept: false,
    acceptToken: null,
    acceptInvitationId: null,
    signInHref: null,
    signUpHref: null,
    switchAccountHref: null,
    continueHref: null,
  };

  const signIn = () => {
    base.signInHref = buildLoginHrefWithReturn(input.returnPath);
    base.signUpHref = buildSignupHrefWithReturn(input.returnPath);
  };

  if (preview.state === "unavailable" || outcome === "authorization_unavailable") {
    base.heading = "We couldn't verify this invitation";
    base.body = "This is a temporary problem. Try again.";
    base.companyLabel = null;
    base.roleLabel = null;
    base.accessSummary = null;
    base.expiryLabel = null;
    base.inviterLabel = null;
    return base;
  }

  if (outcome === "membership_conflict") {
    base.heading = "This account already belongs to a company";
    base.body =
      "An account can only belong to one company. Accepting this invitation will not move or replace that membership.";
    base.showAccept = false;
    return base;
  }

  if (outcome === "accepted_disabled") {
    base.heading = "Your access has been removed";
    base.body = companyLabel
      ? `Your access to ${companyLabel} has been removed. Accepting the invitation again will not restore it.`
      : "Your access has been removed. Accepting the invitation again will not restore it.";
    base.showAccept = false;
    return base;
  }

  if (outcome === "reauthorization_required") {
    base.heading = "This invitation needs to be sent again";
    base.body = "The access on this invitation is no longer current. Ask the person who invited you to send it again.";
    base.showAccept = false;
    return base;
  }

  if (outcome === "email_mismatch") {
    base.heading = "This invitation is for a different account";
    base.body = preview.recipientEmail
      ? `You're signed in as a different account. Sign out, then sign in as ${preview.recipientEmail}.`
      : "You're signed in as a different account. Sign out and sign in with the invited email.";
    base.switchAccountHref = buildLoginHrefWithReturn(input.returnPath);
    base.showAccept = false;
    return base;
  }

  if (outcome === "not_found" || preview.state === "not_found") {
    base.heading = "This invitation link isn't valid";
    base.body = "It may have been replaced by a newer invitation. Ask the person who invited you to send it again.";
    base.companyLabel = null;
    base.roleLabel = null;
    base.accessSummary = null;
    base.expiryLabel = null;
    base.inviterLabel = null;
    return base;
  }

  if (outcome === "expired" || preview.state === "expired") {
    base.heading = "This invitation has expired";
    base.body = "Ask the person who invited you to send it again.";
    return base;
  }

  if (outcome === "revoked" || preview.state === "revoked") {
    base.heading = "This invitation was revoked";
    base.body = "It can no longer be accepted. Ask the person who invited you if you still need access.";
    return base;
  }

  if (outcome === "unauthorized") {
    base.heading = "Sign in to accept";
    base.body = "Accepting an invitation requires the account the invitation was sent to.";
    signIn();
    return base;
  }

  if (
    outcome === "accepted" ||
    outcome === "already_accepted" ||
    outcome === "already_member" ||
    (preview.state === "accepted" && preview.acceptedBySelf)
  ) {
    const joined = outcome === "accepted";
    base.heading = outcome === "already_member" ? "You're already a member" : joined ? "You've joined" : "You've already joined";
    base.body = companyLabel
      ? outcome === "already_member"
        ? `This account is already a member of ${companyLabel}.`
        : `This account is a member of ${companyLabel}.`
      : "This account has already used this invitation.";
    base.continueHref = "/tools/roofing/saved";
    base.expiryLabel = null;
    return base;
  }

  if (preview.state === "accepted") {
    base.heading = "This invitation has already been used";
    base.body = "It can't be accepted again.";
    base.companyLabel = null;
    base.roleLabel = null;
    base.accessSummary = null;
    base.inviterLabel = null;
    return base;
  }

  if (!input.viewer.signedIn) {
    base.heading = companyLabel ? `Join ${companyLabel}` : "You're invited";
    base.body = shownRole
      ? `You've been invited to join as ${shownRole}. Sign in with the invited email, then accept.`
      : "Sign in with the invited email, then accept.";
    signIn();
    return base;
  }

  if (!input.viewer.emailVerified || outcome === "unverified_email") {
    base.heading = "Confirm your email first";
    base.body = "This invitation can be accepted only after the invited email is confirmed.";
    return base;
  }

  if (!emailMatches) {
    base.heading = "This invitation is for a different account";
    base.body = preview.recipientEmail
      ? `You're signed in as a different account. Sign out, then sign in as ${preview.recipientEmail}.`
      : "You're signed in as a different account. Sign out and sign in with the invited email.";
    base.switchAccountHref = buildLoginHrefWithReturn(input.returnPath);
    return base;
  }

  base.heading = companyLabel ? `Join ${companyLabel}` : "Accept invitation";
  base.body = shownRole
    ? `You've been invited to join as ${shownRole}. Accepting adds this account to that company.`
    : "Accepting adds this account to that company.";
  if (input.token) base.acceptToken = input.token;
  else if (input.invitationId) base.acceptInvitationId = input.invitationId;
  else return base;
  base.showAccept = true;
  return base;
}

export function buildInvitationEmail(input: {
  companyLabel: string;
  role: string | null;
  packageKeys: string[];
  expiresAt: string | null;
  joinUrl: string;
}): { subject: string; text: string; html: string } {
  const company = input.companyLabel.trim() || "a company";
  const role = roleLabel(input.role, input.packageKeys);
  const summary = plainAccessSummary(input.packageKeys, false);
  const expires = expiryLabel(input.expiresAt);
  const subject = `You're invited to ${company} on FieldDive`;
  const lines = [
    `You're invited to join ${company} on FieldDive.`,
    role ? `Role: ${role}.` : null,
    summary ? `Access: ${summary}.` : null,
    expires ? `${expires}.` : "This invitation expires in 7 days.",
    "",
    `Accept the invitation: ${input.joinUrl}`,
    "",
    "If you weren't expecting this, you can ignore it. If the link expires, ask the person who invited you to send it again.",
  ].filter((line): line is string => line != null);
  const text = lines.join("\n");
  const html = [
    "<p>You're invited to join ",
    escapeHtml(company),
    " on FieldDive.</p>",
    role ? `<p>Role: ${escapeHtml(role)}.</p>` : "",
    summary ? `<p>Access: ${escapeHtml(summary)}.</p>` : "",
    `<p>${escapeHtml(expires ?? "This invitation expires in 7 days.")}</p>`,
    `<p><a href="${escapeHtml(input.joinUrl)}">Accept the invitation</a></p>`,
    "<p>If you weren't expecting this, you can ignore it. If the link expires, ask the person who invited you to send it again.</p>",
  ].join("");
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
