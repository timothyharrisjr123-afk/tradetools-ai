"use client";

import { useEffect, useMemo, useState } from "react";
import FocusedEditor, {
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
} from "@/app/components/ui/FocusedEditor";
import {
  ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES,
  COMPANY_MEMBERSHIP_ROLE_LABELS,
  isAssignableCompanyMembershipRole,
  type AssignableCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";
import type { CompanyMemberClientItem } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import { labelForCompanyMember } from "@/app/tools/roofing/jobCard/useCompanyMembers";

type CompanySettingsTeamEditorProps = {
  canAdminMembers: boolean;
  members: readonly CompanyMemberClientItem[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

export default function CompanySettingsTeamEditor({
  canAdminMembers,
  members,
  loading,
  error,
  onClose,
  onChanged,
}: CompanySettingsTeamEditorProps) {
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [reassignToUserId, setReassignToUserId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [handoffTargets, setHandoffTargets] = useState<Record<string, string>>({});

  const liveMembers = useMemo(
    () => members.filter((row) => !row.removedAt),
    [members]
  );
  const pendingHandoffs = useMemo(
    () =>
      members.filter(
        (row) =>
          row.removedAt && row.openJobLeadCount + row.openTaskAssigneeCount > 0
      ),
    [members]
  );
  const loadFailed = Boolean(error) && members.length === 0;

  const removing = liveMembers.find((row) => row.userId === removeUserId) ?? null;
  const openTotal = removing
    ? removing.openJobLeadCount + removing.openTaskAssigneeCount
    : 0;

  useEffect(() => {
    setLocalError(null);
  }, [members]);

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
      throw new Error(
        typeof body.message === "string"
          ? body.message
          : "Could not update team member."
      );
    }
    return body;
  };

  const handoffFailureMessage = (handoff: { status?: string; message?: string } | undefined) =>
    handoff?.status === "completed"
      ? null
      : typeof handoff?.message === "string" && handoff.message
        ? handoff.message
        : "Open work could not be handed off. Try again.";

  const changeRole = async (
    userId: string,
    role: AssignableCompanyMembershipRole
  ) => {
    if (!canAdminMembers) return;
    setBusyUserId(userId);
    setLocalError(null);
    try {
      await patchMember({ userId, role });
      await onChanged();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not update role.");
    } finally {
      setBusyUserId(null);
    }
  };

  const confirmRemove = async () => {
    if (!canAdminMembers || !removeUserId) return;
    setBusyUserId(removeUserId);
    setLocalError(null);
    setNotice(null);
    try {
      const body = await patchMember({
        userId: removeUserId,
        action: "remove",
        reassignToUserId: reassignToUserId.trim() || null,
      });
      setRemoveUserId(null);
      setReassignToUserId("");
      const handoffError = handoffFailureMessage(body.handoff);
      if (handoffError) {
        setNotice(`Access removed. ${handoffError}`);
      }
      await onChanged();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Could not remove team member."
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const retryHandoff = async (userId: string) => {
    if (!canAdminMembers) return;
    setBusyUserId(userId);
    setLocalError(null);
    setNotice(null);
    try {
      const body = await patchMember({
        userId,
        action: "handoff",
        reassignToUserId: handoffTargets[userId]?.trim() || null,
      });
      const handoffError = handoffFailureMessage(body.handoff);
      if (handoffError) setLocalError(handoffError);
      await onChanged();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Open work could not be handed off. Try again."
      );
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <FocusedEditor
      open
      title="Team"
      description="Who can work this company’s jobs — keep it simple."
      dirty={Boolean(removeUserId)}
      saving={Boolean(busyUserId)}
      readOnly
      error={localError || error}
      onClose={onClose}
    >
      <div data-company-settings-editor="team" className="space-y-3">
        {notice ? (
          <p
            className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-900"
            data-company-settings-team-notice
          >
            {notice}
          </p>
        ) : null}
        {loading ? (
          <p className={FOCUSED_EDITOR_HINT}>Loading team…</p>
        ) : loadFailed ? (
          <p className={FOCUSED_EDITOR_HINT} data-company-settings-team-unavailable>
            Team members are unavailable right now.
          </p>
        ) : liveMembers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-800">No team members yet</p>
            <p className={`${FOCUSED_EDITOR_HINT} mt-1`}>
              Invite people when you’re ready to share jobs.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" data-company-settings-team-list>
            {liveMembers.map((member) => {
              const name = labelForCompanyMember(member.userId, liveMembers);
              const openJobs = member.openJobLeadCount;
              const openTasks = member.openTaskAssigneeCount;
              return (
                <li key={member.userId} className="py-3.5" data-company-settings-team-row>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tracking-tight text-slate-950">
                        {name}
                      </p>
                      {member.email && member.email !== name ? (
                        <p className="mt-0.5 text-xs text-slate-500">{member.email}</p>
                      ) : null}
                      {(openJobs > 0 || openTasks > 0) && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          {openJobs > 0 ? `${openJobs} job lead${openJobs === 1 ? "" : "s"}` : null}
                          {openJobs > 0 && openTasks > 0 ? " · " : null}
                          {openTasks > 0
                            ? `${openTasks} open task${openTasks === 1 ? "" : "s"}`
                            : null}
                        </p>
                      )}
                    </div>
                    {canAdminMembers && member.role !== "owner" ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <label className="block">
                          <span className="sr-only">Role</span>
                          <select
                            className="min-h-[36px] rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            value={member.role}
                            disabled={busyUserId === member.userId}
                            onChange={(event) => {
                              const role = event.target.value;
                              if (!isAssignableCompanyMembershipRole(role)) return;
                              void changeRole(member.userId, role);
                            }}
                            data-company-settings-team-preset
                          >
                            {member.role === "invalid_role" ? (
                              <option value="invalid_role" disabled>
                                {COMPANY_MEMBERSHIP_ROLE_LABELS.invalid_role}
                              </option>
                            ) : null}
                            {ASSIGNABLE_COMPANY_MEMBERSHIP_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {COMPANY_MEMBERSHIP_ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="min-h-[36px] px-2 text-sm text-slate-400 hover:text-rose-700"
                          disabled={busyUserId === member.userId}
                          onClick={() => {
                            setRemoveUserId(member.userId);
                            setReassignToUserId("");
                            setLocalError(null);
                          }}
                          data-company-settings-team-remove
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-slate-600">
                        {COMPANY_MEMBERSHIP_ROLE_LABELS[member.role] ??
                          COMPANY_MEMBERSHIP_ROLE_LABELS.invalid_role}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canAdminMembers && removing ? (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3"
            data-company-settings-team-remove-confirm
          >
            <p className={FOCUSED_EDITOR_LABEL}>
              Remove {labelForCompanyMember(removing.userId, liveMembers)}?
            </p>
            <p className={FOCUSED_EDITOR_HINT}>
              {openTotal > 0
                ? `They have ${removing.openJobLeadCount} open job lead${
                    removing.openJobLeadCount === 1 ? "" : "s"
                  } and ${removing.openTaskAssigneeCount} open task assignment${
                    removing.openTaskAssigneeCount === 1 ? "" : "s"
                  }. Reassign or leave Unassigned.`
                : "Open assignments will be cleared to Unassigned."}
            </p>
            {openTotal > 0 ? (
              <label className="mt-2 block">
                <span className={FOCUSED_EDITOR_LABEL}>Reassign open work to</span>
                <select
                  className={FOCUSED_EDITOR_INPUT}
                  value={reassignToUserId}
                  onChange={(event) => setReassignToUserId(event.target.value)}
                  data-company-settings-team-reassign
                >
                  <option value="">Unassigned</option>
                  {liveMembers
                    .filter((row) => row.userId !== removing.userId)
                    .map((row) => (
                      <option key={row.userId} value={row.userId}>
                        {labelForCompanyMember(row.userId, liveMembers)}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-[44px] rounded-md bg-rose-700 px-3 text-sm font-semibold text-white hover:bg-rose-800"
                disabled={busyUserId === removing.userId}
                onClick={() => void confirmRemove()}
              >
                Confirm remove
              </button>
              <button
                type="button"
                className="min-h-[44px] px-3 text-sm text-slate-600 hover:text-slate-900"
                onClick={() => {
                  setRemoveUserId(null);
                  setReassignToUserId("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {canAdminMembers && !loading && pendingHandoffs.length > 0 ? (
          <div className="space-y-2" data-company-settings-team-pending-handoff>
            <p className={FOCUSED_EDITOR_LABEL}>Open work still assigned</p>
            {pendingHandoffs.map((row) => (
              <div
                key={row.userId}
                className="rounded-lg border border-slate-200 px-3 py-2.5"
              >
                <p className="text-sm text-slate-800">
                  {labelForCompanyMember(row.userId, members)} no longer has access ·{" "}
                  {row.openJobLeadCount + row.openTaskAssigneeCount} open item
                  {row.openJobLeadCount + row.openTaskAssigneeCount === 1 ? "" : "s"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className={FOCUSED_EDITOR_INPUT}
                    value={handoffTargets[row.userId] ?? ""}
                    onChange={(event) =>
                      setHandoffTargets((prev) => ({
                        ...prev,
                        [row.userId]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {liveMembers.map((live) => (
                      <option key={live.userId} value={live.userId}>
                        {labelForCompanyMember(live.userId, liveMembers)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="min-h-[40px] rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    disabled={busyUserId === row.userId}
                    onClick={() => void retryHandoff(row.userId)}
                  >
                    Hand off open work
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!canAdminMembers ? (
          <p className={FOCUSED_EDITOR_HINT}>
            Only the company owner can change roles or remove members.
          </p>
        ) : null}
      </div>
    </FocusedEditor>
  );
}
