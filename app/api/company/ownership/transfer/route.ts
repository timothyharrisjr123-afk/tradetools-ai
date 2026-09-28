import { NextRequest, NextResponse } from "next/server";
import {
  CompanyMembershipHttpError,
  transferCompanyOwnership,
} from "@/app/lib/companyMembershipPersistence";
import { createClient } from "@/app/lib/supabase/server";

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const result = await transferCompanyOwnership({
      supabase,
      targetUserId: typeof body?.targetUserId === "string" ? body.targetUserId : "",
      formerRole: body?.formerRole,
      ownerExpectedRevision: body?.ownerExpectedRevision,
      targetExpectedRevision: body?.targetExpectedRevision,
      idempotencyKey: body?.idempotencyKey,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorJson(error);
  }
}
