"use client";

import { useMemo, useState } from "react";

type Props = {
  token: string;
  exists: boolean;
  approvedAt?: string | null;
  customerName?: string | null;
  addressLine?: string | null;
  total?: number | null;
  tierLabel?: string | null;
};

export default function ApproveClient(props: Props) {
  const { token, exists } = props;

  const [isApproving, setIsApproving] = useState(false);
  const [approvedAt, setApprovedAt] = useState<string | null>(props.approvedAt ?? null);
  const [error, setError] = useState<string | null>(null);

  const alreadyApproved = !!approvedAt;

  const title = useMemo(() => {
    if (!exists) return "Roofing Estimate Approval";
    if (alreadyApproved) return "Approved ✅";
    return "Approve Your Roofing Estimate";
  }, [exists, alreadyApproved]);

  async function handleApprove() {
    setError(null);
    setIsApproving(true);
    try {
      const res = await fetch("/api/approve/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Approval failed");
        return;
      }

      setApprovedAt(data.approvedAt || new Date().toISOString());
    } catch (e: any) {
      setError(e?.message || "Approval failed");
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl p-6">
        <div className="text-xl font-semibold">{title}</div>

        {!exists ? (
          <div className="mt-3 text-sm text-red-300">
            This approval link is invalid or expired.
          </div>
        ) : (
          <>
            <div className="mt-3 text-sm text-white/80">
              {props.customerName ? <div><span className="text-white/60">Customer:</span> {props.customerName}</div> : null}
              {props.addressLine ? <div className="mt-1"><span className="text-white/60">Address:</span> {props.addressLine}</div> : null}
              {props.tierLabel ? <div className="mt-1"><span className="text-white/60">Package:</span> {props.tierLabel}</div> : null}
              {typeof props.total === "number" ? (
                <div className="mt-1"><span className="text-white/60">Total:</span> ${props.total.toLocaleString()}</div>
              ) : null}
            </div>

            <div className="mt-4 h-px w-full bg-white/10" />

            {alreadyApproved ? (
              <div className="mt-4 text-sm text-emerald-300">
                Approved ✅ We&apos;ll reach out to schedule your start date.
              </div>
            ) : (
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="mt-4 inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {isApproving ? "Approving..." : "Approve Estimate"}
              </button>
            )}

            {error ? (
              <div className="mt-3 text-sm text-red-300">{error}</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
