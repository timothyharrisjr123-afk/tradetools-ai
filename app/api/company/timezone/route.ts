import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("companies")
    .select("timezone")
    .eq("id", companyId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
  const timezone = String((data as { timezone?: string | null } | null)?.timezone ?? "").trim();
  return NextResponse.json({
    ok: true,
    timezone: timezone || null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { setCompanyTimezoneViaRpc } = await import("@/app/lib/jobSchedulePersistence");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }
    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const timezone = typeof body?.timezone === "string" ? body.timezone.trim() : "";
    if (!timezone) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const result = await setCompanyTimezoneViaRpc(supabase, companyId, timezone);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const { JobSchedulePersistenceError } = await import("@/app/lib/jobSchedulePersistence");
    if (error instanceof JobSchedulePersistenceError) {
      return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
