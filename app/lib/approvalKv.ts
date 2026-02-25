import { kv } from "@vercel/kv";

export type ApprovalRecord = {
  token: string;
  estimateId: string;
  sentTo?: string;
  createdAt: number;
  approvedAt?: number | null;
};

const TTL_30_DAYS = 60 * 60 * 24 * 30;

export async function kvSetApproval(rec: ApprovalRecord) {
  await kv.set(`approval:${rec.token}`, rec, { ex: TTL_30_DAYS });
}

export async function kvGetApproval(token: string): Promise<ApprovalRecord | null> {
  const rec = await kv.get<ApprovalRecord>(`approval:${token}`);
  return rec ?? null;
}

export async function kvConfirmApproval(token: string): Promise<ApprovalRecord | null> {
  const rec = await kvGetApproval(token);
  if (!rec) return null;

  if (rec.approvedAt) return rec;

  const next: ApprovalRecord = { ...rec, approvedAt: Date.now() };
  await kv.set(`approval:${token}`, next, { ex: TTL_30_DAYS });
  return next;
}
