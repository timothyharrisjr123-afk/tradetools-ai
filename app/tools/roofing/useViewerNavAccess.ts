"use client";

import { useEffect, useState } from "react";
import { NO_VIEWER_ACCESS, type ViewerAccessFlags } from "@/app/lib/access/viewerAccess";
import type { FieldDiveNavItemKey } from "./fieldDiveNavConfig";

/**
 * Presentation only: which navigation entries the signed-in member can use.
 * Unknown access offers nothing gated; every action is still authorized server-side.
 */
let lastKnown: ViewerAccessFlags | null = null;

export function navItemAllowed(key: FieldDiveNavItemKey | null, access: ViewerAccessFlags | null): boolean {
  // People who run the work company-wide: team administrators and company-scope job
  // assigners. Job creation alone (Sales) and job-scoped access (Lead, Field) do not
  // advertise Team. Presentation only; the members endpoint controls every projection.
  if (key === "team") return Boolean(access && (access.canAdminMembers || access.canAssignJobs));
  if (key === "newJob") return Boolean(access?.canCreateJobs);
  if (key === "pricing" || key === "catalog" || key === "templates") {
    return Boolean(
      access && (access.canReadCommercial || access.canManagePricing || access.canManageTemplates)
    );
  }
  return true;
}

export function useViewerNavAccess(): ViewerAccessFlags | null {
  const [access, setAccess] = useState<ViewerAccessFlags | null>(lastKnown);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/company/members?view=viewer", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; viewerAccess?: unknown };
        const raw =
          res.ok && body.ok === true && body.viewerAccess && typeof body.viewerAccess === "object"
            ? (body.viewerAccess as Record<string, unknown>)
            : null;
        const next = raw
          ? (Object.fromEntries(
              Object.keys(NO_VIEWER_ACCESS).map((key) => [key, raw[key] === true])
            ) as ViewerAccessFlags)
          : null;
        lastKnown = next;
        if (!cancelled) setAccess(next);
      } catch {
        lastKnown = null;
        if (!cancelled) setAccess(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return access;
}
