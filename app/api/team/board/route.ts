import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { loadTeamBoard, TeamBoardHttpError } from "@/app/lib/team/teamBoardPersistence";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }
    const snapshot = await loadTeamBoard(supabase);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    if (error instanceof TeamBoardHttpError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
