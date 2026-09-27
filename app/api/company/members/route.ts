import { NextRequest, NextResponse } from "next/server";
import {
  CompanyMembershipHttpError,
  directoryRowsToMemberItems,
  handoffMemberOpenWork,
  listCompanyAccessAdmin,
  listCompanyDirectory,
  removeCompanyMember,
  updateCompanyMemberRole,
} from "@/app/lib/companyMembershipPersistence";
import {
  resolveLiveMembership,
  sessionHasCapability,
} from "@/app/lib/companyMembershipSession";
import {
  mapActiveMembershipGate,
  requireCapabilitySession,
} from "@/app/lib/requireCapabilitySession";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

function errorJson(error: unknown) {
  if (error instanceof CompanyMembershipHttpError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status }
    );
  }
  return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, code: "unauthorized" },
        { status: 401 }
      );
    }

    // Every active member gets viewer identity + the ordinary directory (names and
    // role labels). Emails, disabled members, and open-work counts are access-admin only.
    const gate = mapActiveMembershipGate(await resolveLiveMembership(supabase, user.id));
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, code: gate.denial.code },
        { status: gate.denial.status }
      );
    }
    const session = gate.session;

    const canAdmin = sessionHasCapability(session, "member_admin");
    const members = canAdmin
      ? await listCompanyAccessAdmin(supabase)
      : directoryRowsToMemberItems(await listCompanyDirectory(supabase));

    return NextResponse.json({
      ok: true,
      members,
      viewerRole: session.role,
      canAdminMembers: canAdmin,
    });
  } catch (error) {
    return errorJson(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, code: "unauthorized" },
        { status: 401 }
      );
    }

    const gated = await requireCapabilitySession(supabase, user.id, "member_admin");
    if (!gated.ok) return gated.response;

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    if (!isUuidLike(userId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    if (body?.action === "remove") {
      const result = await removeCompanyMember({
        supabase,
        actorUserId: user.id,
        targetUserId: userId,
        reassignToUserId: body?.reassignToUserId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body?.action === "handoff") {
      const handoff = await handoffMemberOpenWork({
        supabase,
        targetUserId: userId,
        reassignToUserId: body?.reassignToUserId,
      });
      return NextResponse.json({ ok: true, removedUserId: userId, handoff });
    }

    const member = await updateCompanyMemberRole({
      supabase,
      targetUserId: userId,
      role: body?.role,
    });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return errorJson(error);
  }
}
