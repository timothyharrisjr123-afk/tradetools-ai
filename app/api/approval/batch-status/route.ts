import { NextResponse } from "next/server";
import { getApprovalRecord } from "@/app/lib/kv";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tokens = Array.isArray(body?.tokens) ? body.tokens : [];
    const statuses: Record<string, { status: "sent_pending" | "approved"; approvedAt?: string }> = {};

    for (const token of tokens) {
      const t = typeof token === "string" ? token.trim() : "";
      if (!t) continue;
      const rec = await getApprovalRecord(t);
      if (rec) {
        statuses[t] = {
          status: rec.approvedAt ? "approved" : "sent_pending",
          ...(rec.approvedAt && { approvedAt: rec.approvedAt }),
        };
      }
    }

    return NextResponse.json({ statuses });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch batch status" },
      { status: 500 }
    );
  }
}
