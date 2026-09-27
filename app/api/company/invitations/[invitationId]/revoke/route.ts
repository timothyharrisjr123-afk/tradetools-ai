import { NextResponse } from "next/server";
import { revokeCompanyInvitation } from "@/app/lib/invitations/invitationActions.server";
import { createClient } from "@/app/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ invitationId: string }> }
) {
  const { invitationId } = await context.params;
  if (!UUID.test(invitationId)) {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });

  const result = await revokeCompanyInvitation(invitationId);
  if (!result.ok) {
    const status = result.unavailable ? 503 : 403;
    return NextResponse.json({ ok: false, code: result.code }, { status });
  }
  return NextResponse.json({ ok: true, invitationId: result.invitationId });
}
