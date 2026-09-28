import { NextRequest, NextResponse } from "next/server";
import {
  CompanyMembershipHttpError,
  directoryRowsToMemberItems,
  handoffMemberOpenWork,
  listCompanyAccessAdmin,
  listCompanyDirectory,
  reactivateCompanyMember,
  removeCompanyMember,
  updateCompanyMemberRole,
} from "@/app/lib/companyMembershipPersistence";
import { resolveLiveMembership } from "@/app/lib/companyMembershipSession";
import { mapActiveMembershipGate } from "@/app/lib/requireCapabilitySession";
import { requireAccess } from "@/app/lib/access/requireAccess";
import { loadViewerAccess } from "@/app/lib/access/viewerAccess";
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

export async function GET(req: NextRequest) {
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

    // Every active member gets viewer identity + the directory the database allows
    // (Field: self only). Emails, disabled members, revisions, and open-work counts are
    // team.manage only. Viewer flags are booleans derived from effective access.
    const gate = mapActiveMembershipGate(await resolveLiveMembership(supabase, user.id));
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, code: gate.denial.code },
        { status: gate.denial.status }
      );
    }
    const session = gate.session;

    const jobId = req.nextUrl.searchParams.get("jobId")?.trim() ?? "";
    const viewerAccess = await loadViewerAccess(supabase, isUuidLike(jobId) ? jobId : null);
    if (!viewerAccess) {
      return NextResponse.json(
        { ok: false, code: "authorization_unavailable", message: "Team could not be loaded. Try again." },
        { status: 503 }
      );
    }
    const members = viewerAccess.canAdminMembers
      ? await listCompanyAccessAdmin(supabase)
      : directoryRowsToMemberItems(await listCompanyDirectory(supabase));

    return NextResponse.json({
      ok: true,
      members,
      viewerRole: session.role,
      canAdminMembers: viewerAccess.canAdminMembers,
      viewerAccess,
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

    const gated = await requireAccess(supabase, user.id, "team.manage");
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
        expectedRevision: body?.expectedRevision,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body?.action === "reactivate") {
      const member = await reactivateCompanyMember({
        supabase,
        targetUserId: userId,
        role: body?.role,
        packages: body?.packages,
        jobIds: body?.jobIds,
        expectedRevision: body?.expectedRevision,
        idempotencyKey: body?.idempotencyKey,
      });
      return NextResponse.json({ ok: true, member });
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
      expectedRevision: body?.expectedRevision,
    });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return errorJson(error);
  }
}
