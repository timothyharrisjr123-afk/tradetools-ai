"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  capabilitiesForRole,
  isRestrictedFieldRole,
  resolveCompanyMembershipRole,
  type ResolvedCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";

/** Client mirror of company members API rows (not imported from server-only persistence). */
export type CompanyMemberClientItem = {
  userId: string;
  role: ResolvedCompanyMembershipRole;
  displayName: string | null;
  email: string | null;
  removedAt: string | null;
  openJobLeadCount: number;
  openTaskAssigneeCount: number;
};

export type CompanyMembersClientState = {
  members: CompanyMemberClientItem[];
  liveMembers: CompanyMemberClientItem[];
  viewerRole: ResolvedCompanyMembershipRole | null;
  canAdminMembers: boolean;
  canAssignJobs: boolean;
  canAssignTasks: boolean;
  /** Astra G8 — Hold / Resume. */
  canPauseResume: boolean;
  /** Astra G8 — Lost / Close / Reopen. */
  canFinalizeDisposition: boolean;
  /** Astra G9 — propose / price / send scope changes (proposal_author). */
  canAuthorProposals: boolean;
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

export function useCompanyMembers(enabled = true): CompanyMembersClientState {
  const [members, setMembers] = useState<CompanyMemberClientItem[]>([]);
  const [viewerRole, setViewerRole] = useState<ResolvedCompanyMembershipRole | null>(
    null
  );
  const [canAdminMembers, setCanAdminMembers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/company/members", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        members?: CompanyMemberClientItem[];
        viewerRole?: unknown;
        canAdminMembers?: boolean;
      };
      if (!res.ok || body.ok !== true) {
        setError("Team could not be loaded.");
        return;
      }
      setMembers(Array.isArray(body.members) ? body.members : []);
      setViewerRole(
        body.viewerRole == null ? null : resolveCompanyMembershipRole(body.viewerRole)
      );
      setCanAdminMembers(body.canAdminMembers === true);
    } catch {
      setError("Team could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setMembers([]);
      setViewerRole(null);
      setCanAdminMembers(false);
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

  const caps = viewerRole != null ? capabilitiesForRole(viewerRole) : null;

  return {
    members,
    liveMembers,
    viewerRole,
    canAdminMembers,
    canAssignJobs: caps?.has("job_assign") === true,
    canAssignTasks: caps?.has("task_assign") === true,
    canPauseResume: caps?.has("job_pause_resume") === true,
    canFinalizeDisposition: caps?.has("job_disposition_finalize") === true,
    canAuthorProposals: caps?.has("proposal_author") === true,
    restrictedFieldRole: viewerRole != null && isRestrictedFieldRole(viewerRole),
    loading,
    error,
    refresh,
    labelFor,
  };
}
