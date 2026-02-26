import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";

// 1x1 transparent gif
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (token) {
      const key = `approval:${token}`;
      const record = await kv.get<any>(key);

      if (record && !record.viewedAt) {
        await kv.set(key, {
          ...record,
          viewedAt: new Date().toISOString(),
          status: record.status === "sent" ? "viewed" : record.status,
        });
      }
    }

    return new NextResponse(PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse(PIXEL, {
      status: 200,
      headers: { "Content-Type": "image/gif" },
    });
  }
}
