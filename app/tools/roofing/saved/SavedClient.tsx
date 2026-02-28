"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  markSavedEstimateApprovedByToken,
  markEstimateViewedByToken,
  markSavedEstimateScheduled,
  markSavedEstimateStatus,
  addPaymentToEstimate,
  type RoofingEstimate,
} from "@/app/lib/estimateStore";

function getClientBaseUrl() {
  const envBase =
    (process.env.NEXT_PUBLIC_APP_URL || "").toString().trim();

  if (envBase) return envBase.replace(/\/$/, "");

  if (typeof window !== "undefined") return window.location.origin;

  return "";
}

async function fetchPaymentState(estimateId: string) {
  const res = await fetch(`/api/payments/status?estimateId=${encodeURIComponent(estimateId)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.payment ?? null;
}

async function startCheckout(estimateId: string, paymentType: "deposit" | "full") {
  try {
    const res = await fetch("/api/payments/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateId, paymentType }),
    });
    const json = await res.json();
    if (!json?.ok || !json?.url) {
      alert(json?.error || "Could not start checkout");
      return;
    }
    window.location.href = json.url;
  } catch {
    alert("Checkout failed. Please try again.");
  }
}

function toNumberSafe(v: any) {
  const n =
    typeof v === "number"
      ? v
      : Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isoFromDateInput(d: string) {
  try {
    return d ? new Date(d).toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

type PipelineStatus = "estimate" | "sent" | "sent_pending" | "viewed" | "approved" | "deposit_paid" | "scheduled" | "paid";

const normalizePipelineStatus = (s?: string): PipelineStatus => {
  const v = (s || "estimate").toLowerCase();
  if (v === "sent_pending") return "sent_pending";
  if (v === "pending") return "sent_pending";
  if (v === "sent") return "sent";
  if (v === "viewed") return "viewed";
  if (v === "approved") return "approved";
  if (v === "deposit_paid") return "deposit_paid";
  if (v === "scheduled") return "scheduled";
  if (v === "paid") return "paid";
  return "estimate";
};

const isApprovedOrLater = (st: PipelineStatus) =>
  st === "approved" || st === "deposit_paid" || st === "scheduled" || st === "paid";

const isAwaitingApproval = (estimate: any, st: PipelineStatus) =>
  !!estimate?.approvalToken && !isApprovedOrLater(st);

function formatDatePretty(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateString?: string | null) {
  if (!dateString) return null;
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(dateString?: string | null) {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function normalizeStatusValue(input: unknown): string {
  const s = String(input ?? "").toLowerCase().trim();
  if (s === "pending_approval" || s === "pending approval") return "pending";
  if (s === "sent_pending") return "pending";
  if (s === "sent") return "sent";
  if (s === "viewed") return "viewed";
  if (s === "deposit_paid") return "deposit_paid";
  if (s === "estimate") return "estimate";
  if (s === "pending") return "pending";
  if (s === "approved") return "approved";
  if (s === "scheduled") return "scheduled";
  if (s === "paid") return "paid";
  return "estimate";
}

const getDisplayStage = (status: string) => {
  if (status === "sent_pending" || status === "pending" || status === "sent") return "Pending approval";
  if (status === "viewed") return "Viewed";
  if (status === "approved") return "Approved";
  if (status === "deposit_paid") return "Deposit paid";
  if (status === "scheduled") return "Scheduled";
  if (status === "paid") return "Paid";
  if (status === "estimate") return "Estimate";
  return status?.toUpperCase?.() ?? "—";
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "estimate", label: "Estimate" },
  { value: "sent", label: "Sent" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "deposit_paid", label: "Deposit paid" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paid", label: "Paid" },
];

const statusToStage = (s?: string) => {
  const v = normalizePipelineStatus(s);
  if (v === "estimate") return "estimate";
  if (v === "sent" || v === "sent_pending") return "pending";
  if (v === "approved") return "approved";
  if (v === "deposit_paid") return "deposit_paid";
  if (v === "scheduled") return "scheduled";
  if (v === "paid") return "paid";
  return "estimate";
};

const SHOW_INTERNAL_ACTIONS = true;

const canRecordPayment = (status: string) => status === "scheduled" || status === "paid" || status === "deposit_paid";
const isPendingApproval = (status: string) => status === "sent" || status === "pending" || status === "sent_pending";

const getStage = (e: any) => {
  if (e?.status) return e.status;
  if ((e as any)?.isPaid) return "paid";
  if ((e as any)?.isScheduled) return "scheduled";
  if ((e as any)?.isApproved) return "approved";
  if (e?.sentAt || e?.sentTo || e?.sentToEmail) return "sent_pending";
  return "estimate";
};

const getApprovalLink = (e: any): string | null => {
  if (e?.approvalUrl) return e.approvalUrl;
  if (e?.approvalToken) return `/approve/${e.approvalToken}`;
  const token = e?.approval_token || (e?.approval as any)?.token;
  if (token) return `/approve/${token}`;
  return null;
};

const absLink = (link: string) => {
  if (!link) return "";
  if (link.startsWith("http")) return link;
  const base = getClientBaseUrl();
  return base ? `${base}${link}` : (typeof window !== "undefined" ? window.location.origin : "") + link;
};

const buildApprovalUrl = (e: any) => {
  const link = getApprovalLink(e);
  return link ? absLink(link) : "";
};

const copyToClipboard = async (text: string) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
};

type SavedStatusUI =
  | "estimate"
  | "sent"
  | "sent_pending"
  | "pending"
  | "viewed"
  | "approved"
  | "deposit_paid"
  | "scheduled"
  | "paid"
  | string;

function statusLabel(status: SavedStatusUI) {
  const s = String(status || "").toLowerCase();

  if (s === "sent_pending" || s === "pending" || s === "pending_approval" || s === "sent") return "Pending approval";
  if (s === "estimate" || s === "draft") return "Estimate";
  if (s === "viewed") return "Viewed";
  if (s === "approved") return "Approved";
  if (s === "deposit_paid") return "Deposit paid";
  if (s === "scheduled") return "Scheduled";
  if (s === "paid") return "Paid";

  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusPill({ status }: { status: string }) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset";
  const dot = "h-1.5 w-1.5 rounded-full";

  if (status === "sent" || status === "sent_pending") {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-300 ring-emerald-500/20`}>
        <span className={`${dot} bg-emerald-400`} />
        Pending Approval
      </span>
    );
  }
  if (status === "viewed") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300/90">
        Viewed
      </span>
    );
  }
  if (status === "not_viewed") {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/50">
        Not viewed
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className={`${base} bg-sky-500/10 text-sky-300 ring-sky-500/20`}>
        <span className={`${dot} bg-sky-400`} />
        Approved
      </span>
    );
  }
  if (status === "deposit_paid") {
    return (
      <span className={`${base} bg-violet-500/10 text-violet-300 ring-violet-500/20`}>
        <span className={`${dot} bg-violet-400`} />
        Deposit paid
      </span>
    );
  }
  if (status === "scheduled") {
    return (
      <span className={`${base} bg-violet-500/10 text-violet-300 ring-violet-500/20`}>
        <span className={`${dot} bg-violet-400`} />
        Scheduled
      </span>
    );
  }
  if (status === "paid") {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 ring-amber-500/20`}>
        <span className={`${dot} bg-amber-400`} />
        Paid
      </span>
    );
  }
  return (
    <span className={`${base} bg-white/5 text-white/70 ring-white/10`}>
      <span className={`${dot} bg-white/40`} />
      Estimate
    </span>
  );
}

function Stepper({ status }: { status: string }) {
  const steps = ["estimate", "sent_pending", "approved", "deposit_paid", "scheduled", "paid"] as const;
  const labels: Record<(typeof steps)[number], string> = {
    estimate: "Estimate",
    sent_pending: "Pending",
    approved: "Approved",
    deposit_paid: "Deposit",
    scheduled: "Scheduled",
    paid: "Paid",
  };
  const stepStatus = status === "sent" ? "sent_pending" : status;

  const idx = steps.indexOf(stepStatus as (typeof steps)[number]);
  const activeIndex = idx === -1 ? 0 : idx;

  return (
    <div className="mt-3 flex items-center gap-2 text-[11px] text-white/55">
      {steps.map((s, i) => {
        const done = i <= activeIndex;
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-2",
                done ? "text-white/80" : "text-white/35",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  done ? "bg-emerald-400" : "bg-white/20",
                ].join(" ")}
              />
              {labels[s]}
            </span>
            {i < steps.length - 1 && (
              <span className={done ? "text-emerald-400/30" : "text-white/15"}>—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PipelineBar({ status, isViewed }: { status: string; isViewed?: boolean }) {
  const steps = ["estimate", "sent_pending", "approved", "deposit_paid", "scheduled", "paid"] as const;
  const labels: Record<(typeof steps)[number], string> = {
    estimate: "Estimate",
    sent_pending: "Pending",
    approved: "Approved",
    deposit_paid: "Deposit",
    scheduled: "Scheduled",
    paid: "Paid",
  };
  const stepStatus = status === "sent" ? "sent_pending" : status;

  const idx = steps.indexOf((stepStatus || "estimate") as any);
  const activeIndex = idx === -1 ? 0 : idx;
  const pct = (activeIndex / (steps.length - 1)) * 100;

  return (
    <div className="mt-4">
      {/* labels row */}
      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold tracking-wide">
        {steps.map((s, i) => {
          const done = i <= activeIndex;
          return (
            <span key={s} className={done ? "text-white/70" : "text-white/30"}>
              {labels[s]}
            </span>
          );
        })}
      </div>

      {/* track */}
      <div className="h-1.5 w-full rounded-full bg-white/10">
        <div
          className="h-1.5 rounded-full bg-emerald-400/70 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* dots row */}
      <div className="mt-2 flex items-center justify-between">
        {steps.map((s, i) => {
          const done = i <= activeIndex;
          const isPendingStep = s === "sent_pending";
          const dotClass =
            done
              ? isPendingStep && isViewed
                ? "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]"
                : "bg-emerald-400"
              : "bg-white/15";
          return (
            <span
              key={s}
              className={["h-3 w-3 rounded-full", dotClass].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}

type TimeWindow = "all" | "month" | "30d";

function RevenueSummary({
  estimates,
  onMetrics,
}: {
  estimates: any[];
  onMetrics?: (m: { pipelineTotal: number; collected: number; closeRate: number }) => void;
}) {
  const [window, setWindow] = useState<TimeWindow>("all");

  const now = useMemo(() => new Date(), []);

  const startDate = useMemo(() => {
    if (window === "all") return null;

    if (window === "month") {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // window === "30d"
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }, [window, now]);

  const inWindow = (e: any) => {
    if (!startDate) return true;

    const raw =
      e.createdAt ??
      e.savedAt ??
      e.updatedAt ??
      e.sentAt ??
      e.scheduledAt ??
      e.paidAt;

    if (!raw) return true; // if no timestamp, keep it (prevents "missing data" blanks)

    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return true;

    return dt >= startDate;
  };

  const scoped = useMemo(() => estimates.filter(inWindow), [estimates, startDate]);

  const getValue = (e: any) =>
    typeof e.totalContractPrice === "number"
      ? e.totalContractPrice
      : typeof e.suggestedPrice === "number"
      ? e.suggestedPrice
      : 0;

  const valueOf = (e: any) => {
    const v = Number(getValue(e));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };

  const sum = (status: string) =>
    scoped
      .filter((e) => (e.status ?? "estimate") === status)
      .reduce((acc, e) => acc + valueOf(e), 0);

  const approved = sum("approved");
  const scheduled = sum("scheduled");
  const paid = sum("paid");

  // Pipeline (CRM-correct) = all work value in window (includes paid)
  const pipelineTotal = scoped.reduce((acc, e) => acc + valueOf(e), 0);

  // Collected = paid value in window
  const collected = paid;

  // Open pipeline = how much is still out there
  const openPipeline = Math.max(0, pipelineTotal - collected);

  // % collected
  const pct =
    pipelineTotal > 0 ? Math.min(1, Math.max(0, collected / pipelineTotal)) : 0;
  const pctLabel = `${Math.round(pct * 100)}%`;

  // Close Rate (jobs: paid / total, only count jobs with value > 0)
  const statusOf = (e: any) =>
    ((e?.status ?? "estimate") as
      | "estimate"
      | "sent"
      | "approved"
      | "scheduled"
      | "paid");
  const jobs = scoped.filter((e) => valueOf(e) > 0);
  const totalJobs = jobs.length;
  const paidJobs = jobs.filter((e) => statusOf(e) === "paid").length;
  const closeRate = totalJobs > 0 ? paidJobs / totalJobs : 0;
  const closeRateLabel = `${Math.round(closeRate * 100)}%`;

  useEffect(() => {
    onMetrics?.({ pipelineTotal, collected, closeRate });
  }, [onMetrics, pipelineTotal, collected, closeRate]);

  const averageJobValue =
    totalJobs > 0 ? pipelineTotal / totalJobs : 0;

  // MoM (Month over Month) comparisons
  const dateOf = (e: any): Date | null => {
    const raw =
      e?.updatedAt ??
      e?.savedAt ??
      e?.createdAt ??
      e?.timestamp ??
      e?.withTimestamps?.updatedAt ??
      e?.withTimestamps?.createdAt;

    if (!raw) return null;

    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  };

  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const addMonths = (d: Date, months: number) =>
    new Date(d.getFullYear(), d.getMonth() + months, 1);

  const inRange = (d: Date, start: Date, end: Date) =>
    d.getTime() >= start.getTime() && d.getTime() < end.getTime();

  const nowMoM = new Date();
  const thisMonthStart = startOfMonth(nowMoM);
  const nextMonthStart = addMonths(thisMonthStart, 1);
  const lastMonthStart = addMonths(thisMonthStart, -1);
  const lastMonthEnd = thisMonthStart;

  const jobsThisMonth = jobs.filter((e) => {
    const d = dateOf(e);
    return d ? inRange(d, thisMonthStart, nextMonthStart) : false;
  });
  const jobsLastMonth = jobs.filter((e) => {
    const d = dateOf(e);
    return d ? inRange(d, lastMonthStart, lastMonthEnd) : false;
  });

  const sumValue = (arr: any[]) => arr.reduce((acc, e) => acc + valueOf(e), 0);
  const sumPaid = (arr: any[]) =>
    arr.reduce((acc, e) => acc + (statusOf(e) === "paid" ? valueOf(e) : 0), 0);

  const pipelineThisMonth = sumValue(jobsThisMonth);
  const pipelineLastMonth = sumValue(jobsLastMonth);

  const collectedThisMonth = sumPaid(jobsThisMonth);
  const collectedLastMonth = sumPaid(jobsLastMonth);

  const collectedRateThisMonth =
    pipelineThisMonth > 0 ? collectedThisMonth / pipelineThisMonth : 0;
  const collectedRateLastMonth =
    pipelineLastMonth > 0 ? collectedLastMonth / pipelineLastMonth : 0;

  const paidJobsThisMonth = jobsThisMonth.filter(
    (e) => statusOf(e) === "paid"
  ).length;
  const paidJobsLastMonth = jobsLastMonth.filter(
    (e) => statusOf(e) === "paid"
  ).length;

  const totalJobsThisMonth = jobsThisMonth.length;
  const totalJobsLastMonth = jobsLastMonth.length;

  const closeRateThisMonth =
    totalJobsThisMonth > 0 ? paidJobsThisMonth / totalJobsThisMonth : 0;
  const closeRateLastMonth =
    totalJobsLastMonth > 0 ? paidJobsLastMonth / totalJobsLastMonth : 0;

  const toPp = (x: number) => Math.round(x * 100);
  const collectedMoMPp = toPp(collectedRateThisMonth - collectedRateLastMonth);
  const closeMoMPp = toPp(closeRateThisMonth - closeRateLastMonth);

  const ppLabel = (pp: number) =>
    pp > 0 ? `+${pp}pp` : pp < 0 ? `${pp}pp` : `0pp`;

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const Row = ({
    label,
    value,
    tone,
  }: {
    label: string;
    value: number;
    tone?: "default" | "good";
  }) => (
    <div className="flex items-center justify-between py-3">
      <div className="text-sm font-semibold text-white/70">{label}</div>
      <div
        className={[
          "text-sm font-semibold tabular-nums",
          tone === "good" ? "text-emerald-200" : "text-white",
        ].join(" ")}
      >
        {fmt(value)}
      </div>
    </div>
  );

  const ToggleBtn = ({
    id,
    label,
  }: {
    id: TimeWindow;
    label: string;
  }) => {
    const active = window === id;
    return (
      <button
        type="button"
        onClick={() => setWindow(id)}
        className={[
          "h-9 rounded-full px-3 text-xs font-semibold transition border",
          active
            ? "bg-white/[0.10] border-white/20 text-white"
            : "bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.07] hover:text-white/90 hover:border-white/20",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Revenue Summary</div>
          <div className="mt-1 text-xs text-white/45">
            {window === "all"
              ? "All-time totals from your saved pipeline"
              : window === "month"
              ? "This month's totals"
              : "Last 30 days totals"}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <ToggleBtn id="all" label="All Time" />
            <ToggleBtn id="month" label="This Month" />
            <ToggleBtn id="30d" label="Last 30 Days" />
          </div>
        </div>

        <div className="w-[220px] rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/70">
            Pipeline
          </div>
          <div className="mt-0.5 text-lg font-semibold text-emerald-200 tabular-nums">
            {fmt(pipelineTotal)}
          </div>

          {/* Progress bar (min visual width for 1–5%, true 0 stays empty) */}
          <div className="mt-2 h-2 w-full rounded-full bg-black/20 border border-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400/70"
              style={{
                width:
                  pipelineTotal > 0
                    ? `${pct === 0 ? 0 : Math.max(6, pct * 100)}%`
                    : "0%",
              }}
            />
          </div>

          <div className="mt-2 text-xs text-white/60">
            <span className="tabular-nums text-white/80">{fmt(collected)}</span>{" "}
            collected
            <span className="ml-2 text-white/50">
              · {fmt(openPipeline)} open
            </span>
          </div>
          <div className="mt-1 text-xs text-white/50">
            {paidJobs} paid / {totalJobs} total jobs
          </div>
          <div className="flex items-center justify-between mt-1 text-[12px] text-white/60">
            <span>Average Job Value</span>
            <span className="font-medium text-white/80">
              ${averageJobValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4">
        <Row label="Approved" value={approved} />
        <div className="h-px bg-white/10" />
        <Row label="Scheduled" value={scheduled} />
        <div className="h-px bg-white/10" />
        <Row label="Paid" value={paid} tone="good" />
      </div>
    </div>
  );
}

function SavedEstimateCard({
  estimate,
  batchStatuses,
  onLoad,
  onDelete,
  onStatusChange,
  onSend,
  onSchedule,
  onRecordPayment,
  onMarkApproved,
  onView,
  isFlashing,
}: {
  estimate: any;
  batchStatuses?: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>;
  onLoad: (e: any) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: any) => void;
  onSend?: (e: any) => void;
  onSchedule?: (e: any) => void;
  onRecordPayment?: (e: any) => void;
  onMarkApproved?: (e: any) => void;
  onView?: (e: any) => void;
  isFlashing?: boolean;
}) {
  const status = normalizePipelineStatus(getStage(estimate));
  const remote = estimate?.approvalToken && batchStatuses ? batchStatuses[estimate.approvalToken] : null;
  const viewedAt = (estimate?.viewedAt ?? remote?.viewedAt ?? null) as string | null;
  const isSent = status === "sent" || status === "sent_pending";
  const isApproved = status === "approved" || status === "deposit_paid" || status === "scheduled" || status === "paid";
  const effectiveStatus =
    remote?.status === "approved"
      ? "approved"
      : remote?.status === "viewed" || remote?.viewedAt
        ? "viewed"
        : status === "sent" || status === "sent_pending"
          ? "sent"
          : status;
  const displayStatus =
    isApproved ? effectiveStatus : isSent && viewedAt ? "viewed" : isSent && !viewedAt ? "not_viewed" : effectiveStatus;
  const hasApproval = Boolean(estimate?.approvalToken);
  const statusStr = (estimate?.status ?? "").toLowerCase();
  const isSentLike =
    statusStr === "sent" ||
    statusStr === "pending" ||
    statusStr === "pending approval" ||
    statusStr === "pending_approval" ||
    statusStr === "sent_pending";
  const showApprovalActions = hasApproval && isSentLike;
  const awaitingApproval = isAwaitingApproval(estimate, status);
  const addr = estimate.address || estimate.jobAddress || estimate.jobAddress1;
  const addrExtra = [estimate.city ?? estimate.jobCity, estimate.state ?? estimate.jobState, estimate.zip ?? estimate.jobZip].filter(Boolean).join(", ");
  return (
    <div
      className={`group relative rounded-3xl border border-white/12 bg-gradient-to-b from-slate-900/70 to-slate-950/40 p-6 transition-all duration-300
  ${showApprovalActions || status === "sent" || status === "sent_pending"
    ? "border-emerald-300/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]"
    : "hover:border-white/20"}
  ${isFlashing ? "ring-2 ring-emerald-400/60" : ""}`}
    >
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70 ring-1 ring-inset ring-white/10">
                {(estimate.tierLabel ?? estimate.selectedTier ?? "Core").toString()}
              </span>

              <StatusPill status={displayStatus} />
            </div>

            <div className="mt-4 text-xl font-bold text-white tracking-tight">
              {estimate.customerName || "Unnamed Customer"}
            </div>

            <div className="mt-2 text-sm text-white/70 truncate">
              {estimate.customerEmail || "No email"}
            </div>

            <div className="mt-1 text-sm text-white/45 leading-relaxed">
              {addr || "No address"}
              {addrExtra ? `, ${addrExtra}` : ""}
            </div>

            <div className="mt-2 text-sm text-white/60">
              Roof area saved:{" "}
              <span className="font-semibold text-white/80">
                {estimate.area ?? estimate.roofAreaSqFt ?? "—"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2 text-right">
            {/* Status line (primary) */}
            <div className="text-emerald-300 text-sm font-semibold">
              {isSent && !viewedAt
                ? "Sent — not viewed yet"
                : isSent && viewedAt
                  ? "Viewed — pending approval"
                  : effectiveStatus === "approved" && estimate.needsScheduling
                    ? "Approved — ready to schedule"
                    : showApprovalActions || isPendingApproval(getStage(estimate))
                      ? "Pending approval"
                      : getDisplayStage(effectiveStatus)}
            </div>

            {(status === "sent" || status === "sent_pending") && (
              <div className="text-xs text-white/50 mt-1">
                {viewedAt ? (
                  <>
                    Viewed {formatShortDate(estimate.viewedAt ?? viewedAt)}{" "}
                    <span className="text-white/40">
                      ({timeAgo(estimate.viewedAt ?? viewedAt)})
                    </span>
                    <span className="text-white/40">
                      {" · Sent "}{formatShortDate(estimate.sentAt ?? estimate.sent_at ?? estimate.sentDate ?? estimate.createdAt)}
                    </span>
                  </>
                ) : (
                  <>
                    Sent {formatShortDate(estimate.sentAt ?? estimate.sent_at ?? estimate.sentDate ?? estimate.createdAt)}
                  </>
                )}
              </div>
            )}

            {estimate.approvedAt && status === "approved" && (
              <div className="mt-0.5 text-xs text-white/35">Approved {formatDatePretty(estimate.approvedAt)}</div>
            )}
            {estimate.createdAt && !showApprovalActions && !isPendingApproval(getStage(estimate)) && (
              <div className="mt-0.5 text-xs text-white/35">Saved {formatDatePretty(estimate.createdAt)}</div>
            )}

            <select
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 outline-none hover:bg-white/[0.06]"
              value={normalizeStatusValue(getStage(estimate))}
              onChange={(ev) => {
                const raw = ev.target.value;
                onStatusChange(estimate.id, raw === "pending" ? "sent_pending" : raw);
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <PipelineBar status={getStage(estimate)} isViewed={isSent && !!viewedAt} />

        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-6">
          {/* LEFT: Total */}
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] tracking-[0.25em] text-white/40">
              TOTAL
            </span>
            <span className="text-4xl font-semibold tracking-tight text-white">
              {(() => {
                const n =
                  typeof estimate.totalContractPrice === "number"
                    ? estimate.totalContractPrice
                    : typeof estimate.suggestedPrice === "number"
                    ? estimate.suggestedPrice
                    : undefined;

                return n == null
                  ? "—"
                  : `$${n.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`;
              })()}
            </span>
          </div>

          {/* RIGHT: Actions */}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white hover:bg-white/[0.06]"
              onClick={() => onLoad(estimate)}
            >
              Load
            </button>

            {/* ===== PAYMENT ACTIONS ===== */}
            {estimate.status !== "paid" && (
              <div className="flex flex-wrap gap-2 mt-3">
                {estimate.status !== "deposit_paid" && (
                  <button
                    type="button"
                    onClick={() => startCheckout(estimate.id, "deposit")}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition"
                  >
                    Collect Deposit
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => startCheckout(estimate.id, "full")}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition"
                >
                  Collect Full
                </button>

                <button
                  type="button"
                  onClick={() => onRecordPayment?.(estimate)}
                  className="rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition"
                >
                  Record Payment
                </button>
              </div>
            )}

            {SHOW_INTERNAL_ACTIONS && (
              <>
                {showApprovalActions && (
                  <>
                    {getApprovalLink(estimate) ? (
                      <button
                        type="button"
                        className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white hover:bg-white/[0.10]"
                        onClick={async () => {
                          const link = getApprovalLink(estimate);
                          if (link) await copyToClipboard(absLink(link));
                        }}
                      >
                        Copy Approval Link
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-full border border-emerald-400/20 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
                      onClick={() => onMarkApproved?.(estimate)}
                    >
                      Mark Approved
                    </button>
                  </>
                )}

                {canRecordPayment(status) && (
                  <button
                    type="button"
                    className="rounded-full border border-emerald-400/20 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
                    onClick={() => onRecordPayment?.(estimate)}
                  >
                    Record Payment
                  </button>
                )}

                {(status === "approved" || status === "deposit_paid" || status === "scheduled" || status === "paid") && (
                  <button
                    type="button"
                    className="rounded-full border border-emerald-400/20 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20"
                    onClick={() => onSchedule?.(estimate)}
                    title={status === "scheduled" ? "Update the scheduled date" : "Pick a date to schedule the job"}
                  >
                    {status === "scheduled" ? "Reschedule Job" : "Schedule Job"}
                  </button>
                )}

                {status === "paid" && (
                  <div className="rounded-full px-4 py-2 text-sm font-semibold border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 flex items-center">
                    Paid ✅
                  </div>
                )}

                <button
                  type="button"
                  className="rounded-full border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/15"
                  onClick={() => onDelete(estimate.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SavedClient() {
  const buildSha = (process.env.NEXT_PUBLIC_BUILD_SHA || "local").toString().slice(0, 7);
  useEffect(() => {
    console.log("[BUILD]", buildSha);
  }, [buildSha]);
  const [hydrated, setHydrated] = useState(false);
  const [estimates, setEstimates] = useState<RoofingEstimate[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "estimate" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "paid">("all");
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
  const [revenueMetrics, setRevenueMetrics] = useState<{
    pipelineTotal: number;
    collected: number;
    closeRate: number;
  } | null>(null);
  const [showRevenueDetails, setShowRevenueDetails] = useState(false);
  const [paymentContractTotal, setPaymentContractTotal] = useState("");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [batchStatuses, setBatchStatuses] = useState<Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>>({});
  const router = useRouter();
  const isSyncingRef = useRef(false);

  const ARRIVAL_WINDOW_OPTIONS = [
    { value: "", label: "No window" },
    { value: "8–10am", label: "8–10am" },
    { value: "10am–12pm", label: "10am–12pm" },
    { value: "12–2pm", label: "12–2pm" },
    { value: "2–4pm", label: "2–4pm" },
    { value: "4–6pm", label: "4–6pm" },
  ];
  const STAGES = ["estimate", "sent_pending", "approved", "scheduled", "paid"] as const;
  const STAGE_LABELS: Record<string, string> = { estimate: "Estimate", sent: "Pending", sent_pending: "Pending", approved: "Approved", scheduled: "Scheduled", paid: "Paid" };
  const STAGE_DOT_CLASS: Record<string, string> = {
    estimate: "bg-white/50",
    sent: "bg-emerald-400",
    sent_pending: "bg-emerald-400",
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

  useEffect(() => {
    const paid = searchParams.get("paid");
    const id = searchParams.get("id");
    if (paid !== "1" || !id) return;

    (async () => {
      try {
        const res = await fetch(`/api/payments/status?estimateId=${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!json?.ok || !json?.payment?.status) return;

        const paymentStatus = json.payment.status as "deposit_paid" | "paid";
        if (paymentStatus === "paid" || paymentStatus === "deposit_paid") {
          markSavedEstimateStatus(id, paymentStatus);
          setEstimates(getNormalizedEstimates());
        }
        window.history.replaceState({}, "", "/tools/roofing/saved");
      } catch {
        // ignore
      }
    })();
  }, [searchParams]);

  function handleSendFromSaved(savedId: string) {
    sessionStorage.setItem("ttai_autoSendEstimateId", savedId);
    router.push("/tools/roofing");
  }

  const refreshSaved = () => setEstimates(getNormalizedEstimates());

  const openSchedule = (id: string) => {
    setActiveId(id);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setScheduleDate(`${yyyy}-${mm}-${dd}`);
    setIsScheduleOpen(true);
  };

  const openPayment = (id: string, total?: number) => {
    setActiveId(id);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setPaymentDate(`${yyyy}-${mm}-${dd}`);
    const t = toNumberSafe(total);
    setPaidAmountInput(t > 0 ? String(t.toFixed(2)) : "");
    setIsPaymentOpen(true);
  };

  const confirmSchedule = () => {
    if (!activeId) return;
    try {
      markSavedEstimateScheduled(activeId, scheduleDate || new Date().toISOString().slice(0, 10));
      refreshSaved();
      setToast("Scheduled ✅");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      console.error("[SAVED] schedule failed", e);
    }
    setIsScheduleOpen(false);
    setActiveId(null);
  };

  const confirmPayment = () => {
    if (!activeId) return;
    const paidAmount = toNumberSafe(paidAmountInput);
    try {
      markSavedEstimateStatus(activeId, "paid", {
        paidAt: paymentDate
          ? new Date(paymentDate).toISOString()
          : new Date().toISOString(),
      });
      updateSavedEstimate(activeId, {
        amountPaid: paidAmount,
        paidDate: paymentDate || new Date().toISOString().slice(0, 10),
      });
      refreshSaved();
      setToast("Payment recorded ✅");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      console.error("[SAVED] record payment failed", e);
    }
    setIsPaymentOpen(false);
    setActiveId(null);
  };

  const handleViewDetails = (estimate: RoofingEstimate) => {
    setCurrentLoadedSavedId(estimate.id);
    router.push(`/tools/roofing?loadSaved=${encodeURIComponent(estimate.id)}`);
  };

  type ActionKey =
    | "load"
    | "send"
    | "approve"
    | "schedule"
    | "pay"
    | "delete";

  const handleAction = (est: RoofingEstimate, action: ActionKey) => {
    const id = est?.id;
    if (!id) return;

    if (action === "load") {
      setCurrentLoadedSavedId(id);
      router.push(`/tools/roofing?loadSaved=${encodeURIComponent(id)}`);
      return;
    }

    if (action === "delete") {
      deleteSavedEstimate(id);
      refreshSaved();
      return;
    }

    if (action === "send") {
      handleSendFromSaved(id);
      return;
    }

    if (action === "approve") {
      try {
        markSavedEstimateStatus(id, "approved");
        updateSavedEstimate(id, { approvedAt: new Date().toISOString(), needsScheduling: true });
        refreshSaved();
        setToast("Approved ✅");
        setTimeout(() => setToast(null), 2500);
      } catch (e) {
        console.error("[SAVED] approve failed", e);
      }
      return;
    }

    if (action === "schedule") {
      openSchedule(id);
      return;
    }

    if (action === "pay") {
      const total =
        est.totalContractPrice ??
        est.suggestedPrice ??
        (est as any).priceWithMargin ??
        (est as any).contractTotal ??
        0;
      openPayment(id, total);
      return;
    }
  };

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

  const runApprovalSync = useCallback(() => {
    if (!hydrated || isSyncingRef.current) return;
    const list = getSavedEstimates();
    const withToken = list.filter((e) => e.approvalToken);
    const tokens = withToken.map((e) => e.approvalToken!);
    if (tokens.length === 0) return;
    isSyncingRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/approval/batch-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokens }),
        });
        const json = await res.json();
        if (!res.ok) return;
        const statuses = json?.statuses ?? {};
        setBatchStatuses(statuses);
        let approvedCount = 0;
        for (const token of tokens) {
          const st = statuses[token];
          if (st?.status === "approved") {
            const { changed } = markSavedEstimateApprovedByToken(token, st.approvedAt);
            if (changed) approvedCount++;
          }
          if (st?.viewedAt) markEstimateViewedByToken(token, st.viewedAt);
        }
        setEstimates(getNormalizedEstimates());
        if (approvedCount > 0) {
          setToast(approvedCount === 1 ? "🎉 1 estimate approved — follow up to schedule." : `🎉 ${approvedCount} estimates approved — follow up to schedule.`);
          setTimeout(() => setToast(null), 4000);
        }
      } catch {
        /* ignore */
      } finally {
        isSyncingRef.current = false;
      }
    })();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    runApprovalSync();
  }, [hydrated, runApprovalSync]);

  useEffect(() => {
    if (!hydrated) return;
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") runApprovalSync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [hydrated, runApprovalSync]);

  useEffect(() => {
    if (!hydrated) return;
    const interval = setInterval(runApprovalSync, 30_000);
    return () => clearInterval(interval);
  }, [hydrated, runApprovalSync]);

  useEffect(() => {
    if (!hydrated || !estimates?.length) return;
    let cancelled = false;

    async function syncPaymentStatuses() {
      const candidates = estimates.filter((e) => e?.status !== "paid");
      for (const est of candidates) {
        const id = String(est?.id ?? "").trim();
        if (!id) continue;
        const payment = await fetchPaymentState(id);
        if (cancelled) return;
        if (payment?.status === "paid" && est.status !== "paid") {
          markSavedEstimateStatus(id, "paid");
        } else if (payment?.status === "deposit_paid" && est.status !== "deposit_paid") {
          if (est.status === "approved" || est.status === "scheduled") {
            markSavedEstimateStatus(id, "deposit_paid");
          }
        }
      }
      if (!cancelled) setEstimates(getNormalizedEstimates());
    }

    syncPaymentStatuses();
    return () => {
      cancelled = true;
    };
  }, [hydrated, estimates]);

  const bySearch = (e: RoofingEstimate) => {
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
  };

  const searchFiltered = useMemo(() => estimates.filter(bySearch), [estimates, query]);

  const filtered = searchFiltered
    .filter((e) => {
      if (statusFilter === "all") return true;
      const s = e.status || "estimate";
      const norm = normalizeStatusValue(s);
      if (statusFilter === "sent_pending") return norm === "pending" || s === "sent";
      return norm === normalizeStatusValue(statusFilter);
    });

  // ===============================
  // STAGE CONVERSION (STAGE REACHED)
  // Order: estimate -> sent -> approved -> scheduled -> paid
  // A later status implies all prior stages were reached.
  // ===============================
  const savedEstimates = searchFiltered;
  const countByStatus = (status: "estimate" | "sent" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "paid") =>
    savedEstimates.filter((e) => (e?.status ?? "estimate") === status).length;

  const totalJobs = savedEstimates.length;
  const totalEstimateOnly = countByStatus("estimate");
  const totalSentOnly = countByStatus("sent") + countByStatus("sent_pending");
  const totalApprovedOnly = countByStatus("approved");
  const totalDepositPaidOnly = countByStatus("deposit_paid");
  const totalScheduledOnly = countByStatus("scheduled");
  const totalPaidOnly = countByStatus("paid");

  // "Reached" counts (includes jobs currently in this stage OR beyond)
  const reachedSent = totalSentOnly + totalApprovedOnly + totalDepositPaidOnly + totalScheduledOnly + totalPaidOnly;
  const reachedApproved = totalApprovedOnly + totalDepositPaidOnly + totalScheduledOnly + totalPaidOnly;
  const reachedScheduled = totalScheduledOnly + totalPaidOnly;
  const reachedPaid = totalPaidOnly;

  const pct = (num: number, den: number) => {
    if (!den) return 0;
    return Math.round((num / den) * 100);
  };

  // Conversions between stages (reached-based)
  const estimateToSentPct = pct(reachedSent, totalJobs);
  const sentToApprovedPct = pct(reachedApproved, reachedSent);
  const approvedToScheduledPct = pct(reachedScheduled, reachedApproved);
  const scheduledToPaidPct = pct(reachedPaid, reachedScheduled);

  // Overall close rate (paid of total)
  const overallCloseRatePct = pct(reachedPaid, totalJobs);

  // ===============================
  // WEAKEST STAGE AUTO-DETECTION
  // ===============================
  const stageSteps = [
    { key: "estimate_to_sent", label: "Estimate → Sent", pct: estimateToSentPct },
    { key: "sent_to_approved", label: "Sent → Approved", pct: sentToApprovedPct },
    { key: "approved_to_scheduled", label: "Approved → Scheduled", pct: approvedToScheduledPct },
    { key: "scheduled_to_paid", label: "Scheduled → Paid", pct: scheduledToPaidPct },
  ];

  // pick the lowest conversion (weakest)
  const weakestStage = stageSteps.reduce((min, s) => (s.pct < min.pct ? s : min), stageSteps[0]);

  // ===============================
  // REVENUE FORECAST (based on close rate)
  // Uses same time-filtered metrics as Revenue Summary via onMetrics callback.
  // ===============================
  const pipelineTotal = revenueMetrics?.pipelineTotal ?? 0;
  const collectedTotal = revenueMetrics?.collected ?? 0;
  const closeRatePct = revenueMetrics != null ? Math.round(revenueMetrics.closeRate * 100) : overallCloseRatePct;

  const pipelineDollars = pipelineTotal ?? 0;
  const collectedDollars = collectedTotal ?? 0;
  const closeRatePercent = closeRatePct ?? overallCloseRatePct ?? 0;

  const openPipelineDollars = Math.max(0, pipelineDollars - collectedDollars);
  const closeRateDecimal = Math.min(1, Math.max(0, closeRatePercent / 100));

  const expectedFutureRevenue = openPipelineDollars * closeRateDecimal;
  const expectedTotalCollected = collectedDollars + expectedFutureRevenue;

  // ===============================
  // REVENUE OPPORTUNITY CALCULATOR
  // ===============================

  const improvementScenarios = [5, 10, 15]; // percentage points increase

  const opportunityScenarios = improvementScenarios.map((increase) => {
    const improvedCloseRate = Math.min(100, closeRatePercent + increase);
    const improvedDecimal = improvedCloseRate / 100;
    const improvedExpected = openPipelineDollars * improvedDecimal;
    const additionalRevenue = improvedExpected - expectedFutureRevenue;

    return {
      increase,
      improvedCloseRate,
      additionalRevenue,
    };
  });

  const formatMoney = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-10 text-white">
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

        {/* Build stamp (debug) */}
        <div className="mt-2 text-center text-xs text-white/40">
          Build: <span className="font-mono">{buildSha}</span>
        </div>

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
            className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/90 placeholder:text-white/40 outline-none focus:border-white/20 focus:bg-white/[0.08]"
          />

          <div className="flex flex-wrap gap-2 text-xs">
            {[
              ["all", "All"],
              ["estimate", "Estimate"],
              ["sent_pending", "Pending"],
              ["approved", "Approved"],
              ["deposit_paid", "Deposit paid"],
              ["scheduled", "Scheduled"],
              ["paid", "Paid"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key as any)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                  (statusFilter === key
                    ? "border-white/20 bg-white/[0.10] text-white"
                    : "border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08] hover:text-white/90")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {hydrated && (
          <RevenueSummary
            estimates={searchFiltered}
            onMetrics={setRevenueMetrics}
          />
        )}

        {/* ===============================
            REVENUE INTELLIGENCE (CONSOLIDATED)
        ================================ */}
        {hydrated && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 mt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Revenue Intelligence
                </h3>
                <div className="text-xs text-white/50 mt-1">
                  Insights based on your pipeline performance for this time range.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRevenueDetails((v) => !v)}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.06] active:bg-white/[0.08]"
              >
                {showRevenueDetails ? "Hide details" : "Show details"}
              </button>
            </div>

            {/* Compact summary row (always visible) */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs text-white/50">Close Rate</div>
                <div className="text-lg font-semibold text-white mt-1">
                  {overallCloseRatePct ?? closeRatePercent ?? 0}%
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs text-white/50">Weakest Stage</div>
                <div className="text-lg font-semibold text-white mt-1">
                  {weakestStage.label}
                </div>
                <div className="text-xs text-white/60 mt-1">
                  {weakestStage.pct}% conversion
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs text-white/50">Opportunity (+10%)</div>
                <div className="text-lg font-semibold text-emerald-400 mt-1">
                  {formatMoney(opportunityScenarios?.find((s) => s.increase === 10)?.additionalRevenue ?? 0)}
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {showRevenueDetails && (
              <div className="mt-6 space-y-6">
                {/* Stage Conversion Breakdown (original content) */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      Stage Conversion Breakdown
                    </h3>
                    <div className="text-xs text-white/50">
                      {totalJobs} total jobs
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/80">
                    <div className="flex justify-between">
                      <span>Estimate → Sent</span>
                      <span className="font-semibold text-white">{estimateToSentPct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sent → Approved</span>
                      <span className="font-semibold text-white">{sentToApprovedPct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Approved → Scheduled</span>
                      <span className="font-semibold text-white">{approvedToScheduledPct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Scheduled → Paid</span>
                      <span className="font-semibold text-white">{scheduledToPaidPct}%</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-3 mt-3 col-span-full">
                      <span className="text-white font-medium">Overall Close Rate</span>
                      <span className="font-bold text-emerald-400">{overallCloseRatePct}%</span>
                    </div>
                  </div>
                </div>

                {/* Forecasted Revenue (original content) */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      Forecasted Revenue
                    </h3>
                    <div className="text-xs text-white/50">
                      Based on {Math.round(closeRateDecimal * 100)}% close rate
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/80">
                    <div className="flex justify-between">
                      <span>Open Pipeline</span>
                      <span className="font-semibold text-white">{formatMoney(openPipelineDollars)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Future Revenue</span>
                      <span className="font-semibold text-white">{formatMoney(expectedFutureRevenue)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-3 mt-3 col-span-full">
                      <span className="text-white font-medium">Expected Total Collected</span>
                      <span className="font-bold text-emerald-400">{formatMoney(expectedTotalCollected)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-white/50 mt-3">
                    Forecast uses your current close rate against open pipeline for this time range.
                  </div>
                </div>

                {/* Revenue Opportunity (original content) */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      Revenue Opportunity
                    </h3>
                    <div className="text-xs text-white/50">
                      Based on improving close rate
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-white/80">
                    {opportunityScenarios.map((scenario) => (
                      <div
                        key={scenario.increase}
                        className="flex justify-between border-b border-white/5 pb-2"
                      >
                        <span>+{scenario.increase}% Close Rate</span>
                        <span className="font-semibold text-emerald-400">
                          {formatMoney(scenario.additionalRevenue)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-white/50 mt-3">
                    Increasing close rate directly increases revenue from your existing pipeline.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {hydrated && filtered.map((e) => (
            <SavedEstimateCard
              key={e.id}
              estimate={e}
              batchStatuses={batchStatuses}
              onLoad={(est) => handleAction(est, "load")}
              onDelete={(id) => {
                const est = filtered.find((x) => x.id === id);
                if (est) handleAction(est, "delete");
              }}
              onStatusChange={(id, status) => {
                const statusTyped = status as "estimate" | "sent" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "paid";
                if (statusTyped === "scheduled") {
                  const est = filtered.find((x) => x.id === id);
                  if (est && !est.scheduledStartDate) {
                    setToast("Pick a start date to schedule.");
                    setTimeout(() => setToast(null), 2500);
                    setSchedulingForId(id);
                    setScheduleStartDate((est?.scheduledStartDate || "").trim() || new Date().toISOString().slice(0, 10));
                    setScheduleArrivalWindow((est?.scheduledArrivalWindow || "").trim());
                    setScheduleNotes((est?.scheduleNotes || "").trim());
                    return;
                  }
                }
                updateSavedEstimate(id, { status: statusTyped });
                setEstimates(getNormalizedEstimates());
                const label = statusTyped.charAt(0).toUpperCase() + statusTyped.slice(1);
                setToast(statusTyped === "approved" ? "Approved ✅" : statusTyped === "scheduled" ? "Scheduled ✅" : `Status updated → ${label}`);
                setTimeout(() => setToast(null), 2500);
              }}
              onSend={(est) => handleAction(est, "send")}
              onSchedule={(est) => handleAction(est, "schedule")}
              onRecordPayment={(est) => handleAction(est, "pay")}
              onMarkApproved={(est) => handleAction(est, "approve")}
              onView={(est) => handleAction(est, "load")}
              isFlashing={e.id === flashId}
            />
          ))}
        </div>
      </div>

      {/* Global scheduling modal */}
      {schedulingForId && (() => {
        const e = filtered.find((x) => x.id === schedulingForId);
        if (!e) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => {
              setSchedulingForId(null);
              setScheduleStartDate("");
              setScheduleArrivalWindow("");
              setScheduleNotes("");
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-xl"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="text-sm font-semibold text-white">{e.customerName || "Schedule job"}</div>
              <div className="mt-3 space-y-2">
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
              </div>
              <div className="mt-4 flex gap-2">
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
                  className="rounded-xl px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-50"
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
                  className="rounded-xl bg-white/5 hover:bg-white/10 px-3 py-2 text-xs text-white/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Schedule modal (simple) */}
      {isScheduleOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">
                Schedule Job
              </div>
              <button
                className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10"
                onClick={() => {
                  setIsScheduleOpen(false);
                  setActiveId(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs text-white/60">Scheduled date</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              />
              <div className="mt-2 text-xs text-white/50">
                This will move the job to{" "}
                <span className="text-white/70">Scheduled</span> and update
                revenue totals.
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setIsScheduleOpen(false);
                  setActiveId(null);
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={confirmSchedule}
                className="flex-1 rounded-2xl bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/25 hover:bg-emerald-500/20"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Payment modal */}
      {isPaymentOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">
                Record Payment
              </div>
              <button
                className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10"
                onClick={() => {
                  setIsPaymentOpen(false);
                  setActiveId(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs text-white/60">Paid date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Amount paid</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                />
                <div className="mt-2 text-xs text-white/50">
                  This will move the job to{" "}
                  <span className="text-white/70">Paid</span> and update{" "}
                  <span className="text-white/70">collected</span>.
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setIsPaymentOpen(false);
                  setActiveId(null);
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={confirmPayment}
                className="flex-1 rounded-2xl bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/25 hover:bg-emerald-500/20"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
