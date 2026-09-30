"use client";

/**
 * Team screen intent (Phase 13C Slice 1 redesign).
 *
 * SCREEN JOB — The people behind the work, their known responsibilities, and
 * (when durable Crew truth exists) who works with whom.
 * FIRST SCAN — person and work profile. SECOND — verified current work beneath
 * that person. THIRD — FieldDive state and a deliberate details/access action.
 * COMPOSITION — Operations / Team. Person anchors own an in-place relationship
 * region; invitations are secondary, removed access is below. No role grouping
 * implies Crew leadership. Future Crew children use the same person anchors.
 * Sensitive person/access decisions open in the preserved secondary sheet.
 * INFORMATION OWNERSHIP — the database access engine owns authority. This screen
 * summarizes it in contractor language. Directory viewers see names and access
 * labels only.
 * STATE PRIORITIES — loading looks like loading; a failed read is not an empty
 * list; a pending invitation is not a membership; removal is not deletion;
 * reactivation is a new assignment; ownership transfer is not an access edit.
 * PRESERVE — explicit save, Owner separate from Office Manager, 7-day invite,
 * resend, revoke, handoff distinct from removal, strong sign-in.
 * OMIT — capability ids, package ids, revisions, policy reasons, scope JSON,
 * audit ids, database identifiers, "full access" claims, empty config sections.
 * DISALLOWED — card grids, boxed rows, metric cards, org charts, tinted status
 * panels, a permission matrix, a role builder.
 * SEPARATION IS NOT HIERARCHY.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, UserPlus } from "lucide-react";
import {
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
} from "@/app/components/ui/FocusedEditor";
import {
  TEAM_HANDOFF_ATTENTION,
  TEAM_INVITATIONS_UNAVAILABLE,
  TEAM_MEMBERS_UNAVAILABLE,
  TEAM_OWNER_DETAIL,
  TEAM_OWNER_SUMMARY,
  contractorFacingMessage,
  packageKeysForSave,
  teamAccessLabel,
  teamAccessPreset,
  teamAccessSummary,
  teamAssignedJobCount,
  teamJobReach,
  teamListState,
  teamMemberStatus,
  teamPackageChoices,
  teamPresetChoices,
  teamPresetForAccess,
  teamRoleChangeDropsAccess,
  teamRoleLabel,
  teamSpecialAccessSummary,
  type TeamAccessPresetKey,
  type TeamDelegator,
} from "@/app/lib/access/teamAccessPresentation";
import {
  ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES,
  isAssignableCompanyMembershipRole,
  resolveCompanyMembershipRole,
  type AssignableCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";
import { INVITATION_NOT_SENT_MESSAGE } from "@/app/lib/invitations/invitationModel";
import StrongSignInStep from "@/app/tools/settings/StrongSignInStep";
import type { CompanyMemberClientItem, CompanyMembersClientState } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import { labelForCompanyMember, useCompanyMembers } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import TeamSheet, {
  TEAM_SHEET_DESTRUCTIVE,
  TEAM_SHEET_PRIMARY,
  TEAM_SHEET_SECONDARY,
} from "@/app/tools/settings/team/TeamSheet";
import {
  TeamListSkeleton,
  TeamMonogram,
  TeamPeopleList,
  TeamWorkSummary,
  type TeamRowModel,
} from "@/app/tools/settings/team/TeamPeopleList";
import { TeamAccessChooser, TeamAdditionalAccess } from "@/app/tools/settings/team/TeamAccessChooser";

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

type PersonMode = "read" | "change" | "extras";

type View =
  | { type: "list" }
  | { type: "person"; userId: string; mode: PersonMode }
  | { type: "invite" }
  | { type: "invitation"; invitationId: string }
  | { type: "remove"; userId: string }
  | { type: "handoff"; userId: string }
  | { type: "reactivate"; userId: string }
  | { type: "transfer" };

const INLINE_ACTION =
  "inline-flex min-h-[36px] shrink-0 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const QUIET_ACTION =
  "inline-flex min-h-[44px] items-center rounded text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const DANGER_ACTION =
  "inline-flex min-h-[44px] items-center rounded text-sm font-medium text-rose-700 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500";
const BODY_TEXT = "text-sm leading-relaxed text-slate-700";
const HINT = "text-[13px] leading-snug text-slate-500";

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

/** One fact in the person sheet: label, current value, optional action. */
function Fact({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid gap-1.5 py-4 first:pt-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
      <p className="text-[13px] font-medium text-slate-500 sm:pt-0.5">{label}</p>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">{children}</div>
        {action}
      </div>
    </div>
  );
}

function Included({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        className="inline-flex min-h-[32px] items-center gap-0.5 rounded text-[13px] font-medium text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-company-settings-team-included
      >
        What&apos;s included
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? <p className={`${HINT} max-w-[22rem]`}>{text}</p> : null}
    </div>
  );
}

/** A deep-administration sheet the Team Board asks for. */
export type TeamAccessRequest =
  | { type: "person"; userId: string; nonce: number }
  | { type: "invite"; nonce: number }
  | { type: "invitation"; invitationId: string; nonce: number }
  | { type: "transfer"; nonce: number };

type CompanyTeamClientProps = {
  companyId: string;
  /**
   * Board-hosted mode: no list is rendered, only the access sheets the board
   * requests. Membership data is shared with the board.
   */
  headless?: {
    team: CompanyMembersClientState;
    request: TeamAccessRequest | null;
    onClose: () => void;
    onNotice: (notice: string) => void;
  };
};

export default function CompanyTeamClient({ companyId, headless }: CompanyTeamClientProps) {
  const ownTeam = useCompanyMembers(Boolean(companyId) && !headless);
  const team = headless?.team ?? ownTeam;
  const { canAdminMembers, viewerRole, viewerUserId, members, loading, error } = team;
  const onChanged = team.refresh;

  const delegator: TeamDelegator = viewerRole === "owner" ? "owner" : "admin";
  const viewerIsOwner = viewerRole === "owner";
  const presetChoices = teamPresetChoices(delegator);
  const [view, setView] = useState<View>({ type: "list" });
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftPreset, setDraftPreset] = useState<TeamAccessPresetKey | "">("");
  const [draftPackages, setDraftPackages] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [reassignToUserId, setReassignToUserId] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [formerRole, setFormerRole] = useState<AssignableCompanyMembershipRole>("admin");
  const [transferArmed, setTransferArmed] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [invitations, setInvitations] = useState<PendingInvite[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsFailed, setInvitationsFailed] = useState(false);
  const [strongRetry, setStrongRetry] = useState<(() => Promise<void>) | null>(null);
  const [removedOpen, setRemovedOpen] = useState(false);

  const needsStrongSignIn = (err: unknown, retry: () => Promise<void>) => {
    if ((err as { code?: unknown } | null)?.code !== "assurance_required") return false;
    setLocalError(null);
    setStrongRetry(() => retry);
    return true;
  };

  const listState = teamListState({
    loading: loading || (viewerRole == null && !error),
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
  const activePeople = people.filter((member) => !member.removedAt);
  const removedPeople = people.filter((member) => member.removedAt);

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

  const openView = (next: View) => {
    setView(next);
    setLocalError(null);
    setStrongRetry(null);
    setRequestKey(actionKey());
    setTouched(false);
    setTransferArmed(false);
  };
  const backToList = () => openView({ type: "list" });

  const seedDraftFrom = (member: CompanyMemberClientItem) => {
    const preset = teamPresetForAccess(member.role, member.packageKeys);
    setDraftPreset(preset?.key ?? "");
    const allowed = preset ? teamPackageChoices(preset.role, delegator) : [];
    setDraftPackages(
      (member.packageKeys ?? []).filter((key) => allowed.some((choice) => choice.key === key))
    );
  };

  const openPerson = (member: CompanyMemberClientItem, mode: PersonMode = "read") => {
    seedDraftFrom(member);
    if (mode === "read") setNotice(null);
    openView({ type: "person", userId: member.userId, mode });
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

  const selectedPreset = draftPreset ? teamAccessPreset(draftPreset) : null;
  const specialChoices = selectedPreset ? teamPackageChoices(selectedPreset.role, delegator) : [];

  const saveRole = async (member: CompanyMemberClientItem) => {
    if (!canAdminMembers || member.role === "owner" || !selectedPreset) return;
    const draftRole = selectedPreset.role;
    if (!isAssignableCompanyMembershipRole(draftRole)) return;
    setBusy(true);
    setLocalError(null);
    try {
      await patchMember({
        userId: member.userId,
        role: draftRole,
        expectedRevision: member.accessRevision,
        packages: packageKeysForSave({
          role: draftRole,
          existing: member.packageKeys ?? [],
          selected: draftPackages,
          choices: specialChoices,
          presetPackages: selectedPreset.packages,
        }),
      });
      setNotice(`${personName(member, members)} now has ${selectedPreset.label} access.`);
      openView({ type: "person", userId: member.userId, mode: "read" });
      await onChanged();
    } catch (err) {
      if (needsStrongSignIn(err, () => saveRole(member))) return;
      setLocalError(err instanceof Error ? err.message : "Could not update access.");
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
      setNotice(handoffError ? `Access removed. ${handoffError}` : `${personName(member, members)} no longer has access.`);
      backToList();
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
      if (!handoffError) backToList();
      await onChanged();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : TEAM_HANDOFF_ATTENTION);
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async (member: CompanyMemberClientItem) => {
    if (!canAdminMembers || !selectedPreset) return;
    const draftRole = selectedPreset.role;
    if (!isAssignableCompanyMembershipRole(draftRole)) return;
    setBusy(true);
    setLocalError(null);
    try {
      await patchMember({
        userId: member.userId,
        action: "reactivate",
        role: draftRole,
        packages: packageKeysForSave({
          role: draftRole,
          existing: [],
          selected: draftPackages,
          choices: specialChoices,
          presetPackages: selectedPreset.packages,
        }),
        jobIds: [],
        expectedRevision: member.accessRevision,
        idempotencyKey: requestKey,
      });
      setNotice(`${personName(member, members)} has access again.`);
      backToList();
      await onChanged();
    } catch (err) {
      if (needsStrongSignIn(err, () => reactivate(member))) return;
      setLocalError(err instanceof Error ? err.message : "Could not reactivate access.");
    } finally {
      setBusy(false);
    }
  };

  const sendInvitation = async () => {
    if (!canAdminMembers || !selectedPreset || !inviteEmail.trim()) return;
    const inviteRole = selectedPreset.role;
    setBusy(true);
    setLocalError(null);
    try {
      const packages = packageKeysForSave({
        role: inviteRole,
        existing: [],
        selected: draftPackages,
        choices: specialChoices,
        presetPackages: selectedPreset.packages,
      });
      const res = await fetch("/api/company/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          packages,
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
        packageKeys: packages,
        assignedJobCount: 0,
        delivery: body.delivery === "failed" ? "failed" : body.delivery === "sent" ? "sent" : "unknown",
      };
      setInvitations((current) => [
        created,
        ...current.filter((invite) => invite.invitationId !== created.invitationId),
      ]);
      setInviteEmail("");
      setDraftPreset("");
      setDraftPackages([]);
      backToList();
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
      backToList();
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
      backToList();
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
      backToList();
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

  const loadFailed = listState === "unavailable";
  const warningNotice = Boolean(
    notice && (notice.includes("needs attention") || notice.startsWith("Invitation wasn't"))
  );

  const viewMember =
    view.type === "person" || view.type === "remove" || view.type === "handoff" || view.type === "reactivate"
      ? members.find((member) => member.userId === view.userId) ?? null
      : null;
  const viewInvite =
    view.type === "invitation"
      ? invitations.find((invite) => invite.invitationId === view.invitationId) ?? null
      : null;
  const isManageable = (member: CompanyMemberClientItem) => {
    const self = viewerUserId != null && member.userId === viewerUserId;
    return !self && member.role !== "owner" && (viewerIsOwner || member.role !== "admin");
  };

  const selectPreset = (key: TeamAccessPresetKey) => {
    const preset = teamAccessPreset(key);
    const allowed = teamPackageChoices(preset.role, delegator);
    setDraftPreset(key);
    setDraftPackages((current) => current.filter((pkg) => allowed.some((choice) => choice.key === pkg)));
    setTouched(true);
  };
  const togglePackage = (key: string, on: boolean) => {
    setDraftPackages((current) => (on ? [...current, key] : current.filter((pkg) => pkg !== key)));
    setTouched(true);
  };
  const reassignOptions = (member: CompanyMemberClientItem) =>
    activePeople.filter((row) => row.userId !== member.userId);

  const openInvite = () => {
    setInviteEmail("");
    setDraftPreset("");
    setDraftPackages([]);
    setNotice(null);
    openView({ type: "invite" });
  };

  // ---- Board-hosted requests -------------------------------------------------
  const hostedRequest = headless?.request ?? null;
  const [handledNonce, setHandledNonce] = useState<number | null>(null);
  const [hostedOpen, setHostedOpen] = useState(false);
  useEffect(() => {
    if (!hostedRequest || hostedRequest.nonce === handledNonce) return;
    if (hostedRequest.type === "person") {
      const member = members.find((row) => row.userId === hostedRequest.userId);
      if (!member) return;
      openPerson(member);
    } else if (hostedRequest.type === "invite") {
      openInvite();
    } else if (hostedRequest.type === "invitation") {
      if (!invitations.some((invite) => invite.invitationId === hostedRequest.invitationId)) return;
      setNotice(null);
      openView({ type: "invitation", invitationId: hostedRequest.invitationId });
    } else {
      setNotice(null);
      openView({ type: "transfer" });
    }
    setHandledNonce(hostedRequest.nonce);
    setHostedOpen(true);
    // openPerson/openInvite/openView are recreated each render; the nonce gates re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostedRequest, handledNonce, members, invitations]);
  useEffect(() => {
    if (!headless || !hostedOpen || view.type !== "list") return;
    setHostedOpen(false);
    headless.onClose();
  }, [headless, hostedOpen, view.type]);
  useEffect(() => {
    if (headless && notice) headless.onNotice(notice);
    // Forward each new notice once; the board owns how it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  // ---- Rows -------------------------------------------------------------------
  const memberRow = (member: CompanyMemberClientItem): TeamRowModel => {
    const status = teamMemberStatus({
      removedAt: member.removedAt,
      openWork: member.openJobLeadCount + member.openTaskAssigneeCount,
    });
    const activeAccess = canAdminMembers && !member.removedAt;
    const name = personName(member, people);
    return {
      key: `m:${member.userId}`,
      kind: member.removedAt ? "removed" : "member",
      name,
      email: canAdminMembers ? member.email : null,
      self: viewerUserId != null && member.userId === viewerUserId,
      owner: member.role === "owner",
      accessLabel: teamAccessLabel(member.role, activeAccess || !canAdminMembers ? member.packageKeys : []),
      accessSummary:
        member.removedAt || member.role === "owner" ? null : teamAccessSummary(member.role, member.packageKeys),
      state: canAdminMembers ? status.label : null,
      stateNote: null,
      attention: canAdminMembers ? status.attention : null,
      work: activeAccess ? {
        coordinatorJobs: member.openJobLeadCount,
        assignedTasks: member.openTaskAssigneeCount,
      } : null,
      onOpen: canAdminMembers ? () => openPerson(member) : undefined,
    };
  };
  const inviteRow = (invite: PendingInvite): TeamRowModel => {
    const role = resolveCompanyMembershipRole(invite.role);
    return {
      key: `i:${invite.invitationId}`,
      kind: "invited",
      name: invite.email,
      email: null,
      accessLabel: teamAccessLabel(role, invite.packageKeys),
      accessSummary: teamAccessSummary(role, invite.packageKeys),
      state: "Invited",
      stateNote: expiryLabel(invite.expiresAt) || null,
      attention: invite.delivery === "failed" ? "Email not sent" : null,
      onOpen: () => {
        setNotice(null);
        openView({ type: "invitation", invitationId: invite.invitationId });
      },
    };
  };
  const rows = activePeople.map(memberRow);
  const invitedRows = canAdminMembers ? invitations.map(inviteRow) : [];
  const removedRows = removedPeople.map(memberRow);
  const removedNeedsAttention = removedRows.some((row) => row.attention);
  const showRemoved = removedOpen || removedNeedsAttention;

  const selectedKey =
    view.type === "invitation"
      ? `i:${view.invitationId}`
      : "userId" in view
        ? `m:${view.userId}`
        : null;

  // ---- Sheet per view ---------------------------------------------------------
  let sheet: ReactNode = null;
  const strongStep = strongRetry ? (
    <div className="mb-5">
      <StrongSignInStep
        onConfirmed={() => {
          const retry = strongRetry;
          setStrongRetry(null);
          void retry();
        }}
        onCancel={() => setStrongRetry(null)}
      />
    </div>
  ) : null;
  const cancelButton = (label: string, onClick: () => void) => (
    <button type="button" className={TEAM_SHEET_SECONDARY} disabled={busy} onClick={onClick} data-team-sheet-cancel>
      {label}
    </button>
  );
  const footerRow = (left: ReactNode, right: ReactNode) => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">{left}</div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  );

  if (view.type === "person" && viewMember) {
    const member = viewMember;
    const name = personName(member, people);
    const manageable = canAdminMembers && isManageable(member);
    const activeAccess = canAdminMembers && !member.removedAt;
    const special = activeAccess ? teamSpecialAccessSummary(member.packageKeys ?? []) : null;
    const showEmail = canAdminMembers && member.email && member.email !== name;
    const status = teamMemberStatus({
      removedAt: member.removedAt,
      openWork: member.openJobLeadCount + member.openTaskAssigneeCount,
    });
    const editable = manageable && !member.removedAt;
    const currentPreset = teamPresetForAccess(member.role, member.packageKeys);
    const currentExtras = currentPreset ? teamPackageChoices(currentPreset.role, delegator) : [];
    const presetChanged = selectedPreset != null && selectedPreset.key !== currentPreset?.key;
    const dropsNote =
      editable && selectedPreset && presetChanged
        ? teamRoleChangeDropsAccess(selectedPreset.role, member.packageKeys ?? [], selectedPreset.label)
        : null;
    const toRead = () => openPerson(member, "read");
    const kind = member.removedAt ? "removed" : "member";
    const leading = <TeamMonogram name={name} kind={kind} size="lg" />;

    if (view.mode !== "read" && editable) {
      const extrasOnly = view.mode === "extras";
      sheet = (
        <TeamSheet
          view={extrasOnly ? "person-extras" : "person-change"}
          title={name}
          subtitle={showEmail ? member.email : null}
          leading={leading}
          backLabel={name}
          onBack={toRead}
          dirty={touched}
          busy={busy}
          error={localError}
          onClose={backToList}
          footer={footerRow(
            null,
            <>
              {cancelButton("Cancel", toRead)}
              <button
                type="button"
                className={TEAM_SHEET_PRIMARY}
                disabled={busy || !touched || !selectedPreset}
                onClick={() => void saveRole(member)}
                data-team-sheet-save
              >
                {busy ? "Saving…" : "Save access"}
              </button>
            </>
          )}
        >
          {strongStep}
          <div className="space-y-5" data-company-settings-team-person data-company-settings-team-person-mode={view.mode}>
            {extrasOnly ? (
              <TeamAdditionalAccess
                choices={specialChoices}
                selected={draftPackages}
                onToggle={togglePackage}
                startOpen
              />
            ) : (
              <>
                <TeamAccessChooser
                  label="Change access"
                  choices={presetChoices}
                  value={draftPreset}
                  currentKey={currentPreset?.key ?? null}
                  onChange={selectPreset}
                />
                {dropsNote ? (
                  <p className="text-sm text-amber-800" data-company-settings-team-drops-access>
                    {dropsNote}
                  </p>
                ) : null}
                <TeamAdditionalAccess
                  key={draftPreset}
                  choices={specialChoices}
                  selected={draftPackages}
                  onToggle={togglePackage}
                />
              </>
            )}
          </div>
        </TeamSheet>
      );
    } else {
      const reach = member.role;
      const accessDetail =
        member.role === "owner" ? TEAM_OWNER_DETAIL : currentPreset?.detail ?? null;
      const showExtras = Boolean(special) || (editable && currentExtras.length > 0);
      sheet = (
        <TeamSheet
          view="person"
          title={name}
          subtitle={showEmail ? member.email : null}
          leading={leading}
          busy={busy}
          error={localError}
          onClose={backToList}
        >
          {strongStep}
          <div data-company-settings-team-person data-company-settings-team-person-mode="read">
            {!headless && activeAccess && (member.openJobLeadCount > 0 || member.openTaskAssigneeCount > 0) ? (
              <section className="mb-6" aria-label="Current work" data-team-person-current-truth>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Current work</h3>
                <TeamWorkSummary work={{ coordinatorJobs: member.openJobLeadCount, assignedTasks: member.openTaskAssigneeCount }} />
              </section>
            ) : null}
            <div className="divide-y divide-slate-100">
              <Fact
                label="FieldDive access"
                action={
                  editable ? (
                    <button
                      type="button"
                      className={INLINE_ACTION}
                      onClick={() => openPerson(member, "change")}
                      data-company-settings-team-change-access
                    >
                      Change access
                    </button>
                  ) : null
                }
              >
                <p className={`text-[15px] font-semibold ${member.removedAt ? "text-slate-500" : "text-slate-900"}`}>
                  {teamAccessLabel(member.role, activeAccess ? member.packageKeys : [])}
                </p>
                {!member.removedAt ? (
                  <p className="mt-0.5 text-sm text-slate-600">
                    {member.role === "owner"
                      ? TEAM_OWNER_SUMMARY
                      : teamAccessSummary(member.role, member.packageKeys)}
                  </p>
                ) : null}
                {accessDetail && !member.removedAt ? <Included text={accessDetail} /> : null}
                {canAdminMembers && !manageable && member.role === "admin" ? (
                  <p className={`${HINT} mt-1`}>Only the Owner changes an Office Manager&apos;s access.</p>
                ) : null}
              </Fact>

              {!member.removedAt ? (
                <Fact label="Job access">
                  <p className="text-sm font-medium text-slate-900">{teamJobReach(reach)}</p>
                  {reach === "field_user" && activeAccess ? (
                    <p className={`${HINT} mt-0.5`}>{teamAssignedJobCount(member.grantedJobCount ?? 0)}</p>
                  ) : null}
                </Fact>
              ) : null}

              {showExtras && !member.removedAt ? (
                <Fact
                  label="Additional access"
                  action={
                    editable && currentExtras.length > 0 ? (
                      <button
                        type="button"
                        className={INLINE_ACTION}
                        onClick={() => openPerson(member, "extras")}
                        data-company-settings-team-add-access-open
                      >
                        {special ? "Change" : "Add access"}
                      </button>
                    ) : null
                  }
                >
                  <p className={`text-sm ${special ? "font-medium text-slate-900" : "text-slate-500"}`}>
                    {special ?? "None"}
                  </p>
                </Fact>
              ) : null}

              {canAdminMembers ? (
                <Fact label="Status">
                  <p className={`text-sm font-medium ${member.removedAt ? "text-slate-500" : "text-slate-900"}`}>
                    {status.label}
                  </p>
                  {activeAccess && member.restrictionCount ? (
                    <p className={`${HINT} mt-0.5`}>Some access is limited.</p>
                  ) : null}
                  {status.attention ? (
                    <p className="mt-0.5 text-sm text-amber-800" data-company-settings-team-pending-handoff>
                      {status.attention}
                    </p>
                  ) : null}
                </Fact>
              ) : null}
            </div>

            {manageable || (viewerIsOwner && member.role === "owner" && canAdminMembers) ? (
              <div className="mt-6 border-t border-slate-100 pt-4" data-company-settings-team-actions>
                {member.role === "owner" ? (
                  <>
                    <p className={HINT}>Owner is separate from Office Manager. Ownership moves only by transfer.</p>
                    <button
                      type="button"
                      className={QUIET_ACTION}
                      onClick={() => {
                        setTransferTargetId("");
                        openView({ type: "transfer" });
                      }}
                    >
                      Transfer ownership
                    </button>
                  </>
                ) : member.removedAt ? (
                  <div className="flex flex-col items-start">
                    <button
                      type="button"
                      className={QUIET_ACTION}
                      onClick={() => {
                        setDraftPreset("");
                        setDraftPackages([]);
                        openView({ type: "reactivate", userId: member.userId });
                      }}
                    >
                      Reactivate access
                    </button>
                    {status.attention ? (
                      <button
                        type="button"
                        className={QUIET_ACTION}
                        onClick={() => {
                          setReassignToUserId("");
                          openView({ type: "handoff", userId: member.userId });
                        }}
                      >
                        Reassign open work
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    className={DANGER_ACTION}
                    data-company-settings-team-remove
                    onClick={() => {
                      setReassignToUserId("");
                      openView({ type: "remove", userId: member.userId });
                    }}
                  >
                    Remove access
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </TeamSheet>
      );
    }
  } else if (view.type === "invite") {
    const dirty = touched || inviteEmail.trim() !== "";
    sheet = (
      <TeamSheet
        view="invite"
        title="Invite person"
        subtitle="They join after they accept from their email."
        dirty={dirty}
        busy={busy}
        error={localError}
        onClose={backToList}
        footer={footerRow(
          <p className={HINT}>Expires in 7 days</p>,
          <>
            {cancelButton("Cancel", backToList)}
            <button
              type="button"
              className={TEAM_SHEET_PRIMARY}
              disabled={busy || !inviteEmail.trim() || !selectedPreset}
              onClick={() => void sendInvitation()}
              data-team-sheet-save
            >
              {busy ? "Sending…" : "Send invitation"}
            </button>
          </>
        )}
      >
        {strongStep}
        <form
          className="space-y-6"
          data-company-settings-team-invite
          onSubmit={(event) => {
            event.preventDefault();
            void sendInvitation();
          }}
        >
          <label className={FOCUSED_EDITOR_LABEL}>
            <span className="text-[13px] font-medium text-slate-500">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className={FOCUSED_EDITOR_INPUT}
              placeholder="name@company.com"
            />
          </label>
          <TeamAccessChooser choices={presetChoices} value={draftPreset} onChange={selectPreset} />
          {selectedPreset ? (
            <TeamAdditionalAccess
              key={draftPreset}
              choices={specialChoices}
              selected={draftPackages}
              onToggle={togglePackage}
            />
          ) : null}
        </form>
      </TeamSheet>
    );
  } else if (view.type === "invitation" && viewInvite) {
    const invite = viewInvite;
    const role = resolveCompanyMembershipRole(invite.role);
    const when = expiryLabel(invite.expiresAt);
    const special = teamSpecialAccessSummary(invite.packageKeys);
    sheet = (
      <TeamSheet
        view="invitation"
        title={invite.email}
        subtitle={when ? `Invited · ${when}` : "Invited"}
        leading={<TeamMonogram name={invite.email} kind="invited" size="lg" />}
        busy={busy}
        error={localError}
        onClose={backToList}
        footer={footerRow(
          <button
            type="button"
            className={DANGER_ACTION}
            disabled={busy}
            onClick={() => void revokeInvitation(invite)}
          >
            Revoke invitation
          </button>,
          <button
            type="button"
            className={TEAM_SHEET_PRIMARY}
            disabled={busy}
            onClick={() => void resendInvitation(invite)}
            data-team-sheet-save
          >
            {busy ? "Sending…" : "Resend invitation"}
          </button>
        )}
      >
        <div className="divide-y divide-slate-100" data-company-settings-team-invitation>
          <Fact label="Access">
            <p className="text-[15px] font-semibold text-slate-900">{teamAccessLabel(role, invite.packageKeys)}</p>
            <p className="mt-0.5 text-sm text-slate-600">{teamAccessSummary(role, invite.packageKeys)}</p>
          </Fact>
          <Fact label="Job access">
            <p className="text-sm font-medium text-slate-900">{teamJobReach(role)}</p>
          </Fact>
          {special ? (
            <Fact label="Additional access">
              <p className="text-sm font-medium text-slate-900">{special}</p>
            </Fact>
          ) : null}
          <Fact label="Status">
            <p className="text-sm font-medium text-amber-700">Invited</p>
            <p className={`${HINT} mt-0.5`}>No access until they accept. Resending sends a new link.</p>
            {invite.delivery === "failed" ? (
              <p className="mt-1 text-sm text-amber-800">{INVITATION_NOT_SENT_MESSAGE}</p>
            ) : null}
          </Fact>
        </div>
      </TeamSheet>
    );
  } else if (view.type === "remove" && viewMember) {
    const member = viewMember;
    const name = personName(member, people);
    sheet = (
      <TeamSheet
        view="remove"
        title={`Remove ${name}'s access?`}
        backLabel={name}
        onBack={() => openPerson(member)}
        busy={busy}
        error={localError}
        onClose={backToList}
        footer={footerRow(
          null,
          <>
            {cancelButton("Cancel", () => openPerson(member))}
            <button
              type="button"
              className={TEAM_SHEET_DESTRUCTIVE}
              disabled={busy}
              onClick={() => void confirmRemove(member)}
              data-team-sheet-save
            >
              {busy ? "Removing…" : "Remove access"}
            </button>
          </>
        )}
      >
        <div className="space-y-5" data-company-settings-team-remove-confirm>
          <p className={BODY_TEXT}>
            They lose company access immediately. Their past work stays. Open work may need to be reassigned.
          </p>
          <label className={FOCUSED_EDITOR_LABEL}>
            Give open work to
            <select
              className={FOCUSED_EDITOR_INPUT}
              value={reassignToUserId}
              data-company-settings-team-reassign
              onChange={(event) => setReassignToUserId(event.target.value)}
            >
              <option value="">Choose later</option>
              {reassignOptions(member).map((row) => (
                <option key={row.userId} value={row.userId}>
                  {personName(row, people)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </TeamSheet>
    );
  } else if (view.type === "handoff" && viewMember) {
    const member = viewMember;
    const name = personName(member, people);
    sheet = (
      <TeamSheet
        view="handoff"
        title="Reassign open work"
        subtitle={name}
        backLabel={name}
        onBack={() => openPerson(member)}
        busy={busy}
        error={localError}
        onClose={backToList}
        footer={footerRow(
          null,
          <>
            {cancelButton("Cancel", () => openPerson(member))}
            <button
              type="button"
              className={TEAM_SHEET_PRIMARY}
              disabled={busy || !reassignToUserId}
              onClick={() => void reassignOpenWork(member)}
              data-team-sheet-save
            >
              Reassign open work
            </button>
          </>
        )}
      >
        <div className="space-y-5" data-company-settings-team-handoff>
          <p className={BODY_TEXT}>Choose who should take the open work.</p>
          <label className={FOCUSED_EDITOR_LABEL}>
            Give open work to
            <select
              className={FOCUSED_EDITOR_INPUT}
              value={reassignToUserId}
              data-company-settings-team-reassign
              onChange={(event) => setReassignToUserId(event.target.value)}
            >
              <option value="">Choose a person</option>
              {reassignOptions(member).map((row) => (
                <option key={row.userId} value={row.userId}>
                  {personName(row, people)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </TeamSheet>
    );
  } else if (view.type === "reactivate" && viewMember) {
    const member = viewMember;
    const name = personName(member, people);
    sheet = (
      <TeamSheet
        view="reactivate"
        title={`Reactivate ${name}`}
        leading={<TeamMonogram name={name} kind="removed" size="lg" />}
        backLabel={name}
        onBack={() => openPerson(member)}
        dirty={touched}
        busy={busy}
        error={localError}
        onClose={backToList}
        footer={footerRow(
          null,
          <>
            {cancelButton("Cancel", () => openPerson(member))}
            <button
              type="button"
              className={TEAM_SHEET_PRIMARY}
              disabled={busy || !selectedPreset}
              onClick={() => void reactivate(member)}
              data-team-sheet-save
            >
              Reactivate access
            </button>
          </>
        )}
      >
        {strongStep}
        <div className="space-y-5" data-company-settings-team-reactivate>
          <p className={BODY_TEXT}>
            Choose the access they should have now. Earlier special access is not restored.
          </p>
          <TeamAccessChooser choices={presetChoices} value={draftPreset} onChange={selectPreset} />
          {selectedPreset?.role === "field_user" ? (
            <p className={HINT}>Job access follows the jobs you assign. Earlier job access is not restored.</p>
          ) : null}
          {selectedPreset ? (
            <TeamAdditionalAccess
              key={draftPreset}
              choices={specialChoices}
              selected={draftPackages}
              onToggle={togglePackage}
            />
          ) : null}
        </div>
      </TeamSheet>
    );
  } else if (view.type === "transfer") {
    const owner = members.find((member) => member.role === "owner") ?? null;
    sheet = (
      <TeamSheet
        view="transfer"
        title="Transfer ownership"
        subtitle="Owner is one person. This moves it."
        backLabel={owner ? personName(owner, people) : "Team"}
        onBack={owner ? () => openPerson(owner) : backToList}
        dirty={Boolean(transferTargetId) || transferArmed}
        busy={busy}
        error={localError}
        onClose={backToList}
        footer={footerRow(
          null,
          <>
            {cancelButton("Cancel", owner ? () => openPerson(owner) : backToList)}
            <button
              type="button"
              className={TEAM_SHEET_DESTRUCTIVE}
              disabled={busy || !transferArmed || !transferTargetId}
              onClick={() => void transferOwnership()}
              data-team-sheet-save
            >
              Transfer ownership
            </button>
          </>
        )}
      >
        {strongStep}
        <div className="space-y-5" data-company-settings-team-transfer>
          <label className={FOCUSED_EDITOR_LABEL}>
            New Owner
            <select
              required
              className={FOCUSED_EDITOR_INPUT}
              value={transferTargetId}
              onChange={(event) => setTransferTargetId(event.target.value)}
            >
              <option value="">Choose a person</option>
              {activePeople
                .filter((member) => member.role !== "owner")
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {personName(member, people)}
                  </option>
                ))}
            </select>
          </label>
          <label className={FOCUSED_EDITOR_LABEL}>
            Your next access
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
          <p className={BODY_TEXT}>The person you choose becomes the Owner. You get the access you pick here.</p>
          <p className={HINT}>You&apos;ll confirm with your authenticator app before this happens.</p>
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={transferArmed}
              onChange={(event) => setTransferArmed(event.target.checked)}
            />
            I understand I will no longer be the Owner.
          </label>
        </div>
      </TeamSheet>
    );
  }

  if (headless) return <>{sheet}</>;

  const onlyOwnerSoFar =
    canAdminMembers && listState === "ready" && activePeople.length <= 1 && invitations.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl pb-12" data-company-team-page>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6 sm:pb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-600">The people behind your work.</p>
        </div>
        {canAdminMembers && !loadFailed ? (
          <button type="button" className={`${TEAM_SHEET_PRIMARY} gap-2`} onClick={openInvite} data-company-settings-team-invite-open>
            <UserPlus className="h-4 w-4" aria-hidden />
            Invite person
          </button>
        ) : null}
      </header>

      {notice && view.type === "list" ? (
        <p
          className={`mt-5 text-sm ${warningNotice ? "text-amber-800" : "text-slate-700"}`}
          role="status"
          data-company-settings-team-notice
        >
          {notice}
        </p>
      ) : null}

      <div className={`min-w-0 rounded-xl bg-white px-4 sm:px-7 ${invitedRows.length > 0 ? "lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10" : ""}`} data-team-workspace>
      <section className="min-w-0 py-5 sm:py-6" aria-label="People">
        <h2 className="text-sm font-semibold text-slate-900">People</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Showing people in FieldDive. Work descriptions reflect their current access.</p>
        {listState === "loading" ? (
          <TeamListSkeleton />
        ) : loadFailed ? (
          <div className="rounded-xl border border-slate-200/80 bg-white px-6 py-8" data-company-settings-team-unavailable>
            <p className="text-sm font-medium text-slate-900">{TEAM_MEMBERS_UNAVAILABLE}</p>
            <button type="button" className={QUIET_ACTION} onClick={() => void onChanged()}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200/80 bg-white px-6 py-10 text-center" data-company-settings-team-empty>
            <p className="text-[15px] font-medium text-slate-900">No one here yet</p>
            <p className="mt-1 text-sm text-slate-500">Invite the people who need FieldDive for this business.</p>
          </div>
        ) : (
          <TeamPeopleList rows={rows} selectedKey={selectedKey} />
        )}

        {error && members.length > 0 ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

        {onlyOwnerSoFar ? (
          <p className={`mt-4 ${HINT}`} data-company-settings-team-only-owner>
            You can run your work here on your own. Invite someone when they need to work with you in FieldDive.
          </p>
        ) : null}

        {canAdminMembers && invitationsLoading && invitations.length === 0 ? (
          <p className={`mt-4 ${HINT}`}>Checking invitations…</p>
        ) : canAdminMembers && invitationsFailed && invitations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-800">{TEAM_INVITATIONS_UNAVAILABLE}</p>
        ) : null}

        {!canAdminMembers && listState === "ready" ? (
          <p className={`mt-4 ${HINT}`}>An Owner or Office Manager changes access.</p>
        ) : null}
      </section>
      {invitedRows.length > 0 ? (
        <aside className="min-w-0 border-t border-slate-100 py-5 sm:py-6 lg:border-t-0" aria-label="Invited people">
          <h2 className="text-sm font-semibold text-slate-900">Invited</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Waiting to join FieldDive.</p>
          <TeamPeopleList rows={invitedRows} selectedKey={selectedKey} testId="invited" />
        </aside>
      ) : null}
      </div>

      {canAdminMembers && removedRows.length > 0 ? (
        <section className="mt-8" aria-label="Access removed">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-expanded={showRemoved}
            onClick={() => setRemovedOpen((open) => !open)}
            disabled={removedNeedsAttention}
            data-company-settings-team-removed-toggle
          >
            Access removed · {removedRows.length}
            <ChevronDown className={`h-4 w-4 transition-transform ${showRemoved ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showRemoved ? (
            <div className="mt-2">
              <TeamPeopleList rows={removedRows} selectedKey={selectedKey} testId="removed" />
            </div>
          ) : null}
        </section>
      ) : null}

      {sheet}
    </div>
  );
}
