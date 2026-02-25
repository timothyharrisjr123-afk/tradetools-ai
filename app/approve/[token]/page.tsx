import ApproveClient from "./ApproveClient";
import { getApprovalRecord } from "@/app/lib/kv";

export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: t } = await params;
  const token = (t || "").trim();
  const rec = token ? await getApprovalRecord(token) : null;

  return (
    <ApproveClient
      token={token}
      exists={!!rec}
      approvedAt={rec?.approvedAt ?? null}
      customerName={rec?.customerName ?? null}
      addressLine={rec?.addressLine ?? null}
      total={rec?.total ?? null}
      tierLabel={rec?.tierLabel ?? null}
    />
  );
}
