import { NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { getDerivedPaymentStateFromSupabase } from "@/app/lib/paymentsTable";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const estimateId = req.nextUrl.searchParams.get("estimateId")?.trim();
  if (!estimateId) {
    return Response.json({ ok: false, error: "Missing estimateId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id, suggested_price, job_cost")
    .eq("id", estimateId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (estimateError || !estimate) {
    return Response.json({ ok: false, error: "Estimate not found" }, { status: 404 });
  }

  const estimateTotal = Number(estimate.suggested_price ?? estimate.job_cost ?? 0) || 0;
  const estimateTotalCents = Math.round(estimateTotal * 100);

  const payment = await getDerivedPaymentStateFromSupabase({
    supabase,
    companyId,
    estimateId,
    estimateTotalCents,
  });

  return Response.json({ ok: true, payment });
}
