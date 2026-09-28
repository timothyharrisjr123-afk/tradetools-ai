"use client";

/**
 * Team screen intent (Phase 13B-G).
 * The screen’s job, first/second/third scan order, information ownership,
 * state-specific priorities, what to preserve/omit, allowed/disallowed visual
 * mechanisms, and proof criteria must be explicit before editing.
 *
 * SCREEN JOB — An Owner or Admin can see who has access, each person's role,
 * whether access is active, invited, or removed, any special access that
 * matters, and the next safe action.
 * FIRST SCAN — the person. SECOND — role, then status. THIRD — special access
 * or attention, only when it changes the next action.
 * INFORMATION OWNERSHIP — the database access engine owns authority. This
 * screen summarizes it. Directory viewers see names and roles only.
 * STATE PRIORITIES — loading looks like loading; a failed read is not an empty
 * list; a pending invitation is not a membership; removal is not deletion;
 * reactivation is a new assignment; ownership transfer is not a role edit.
 * PRESERVE — five launch roles, explicit save, Owner separate from Admin,
 * 7-day invite, resend, revoke, handoff distinct from removal.
 * OMIT — capability ids, package ids, revisions, policy reasons, scope JSON,
 * audit ids, and database identifiers.
 * ALLOWED — order, type, spacing, grouping, alignment, restrained contextual
 * color, progressive disclosure.
 * DISALLOWED — card grids, boxes inside boxes, tinted status panels, banners
 * for Active / Invited / Access removed, a permission matrix, a role builder.
 * SEPARATION IS NOT HIERARCHY.
 * PROOF — deterministic presentation tests, plus live desktop and 390px proof
 * when a schema-compatible runtime exists. Production is not that runtime.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import FocusedEditor, {
  FOCUSED_EDITOR_CANCEL,
  FOCUSED_EDITOR_DESTRUCTIVE,
  FOCUSED_EDITOR_DESTRUCTIVE_CONFIRM,
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
  FOCUSED_EDITOR_SAVE,
  FOCUSED_EDITOR_SECONDARY,
} from "@/app/components/ui/FocusedEditor";
import {
  TEAM_HANDOFF_ATTENTION,
  TEAM_INVITATIONS_UNAVAILABLE,
  TEAM_MEMBERS_UNAVAILABLE,
  TEAM_ROLE_BLURB,
  contractorFacingMessage,
  packageKeysForSave,
  teamFieldAccessLine,
  teamListState,
  teamMemberStatus,
  teamPackageChoices,
  teamRoleChangeDropsAccess,
  teamRoleLabel,
  teamSpecialAccessSummary,
  type TeamDelegator,
} from "@/app/lib/access/teamAccessPresentation";
import {
  ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES,
  isAssignableCompanyMembershipRole,
  type AssignableCompanyMembershipRole,
  type ResolvedCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";
import { INVITATION_NOT_SENT_MESSAGE } from "@/app/lib/invitations/invitationModel";
import StrongSignInStep from "@/app/tools/settings/StrongSignInStep";
import type { CompanyMemberClientItem } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import { labelForCompanyMember } from "@/app/tools/roofing/jobCard/useCompanyMembers";

type CompanySettingsTeamEditorProps = {
  canAdminMembers: boolean;
  viewerRole: ResolvedCompanyMembershipRole | null;
  viewerUserId: string | null;
  members: readonly CompanyMemberClientItem[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

type PendingInvite = {
  invitationId: string;
  email: string;
  role: string;
  expiresAt: string;
  generation: number;
  packageKeys: string[];
  assignedJobCount: number;
  delivery: "sent" | "failed" | "unknown";
};

type Panel =
  | { type: "invite" }
  | { type: "role"; userId: string }
  | { type: "remove"; userId: string }
  | { type: "reactivate"; userId: string }
  | { type: "transfer" }
  | null;

const ACTION = `${FOCUSED_EDITOR_SECONDARY} w-full sm:w-auto`;
const DESTRUCTIVE_ACTION = `${FOCUSED_EDITOR_DESTRUCTIVE} w-full sm:w-auto`;
const ACTION_ROW = "mt-3 flex flex-col gap-2 sm:flex-row";
const FORM_ACTIONS = "flex flex-col gap-2 sm:flex-row sm:items-center";

function actionKey() {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `team.${id}`.slice(0, 120);
}

function expiryLabel(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const date = new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return time < Date.now() ? `Expired ${date}` : `Expires ${date}`;
}

function teamError(code: unknown, message: unknown, fallback: string) {
  return Object.assign(new Error(contractorFacingMessage(code, message, fallback)), {
    code: typeof code === "string" ? code : undefined,
  });
}

function personName(member: CompanyMemberClientItem, members: readonly CompanyMemberClientItem[]) {
  return labelForCompanyMember(member.userId, members);
}

export default function CompanySettingsTeamEditor({
  canAdminMembers,
  viewerRole,
  viewerUserId,
  members,
  loading,
  error,
  onClose,
  onChanged,
}: CompanySettingsTeamEditorProps) {
  const delegator: TeamDelegator = viewerRole === "owner" ? "owner" : "admin";
  const viewerIsOwner = viewerRole === "owner";
  const assignableRoles = viewerIsOwner
    ? ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES
    : ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES.filter((role) => role !== "admin");
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<AssignableCompanyMembershipRole | "">("");
  const [draftPackages, setDraftPackages] = useState<string[]>([]);
  const [packagesTouched, setPackagesTouched] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableCompanyMembershipRole | "">("");
  const [reassignToUserId, setReassignToUserId] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [formerRole, setFormerRole] = useState<AssignableCompanyMembershipRole>("admin");
  const [transferArmed, setTransferArmed] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [invitations, setInvitations] = useState<PendingInvite[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsFailed, setInvitationsFailed] = useState(false);
  const [strongRetry, setStrongRetry] = useState<(() => Promise<void>) | null>(null);

  const needsStrongSignIn = (err: unknown, retry: () => Promise<void>) => {
    if ((err as { code?: unknown } | null)?.code !== "assurance_required") return false;
    setLocalError(null);
    setStrongRetry(() => retry);
    return true;
  };

  const listState = teamListState({
    loading,
    failed: Boolean(error),
    count: members.length,
  });
  const people = useMemo(() => {
    return [...members].sort((left, right) => {
      const leftRemoved = left.removedAt ? 1 : 0;
      const rightRemoved = right.removedAt ? 1 : 0;
      if (leftRemoved !== rightRemoved) return leftRemoved - rightRemoved;
      if (left.role === "owner") return -1;
      if (right.role === "owner") return 1;
      return personName(left, members).localeCompare(personName(right, members));
    });
  }, [members]);

  const loadInvitations = useCallback(async () => {
    if (!canAdminMembers) return;
    setInvitationsLoading(true);
    try {
      const res = await fetch("/api/company/invitations/pending", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: unknown;
        message?: unknown;
        invitations?: PendingInvite[];
      };
      if (!res.ok || body.ok !== true || !Array.isArray(body.invitations)) {
        setInvitationsFailed(true);
        return;
      }
      setInvitationsFailed(false);
      setInvitations(body.invitations);
    } catch {
      setInvitationsFailed(true);
    } finally {
      setInvitationsLoading(false);
    }
  }, [canAdminMembers]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const openPanel = (next: Panel) => {
    setPanel(next);
    setLocalError(null);
    setRequestKey(actionKey());
    setPackagesTouched(false);
    setTransferArmed(false);
  };

  const patchMember = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/company/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      code?: string;
      handoff?: { status?: string; message?: string };
    };
    if (!res.ok || body.ok !== true) {
      throw teamError(body.code, body.message, "Could not update team member.");
    }
    return body;
  };

  const handoffFailureMessage = (handoff: { status?: string; message?: string } | undefined) =>
    handoff?.status === "completed"
      ? null
      : typeof handoff?.message === "string" && handoff.message
        ? handoff.message
        : "Work reassignment still needs attention.";

  const saveRole = async (member: CompanyMemberClientItem) => {
    if (!canAdminMembers || member.role === "owner" || !isAssignableCompanyMembershipRole(draftRole)) return;
    setBusy(true);
    setLocalError(null);
    try {
      const choices = teamPackageChoices(draftRole, delegator);
      await patchMember({
        userId: member.userId,
        role: draftRole,
        expectedRevision: member.accessRevision,
        ...(packagesTouched || draftRole !== member.role
          ? {
              packages: packageKeysForSave({
                role: draftRole,
                existing: member.packageKeys ?? [],
                selected: draftPackages,
                choices,
              }),
            }
          : {}),
      });
      setPanel(null);
      await onChanged();
    } catch (err) {
      if (needsStrongSignIn(err, () => saveRole(member))) return;
      setLocalError(err instanceof Error ? err.message : "Could not update role.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async (member: CompanyMemberClientItem) => {
    if (!canAdminMembers || member.role === "owner") return;
    setBusy(true);
    setLocalError(null);
    setNotice(null);
    try {
      const body = await patchMember({
        userId: member.userId,
        action: "remove",
        expectedRevision: member.accessRevision,
        reassignToUserId: reassignToUserId || null,
      });
      const handoffError = handoffFailureMessage(body.handoff);
      if (handoffError) {
        setNotice(`Access removed. ${handoffError}`);
      }
      setPanel(null);
      await onChanged();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not remove access.");
    } finally {
      setBusy(false);
    }
  };

  const reassignOpenWork = async (member: CompanyMemberClientItem) => {
    if (!canAdminMembers || !reassignToUserId) return;
    setBusy(true);
    setLocalError(null);
    try {
      const body = await patchMember({
        userId: member.userId,
        action: "handoff",
        reassignToUserId,
        expectedRevision: member.accessRevision,
      });
      const handoffError = handoffFailureMessage(body.handoff);
      setNotice(handoffError);
      if (!handoffError) setPanel(null);
      await onChanged();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : TEAM_HANDOFF_ATTENTION);
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async (member: CompanyMemberClientItem) => {
    if (!canAdminMembers || !isAssignableCompanyMembershipRole(draftRole)) return;
    setBusy(true);
    setLocalError(null);
    try {
      const choices = teamPackageChoices(draftRole, delegator);
      await patchMember({
        userId: member.userId,
        action: "reactivate",
        role: draftRole,
        packages: packageKeysForSave({
          role: draftRole,
          existing: [],
          selected: draftPackages,
          choices,
        }),
        jobIds: [],
        expectedRevision: member.accessRevision,
        idempotencyKey: requestKey,
      });
      setPanel(null);
      await onChanged();
    } catch (err) {
      if (needsStrongSignIn(err, () => reactivate(member))) return;
      setLocalError(err instanceof Error ? err.message : "Could not reactivate access.");
    } finally {
      setBusy(false);
    }
  };

  const sendInvitation = async () => {
    if (!canAdminMembers || !inviteRole || !inviteEmail.trim()) return;
    setBusy(true);
    setLocalError(null);
    try {
      const choices = teamPackageChoices(inviteRole, delegator);
      const res = await fetch("/api/company/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          packages: draftPackages.filter((key) => choices.some((choice) => choice.key === key)),
          jobIds: [],
          idempotencyKey: requestKey,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
        invitationId?: string;
        delivery?: string;
        generation?: number | null;
        expiresAt?: string | null;
      };
      if (!res.ok || body.ok !== true || !body.invitationId) {
        throw teamError(body.code, body.message, "Could not send the invitation.");
      }
      if (body.delivery === "failed") setNotice(INVITATION_NOT_SENT_MESSAGE);
      else setNotice(`Invitation sent to ${inviteEmail.trim()}.`);
      const created: PendingInvite = {
        invitationId: body.invitationId,
        email: inviteEmail.trim(),
        role: inviteRole,
        expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : "",
        generation: typeof body.generation === "number" ? body.generation : 1,
        packageKeys: draftPackages.filter((key) => choices.some((choice) => choice.key === key)),
        assignedJobCount: 0,
        delivery: body.delivery === "failed" ? "failed" : body.delivery === "sent" ? "sent" : "unknown",
      };
      setInvitations((current) => [
        created,
        ...current.filter((invite) => invite.invitationId !== created.invitationId),
      ]);
      setInviteEmail("");
      setInviteRole("");
      setDraftPackages([]);
      setPanel(null);
      await loadInvitations();
    } catch (err) {
      if (needsStrongSignIn(err, sendInvitation)) return;
      setLocalError(err instanceof Error ? err.message : "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const resendInvitation = async (invite: PendingInvite) => {
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/company/invitations/${invite.invitationId}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedGeneration: invite.generation,
          idempotencyKey: actionKey(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
        delivery?: string;
      };
      if (!res.ok || body.ok !== true) {
        throw teamError(body.code, body.message, "Could not resend the invitation.");
      }
      setNotice(body.delivery === "failed" ? INVITATION_NOT_SENT_MESSAGE : `Invitation sent again to ${invite.email}.`);
      await loadInvitations();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not resend the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const revokeInvitation = async (invite: PendingInvite) => {
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/company/invitations/${invite.invitationId}/revoke`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string };
      if (!res.ok || body.ok !== true) {
        throw teamError(body.code, body.message, "Could not revoke the invitation.");
      }
      setNotice(`Invitation to ${invite.email} revoked. The link no longer works.`);
      await loadInvitations();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not revoke the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const transferOwnership = async () => {
    if (!viewerIsOwner || !transferArmed || !transferTargetId) return;
    const owner = members.find((member) => member.role === "owner");
    const target = members.find((member) => member.userId === transferTargetId);
    if (!owner || !target) return;
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch("/api/company/ownership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: target.userId,
          formerRole,
          ownerExpectedRevision: owner.accessRevision,
          targetExpectedRevision: target.accessRevision,
          idempotencyKey: requestKey,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string };
      if (!res.ok || body.ok !== true) {
        throw teamError(body.code, body.message, "Could not transfer ownership.");
      }
      setPanel(null);
      await onChanged();
      setNotice(
        `${personName(target, members)} is now the Owner. You're now ${teamRoleLabel(formerRole)}.`
      );
    } catch (err) {
      if (needsStrongSignIn(err, transferOwnership)) return;
      setLocalError(err instanceof Error ? err.message : "Could not transfer ownership.");
    } finally {
      setBusy(false);
    }
  };

  const inviteChoices = inviteRole ? teamPackageChoices(inviteRole, delegator) : [];
  const loadFailed = listState === "unavailable";
  const warningNotice = Boolean(
    notice && (notice.includes("needs attention") || notice.startsWith("Invitation wasn't"))
  );

  return (
    <FocusedEditor
      open
      title="Team"
      description="Who has access to this business."
      dirty={panel != null}
      saving={busy}
      readOnly
      error={loadFailed ? localError : localError || (error && members.length > 0 ? error : null)}
      onClose={onClose}
    >
      <div data-company-settings-editor="team" className="max-w-full space-y-6 overflow-x-hidden">
        {notice ? (
          <p
            className={warningNotice ? "text-sm text-amber-800" : "text-sm text-slate-700"}
            data-company-settings-team-notice
          >
            {notice}
          </p>
        ) : null}

        {strongRetry ? (
          <StrongSignInStep
            onConfirmed={() => {
              const retry = strongRetry;
              setStrongRetry(null);
              void retry();
            }}
            onCancel={() => setStrongRetry(null)}
          />
        ) : null}

        {listState === "loading" ? (
          <p className={FOCUSED_EDITOR_HINT}>Loading team…</p>
        ) : loadFailed ? (
          <p className="text-sm text-slate-800" data-company-settings-team-unavailable>
            {TEAM_MEMBERS_UNAVAILABLE}
          </p>
        ) : (
          <>
            {canAdminMembers ? (
              <div>
                {panel?.type === "invite" ? (
                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendInvitation();
                    }}
                  >
                    <label className={FOCUSED_EDITOR_LABEL}>
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        className={FOCUSED_EDITOR_INPUT}
                      />
                    </label>
                    <label className={FOCUSED_EDITOR_LABEL}>
                      Role
                      <select
                        required
                        value={inviteRole}
                        onChange={(event) => {
                          const role = event.target.value;
                          if (!isAssignableCompanyMembershipRole(role)) {
                            setInviteRole("");
                            setDraftPackages([]);
                            return;
                          }
                          setInviteRole(role);
                          setDraftPackages([]);
                        }}
                        className={FOCUSED_EDITOR_INPUT}
                      >
                        <option value="">Choose a role</option>
                        {assignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {teamRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {inviteRole ? <p className={FOCUSED_EDITOR_HINT}>{TEAM_ROLE_BLURB[inviteRole]}</p> : null}
                    {inviteRole === "field_user" ? (
                      <p className={FOCUSED_EDITOR_HINT}>They can work on jobs you assign to them.</p>
                    ) : null}
                    {inviteChoices.length > 0 ? (
                      <fieldset className="space-y-1">
                        <legend className={FOCUSED_EDITOR_LABEL}>Special access</legend>
                        <p className={FOCUSED_EDITOR_HINT}>Only if this person needs something beyond the role.</p>
                        {inviteChoices.map((choice) => (
                          <label key={choice.label} className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={draftPackages.includes(choice.key)}
                              onChange={(event) => {
                                setDraftPackages((current) =>
                                  event.target.checked
                                    ? [...current, choice.key]
                                    : current.filter((key) => key !== choice.key)
                                );
                              }}
                            />
                            {choice.label}
                          </label>
                        ))}
                      </fieldset>
                    ) : null}
                    <div className={FORM_ACTIONS}>
                      <button type="submit" className={`${FOCUSED_EDITOR_SAVE} w-full sm:w-auto`} disabled={busy}>
                        Send invitation
                      </button>
                      <button type="button" className={FOCUSED_EDITOR_CANCEL} disabled={busy} onClick={() => setPanel(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className={ACTION} onClick={() => openPanel({ type: "invite" })}>
                    Add team member
                  </button>
                )}
              </div>
            ) : (
              <p className={FOCUSED_EDITOR_HINT}>An Owner or Admin changes access.</p>
            )}

            {people.length === 0 ? (
              <p className="text-sm text-slate-700">Add a team member when you are ready.</p>
            ) : (
              <ul className="divide-y divide-slate-100" data-company-settings-team-list>
                {people.map((member) => {
                  const name = personName(member, people);
                  const status = teamMemberStatus({
                    removedAt: member.removedAt,
                    openWork: member.openJobLeadCount + member.openTaskAssigneeCount,
                  });
                  const self = viewerUserId != null && member.userId === viewerUserId;
                  const manageable = !self && member.role !== "owner" && (viewerIsOwner || member.role !== "admin");
                  const activeAccess = canAdminMembers && !member.removedAt;
                  const special = activeAccess ? teamSpecialAccessSummary(member.packageKeys ?? []) : null;
                  const fieldLine = activeAccess
                    ? teamFieldAccessLine(member.role, member.grantedJobCount ?? 0)
                    : null;
                  const showEmail = canAdminMembers && member.email && member.email !== name;
                  const editingRole = panel?.type === "role" && panel.userId === member.userId;
                  const removing = panel?.type === "remove" && panel.userId === member.userId;
                  const reactivating = panel?.type === "reactivate" && panel.userId === member.userId;
                  const choices = isAssignableCompanyMembershipRole(draftRole)
                    ? teamPackageChoices(draftRole, delegator)
                    : [];
                  return (
                    <li key={member.userId} className="min-w-0 py-3.5" data-company-settings-team-row>
                      <p className="break-words text-sm font-semibold tracking-tight text-slate-950">{name}</p>
                      <p className="mt-0.5 text-sm text-slate-700">
                        <span>{teamRoleLabel(member.role)}</span>
                        {canAdminMembers ? (
                          <>
                            <span className="text-slate-400"> · </span>
                            <span>{status.label}</span>
                          </>
                        ) : null}
                      </p>
                      {showEmail ? <p className="mt-0.5 break-all text-xs text-slate-500">{member.email}</p> : null}
                      {special ? <p className="mt-1 text-sm text-slate-600">Special access: {special}</p> : null}
                      {fieldLine ? <p className="mt-1 text-sm text-slate-600">{fieldLine}</p> : null}
                      {activeAccess && member.restrictionCount ? (
                        <p className="mt-1 text-sm text-slate-600">Some access is limited.</p>
                      ) : null}
                      {canAdminMembers && status.attention ? (
                        <p className="mt-1 text-sm text-amber-800" data-company-settings-team-pending-handoff>
                          {status.attention}
                        </p>
                      ) : null}

                      {canAdminMembers && manageable && !member.removedAt && !editingRole && !removing ? (
                        <div className={ACTION_ROW}>
                          <button
                            type="button"
                            className={ACTION}
                            onClick={() => {
                              const role = isAssignableCompanyMembershipRole(member.role) ? member.role : "";
                              setDraftRole(role);
                              const allowed = role ? teamPackageChoices(role, delegator) : [];
                              setDraftPackages(
                                (member.packageKeys ?? []).filter((key) =>
                                  allowed.some((choice) => choice.key === key)
                                )
                              );
                              setReassignToUserId("");
                              openPanel({ type: "role", userId: member.userId });
                            }}
                          >
                            Change role
                          </button>
                          <button
                            type="button"
                            className={DESTRUCTIVE_ACTION}
                            data-company-settings-team-remove
                            onClick={() => {
                              setReassignToUserId("");
                              openPanel({ type: "remove", userId: member.userId });
                            }}
                          >
                            Remove access
                          </button>
                        </div>
                      ) : null}

                      {canAdminMembers && manageable && member.removedAt && !reactivating && !removing ? (
                        <div className={ACTION_ROW}>
                          <button
                            type="button"
                            className={ACTION}
                            onClick={() => {
                              setDraftRole("");
                              setDraftPackages([]);
                              openPanel({ type: "reactivate", userId: member.userId });
                            }}
                          >
                            Reactivate access
                          </button>
                          {status.attention ? (
                            <button
                              type="button"
                              className={ACTION}
                              onClick={() => {
                                setReassignToUserId("");
                                openPanel({ type: "remove", userId: member.userId });
                              }}
                            >
                              Reassign open work
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {editingRole ? (
                        <form
                          className="mt-3 space-y-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveRole(member);
                          }}
                        >
                          <label className={FOCUSED_EDITOR_LABEL}>
                            Role
                            <select
                              className={FOCUSED_EDITOR_INPUT}
                              required
                              value={draftRole}
                              data-company-settings-team-preset
                              onChange={(event) => {
                                const role = event.target.value;
                                if (!isAssignableCompanyMembershipRole(role)) {
                                  setDraftRole("");
                                  setDraftPackages([]);
                                  return;
                                }
                                setDraftRole(role);
                                setDraftPackages((current) =>
                                  current.filter((key) =>
                                    teamPackageChoices(role, delegator).some((choice) => choice.key === key)
                                  )
                                );
                              }}
                            >
                              <option value="">Choose a role</option>
                              {assignableRoles.map((role) => (
                                <option key={role} value={role}>
                                  {teamRoleLabel(role)}
                                </option>
                              ))}
                            </select>
                          </label>
                          {draftRole ? <p className={FOCUSED_EDITOR_HINT}>{TEAM_ROLE_BLURB[draftRole]}</p> : null}
                          {isAssignableCompanyMembershipRole(draftRole) && draftRole !== member.role
                            ? (() => {
                                const dropsNote = teamRoleChangeDropsAccess(draftRole, member.packageKeys ?? []);
                                return dropsNote ? (
                                  <p className="text-sm text-slate-700" data-company-settings-team-drops-access>
                                    {dropsNote}
                                  </p>
                                ) : null;
                              })()
                            : null}
                          {choices.length > 0 ? (
                            <fieldset className="space-y-1">
                              <legend className={FOCUSED_EDITOR_LABEL}>Special access</legend>
                              {choices.map((choice) => (
                                <label key={choice.label} className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={draftPackages.includes(choice.key)}
                                    onChange={(event) => {
                                      setPackagesTouched(true);
                                      setDraftPackages((current) =>
                                        event.target.checked
                                          ? [...current, choice.key]
                                          : current.filter((key) => key !== choice.key)
                                      );
                                    }}
                                  />
                                  {choice.label}
                                </label>
                              ))}
                            </fieldset>
                          ) : null}
                          <div className={FORM_ACTIONS}>
                            <button type="submit" className={`${FOCUSED_EDITOR_SAVE} w-full sm:w-auto`} disabled={busy}>
                              Save
                            </button>
                            <button type="button" className={FOCUSED_EDITOR_CANCEL} disabled={busy} onClick={() => setPanel(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {removing ? (
                        <form
                          className="mt-3 space-y-3"
                          data-company-settings-team-remove-confirm
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (member.removedAt) void reassignOpenWork(member);
                            else void confirmRemove(member);
                          }}
                        >
                          {member.removedAt ? (
                            <p className="text-sm text-slate-700">Choose who should take the open work.</p>
                          ) : (
                            <p className="text-sm text-slate-700">
                              They lose company access immediately. Their past work stays. Open work may need to be reassigned.
                            </p>
                          )}
                          <label className={FOCUSED_EDITOR_LABEL}>
                            Give open work to
                            <select
                              className={FOCUSED_EDITOR_INPUT}
                              value={reassignToUserId}
                              data-company-settings-team-reassign
                              onChange={(event) => setReassignToUserId(event.target.value)}
                            >
                              <option value="">Choose a person</option>
                              {people
                                .filter((row) => !row.removedAt && row.userId !== member.userId)
                                .map((row) => (
                                  <option key={row.userId} value={row.userId}>
                                    {personName(row, people)}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <div className={FORM_ACTIONS}>
                            <button
                              type="submit"
                              className={
                                member.removedAt
                                  ? `${FOCUSED_EDITOR_SAVE} w-full sm:w-auto`
                                  : `${FOCUSED_EDITOR_DESTRUCTIVE_CONFIRM} w-full sm:w-auto`
                              }
                              disabled={busy || (Boolean(member.removedAt) && !reassignToUserId)}
                            >
                              {member.removedAt ? "Reassign open work" : "Remove access"}
                            </button>
                            <button type="button" className={FOCUSED_EDITOR_CANCEL} disabled={busy} onClick={() => setPanel(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {reactivating ? (
                        <form
                          className="mt-3 space-y-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void reactivate(member);
                          }}
                        >
                          <p className="text-sm text-slate-700">
                            Choose the role they should have now. Earlier special access is not restored.
                          </p>
                          <label className={FOCUSED_EDITOR_LABEL}>
                            Role
                            <select
                              className={FOCUSED_EDITOR_INPUT}
                              required
                              value={draftRole}
                              onChange={(event) => {
                                const role = event.target.value;
                                if (!isAssignableCompanyMembershipRole(role)) {
                                  setDraftRole("");
                                  setDraftPackages([]);
                                  return;
                                }
                                setDraftRole(role);
                                setDraftPackages([]);
                              }}
                            >
                              <option value="">Choose a role</option>
                              {assignableRoles.map((role) => (
                                <option key={role} value={role}>
                                  {teamRoleLabel(role)}
                                </option>
                              ))}
                            </select>
                          </label>
                          {draftRole ? <p className={FOCUSED_EDITOR_HINT}>{TEAM_ROLE_BLURB[draftRole]}</p> : null}
                          {draftRole === "field_user" ? (
                            <p className={FOCUSED_EDITOR_HINT}>
                              Job access follows the jobs you assign. Earlier job access is not restored.
                            </p>
                          ) : null}
                          {choices.length > 0 ? (
                            <fieldset className="space-y-1">
                              <legend className={FOCUSED_EDITOR_LABEL}>Special access</legend>
                              {choices.map((choice) => (
                                <label key={choice.label} className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={draftPackages.includes(choice.key)}
                                    onChange={(event) => {
                                      setDraftPackages((current) =>
                                        event.target.checked
                                          ? [...current, choice.key]
                                          : current.filter((key) => key !== choice.key)
                                      );
                                    }}
                                  />
                                  {choice.label}
                                </label>
                              ))}
                            </fieldset>
                          ) : null}
                          <div className={FORM_ACTIONS}>
                            <button type="submit" className={`${FOCUSED_EDITOR_SAVE} w-full sm:w-auto`} disabled={busy}>
                              Reactivate access
                            </button>
                            <button type="button" className={FOCUSED_EDITOR_CANCEL} disabled={busy} onClick={() => setPanel(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {canAdminMembers && (invitationsLoading || invitationsFailed || invitations.length > 0) ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-950">Invitations</h3>
                {invitationsLoading && invitations.length === 0 ? (
                  <p className={FOCUSED_EDITOR_HINT}>Loading invitations…</p>
                ) : invitationsFailed && invitations.length === 0 ? (
                  <p className="text-sm text-slate-800">{TEAM_INVITATIONS_UNAVAILABLE}</p>
                ) : invitations.length === 0 ? null : (
                  <ul className="divide-y divide-slate-100">
                    {invitations.map((invite) => {
                      const role = isAssignableCompanyMembershipRole(invite.role)
                        ? teamRoleLabel(invite.role)
                        : "Invited";
                      const when = expiryLabel(invite.expiresAt);
                      const special = teamSpecialAccessSummary(invite.packageKeys);
                      return (
                        <li key={invite.invitationId} className="min-w-0 py-3.5">
                          <p className="break-all text-sm font-semibold text-slate-950">{invite.email}</p>
                          <p className="mt-0.5 text-sm text-slate-700">
                            {role}
                            <span className="text-slate-400"> · </span>
                            Invited
                            {when ? <span className="text-slate-500"> · {when}</span> : null}
                          </p>
                          {special ? <p className="mt-1 text-sm text-slate-600">Special access: {special}</p> : null}
                          {invite.role === "field_user" ? (
                            <p className="mt-1 text-sm text-slate-600">
                              {invite.assignedJobCount > 0
                                ? `Assigned jobs (${invite.assignedJobCount})`
                                : "No jobs assigned yet"}
                            </p>
                          ) : null}
                          {invite.delivery === "failed" ? (
                            <p className="mt-1 text-sm text-amber-800">{INVITATION_NOT_SENT_MESSAGE}</p>
                          ) : null}
                          <div className={ACTION_ROW}>
                            <button type="button" className={ACTION} disabled={busy} onClick={() => void resendInvitation(invite)}>
                              Resend
                            </button>
                            <button
                              type="button"
                              className={DESTRUCTIVE_ACTION}
                              disabled={busy}
                              onClick={() => void revokeInvitation(invite)}
                            >
                              Revoke invitation
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : null}

            {viewerIsOwner && canAdminMembers ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-950">Owner</h3>
                <p className="text-sm text-slate-700">
                  Owner is separate from Admin. Transfer ownership is the only way to change who owns the business.
                </p>
                {panel?.type === "transfer" ? (
                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void transferOwnership();
                    }}
                  >
                    <label className={FOCUSED_EDITOR_LABEL}>
                      New Owner
                      <select
                        required
                        className={FOCUSED_EDITOR_INPUT}
                        value={transferTargetId}
                        onChange={(event) => setTransferTargetId(event.target.value)}
                      >
                        <option value="">Choose a person</option>
                        {people
                          .filter((member) => !member.removedAt && member.role !== "owner")
                          .map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {personName(member, people)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className={FOCUSED_EDITOR_LABEL}>
                      Your next role
                      <select
                        className={FOCUSED_EDITOR_INPUT}
                        value={formerRole}
                        onChange={(event) => {
                          const role = event.target.value;
                          if (!isAssignableCompanyMembershipRole(role)) return;
                          setFormerRole(role);
                        }}
                      >
                        {ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {teamRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-sm text-slate-700">
                      The person you choose becomes the Owner. You become the role you pick here. This does not happen from the role list.
                    </p>
                    <p className={FOCUSED_EDITOR_HINT}>You&apos;ll confirm with your authenticator app before this happens.</p>
                    <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={transferArmed}
                        onChange={(event) => setTransferArmed(event.target.checked)}
                      />
                      I understand I will no longer be the Owner.
                    </label>
                    <div className={FORM_ACTIONS}>
                      <button
                        type="submit"
                        className={`${FOCUSED_EDITOR_SAVE} w-full sm:w-auto`}
                        disabled={busy || !transferArmed || !transferTargetId}
                      >
                        Transfer ownership
                      </button>
                      <button type="button" className={FOCUSED_EDITOR_CANCEL} disabled={busy} onClick={() => setPanel(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className={ACTION} onClick={() => openPanel({ type: "transfer" })}>
                    Transfer ownership
                  </button>
                )}
              </section>
            ) : null}
          </>
        )}
      </div>
    </FocusedEditor>
  );
}
