import { NextResponse } from "next/server";
import { getApprovalRecord } from "@/app/lib/kv";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();
  if (!token)
    return NextResponse.json(
      { success: false, error: "Missing token" },
      { status: 400 }
    );

  const rec = await getApprovalRecord(token);
  if (!rec)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );

  const status = rec.approvedAt ? "approved" : "sent_pending";
  return NextResponse.json({
    success: true,
    record: {
      token: rec.token,
      status,
      createdAt: rec.createdAt,
      approvedAt: rec.approvedAt ?? null,
      savedEstimateId: rec.estimateId ?? null,
      customerName: rec.customerName,
      customerEmail: rec.customerEmail,
      job: rec.addressLine ? { addressLine: rec.addressLine } : undefined,
      tierLabel: rec.tierLabel,
      totalFormatted: rec.total != null ? `$${rec.total.toLocaleString()}` : undefined,
    },
  });
}
