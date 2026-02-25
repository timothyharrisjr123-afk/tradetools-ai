"use client";

import { useEffect, useState } from "react";
import { patchSavedEstimateByToken } from "@/app/lib/estimateStore";

type Found = {
  key: string;
  index: number;
  estimate: any;
  list: any[];
};

function safeJsonParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Scan every localStorage key for an array containing an item with approvalToken === token. */
function findEstimateByToken(token: string): Found | null {
  if (typeof window === "undefined") return null;
  const t = String(token || "").trim();
  if (!t) return null;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const parsed = safeJsonParse(localStorage.getItem(key));
    if (!Array.isArray(parsed)) continue;

    const idx = parsed.findIndex(
      (e: any) => String(e?.approvalToken || "").trim() === t
    );

    if (idx >= 0) {
      return { key, index: idx, estimate: parsed[idx], list: parsed };
    }
  }

  return null;
}

function patchFound(found: Found, patch: any) {
  const updated = [...found.list];
  updated[found.index] = { ...updated[found.index], ...patch };
  try {
    localStorage.setItem(found.key, JSON.stringify(updated));
  } catch {}
}

type Snapshot = {
  status: "sent_pending" | "approved";
  approvedAt?: string | null;
  company?: { name?: string; phone?: string; email?: string; logoDataUrl?: string };
  customer?: { name?: string; email?: string };
  job?: { addressLine?: string };
  tierLabel?: string;
  totalFormatted?: string;
  packageDescription?: string;
  scheduleCta?: string;
};

export default function ApproveClient({ token }: { token: string }) {
  const t = (token ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"sent_pending" | "approved" | "notfound" | "error">("sent_pending");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!t) {
      setLoading(false);
      setStatus("notfound");
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/approval/status?token=${encodeURIComponent(t)}`);
        const json = await res.json();
        if (!mounted) return;
        if (res.ok && json?.success) {
          const rec = json.record;
          const st = rec.status === "approved" ? "approved" : "sent_pending";
          setStatus(st);
          setSnapshot({
            status: st,
            approvedAt: rec.approvedAt ?? null,
            company: rec.company,
            customer: rec.customer,
            job: rec.job,
            tierLabel: rec.tierLabel,
            totalFormatted: rec.totalFormatted,
            packageDescription: rec.packageDescription,
            scheduleCta: rec.scheduleCta,
          });
          return;
        }

        const f = findEstimateByToken(t);

        if (typeof console !== "undefined" && console.log) {
          console.log("[APPROVE SCAN]", {
            token: t,
            found: !!f,
            foundKey: f?.key ?? null,
            foundId: f?.estimate?.id ?? null,
            foundStatus: f?.estimate?.status ?? null,
          });
        }

        if (!f) {
          setStatus(res.status === 404 ? "notfound" : "error");
          return;
        }

        setFound(f);
        const match = f.estimate;
        const st = match.status === "approved" ? "approved" : "sent_pending";
        const totalFormatted =
          match.totalContractPrice != null || match.suggestedPrice != null
            ? `$${Number(match.totalContractPrice ?? match.suggestedPrice ?? 0).toLocaleString()}`
            : undefined;
        setStatus(st);
        setSnapshot({
          status: st,
          approvedAt: match.approvedAt ?? null,
          company: { name: (match as any).companyName, email: (match as any).contractorEmail },
          customer: { name: match.customerName, email: match.customerEmail },
          job: {
            addressLine: [match.jobAddress1, match.jobCity, match.jobState, match.jobZip]
              .filter(Boolean)
              .join(", "),
          },
          tierLabel: match.selectedTier,
          totalFormatted,
          packageDescription: (match as any).packageDescription,
          scheduleCta: (match as any).scheduleCta,
        });
      } catch {
        if (mounted) setStatus("error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [t]);

  async function confirm() {
    setSubmitting(true);
    const approvedAt = new Date().toISOString();
    const patch = { status: "approved" as const, approvedAt };
    try {
      const res = await fetch("/api/approval/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const json = await res.json().catch(() => null);
      const apiOk = res.ok && (json?.success || json?.ok);

      let localPatched = false;
      if (found) {
        patchFound(found, patch);
        localPatched = true;
      } else {
        localPatched = patchSavedEstimateByToken(t, patch);
      }

      if (apiOk || localPatched) {
        setStatus("approved");
        setSnapshot((s) =>
          s ? { ...s, status: "approved", approvedAt: json?.approvedAt ?? json?.record?.approvedAt ?? approvedAt } : s
        );
      } else {
        setStatus("error");
      }
    } catch {
      if (found) {
        patchFound(found, patch);
        setStatus("approved");
        setSnapshot((s) => (s ? { ...s, status: "approved", approvedAt } : s));
      } else {
        const localPatched = patchSavedEstimateByToken(t, patch);
        if (localPatched) {
          setStatus("approved");
          setSnapshot((s) => (s ? { ...s, status: "approved", approvedAt } : s));
        } else {
          setStatus("error");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const companyName = snapshot?.company?.name?.trim() || "Your Contractor";
  const companyPhone = snapshot?.company?.phone?.trim();
  const totalFormatted = snapshot?.totalFormatted;
  const packageDescription = snapshot?.packageDescription?.trim();
  const scheduleCta = snapshot?.scheduleCta?.trim();
  const jobAddress = snapshot?.job?.addressLine?.trim();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-xl">
        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : status === "notfound" ? (
          <div className="text-white/70">This approval link is invalid or expired.</div>
        ) : status === "error" ? (
          <div className="text-red-300">Something went wrong. Please contact your contractor.</div>
        ) : status === "approved" ? (
          <div>
            <div className="text-xl font-semibold text-white">{companyName}</div>
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="font-semibold text-emerald-200">Thank you — your estimate has been approved.</div>
              <div className="mt-2 text-sm text-white/80">
                We&apos;ll contact you shortly to schedule.
              </div>
            </div>
            {companyPhone ? (
              <p className="mt-4 text-xs text-white/50">Questions? Call {companyPhone}</p>
            ) : null}
          </div>
        ) : (
          <div>
            <div className="text-xl font-semibold text-white">{companyName}</div>
            <div className="mt-1 text-xs text-white/50">Your Roofing Estimate</div>

            {totalFormatted ? (
              <div className="mt-6 text-2xl font-bold text-emerald-300">{totalFormatted}</div>
            ) : null}
            {jobAddress ? (
              <div className="mt-2 text-sm text-white/70">{jobAddress}</div>
            ) : null}
            {snapshot?.tierLabel ? (
              <div className="mt-1 text-xs text-white/50">{snapshot.tierLabel} package</div>
            ) : null}

            {packageDescription ? (
              <div className="mt-6">
                <div className="text-xs font-semibold text-white/50 uppercase tracking-wide">Scope</div>
                <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">{packageDescription}</p>
              </div>
            ) : null}
            {scheduleCta ? (
              <div className="mt-4 text-sm text-white/70">{scheduleCta}</div>
            ) : null}

            <div className="mt-8">
              <button
                type="button"
                onClick={confirm}
                disabled={submitting}
                className="w-full rounded-2xl bg-emerald-600 py-3.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Confirming…" : "Approve Estimate"}
              </button>
              <p className="mt-3 text-xs text-white/50 text-center">
                This confirms you approve the estimate. Payment is handled separately with your contractor.
              </p>
            </div>

            {companyPhone ? (
              <p className="mt-6 text-xs text-white/50 text-center">Questions? Call {companyPhone}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
