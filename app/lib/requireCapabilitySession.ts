/**
 * Route helper: require live membership + capability for G7-sensitive mutations.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyCapability } from "@/app/lib/companyMembershipRoles";
import {
  loadLiveMembershipSession,
  sessionHasCapability,
  type LiveMembershipSession,
} from "@/app/lib/companyMembershipSession";

export async function requireCapabilitySession(
  supabase: SupabaseClient,
  userId: string,
  capability: CompanyCapability
): Promise<
  | { ok: true; session: LiveMembershipSession }
  | { ok: false; response: NextResponse }
> {
  const session = await loadLiveMembershipSession(supabase, userId);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: "forbidden", error: "Forbidden." },
        { status: 403 }
      ),
    };
  }
  if (!sessionHasCapability(session, capability)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: "capability_denied", error: "Forbidden." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, session };
}
