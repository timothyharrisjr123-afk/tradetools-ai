"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isRestrictedFieldRole,
  resolveCompanyMembershipRole,
  type ResolvedCompanyMembershipRole,
} from "@/app/lib/companyMembershipRoles";
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
};

export type CompanyMembersClientState = ViewerAccessFlags & {
  members: CompanyMemberClientItem[];
  liveMembers: CompanyMemberClientItem[];
  viewerRole: ResolvedCompanyMembershipRole | null;
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
        members?: CompanyMemberClientItem[];
        viewerRole?: unknown;
        viewerAccess?: unknown;
      };
      if (!res.ok || body.ok !== true) {
        setViewerAccess(NO_VIEWER_ACCESS);
        setError("Team could not be loaded.");
        return;
      }
      setMembers(Array.isArray(body.members) ? body.members : []);
      setViewerRole(
        body.viewerRole == null ? null : resolveCompanyMembershipRole(body.viewerRole)
      );
      setViewerAccess(parseViewerAccess(body.viewerAccess));
    } catch {
      setViewerAccess(NO_VIEWER_ACCESS);
      setError("Team could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [enabled, scopedJobId]);

  useEffect(() => {
    if (!enabled) {
      setMembers([]);
      setViewerRole(null);
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
    restrictedFieldRole:
      viewerRole != null &&
      (isRestrictedFieldRole(viewerRole) || !viewerAccess.canReadCommercial),
    loading,
    error,
    refresh,
    labelFor,
  };
}
