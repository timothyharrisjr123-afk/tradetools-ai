import { NextResponse } from "next/server";
import { getApproval } from "@/app/lib/kv";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();
  if (!token)
    return NextResponse.json(
      { success: false, error: "Missing token" },
      { status: 400 }
    );

  const rec = await getApproval(token);
  if (!rec)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );

  return NextResponse.json({
    success: true,
    record: {
      token: rec.token,
      status: rec.status,
      createdAt: rec.createdAt,
      approvedAt: rec.approvedAt ?? null,
      savedEstimateId: rec.savedEstimateId,
    },
  });
}
