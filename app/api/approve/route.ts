import { NextResponse } from "next/server";
import { getApprovalRecord, markApproved } from "@/app/lib/kv";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    const rec = await getApprovalRecord(token);
    if (!rec) {
      return NextResponse.json({ ok: false, error: "Invalid or expired token" }, { status: 404 });
    }

    const updated = await markApproved(token);

    return NextResponse.json({
      ok: true,
      approvedAt: updated?.approvedAt ?? null,
      estimateId: updated?.estimateId ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
