import { NextRequest, NextResponse } from "next/server";
import {
  CompanyMembershipHttpError,
  listCompanyMembers,
  removeCompanyMember,
  updateCompanyMemberRole,
} from "@/app/lib/companyMembershipPersistence";
import {
  resolveLiveMembership,
  sessionHasCapability,
} from "@/app/lib/companyMembershipSession";
import {
  mapCapabilityGate,
  requireCapabilitySession,
} from "@/app/lib/requireCapabilitySession";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

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

    // Viewer identity is returned to every active member so role-restricted
    // presentation (Field) never fails open; the member list stays capability-gated.
    const resolution = await resolveLiveMembership(supabase, user.id);
    if (resolution.status !== "active") {
      const gate = mapCapabilityGate(resolution, "customers_jobs");
      const denial = gate.ok ? null : gate.denial;
      return NextResponse.json(
        { ok: false, code: denial?.code ?? "forbidden" },
        { status: denial?.status ?? 403 }
      );
    }
    const session = resolution.session;

    const canAdmin = sessionHasCapability(session, "member_admin");
    const members = sessionHasCapability(session, "customers_jobs")
      ? await listCompanyMembers({
          supabase,
          companyId: session.companyId,
          includeRemoved: canAdmin,
        })
      : [];

    return NextResponse.json({
      ok: true,
      members,
      viewerRole: session.role,
      canAdminMembers: canAdmin,
    });
  } catch (error) {
    if (error instanceof CompanyMembershipHttpError) {
      return NextResponse.json(
        { ok: false, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
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
        companyId: gated.session.companyId,
        actorUserId: user.id,
        actorRole: gated.session.role,
        targetUserId: userId,
        reassignToUserId:
          body?.reassignToUserId === undefined
            ? null
            : body.reassignToUserId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const member = await updateCompanyMemberRole({
      supabase,
      companyId: gated.session.companyId,
      actorUserId: user.id,
      actorRole: gated.session.role,
      targetUserId: userId,
      role: body?.role,
    });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    if (error instanceof CompanyMembershipHttpError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
