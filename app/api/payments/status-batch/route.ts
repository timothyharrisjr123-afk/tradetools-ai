import { NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  getDerivedPaymentStateFromSupabase,
  type DerivedPaymentState,
} from "@/app/lib/paymentsTable";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

const MAX_BATCH = 100;

function parseEstimateIds(req: NextRequest): string[] {
  const fromQuery = (req.nextUrl.searchParams.get("estimateIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (fromQuery.length > 0) return fromQuery;
  return [];
}

export async function GET(req: NextRequest) {
  const estimateIds = parseEstimateIds(req);
  if (estimateIds.length === 0) {
    return Response.json({ ok: false, error: "Missing estimateIds" }, { status: 400 });
  }
  if (estimateIds.length > MAX_BATCH) {
    return Response.json({ ok: false, error: "Too many estimateIds" }, { status: 400 });
  }
  for (const id of estimateIds) {
    if (!isUuidLike(id)) {
      return Response.json({ ok: false, error: "Invalid estimateId" }, { status: 400 });
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: estimates, error: estimateError } = await supabase
    .from("estimates")
    .select("id, suggested_price, job_cost")
    .eq("company_id", companyId)
    .in("id", estimateIds);

  if (estimateError) {
    return Response.json({ ok: false, error: "Estimate lookup failed" }, { status: 500 });
  }

  const byId = new Map(
    (estimates ?? []).map((row) => [String(row.id), row])
  );
  const payments: Record<string, DerivedPaymentState | null> = {};

  await Promise.all(
    estimateIds.map(async (estimateId) => {
      const estimate = byId.get(estimateId);
      if (!estimate) {
        payments[estimateId] = null;
        return;
      }
      const estimateTotal =
        Number(estimate.suggested_price ?? estimate.job_cost ?? 0) || 0;
      const estimateTotalCents = Math.round(estimateTotal * 100);
      payments[estimateId] = await getDerivedPaymentStateFromSupabase({
        supabase,
        companyId,
        estimateId,
        estimateTotalCents,
      });
    })
  );

  return Response.json({ ok: true, payments });
}

export async function POST(req: NextRequest) {
  let body: { estimateIds?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const estimateIds = Array.isArray(body.estimateIds)
    ? body.estimateIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  if (estimateIds.length === 0) {
    return Response.json({ ok: false, error: "Missing estimateIds" }, { status: 400 });
  }
  if (estimateIds.length > MAX_BATCH) {
    return Response.json({ ok: false, error: "Too many estimateIds" }, { status: 400 });
  }
  for (const id of estimateIds) {
    if (!isUuidLike(id)) {
      return Response.json({ ok: false, error: "Invalid estimateId" }, { status: 400 });
    }
  }

  const url = new URL(req.url);
  url.searchParams.set("estimateIds", estimateIds.join(","));
  return GET(new NextRequest(url.toString(), { method: "GET" }));
}
