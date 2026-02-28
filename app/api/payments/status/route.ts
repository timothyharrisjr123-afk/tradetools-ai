import { NextRequest } from "next/server";
import { getPaymentState } from "@/app/lib/stripePayments";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const estimateId = req.nextUrl.searchParams.get("estimateId")?.trim();
  if (!estimateId) {
    return Response.json({ ok: false, error: "Missing estimateId" }, { status: 400 });
  }

  const payment = await getPaymentState(estimateId);
  return Response.json({ ok: true, payment });
}
