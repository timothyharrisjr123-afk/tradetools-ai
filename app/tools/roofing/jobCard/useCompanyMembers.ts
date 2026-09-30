"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isRestrictedFieldRole,
  resolveCompanyMembershipRole,
  type ResolvedCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";
import {
  TEAM_MEMBERS_UNAVAILABLE,
  contractorFacingMessage,
} from "@/app/lib/access/teamAccessPresentation";
import {
  NO_VIEWER_ACCESS,
  type ViewerAccessFlags,
} from "@/app/lib/access/viewerAccess";

/** Client mirror of company members API rows (not imported from server-only persistence). */
export type CompanyMemberClientItem = {
  userId: string;
  role: ResolvedCompanyMembershipRole;
  displayName: string | null;
  email: string | null;
  removedAt: string | null;
  openJobLeadCount: number;
  openTaskAssigneeCount: number;
  /** Present for Team admins; sent back as the expected revision on access changes. */
  accessRevision: number | null;
  /** Access-admin only. Never rendered as raw keys. */
  packageKeys?: string[];
  grantedJobCount?: number;
  restrictionCount?: number;
};

export type CompanyMembersClientState = ViewerAccessFlags & {
  members: CompanyMemberClientItem[];
  liveMembers: CompanyMemberClientItem[];
  viewerRole: ResolvedCompanyMembershipRole | null;
  /** Signed-in user. Used to hide self-edits. Not shown. */
  viewerUserId: string | null;
  /**
   * Restricted (non-commercial) presentation: Field role, invalid role, or no
   * commercial read access. Presentation only; data access is enforced by the database.
   */
  restrictedFieldRole: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  labelFor: (userId: string | null | undefined, fallbackName?: string | null) => string;
};

function memberDisplayName(member: {
  displayName?: string | null;
  email?: string | null;
}): string | null {
  const name = String(member.displayName ?? "").trim();
  if (name) return name;
  const email = String(member.email ?? "").trim();
  return email || null;
}

export type TaskAssigneeCandidate = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
};

/**
 * People a task can be assigned to: the company directory (company-wide viewers)
 * plus the job's own people from the Field brief (coordinator and current task
 * assignees), which is all a Lead may see.
 */
export function taskAssigneeCandidates(
  liveMembers: readonly TaskAssigneeCandidate[],
  jobPeople: readonly { userId: string; displayName: string | null }[] | null | undefined
): TaskAssigneeCandidate[] {
  const out: TaskAssigneeCandidate[] = [...liveMembers];
  const seen = new Set(out.map((row) => row.userId));
  for (const person of jobPeople ?? []) {
    if (seen.has(person.userId)) continue;
    seen.add(person.userId);
    out.push({ userId: person.userId, displayName: person.displayName });
  }
  return out;
}

export function labelForCompanyMember(
  userId: string | null | undefined,
  members: readonly { userId: string; displayName?: string | null; email?: string | null }[],
  fallbackName?: string | null
): string {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) return "Unassigned";
  const match = members.find((row) => row.userId === id);
  const named =
    (match ? memberDisplayName(match) : null) ||
    (typeof fallbackName === "string" ? fallbackName.trim() : "") ||
    "";
  return named || "Team member";
}

function parseViewerAccess(value: unknown): ViewerAccessFlags {
  if (!value || typeof value !== "object" || Array.isArray(value)) return NO_VIEWER_ACCESS;
  const raw = value as Record<string, unknown>;
  const flags = { ...NO_VIEWER_ACCESS };
  for (const key of Object.keys(flags) as (keyof ViewerAccessFlags)[]) {
    flags[key] = raw[key] === true;
  }
  return flags;
}

export function useCompanyMembers(
  enabled = true,
  jobId?: string | null
): CompanyMembersClientState {
  const [members, setMembers] = useState<CompanyMemberClientItem[]>([]);
  const [viewerRole, setViewerRole] = useState<ResolvedCompanyMembershipRole | null>(
    null
  );
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerAccess, setViewerAccess] = useState<ViewerAccessFlags>(NO_VIEWER_ACCESS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopedJobId = typeof jobId === "string" ? jobId.trim() : "";

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const query = scopedJobId ? `?jobId=${encodeURIComponent(scopedJobId)}` : "";
      const res = await fetch(`/api/company/members${query}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: unknown;
        message?: unknown;
        members?: CompanyMemberClientItem[];
        viewerRole?: unknown;
        viewerUserId?: unknown;
        viewerAccess?: unknown;
      };
      if (!res.ok || body.ok !== true) {
        setViewerAccess(NO_VIEWER_ACCESS);
        setViewerUserId(null);
        setError(contractorFacingMessage(body.code, body.message, TEAM_MEMBERS_UNAVAILABLE));
        return;
      }
      setMembers(
        Array.isArray(body.members)
          ? body.members.map((member) => ({
              ...member,
              packageKeys: Array.isArray(member.packageKeys)
                ? member.packageKeys.filter((key) => typeof key === "string")
                : [],
              grantedJobCount:
                typeof member.grantedJobCount === "number" && member.grantedJobCount >= 0
                  ? member.grantedJobCount
                  : 0,
              restrictionCount:
                typeof member.restrictionCount === "number" && member.restrictionCount >= 0
                  ? member.restrictionCount
                  : 0,
            }))
          : []
      );
      setViewerRole(
        body.viewerRole == null ? null : resolveCompanyMembershipRole(body.viewerRole)
      );
      setViewerUserId(typeof body.viewerUserId === "string" ? body.viewerUserId : null);
      setViewerAccess(parseViewerAccess(body.viewerAccess));
    } catch {
      setViewerAccess(NO_VIEWER_ACCESS);
      setViewerUserId(null);
      setError(TEAM_MEMBERS_UNAVAILABLE);
    } finally {
      setLoading(false);
    }
  }, [enabled, scopedJobId]);

  useEffect(() => {
    if (!enabled) {
      setMembers([]);
      setViewerRole(null);
      setViewerUserId(null);
      setViewerAccess(NO_VIEWER_ACCESS);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const liveMembers = useMemo(
    () => members.filter((row) => !row.removedAt),
    [members]
  );

  const labelFor = useCallback(
    (userId: string | null | undefined, fallbackName?: string | null) =>
      labelForCompanyMember(userId, liveMembers, fallbackName),
    [liveMembers]
  );

  return {
    ...viewerAccess,
    members,
    liveMembers,
    viewerRole,
    viewerUserId,
    restrictedFieldRole:
      viewerRole != null &&
      (isRestrictedFieldRole(viewerRole) || !viewerAccess.canReadCommercial),
    loading,
    error,
    refresh,
    labelFor,
  };
}
