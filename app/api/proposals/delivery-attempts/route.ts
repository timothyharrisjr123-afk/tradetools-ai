import { NextRequest, NextResponse } from "next/server";
import { getProposalDeliveryHistoryForContractor } from "@/app/lib/proposalDeliveryHistory.server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const proposalId = req.nextUrl.searchParams.get("proposalId")?.trim() ?? "";
    const jobId = req.nextUrl.searchParams.get("jobId")?.trim() ?? "";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const result = await getProposalDeliveryHistoryForContractor({
      companyId,
      proposalId,
      jobId: jobId.length > 0 ? jobId : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
