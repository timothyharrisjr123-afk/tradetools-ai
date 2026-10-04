import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { runTeamBoardAction, TeamBoardHttpError } from "@/app/lib/team/teamBoardPersistence";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const result = await runTeamBoardAction(supabase, body as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof TeamBoardHttpError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message, ...error.details }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
