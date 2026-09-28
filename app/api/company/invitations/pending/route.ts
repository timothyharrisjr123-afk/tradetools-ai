import { NextResponse } from "next/server";
import { requireAccess } from "@/app/lib/access/requireAccess";
import { TEAM_INVITATIONS_UNAVAILABLE } from "@/app/lib/access/teamAccessPresentation";
import { listPendingCompanyInvitations } from "@/app/lib/invitations/invitationActions.server";
import { resolveLiveMembership } from "@/app/lib/companyMembershipSession";
import { mapActiveMembershipGate } from "@/app/lib/requireCapabilitySession";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Pending invitations for the signed-in company. Company id comes from the
 * live membership after team.manage. The request cannot choose a company.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });

  const gated = await requireAccess(supabase, user.id, "team.manage");
  if (!gated.ok) return gated.response;

  const gate = mapActiveMembershipGate(await resolveLiveMembership(supabase, user.id));
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, code: gate.denial.code },
      { status: gate.denial.status }
    );
  }

  const listed = await listPendingCompanyInvitations(gate.session.companyId);
  if (!listed.ok) {
    return NextResponse.json(
      { ok: false, code: "invitations_unavailable", message: TEAM_INVITATIONS_UNAVAILABLE },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, invitations: listed.invitations });
}
