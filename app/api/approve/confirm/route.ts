import { NextResponse } from "next/server";
import { kvConfirmApproval } from "@/app/lib/approvalKv";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token || "";
  if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

  const rec = await kvConfirmApproval(token);
  if (!rec) return NextResponse.json({ ok: false, error: "Invalid or expired" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    data: {
      estimateId: rec.estimateId,
      approvedAt: rec.approvedAt,
    },
  });
}
