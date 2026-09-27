/**
 * Membership-only gate for ordinary member reads. Capability gates use
 * app/lib/access/requireAccess (database policy engine).
 */

import type {
  LiveMembershipResolution,
  LiveMembershipSession,
} from "@/app/lib/companyMembershipSession";

export type CapabilityGateDenial = {
  status: 403 | 503;
  code: "forbidden" | "invalid_role" | "capability_denied" | "authorization_unavailable";
};

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
