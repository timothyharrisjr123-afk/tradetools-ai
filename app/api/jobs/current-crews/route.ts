import { NextRequest, NextResponse } from "next/server";
import { CurrentCrewReadError, JOB_CURRENT_CREWS_MAX_JOBS, loadJobCurrentCrews } from "@/app/lib/crew/currentCrew";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Current Crew(s) for many Jobs: GET ?ids=<uuid>,<uuid>. The database returns only Jobs
 * the caller can read (jobs.read per Job, same company); others are simply absent.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length > JOB_CURRENT_CREWS_MAX_JOBS) {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }
  try {
    const jobs = await loadJobCurrentCrews(supabase, ids);
    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    const code = error instanceof CurrentCrewReadError ? error.code : "unavailable";
    const status = code === "forbidden" ? 403 : code === "invalid_payload" ? 400 : 503;
    return NextResponse.json({ ok: false, code }, { status });
  }
}
