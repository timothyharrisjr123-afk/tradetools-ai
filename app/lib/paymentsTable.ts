export type DerivedPaymentState = {
  estimateId: string;
  depositAmountCents: number;
  fullAmountCents: number;
  offlinePaidCents: number;
  offlineTransactions: Array<{
    id: string;
    amountCents: number;
    method: string;
    notes: string;
    stage?: "deposit" | "additional";
    recordedAt: string;
  }>;
  status: "none" | "deposit_paid" | "paid";
};

function emptyState(estimateId: string): DerivedPaymentState {
  return {
    estimateId,
    depositAmountCents: 0,
    fullAmountCents: 0,
    offlinePaidCents: 0,
    offlineTransactions: [],
    status: "none",
  };
}

export async function getDerivedPaymentStateFromSupabase({
  supabase,
  companyId,
  estimateId,
  estimateTotalCents,
}: {
  supabase: any;
  companyId: string;
  estimateId: string;
  estimateTotalCents: number;
}): Promise<DerivedPaymentState> {
  try {
    const { data: rows, error } = await supabase
      .from("payments")
      .select("id, estimate_id, payment_type, amount, status, created_at")
      .eq("company_id", companyId)
      .eq("estimate_id", estimateId);

    if (error) return emptyState(estimateId);
    const list = Array.isArray(rows) ? rows : [];

    let depositAmountCents = 0;
    let fullAmountCents = 0;
    let offlinePaidCents = 0;
    const offlineTransactions: DerivedPaymentState["offlineTransactions"] = [];

    for (const row of list) {
      const amountCents = Math.round(Number(row?.amount ?? 0) * 100);
      const paymentType = String(row?.payment_type ?? "").toLowerCase();

      if (paymentType === "deposit") {
        depositAmountCents += amountCents;
      } else if (paymentType === "full" || paymentType === "balance") {
        fullAmountCents += amountCents;
      } else if (paymentType === "offline") {
        offlinePaidCents += amountCents;
        offlineTransactions.push({
          id: String(row?.id ?? ""),
          amountCents,
          method: "offline",
          notes: "",
          stage: "additional",
          recordedAt: String(row?.created_at ?? ""),
        });
      }
    }

    const totalCollected = depositAmountCents + fullAmountCents + offlinePaidCents;
    let status: DerivedPaymentState["status"] = "none";
    if (estimateTotalCents > 0 && totalCollected >= estimateTotalCents) {
      status = "paid";
    } else if (depositAmountCents > 0 || fullAmountCents > 0 || offlinePaidCents > 0) {
      status = "deposit_paid";
    }

    return {
      estimateId,
      depositAmountCents,
      fullAmountCents,
      offlinePaidCents,
      offlineTransactions,
      status,
    };
  } catch {
    return emptyState(estimateId);
  }
}
