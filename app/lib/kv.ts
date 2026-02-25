import { kv } from "@vercel/kv";

export type ApprovalRecord = {
  token: string;
  estimateId?: string;
  createdAt: string; // ISO
  approvedAt?: string; // ISO
  customerName?: string | null;
  customerEmail?: string | null;
  addressLine?: string | null;
  total?: number | null;
  tierLabel?: string | null;
};

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function approvalKey(token: string) {
  return `approval:${token}`;
}

export async function putApprovalRecord(record: ApprovalRecord) {
  await kv.set(approvalKey(record.token), record, { ex: TTL_SECONDS });
}

export async function getApprovalRecord(token: string): Promise<ApprovalRecord | null> {
  const rec = await kv.get<ApprovalRecord>(approvalKey(token));
  return rec ?? null;
}

export async function markApproved(token: string): Promise<ApprovalRecord | null> {
  const rec = await getApprovalRecord(token);
  if (!rec) return null;
  if (rec.approvedAt) return rec;

  const updated: ApprovalRecord = {
    ...rec,
    approvedAt: new Date().toISOString(),
  };
  await putApprovalRecord(updated);
  return updated;
}
