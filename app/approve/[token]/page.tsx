"use client";

import { useEffect, useMemo, useState } from "react";

export default function ApprovePage({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ token: string } | null>(
    null
  );
  useEffect(() => {
    let mounted = true;
    Promise.resolve(params).then((p) => {
      if (mounted) setResolvedParams(p);
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  const token = useMemo(
    () => (resolvedParams?.token || "").trim(),
    [resolvedParams]
  );

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<
    "sent" | "approved" | "notfound" | "error"
  >("sent");
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setStatus("notfound");
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/approval/status?token=${encodeURIComponent(token)}`
        );
        const json = await res.json();
        if (!mounted) return;
        if (!res.ok || !json?.success) {
          setStatus(res.status === 404 ? "notfound" : "error");
        } else {
          const rec = json.record;
          setStatus(rec.status === "approved" ? "approved" : "sent");
          setApprovedAt(rec.approvedAt || null);
        }
      } catch {
        if (mounted) setStatus("error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  async function confirm() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/approval/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setStatus("approved");
        setApprovedAt(
          json?.record?.approvedAt || new Date().toISOString()
        );
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="text-xl font-semibold">Approve Estimate</div>
        <div className="mt-2 text-sm text-white/70">
          This confirms you approve the estimate and want to move forward.
        </div>

        {loading ? (
          <div className="mt-6 text-white/70">Loading…</div>
        ) : status === "notfound" ? (
          <div className="mt-6 text-white/70">
            This approval link is invalid or expired.
          </div>
        ) : status === "error" ? (
          <div className="mt-6 text-red-300">
            Something went wrong. Please contact your contractor.
          </div>
        ) : status === "approved" ? (
          <div className="mt-6">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="font-semibold">Approved ✅</div>
              <div className="mt-1 text-sm text-white/70">
                {approvedAt
                  ? `Confirmed at ${new Date(approvedAt).toLocaleString()}`
                  : "Confirmed."}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={confirm}
              disabled={submitting}
              className="w-full rounded-2xl bg-white py-3 font-semibold text-black hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Confirming…" : "Approve"}
            </button>
            <div className="mt-3 text-xs text-white/50">
              This is a confirmation only. Payment is handled separately with
              your contractor.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
