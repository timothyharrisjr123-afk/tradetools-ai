import { NextRequest, NextResponse } from "next/server";
import {
  CompanyMembershipHttpError,
  listCompanyMembers,
  removeCompanyMember,
  updateCompanyMemberPreset,
} from "@/app/lib/companyMembershipPersistence";
import { requireCapabilitySession } from "@/app/lib/requireCapabilitySession";
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

    const gated = await requireCapabilitySession(
      supabase,
      user.id,
      "customers_jobs"
    );
    if (!gated.ok) return gated.response;

    const canAdmin = gated.session.preset === "owner_admin";
    const members = await listCompanyMembers({
      supabase,
      companyId: gated.session.companyId,
      includeRemoved: canAdmin,
    });

    return NextResponse.json({
      ok: true,
      members,
      viewerPreset: gated.session.preset,
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
        targetUserId: userId,
        reassignToUserId:
          body?.reassignToUserId === undefined
            ? null
            : body.reassignToUserId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const member = await updateCompanyMemberPreset({
      supabase,
      companyId: gated.session.companyId,
      actorUserId: user.id,
      targetUserId: userId,
      preset: String(body?.preset ?? ""),
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
