import { NextResponse } from "next/server";
import { kvGetApproval } from "@/app/lib/approvalKv";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

  const rec = await kvGetApproval(token);
  if (!rec) return NextResponse.json({ ok: false, error: "Invalid or expired" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    data: {
      estimateId: rec.estimateId,
      sentTo: rec.sentTo ?? null,
      createdAt: rec.createdAt,
      approvedAt: rec.approvedAt ?? null,
    },
  });
}
