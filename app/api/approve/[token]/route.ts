import { kv } from "@vercel/kv";

export const runtime = "edge";

type ApprovalRecord = {
  estimateId: string;
  createdAt: number;
  sentTo?: string;
  approvedAt?: number;
};

const key = (token: string) => `approval:${token}`;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token: t } = await ctx.params;
  const token = t || "";
  if (!token) return Response.json({ ok: false }, { status: 400 });

  const record = await kv.get<ApprovalRecord>(key(token));
  if (!record) return Response.json({ ok: false }, { status: 404 });

  return Response.json({ ok: true });
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token: t } = await ctx.params;
  const token = t || "";
  if (!token) return Response.json({ ok: false }, { status: 400 });

  const record = await kv.get<ApprovalRecord>(key(token));
  if (!record) return Response.json({ ok: false }, { status: 404 });

  const updated: ApprovalRecord = {
    ...record,
    approvedAt: Date.now(),
  };

  await kv.set(key(token), updated, { ex: 60 * 60 * 24 * 30 });

  await kv.set(
    `approved:${record.estimateId}`,
    { approvedAt: Date.now(), token },
    { ex: 60 * 60 * 24 * 365 }
  );

  return Response.json({ ok: true });
}
