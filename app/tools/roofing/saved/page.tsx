"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RoofingTabs from "@/app/tools/roofing/RoofingTabs";
import {
  getSavedEstimates,
  getSavedEstimateById,
  setCurrentLoadedSavedId,
  deleteSavedEstimate,
  updateSavedEstimate,
  markSavedEstimateApproved,
  markSavedEstimateScheduled,
  addPaymentToEstimate,
  canRecordPayment,
  type RoofingEstimate,
} from "@/app/lib/estimateStore";

export default function SavedEstimatesPage() {
  const [hydrated, setHydrated] = useState(false);
  const [estimates, setEstimates] = useState<RoofingEstimate[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "estimate" | "sent" | "approved" | "scheduled" | "paid">("all");
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [schedulingForId, setSchedulingForId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleArrivalWindow, setScheduleArrivalWindow] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [payingForId, setPayingForId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paidDate, setPaidDate] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidMethod, setPaidMethod] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [paymentType, setPaymentType] = useState<"deposit" | "progress" | "final">("deposit");
  const [paymentContractTotal, setPaymentContractTotal] = useState("");
  const router = useRouter();

  const ARRIVAL_WINDOW_OPTIONS = [
    { value: "", label: "No window" },
    { value: "8–10am", label: "8–10am" },
    { value: "10am–12pm", label: "10am–12pm" },
    { value: "12–2pm", label: "12–2pm" },
    { value: "2–4pm", label: "2–4pm" },
    { value: "4–6pm", label: "4–6pm" },
  ];
  const STAGES = ["estimate", "sent", "approved", "scheduled", "paid"] as const;
  const STAGE_LABELS: Record<string, string> = { estimate: "Estimate", sent: "Sent", approved: "Approved", scheduled: "Scheduled", paid: "Paid" };
  const STAGE_DOT_CLASS: Record<string, string> = {
    estimate: "bg-white/50",
    sent: "bg-blue-400",
    approved: "bg-emerald-400",
    scheduled: "bg-violet-400",
    paid: "bg-amber-400",
  };
  const PAYMENT_METHOD_OPTIONS = [
    { value: "", label: "—" },
    { value: "Cash", label: "Cash" },
    { value: "Check", label: "Check" },
    { value: "Card", label: "Card" },
    { value: "ACH", label: "ACH" },
    { value: "Other", label: "Other" },
  ];
  const PAYMENT_TYPE_OPTIONS: { value: "deposit" | "progress" | "final"; label: string }[] = [
    { value: "deposit", label: "Deposit" },
    { value: "progress", label: "Progress" },
    { value: "final", label: "Final" },
  ];
  const searchParams = useSearchParams();

  function formatDate(dateStr?: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function money(value?: number) {
    const n = Math.round(Number(value || 0) * 100) / 100;
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getContractTotal(e: RoofingEstimate): number {
    return e.totalContractPrice ?? e.suggestedPrice ?? 0;
  }
  function getAmountPaid(e: RoofingEstimate): number {
    if (e.amountPaid != null) return e.amountPaid;
    const h = e.paymentHistory;
    return Array.isArray(h) ? h.reduce((s, p) => s + (p.amount || 0), 0) : 0;
  }

  const [flashBanner, setFlashBanner] = useState<string | null>(null);

  useEffect(() => {
    const flash = searchParams.get("flash");
    if (!flash) return;
    setFlashId(flash);
    const message = "Estimate Sent ✅";
    setFlashBanner(message);
    setToast(message);
    setTimeout(() => setToast(null), 2500);
    const url = new URL(window.location.href);
    url.searchParams.delete("flash");
    router.replace(url.pathname + url.search);
    const t = setTimeout(() => {
      setFlashId(null);
      setFlashBanner(null);
    }, 3500);
    return () => clearTimeout(t);
  }, [searchParams, router]);

  function handleSendFromSaved(savedId: string) {
    sessionStorage.setItem("ttai_autoSendEstimateId", savedId);
    router.push("/tools/roofing");
  }

  function getNormalizedEstimates(): RoofingEstimate[] {
    return getSavedEstimates().map((e) => {
      const paidFromHistory = e.paymentHistory?.reduce((s, p) => s + Number(p.amount || 0), 0) ?? 0;
      const paid = e.amountPaid ?? paidFromHistory;
      const contractTotal = e.totalContractPrice ?? e.suggestedPrice ?? 0;
      const out = { ...e } as RoofingEstimate;
      if ((e.status || "") === "paid" && contractTotal <= 0 && paid > 0) {
        (out as any).totalContractPrice = paid;
      }
      if (e.amountPaid == null && (e.paymentHistory?.length ?? 0) > 0) {
        (out as any).amountPaid = paid;
      }
      return out;
    });
  }

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setEstimates(getNormalizedEstimates());
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let mounted = true;
    const list = getSavedEstimates();
    const withToken = list.filter((e) => e.approvalToken);
    if (withToken.length === 0) return;
    (async () => {
      for (const e of withToken) {
        try {
          const res = await fetch(
            `/api/approval/status?token=${encodeURIComponent(e.approvalToken!)}`
          );
          const json = await res.json();
          if (!mounted) return;
          if (res.ok && json?.success && json?.record?.status === "approved") {
            if (typeof console !== "undefined" && console.log) {
              console.log("[saved sync] approved", e.id, json.record.approvedAt);
            }
            markSavedEstimateApproved(
              e.id,
              json.record.approvedAt || undefined
            );
          }
        } catch {
          /* ignore */
        }
      }
      if (mounted) setEstimates(getNormalizedEstimates());
    })();
    return () => {
      mounted = false;
    };
  }, [hydrated]);

  const filtered = estimates
    .filter((e) => {
      if (statusFilter === "all") return true;
      return (e.status || "estimate") === statusFilter;
    })
    .filter((e) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        e.customerName,
        e.customerEmail,
        e.customerPhone,
        e.address,
        e.jobAddress1,
        e.jobCity,
        e.jobState,
        e.jobZip,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

  return (
    <div className="min-h-screen bg-[#0b1220] px-6 py-10 text-white">
      {toast !== null && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-800/90 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-md"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400" aria-hidden>✓</span>
          <span className="text-sm font-medium text-slate-100">{toast}</span>
        </div>
      )}
      {flashBanner && (
        <div
          role="status"
          className="mx-auto max-w-xl mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-center text-sm font-medium text-emerald-200"
        >
          {flashBanner}
        </div>
      )}
      <div className="mx-auto max-w-xl space-y-6">
        <RoofingTabs active="saved" />
        <div className="text-center">
          <Link
            href="/tools/roofing"
            className="text-xs text-white/60 hover:text-white/80"
          >
            ← Back to Calculator
          </Link>
        </div>

        <h1 className="text-center text-xl font-semibold text-white">
          Saved Estimates
        </h1>

        {!hydrated && (
          <div className="text-center text-sm text-white/60 py-8">
            Loading saved estimates…
          </div>
        )}
        {hydrated && estimates.length === 0 && (
          <div className="text-center text-sm text-white/60">
            No saved estimates yet.
          </div>
        )}

        <div className="space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved estimates..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/40"
          />

          <div className="flex flex-wrap gap-2 text-xs">
            {[
              ["all", "All"],
              ["estimate", "Estimate"],
              ["sent", "Sent"],
              ["approved", "Approved"],
              ["scheduled", "Scheduled"],
              ["paid", "Paid"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key as any)}
                className={
                  "rounded-full border px-3 py-1 " +
                  (statusFilter === key
                    ? "border-white/20 bg-white/[0.10] text-white"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:text-white")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {hydrated && filtered.map((e) => (
            <div
              id={`card-${e.id}`}
              key={e.id}
              className={
                "rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-300 " +
                (e.id === flashId ? "ring-2 ring-emerald-400/60" : "")
              }
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-white/50">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                  {String(e.selectedTier || "")}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-0.5">
                    {e.sentAt ? (
                      <span>Sent {new Date(e.sentAt).toLocaleDateString()}</span>
                    ) : null}
                    {e.lastSavedAt ? (
                      <span>Saved {new Date(e.lastSavedAt).toLocaleDateString()}</span>
                    ) : e.createdAt ? (
                      <span>{new Date(e.createdAt).toLocaleString()}</span>
                    ) : null}
                  </div>
                  <select
                    value={e.status || "estimate"}
                    onChange={(ev) => {
                      const status = ev.target.value as "estimate" | "sent" | "approved" | "scheduled" | "paid";
                      if (status === "scheduled" && !e.scheduledStartDate) {
                        setToast("Pick a start date to schedule.");
                        setTimeout(() => setToast(null), 2500);
                        setSchedulingForId(e.id);
                        setScheduleStartDate((prev) => prev || new Date().toISOString().slice(0, 10));
                        setScheduleNotes("");
                        setScheduleArrivalWindow("");
                        return;
                      }
                      updateSavedEstimate(e.id, { status });
                      setEstimates(getNormalizedEstimates());
                      const label = status.charAt(0).toUpperCase() + status.slice(1);
                      setToast(status === "approved" ? "Approved ✅" : status === "scheduled" ? "Scheduled ✅" : `Status updated → ${label}`);
                      setTimeout(() => setToast(null), 2500);
                    }}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/80"
                  >
                    <option value="estimate">Estimate</option>
                    <option value="sent">Sent</option>
                    <option value="approved">Approved</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="mb-2 flex flex-wrap gap-3 items-center text-[10px] uppercase tracking-wide">
                {STAGES.map((stage) => {
                  const status = e.status || "estimate";
                  const idx = STAGES.indexOf(status);
                  const stageIdx = STAGES.indexOf(stage);
                  const isCompleted = stageIdx < idx;
                  const isCurrent = stage === status;
                  const isFuture = stageIdx > idx;
                  const dotClass = isCurrent ? STAGE_DOT_CLASS[stage] || "bg-white/50" : "";
                  return (
                    <span
                      key={stage}
                      className={
                        isCurrent ? "text-white font-semibold flex items-center gap-1.5" :
                        isCompleted ? "text-white/60 flex items-center gap-1.5" :
                        "text-white/30 flex items-center gap-1.5"
                      }
                    >
                      {isCompleted ? (
                        <span className="text-emerald-400/80" aria-hidden>✓</span>
                      ) : isCurrent ? (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden />
                      ) : null}
                      {STAGE_LABELS[stage] || stage}
                    </span>
                  );
                })}
              </div>
              <div className="text-base font-semibold text-white">
                {e.customerName || "Unnamed Job"}
              </div>
              {e.revisionOfId ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-white/50">
                  <span className="rounded border border-white/15 bg-white/[0.06] px-2 py-0.5">
                    Revision #{e.revisionNumber ?? 1}
                  </span>
                  <span>
                    of {getSavedEstimateById(e.revisionOfId)?.customerName?.trim() || e.revisionOfId.slice(0, 8)}
                  </span>
                </div>
              ) : null}
              {(e.status || "estimate") === "scheduled" && e.scheduledStartDate ? (
                <div className="mt-1 text-[11px] text-white/60">
                  Scheduled: {e.scheduledStartDate}
                  {e.scheduledArrivalWindow?.trim() ? ` · Arrival: ${e.scheduledArrivalWindow.trim()}` : ""}
                  {e.scheduleNotes?.trim() ? ` · ${e.scheduleNotes.trim()}` : ""}
                </div>
              ) : null}
              {(() => {
                const status = e.status || "estimate";
                const contractTotal = Math.round(Number(e.totalContractPrice ?? e.suggestedPrice ?? 0) * 100) / 100;
                const paid = Math.round(Number(e.amountPaid ?? (e.paymentHistory?.reduce((s, p) => s + Number(p.amount || 0), 0) ?? 0)) * 100) / 100;
                const balanceDue = Math.max(0, Math.round((contractTotal - paid) * 100) / 100);
                const showFinancialSummary = status === "paid" || (status === "scheduled" && paid > 0);
                const showPaidInFull = contractTotal > 0 && balanceDue === 0 && paid > 0;
                const showPaymentRecorded = paid > 0 && !showPaidInFull;
                if (!showFinancialSummary && !showPaymentRecorded) return null;

                const paidOnDate = e.paidDate || e.paidAt || (e.paymentHistory?.length ? e.paymentHistory[e.paymentHistory.length - 1]?.date : undefined) || e.lastSavedAt || e.createdAt;

                if (status === "paid" || showPaidInFull) {
                  const displayTotal = contractTotal > 0 ? contractTotal : (paid > 0 ? paid : 0);
                  return (
                    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                          {showPaidInFull ? "Paid in Full" : "Payment Recorded"}
                        </div>
                        <div className="text-[11px] text-white/60">
                          {paidOnDate ? `Paid ${formatDate(paidOnDate)}` : ""}
                        </div>
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        ${money(displayTotal)}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                          <div className="text-[11px] text-white/60">Contract Total</div>
                          <div className="text-sm font-semibold text-white">${money(contractTotal)}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                          <div className="text-[11px] text-white/60">Collected</div>
                          <div className="text-sm font-semibold text-white">${money(paid)}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 col-span-2">
                          <div className="text-[11px] text-white/60">Balance Due</div>
                          <div className="text-sm font-semibold text-white">${money(balanceDue)}</div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                        Scheduled — Payment Recorded
                      </div>
                      {e.scheduledStartDate ? (
                        <div className="text-[11px] text-white/60">
                          Start {String(e.scheduledStartDate)}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2 text-[11px] text-white/60">Balance Due</div>
                    <div className="mt-1 text-2xl font-semibold text-white">
                      ${money(balanceDue)}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="text-[11px] text-white/60">Contract Total</div>
                        <div className="text-sm font-semibold text-white">${money(contractTotal)}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="text-[11px] text-white/60">Collected</div>
                        <div className="text-sm font-semibold text-white">${money(paid)}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {e.customerEmail ? (
                <div className="mt-1 text-xs text-white/60">
                  {String(e.customerEmail)}
                </div>
              ) : null}
              {e.customerPhone ? (
                <div className="mt-1 text-xs text-white/60">
                  {String(e.customerPhone)}
                </div>
              ) : null}

              <div className="mt-1 text-xs text-white/60">{e.address}</div>

              <div className="mt-1 text-xs text-white/60">
                Roof area saved: {String(e.roofAreaSqFt ?? "")}
              </div>

              {!((e.paymentHistory?.length ?? 0) > 0) ? (
                <div className="mt-2 text-sm text-white">
                  ${money(e.suggestedPrice)}
                </div>
              ) : null}

              {((e.status || "estimate") === "approved" || (e.status || "estimate") === "scheduled") && schedulingForId === e.id ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-2">
                  <label className="block text-[11px] text-white/60">Start date</label>
                  <input
                    type="date"
                    value={scheduleStartDate}
                    onChange={(ev) => setScheduleStartDate(ev.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white"
                  />
                  <label className="block text-[11px] text-white/60">Arrival window (optional)</label>
                  <select
                    value={scheduleArrivalWindow}
                    onChange={(ev) => setScheduleArrivalWindow(ev.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white"
                  >
                    {ARRIVAL_WINDOW_OPTIONS.map((opt) => (
                      <option key={opt.value || "none"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <label className="block text-[11px] text-white/60">Notes (optional)</label>
                  <textarea
                    value={scheduleNotes}
                    onChange={(ev) => setScheduleNotes(ev.target.value)}
                    rows={2}
                    placeholder="Crew, access, etc."
                    className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!scheduleStartDate.trim()) return;
                        setSchedulingId(e.id);
                        const startDate = scheduleStartDate.trim();
                        const notes = scheduleNotes.trim() || undefined;
                        const arrivalWindow = scheduleArrivalWindow.trim() || undefined;
                        setTimeout(() => {
                          markSavedEstimateScheduled(e.id, startDate, notes, arrivalWindow);
                          setEstimates(getNormalizedEstimates());
                          setSchedulingForId(null);
                          setScheduleStartDate("");
                          setScheduleArrivalWindow("");
                          setScheduleNotes("");
                          setStatusFilter("scheduled");
                          setQuery("");
                          setFlashId(e.id);
                          const [y, m, d] = startDate.split("-");
                          const formattedDate = m && d && y ? `${m}/${d}/${y}` : startDate;
                          setToast(arrivalWindow ? `Scheduled ✅ ${formattedDate} · ${arrivalWindow}` : `Scheduled ✅ ${formattedDate}`);
                          setTimeout(() => setToast(null), 2500);
                          setTimeout(() => setFlashId(null), 1200);
                          setSchedulingId(null);
                        }, 400);
                      }}
                      disabled={!scheduleStartDate.trim() || schedulingId === e.id}
                      className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      {schedulingId === e.id ? "Scheduling…" : "Confirm Schedule"}
                    </button>
                    <button
                      onClick={() => {
                        setSchedulingForId(null);
                        setScheduleStartDate("");
                        setScheduleArrivalWindow("");
                        setScheduleNotes("");
                      }}
                      disabled={schedulingId === e.id}
                      className="rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-white/80 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {(e.status || "estimate") === "scheduled" && payingForId === e.id ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-2">
                  {!canRecordPayment(e) ? (
                    <>
                      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        Contract total missing — load estimate and re-save.
                      </div>
                      <label className="block text-[11px] text-white/60">Contract total (required)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={paymentContractTotal}
                        onChange={(ev) => setPaymentContractTotal(ev.target.value)}
                        placeholder="0"
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/40"
                      />
                    </>
                  ) : null}
                  <label className="block text-[11px] text-white/60">Payment type</label>
                  <select
                    value={paymentType}
                    onChange={(ev) => setPaymentType(ev.target.value as "deposit" | "progress" | "final")}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white"
                  >
                    {PAYMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <label className="block text-[11px] text-white/60">Amount</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={paidAmount}
                    onChange={(ev) => setPaidAmount(ev.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/40"
                  />
                  <label className="block text-[11px] text-white/60">Date</label>
                  <input
                    type="date"
                    value={paidDate}
                    onChange={(ev) => setPaidDate(ev.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white"
                  />
                  <label className="block text-[11px] text-white/60">Method (optional)</label>
                  <select
                    value={paidMethod}
                    onChange={(ev) => setPaidMethod(ev.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.value || "none"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <label className="block text-[11px] text-white/60">Note (optional)</label>
                  <input
                    type="text"
                    value={paidNote}
                    onChange={(ev) => setPaidNote(ev.target.value)}
                    placeholder="e.g. Deposit for materials"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!paidDate.trim() || !paidAmount.trim()) return;
                        const amountNum = parseFloat(paidAmount);
                        if (isNaN(amountNum) || amountNum <= 0) return;
                        const contractTotal = getContractTotal(e);
                        if (contractTotal <= 0) {
                          const enteredTotal = parseFloat(paymentContractTotal);
                          if (isNaN(enteredTotal) || enteredTotal <= 0) {
                            setToast("Enter contract total first.");
                            setTimeout(() => setToast(null), 2500);
                            return;
                          }
                          updateSavedEstimate(e.id, { totalContractPrice: enteredTotal });
                          setEstimates(getNormalizedEstimates());
                        }
                        setPayingId(e.id);
                        const date = paidDate.trim();
                        const methodVal = paidMethod.trim() || undefined;
                        setTimeout(() => {
                          const ok = addPaymentToEstimate(e.id, { type: paymentType, amount: amountNum, date, method: methodVal, note: paidNote.trim() || undefined });
                          if (!ok) {
                            setToast("Contract total required. Enter total and try again.");
                            setTimeout(() => setToast(null), 2500);
                            setPayingId(null);
                            return;
                          }
                          setEstimates(getNormalizedEstimates());
                          setPayingForId(null);
                          setPaidDate("");
                          setPaidAmount("");
                          setPaidMethod("");
                          setPaidNote("");
                          setPaymentType("deposit");
                          setPaymentContractTotal("");
                          setFlashId(e.id);
                          setToast("Payment recorded ✅");
                          setTimeout(() => setToast(null), 2500);
                          setTimeout(() => setFlashId(null), 1200);
                          const updated = getSavedEstimates().find((x) => x.id === e.id);
                          if (updated && (updated.status || "estimate") === "paid") setStatusFilter("paid");
                          setPayingId(null);
                        }, 400);
                      }}
                      disabled={!paidDate.trim() || !paidAmount.trim() || payingId === e.id || (!canRecordPayment(e) && (isNaN(parseFloat(paymentContractTotal)) || parseFloat(paymentContractTotal) <= 0))}
                      className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      {payingId === e.id ? "Recording…" : "Record Payment"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayingForId(null);
                        setPaidDate("");
                        setPaidAmount("");
                        setPaidMethod("");
                        setPaidNote("");
                        setPaymentType("deposit");
                        setPaymentContractTotal("");
                      }}
                      className="rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-white/80 transition-all duration-150 active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(e.status || "estimate") === "estimate" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentLoadedSavedId(e.id);
                      router.push(`/tools/roofing?loadSaved=${encodeURIComponent(e.id)}&autoSend=1`);
                    }}
                    className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] bg-blue-500 hover:bg-blue-400 text-white"
                  >
                    Send Estimate
                  </button>
                ) : null}
                {(e.status || "estimate") === "sent" ? (
                  <button type="button" disabled className="rounded-xl px-4 py-2 text-xs font-semibold bg-white/10 text-white/50 cursor-not-allowed">
                    Awaiting Approval
                  </button>
                ) : null}
                {((e.status || "estimate") === "approved" || (e.status || "estimate") === "scheduled") && schedulingForId !== e.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSchedulingForId(e.id);
                      setScheduleStartDate((e.scheduledStartDate || "").trim() || new Date().toISOString().slice(0, 10));
                      setScheduleArrivalWindow((e.scheduledArrivalWindow || "").trim());
                      setScheduleNotes((e.scheduleNotes || "").trim());
                      requestAnimationFrame(() =>
                        document.getElementById(`card-${e.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                      );
                    }}
                    className={
                      (e.status || "estimate") === "scheduled"
                        ? "rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                        : "rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] bg-emerald-500 hover:bg-emerald-400 text-black"
                    }
                  >
                    {(e.status || "estimate") === "scheduled" ? "Edit Schedule" : "Schedule Job"}
                  </button>
                ) : null}
                {(e.status || "estimate") === "scheduled" && payingForId !== e.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPayingForId(e.id);
                      setPaidDate(new Date().toISOString().slice(0, 10));
                      setPaidAmount("");
                      setPaidMethod("");
                      setPaidNote("");
                      setPaymentType("deposit");
                      setPaymentContractTotal(String(getContractTotal(e) || ""));
                      requestAnimationFrame(() =>
                        document.getElementById(`card-${e.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                      );
                    }}
                    className="rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] bg-amber-500 hover:bg-amber-400 text-black"
                  >
                    Record Payment
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentLoadedSavedId(e.id);
                    router.push(`/tools/roofing?loadSaved=${encodeURIComponent(e.id)}`);
                  }}
                  className="rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-white/80 transition-all duration-150 active:scale-[0.98]"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteSavedEstimate(e.id);
                    setEstimates(getNormalizedEstimates());
                  }}
                  className="text-red-400 hover:text-red-300 text-xs font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
