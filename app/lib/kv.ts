/** True only when KV env vars are set. When false, approval is disabled and kv is never called. */
export const KV_ENABLED =
  typeof process !== "undefined" &&
  !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export type ApprovalRecord = {
  token: string;
  status: "sent" | "approved";
  createdAt: string;
  approvedAt?: string;

  savedEstimateId: string;
  contractorEmail: string;
  customerName?: string;
  customerEmail?: string;
  jobAddress?: string;
};

export const approvalKey = (token: string) => `approval:${token}`;

export async function getApproval(
  token: string
): Promise<ApprovalRecord | null> {
  if (!KV_ENABLED) return null;
  const { kv } = await import("@vercel/kv");
  const rec = await kv.get<ApprovalRecord>(approvalKey(token));
  return rec ?? null;
}

export async function setApproval(rec: ApprovalRecord): Promise<void> {
  if (!KV_ENABLED) return;
  const { kv } = await import("@vercel/kv");
  await kv.set(approvalKey(rec.token), rec);
}

export async function patchApproval(
  token: string,
  patch: Partial<ApprovalRecord>
): Promise<ApprovalRecord | null> {
  if (!KV_ENABLED) return null;
  const existing = await getApproval(token);
  if (!existing) return null;
  const updated: ApprovalRecord = { ...existing, ...patch };
  await setApproval(updated);
  return updated;
}
