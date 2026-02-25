import { NextResponse } from "next/server";
import { getApprovalRecord, markApproved } from "@/app/lib/kv";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body?.token || "").trim();
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

  if (rec.approvedAt) {
    return NextResponse.json({
      success: true,
      ok: true,
      record: { status: "approved", approvedAt: rec.approvedAt },
      approvedAt: rec.approvedAt,
    });
  }

  const updated = await markApproved(token);
  if (!updated)
    return NextResponse.json(
      { success: false, error: "Failed to update" },
      { status: 500 }
    );

  return NextResponse.json({
    success: true,
    ok: true,
    approvedAt: updated.approvedAt ?? null,
    record: {
      status: "approved",
      approvedAt: updated.approvedAt ?? null,
    },
  });
}
