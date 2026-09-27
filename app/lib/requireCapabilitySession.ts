/**
 * Route helper: require live membership + capability for G7-sensitive mutations.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyCapability } from "@/app/lib/companyMembershipRoles";
import {
  resolveLiveMembership,
  sessionHasCapability,
  type LiveMembershipResolution,
  type LiveMembershipSession,
} from "@/app/lib/companyMembershipSession";

export type CapabilityGateDenial = {
  status: 403 | 503;
  code: "forbidden" | "invalid_role" | "capability_denied" | "authorization_unavailable";
};

export function mapCapabilityGate(
  resolution: LiveMembershipResolution,
  capability: CompanyCapability
): { ok: true; session: LiveMembershipSession } | { ok: false; denial: CapabilityGateDenial } {
  switch (resolution.status) {
    case "unavailable":
      return { ok: false, denial: { status: 503, code: "authorization_unavailable" } };
    case "invalid_role":
      return { ok: false, denial: { status: 403, code: "invalid_role" } };
    case "none":
    case "removed":
      return { ok: false, denial: { status: 403, code: "forbidden" } };
    case "active":
      if (!sessionHasCapability(resolution.session, capability)) {
        return { ok: false, denial: { status: 403, code: "capability_denied" } };
      }
      return { ok: true, session: resolution.session };
  }
}

/** Active, valid-role membership without a capability requirement (ordinary member reads). */
export function mapActiveMembershipGate(
  resolution: LiveMembershipResolution
): { ok: true; session: LiveMembershipSession } | { ok: false; denial: CapabilityGateDenial } {
  switch (resolution.status) {
    case "unavailable":
      return { ok: false, denial: { status: 503, code: "authorization_unavailable" } };
    case "invalid_role":
      return { ok: false, denial: { status: 403, code: "invalid_role" } };
    case "none":
    case "removed":
      return { ok: false, denial: { status: 403, code: "forbidden" } };
    case "active":
      return { ok: true, session: resolution.session };
  }
}

export async function requireCapabilitySession(
  supabase: SupabaseClient,
  userId: string,
  capability: CompanyCapability
): Promise<
  | { ok: true; session: LiveMembershipSession }
  | { ok: false; response: NextResponse }
> {
  const gate = mapCapabilityGate(
    await resolveLiveMembership(supabase, userId),
    capability
  );
  if (gate.ok) return gate;
  const error =
    gate.denial.code === "authorization_unavailable"
      ? "Access could not be verified. Try again."
      : "Forbidden.";
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, code: gate.denial.code, error },
      { status: gate.denial.status }
    ),
  };
}
