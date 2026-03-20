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
    if (alreadyApproved) return "Estimate Approved";
    return "Review & Approve Your Estimate";
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
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-sm">

        {/* HEADER */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
            Roofing Estimate
          </div>
          <div className="mt-1 text-xl font-semibold">
            {title}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {exists
              ? alreadyApproved
                ? "Your approval has been received."
                : "Review your estimate and approve to move forward."
              : "This approval link is invalid or expired."}
          </div>
        </div>

        <div className="px-6 py-6">

          {!exists ? (
            <div className="text-sm text-red-600">
              This approval link is invalid or expired.
            </div>
          ) : (
            <>
              {/* INFO GRID */}
              <div className="grid gap-4 sm:grid-cols-2">

                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase">Customer</div>
                  <div className="mt-1 text-sm font-medium">
                    {props.customerName || "Not provided"}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase">Package</div>
                  <div className="mt-1 text-sm font-medium">
                    {props.tierLabel || "Not provided"}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 sm:col-span-2">
                  <div className="text-xs text-gray-500 uppercase">Project Address</div>
                  <div className="mt-1 text-sm font-medium">
                    {props.addressLine || "Not provided"}
                  </div>
                </div>

                {/* TOTAL */}
                <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 sm:col-span-2">
                  <div className="text-xs text-emerald-700 uppercase">
                    Total Investment
                  </div>
                  <div className="mt-1 text-2xl font-bold text-emerald-700">
                    {typeof props.total === "number"
                      ? `$${props.total.toLocaleString()}`
                      : "—"}
                  </div>
                </div>

              </div>

              {/* APPROVED STATE */}
              {alreadyApproved ? (
                <div className="mt-6 text-sm text-emerald-700">
                  ✅ Approved — We'll contact you shortly to schedule your project.
                </div>
              ) : (
                <>
                  {/* WHAT HAPPENS NEXT */}
                  <div className="mt-6 border border-gray-200 rounded-xl p-4">
                    <div className="text-sm font-semibold">
                      What happens next
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      Once approved, we'll contact you to schedule your start date.
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-7">
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {isApproving ? "Approving..." : "Approve & Move Forward"}
                    </button>
                  </div>
                </>
              )}

              {error ? (
                <div className="mt-4 text-sm text-red-600">
                  {error}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
