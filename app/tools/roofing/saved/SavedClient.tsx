"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toLocalDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatLocalDateHeader(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map((v) => Number(v));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const ARRIVAL_WINDOWS = [
  { value: "7-10", label: "7–10 AM" },
  { value: "8-12", label: "8–12 AM" },
  { value: "10-2", label: "10 AM–2 PM" },
  { value: "12-5", label: "12–5 PM" },
  { value: "2-6", label: "2–6 PM" },
  { value: "Anytime", label: "Anytime" },
] as const;

const ARRIVAL_CUSTOM = "__custom__";

const ROOFING_SAVED_RETURN_STATUS_FILTER = "roofing_saved_return_status_filter";
const ROOFING_SAVED_RETURN_SCHEDULED_VIEW = "roofing_saved_return_scheduled_view";
const ROOFING_SAVED_RETURN_QUERY = "roofing_saved_return_query";

function isStandardArrivalValue(v: string) {
  return ARRIVAL_WINDOWS.some((x) => x.value === v);
}

function arrivalLabelFromValue(v: string) {
  const found = ARRIVAL_WINDOWS.find((x) => x.value === v);
  return found?.label ?? v;
}

function normalizeDateKey(input: any): string | null {
  if (!input) return null;
  const s = String(input).trim();

  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO datetime -> take YYYY-MM-DD
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  return null;
}

function dateFromDateKeyLocal(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1); // LOCAL date (prevents timezone shift)
}

function formatDateKeyLocal(dateKey: string): string {
  const dt = dateFromDateKeyLocal(dateKey);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function getScheduledDateKeyFromEstimate(est: any): string | null {
  const candidates = [
    est?.scheduledStartDate,
    (est as any)?.schedule?.date,
    est?.scheduleInfo?.date,
    (est as any)?.scheduled?.date,
    est?.scheduleDate,
  ];

  for (const c of candidates) {
    const key = normalizeScheduleDateISO(c) ?? normalizeDateKey(c);
    if (key) return key;
  }
  return null;
}

function parseISODateOnly(isoOrDate: string): Date | null {
  const raw = (isoOrDate ?? "").trim();
  if (!raw) return null;
  const key = normalizeScheduleDateISO(raw) ?? normalizeDateKey(raw);
  if (!key) {
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return null;
    return startOfDay(d);
  }
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatHeaderDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function smartTimeAgoLabel(date?: string | null) {
  if (!date) return null;

  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return null;

  const now = Date.now();
  const diffMs = Math.max(0, now - then);

  const hour = 1000 * 60 * 60;
  const day = hour * 24;

  if (diffMs < hour) return "today";

  const diffDays = Math.floor(diffMs / day);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

function buildStageAgeText(args: {
  status: string;
  isSent: boolean;
  viewedAt?: string | null;
  estimate: any;
  showDepositPaid: boolean;
  showPaid: boolean;
}) {
  const { status, isSent, viewedAt, estimate, showDepositPaid, showPaid } = args;

  const createdAt =
    estimate?.createdAt ??
    estimate?.created_at ??
    null;

  const sentAt =
    estimate?.sentAt ??
    estimate?.sent_at ??
    estimate?.sentDate ??
    createdAt ??
    null;

  const approvedAt =
    estimate?.approvedAt ??
    estimate?.approved_at ??
    null;

  const depositPaidAt =
    estimate?.depositPaidAt ??
    estimate?.deposit_paid_at ??
    estimate?.paymentReceivedAt ??
    estimate?.payment_received_at ??
    estimate?.paidAt ??
    estimate?.paid_at ??
    null;

  const scheduledAt =
    estimate?.scheduledAt ??
    estimate?.scheduled_at ??
    estimate?.scheduledStartDate ??
    null;

  const completedAt =
    estimate?.completedAt ??
    estimate?.completed_at ??
    estimate?.paidAt ??
    estimate?.paid_at ??
    null;

  function firstValidDate(...values: Array<string | null | undefined>) {
    for (const value of values) {
      if (!value) continue;
      const ts = new Date(value).getTime();
      if (!Number.isNaN(ts)) return value;
    }
    return null;
  }

  if (showPaid) {
    const best = firstValidDate(completedAt, depositPaidAt, scheduledAt, approvedAt, sentAt, createdAt);
    const age = smartTimeAgoLabel(best);
    return age ? `Paid ${age}` : null;
  }

  if (status === "scheduled") {
    const best = firstValidDate(scheduledAt, depositPaidAt, approvedAt, sentAt, createdAt);
    const age = smartTimeAgoLabel(best);
    return age ? `Scheduled ${age}` : null;
  }

  if (showDepositPaid || status === "deposit_paid") {
    const best = firstValidDate(depositPaidAt, approvedAt, sentAt, createdAt);
    const age = smartTimeAgoLabel(best);
    return age ? `Deposit paid ${age}` : null;
  }

  if (status === "approved") {
    const best = firstValidDate(approvedAt, viewedAt, sentAt, createdAt);
    const age = smartTimeAgoLabel(best);
    return age ? `Approved ${age}` : null;
  }

  if (isSent && viewedAt) {
    const best = firstValidDate(viewedAt, sentAt, createdAt);
    const age = smartTimeAgoLabel(best);
    return age ? `Viewed ${age}` : null;
  }

  if (isSent) {
    const best = firstValidDate(sentAt, createdAt);
    const age = smartTimeAgoLabel(best);
    return age ? `Sent ${age}` : null;
  }

  return null;
}

function firstValidIsoDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const ts = new Date(value).getTime();
    if (!Number.isNaN(ts)) return value;
  }
  return null;
}

function getEffectiveSentAt(est: any) {
  return firstValidIsoDate(
    est?.sentAt,
    est?.sent_at,
    est?.sentDate,
    est?.createdAt,
    est?.created_at
  );
}

function getEffectiveViewedAt(est: any, batchStatuses?: any) {
  const remote =
    est?.approvalToken && batchStatuses
      ? batchStatuses?.[est.approvalToken] ?? null
      : null;

  const sentAt = getEffectiveSentAt(est);

  const rawViewedAt = firstValidIsoDate(
    est?.viewedAt,
    est?.lastViewedAt,
    remote?.viewedAt,
    remote?.lastViewedAt
  );

  if (!rawViewedAt) return null;
  if (!sentAt) return rawViewedAt;

  const viewedTs = new Date(rawViewedAt).getTime();
  const sentTs = new Date(sentAt).getTime();

  if (!Number.isNaN(viewedTs) && !Number.isNaN(sentTs) && viewedTs < sentTs) {
    return null;
  }

  return rawViewedAt;
}

function hoursSince(iso?: string | null) {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return (Date.now() - ts) / (1000 * 60 * 60);
}

function getEstimateDisplayName(est: any) {
  return (
    est?.customerName ||
    est?.name ||
    est?.customer ||
    "this customer"
  );
}

function getSentDueJobs(estimates: any[], batchStatuses: any) {
  return (estimates || []).filter((e) => {
    const status = String(e?.status ?? "");
    const sentish =
      status === "sent" ||
      status === "sent_pending" ||
      status === "pending" ||
      status === "pending_approval" ||
      status === "pending approval";

    if (!sentish) return false;

    const viewedAt = getEffectiveViewedAt(e, batchStatuses);
    const sentAt = getEffectiveSentAt(e);
    const approvedLike = ["approved", "deposit_paid", "scheduled", "paid", "completed"].includes(
      String(e?.status ?? "")
    );

    if (!viewedAt && !approvedLike) {
      const hrs = hoursSince(sentAt);
      return hrs != null && hrs >= 36;
    }

    if (viewedAt && !approvedLike) {
      const hrs = hoursSince(viewedAt);
      return hrs != null && hrs >= 48;
    }

    return false;
  });
}

function getApprovedDueJobs(estimates: any[], paymentStates: Record<string, any>) {
  return (estimates || []).filter((e) => {
    const status = String(e?.status ?? "");
    if (status !== "approved") return false;

    const ps = paymentStates?.[e.id] ?? null;
    const depositPaid =
      (ps?.depositAmountCents ?? 0) > 0 ||
      (ps?.offlinePaidCents ?? 0) > 0;

    if (depositPaid) return false;

    const approvedAt =
      e?.approvedAt ??
      e?.approved_at ??
      e?.lastSavedAt ??
      e?.sentAt ??
      e?.createdAt ??
      null;

    const hrs = hoursSince(approvedAt);
    return hrs != null && hrs >= 48;
  });
}

function getDepositReadyJobs(estimates: any[], paymentStates: Record<string, any>) {
  return (estimates || []).filter((e) => {
    const status = String(e?.status ?? "");
    const ps = paymentStates?.[e.id] ?? null;

    const depositPaid =
      status === "deposit_paid" ||
      (ps?.depositAmountCents ?? 0) > 0 ||
      (ps?.offlinePaidCents ?? 0) > 0;

    const scheduled =
      status === "scheduled" ||
      !!e?.scheduledStartDate ||
      !!e?.scheduledAt ||
      !!e?.scheduled_at ||
      !!getScheduledDateKeyFromEstimate(e);

    return depositPaid && !scheduled;
  });
}

type ScheduleBucket = "today" | "tomorrow" | "this_week" | "next_week" | "future" | "past";

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return startOfDay(x);
}

const FOLLOWUP_PREFS_KEY = "ttai_followup_prefs_v1";

type FollowUpPrefs = {
  snoozeUntil?: string | null;
  clearedUntil?: string | null; // legacy support
  cleared?: boolean; // permanent handled
};

function safeParseFollowUpJson<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isFutureIso(iso?: string | null) {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return ts > Date.now();
}

function addDaysToIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Calendar week: Monday = start, Sunday = end (local time)
function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = (day + 6) % 7;
  return addDays(startOfDay(d), -daysFromMonday);
}

function getScheduleBucket(d: Date, now: Date): ScheduleBucket {
  const scheduledStart = startOfDay(d);
  const nowStart = startOfDay(now);
  const tomorrowStart = addDays(nowStart, 1);
  const currentWeekMonday = startOfWeekMonday(now);
  const nextWeekMonday = addDays(currentWeekMonday, 7);
  const weekAfterNextMonday = addDays(currentWeekMonday, 14);

  const t = scheduledStart.getTime();
  const todayT = nowStart.getTime();
  const tomorrowT = tomorrowStart.getTime();
  const nextWeekT = nextWeekMonday.getTime();
  const weekAfterNextT = weekAfterNextMonday.getTime();

  if (t < todayT) return "past";
  if (t === todayT) return "today";
  if (t === tomorrowT) return "tomorrow";
  if (t > tomorrowT && t < nextWeekT) return "this_week";
  if (t >= nextWeekT && t < weekAfterNextT) return "next_week";
  return "future";
}

function bucketLabel(bucket: ScheduleBucket): string {
  switch (bucket) {
    case "today":
      return "Today";
    case "tomorrow":
      return "Tomorrow";
    case "this_week":
      return "This Week";
    case "next_week":
      return "Next Week";
    case "future":
      return "Future";
    case "past":
      return "Past Jobs";
    default:
      return String(bucket);
  }
}

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

async function startCheckout(
  estimateId: string,
  paymentType: "deposit" | "full" | "balance",
  estimateOrOpts: { totalContractPrice?: number; suggestedPrice?: number; estimateTotalCents?: number; customDepositCents?: number },
  setCheckoutLoading: (fn: (m: Record<string, "deposit" | "full" | "balance" | null>) => Record<string, "deposit" | "full" | "balance" | null>) => void,
  remainingCentsForFull?: number,
  returnContext?: { statusFilter?: string; scheduledView?: string; query?: string }
) {
  const estimateTotalCents =
    typeof estimateOrOpts.estimateTotalCents === "number"
      ? estimateOrOpts.estimateTotalCents
      : toEstimateTotalCents(estimateOrOpts);

  const customDepositCents =
    paymentType === "deposit" && typeof estimateOrOpts.customDepositCents === "number"
      ? Math.floor(estimateOrOpts.customDepositCents)
      : undefined;

  if (paymentType === "full") {
    const amountCents =
      typeof remainingCentsForFull === "number" && Number.isFinite(remainingCentsForFull) && remainingCentsForFull > 0
        ? Math.floor(remainingCentsForFull)
        : 0;
    if (amountCents <= 0) return;
  } else if (paymentType === "balance") {
    const amountCents =
      typeof remainingCentsForFull === "number" && Number.isFinite(remainingCentsForFull) && remainingCentsForFull > 0
        ? Math.floor(remainingCentsForFull)
        : 0;
    if (amountCents <= 0) return;
  } else if (paymentType === "deposit" && customDepositCents != null && (!Number.isFinite(customDepositCents) || customDepositCents <= 0)) {
    return;
  }

  setCheckoutLoading((m) => ({ ...m, [estimateId]: paymentType }));
  try {
    const body: Record<string, unknown> = {
      estimateId,
      paymentType,
      estimateTotalCents,
    };
    if (paymentType === "deposit" && customDepositCents != null) body.customDepositCents = customDepositCents;
    if (paymentType === "full" && typeof remainingCentsForFull === "number" && remainingCentsForFull > 0) {
      body.amountCents = Math.floor(remainingCentsForFull);
    }
    if (paymentType === "balance" && typeof remainingCentsForFull === "number" && remainingCentsForFull > 0) {
      body.amountCents = Math.floor(remainingCentsForFull);
    }

    const res = await fetch("/api/payments/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json?.ok || !json?.url) {
      alert(json?.error || "Could not start checkout");
      return;
    }
    if (typeof window !== "undefined" && returnContext) {
      if (returnContext.statusFilter != null) sessionStorage.setItem(ROOFING_SAVED_RETURN_STATUS_FILTER, returnContext.statusFilter);
      if (returnContext.scheduledView != null) sessionStorage.setItem(ROOFING_SAVED_RETURN_SCHEDULED_VIEW, returnContext.scheduledView);
      if (returnContext.query != null) sessionStorage.setItem(ROOFING_SAVED_RETURN_QUERY, returnContext.query);
    }
    window.location.href = json.url;
  } catch {
    alert("Checkout failed. Please try again.");
  } finally {
    setCheckoutLoading((m) => ({ ...m, [estimateId]: null }));
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

function normalizeScheduleDateISO(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type FunnelStage =
  | "estimate"
  | "sent"
  | "viewed"
  | "approved"
  | "deposit"
  | "scheduled"
  | "completed";

const FUNNEL_LABELS: Record<FunnelStage, string> = {
  estimate: "Estimate",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  deposit: "Deposit",
  scheduled: "Scheduled",
  completed: "Completed",
};

const FUNNEL_EDGES: Array<[FunnelStage, FunnelStage]> = [
  ["estimate", "sent"],
  ["sent", "viewed"],
  ["viewed", "approved"],
  ["approved", "deposit"],
  ["deposit", "scheduled"],
  ["scheduled", "completed"],
];

function getBaseStageFromStatus(statusRaw: any): FunnelStage {
  const s = String(statusRaw || "estimate");
  if (s === "sent_pending") return "sent";
  if (s === "deposit_paid") return "deposit";
  if (s === "paid") return "completed";
  if (s === "completed") return "completed";
  if (s === "scheduled") return "scheduled";
  if (s === "approved") return "approved";
  if (s === "sent") return "sent";
  return "estimate";
}

function stageIndex(stage: FunnelStage): number {
  switch (stage) {
    case "estimate":
      return 0;
    case "sent":
      return 1;
    case "viewed":
      return 2;
    case "approved":
      return 3;
    case "deposit":
      return 4;
    case "scheduled":
      return 5;
    case "completed":
      return 6;
    default:
      return 0;
  }
}

function hasViewedSignal(est: any, batchStatuses: any): boolean {
  const bs = batchStatuses?.[est?.id] ?? batchStatuses?.[est?.approvalToken];
  return Boolean(
    est?.viewedAt ||
      est?.lastViewedAt ||
      est?.viewed ||
      bs?.viewedAt ||
      bs?.lastViewedAt ||
      bs?.viewed ||
      bs?.status === "viewed"
  );
}

function computeFunnelStats(estimates: any[], batchStatuses: any) {
  const reached: Record<FunnelStage, number> = {
    estimate: 0,
    sent: 0,
    viewed: 0,
    approved: 0,
    deposit: 0,
    scheduled: 0,
    completed: 0,
  };

  for (const e of estimates || []) {
    const base = getBaseStageFromStatus(e?.status);
    const idx = stageIndex(base);

    reached.estimate += 1;
    if (idx >= stageIndex("sent")) reached.sent += 1;

    const viewed =
      hasViewedSignal(e, batchStatuses) || idx >= stageIndex("approved");
    if (viewed) reached.viewed += 1;

    if (idx >= stageIndex("approved")) reached.approved += 1;
    if (idx >= stageIndex("deposit")) reached.deposit += 1;
    if (idx >= stageIndex("scheduled")) reached.scheduled += 1;
    if (idx >= stageIndex("completed")) reached.completed += 1;
  }

  const conversions = FUNNEL_EDGES.map(([from, to]) => {
    const denom = reached[from] || 0;
    const numer = reached[to] || 0;
    const pct = denom > 0 ? Math.round((numer / denom) * 100) : 0;
    return { from, to, denom, numer, pct };
  });

  const MIN_DENOM = 3;
  const eligible = conversions.filter((c) => c.denom >= MIN_DENOM);
  const weakest = (eligible.length ? eligible : conversions).reduce((min, c) =>
    c.pct < min.pct ? c : min
  );

  return { reached, conversions, weakest };
}

function getPipelineInsight(estimates: any[]) {
  const approved = estimates.filter((e) => e.status === "approved");
  const sent = estimates.filter((e) => e.status === "sent" || e.status === "sent_pending");
  const viewed = estimates.filter((e) => e.viewedAt && e.status !== "approved");
  const deposit = estimates.filter((e) => e.status === "deposit_paid");
  const scheduled = estimates.filter((e) => e.status === "scheduled");

  const depositWaiting = deposit.filter((e) => !e.scheduledDate);
  const approvedWaiting = approved.filter((e) => !e.depositPaid);
  const viewedWaiting = viewed.filter((e) => !e.approvedAt);
  const sentWaiting = sent.filter((e) => !e.viewedAt);

  const revenueWaiting = depositWaiting.reduce((sum, e) => {
    return sum + (e.totalContractPrice || 0);
  }, 0);

  if (depositWaiting.length > 0) {
    const count = depositWaiting.length;
    return {
      title: "Schedule jobs",
      message: `Schedule ${count} deposit-paid job${count === 1 ? "" : "s"}.`,
      revenue: revenueWaiting,
      action: "deposit",
    };
  }

  if (approvedWaiting.length > 0) {
    const count = approvedWaiting.length;
    return {
      title: "Collect deposit",
      message: `${count} approved job${count === 1 ? "" : "s"} waiting for deposit.`,
      action: "approved",
    };
  }

  if (viewedWaiting.length > 0) {
    const count = viewedWaiting.length;
    return {
      title: "Follow up",
      message: `${count} viewed estimate${count === 1 ? "" : "s"} waiting on approval.`,
      action: "viewed",
    };
  }

  if (sentWaiting.length > 0) {
    const count = sentWaiting.length;
    return {
      title: "Confirm estimate received",
      message: `${count} sent estimate${count === 1 ? "" : "s"} not viewed yet.`,
      action: "sent",
    };
  }

  return {
    title: "Pipeline healthy",
    message: "No urgent actions right now.",
    action: "none",
  };
}

function formatCentsToCurrency(cents: number | undefined | null): string {
  const c = Number(cents);
  if (!Number.isFinite(c) || c < 0) return "$0.00";
  const dollars = (Math.round(c) / 100).toFixed(2);
  const [whole, dec] = dollars.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${dec}`;
}

function toEstimateTotalCents(estimate: { totalContractPrice?: number; suggestedPrice?: number } | null | undefined): number {
  const v = Number(estimate?.totalContractPrice ?? estimate?.suggestedPrice ?? 0);
  if (!Number.isFinite(v)) return 0;
  if (v >= 1000 && Number.isInteger(v)) return Math.round(v);
  return Math.round(v * 100);
}

function sumCollectedCents(ps: any): number {
  const stripe = (Number(ps?.depositAmountCents) || 0) + (Number(ps?.fullAmountCents) || 0);
  const offline = Array.isArray(ps?.offlineTransactions)
    ? ps.offlineTransactions.reduce((acc: number, t: any) => acc + (Number(t?.amountCents) || 0), 0)
    : (Number(ps?.offlineCollectedCents) ?? Number(ps?.offlinePaidCents) ?? 0) || 0;
  const total = Number(stripe) + Number(offline);
  return Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
}

type PaymentStateLite = {
  depositAmountCents?: number | null;
  fullAmountCents?: number | null;
  offlineTransactions?: Array<{ amountCents?: number }>;
};

function sumOfflineCents(ps?: PaymentStateLite | null): number {
  const tx = ps?.offlineTransactions ?? [];
  return tx.reduce((acc, t) => acc + (Number(t?.amountCents) || 0), 0);
}

function collectedCentsFromPaymentState(ps?: PaymentStateLite | null): number {
  const deposit = Number(ps?.depositAmountCents) || 0;
  const full = Number(ps?.fullAmountCents) || 0;
  const offline = sumOfflineCents(ps);
  return deposit + full + offline;
}

function derivePaymentBadge(
  totalCents: number,
  ps?: PaymentStateLite | null
): { pill: "paid" | "deposit_paid" | null } {
  const total = Math.max(0, Number(totalCents) || 0);
  const deposit = Number(ps?.depositAmountCents) || 0;
  const full = Number(ps?.fullAmountCents) || 0;
  const collected = Math.min(total, collectedCentsFromPaymentState(ps));

  if (full > 0 || collected >= total) return { pill: "paid" };
  if (deposit > 0) return { pill: "deposit_paid" };
  return { pill: null };
}

function parseScheduledSortKey(est: any): number {
  const dateStr = est?.scheduledStartDate ?? est?.scheduledDateISO ?? est?.scheduledDate ?? est?.scheduleDate;
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const d = new Date(dateStr + "T00:00:00");
  const base = d.getTime();
  const tw = String(est?.scheduledArrivalWindow ?? est?.scheduledTimeWindow ?? "").trim();
  const hasTime = tw.length > 0;
  return hasTime ? base : base + 12 * 60 * 60 * 1000;
}

function isPastScheduled(est: any): boolean {
  const dateStr = est?.scheduledStartDate ?? est?.scheduledDateISO ?? est?.scheduledDate ?? est?.scheduleDate;
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return d.getTime() < t0;
}

function formatScheduledDisplay(dateStr?: string | null, timeWindow?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const tw = (timeWindow ?? "").trim();
  return tw ? `Scheduled: ${formatted} • ${tw}` : `Scheduled: ${formatted} • Time TBD`;
}

type TxItem = {
  label: string;
  amountCents: number;
  whenIso?: string | null;
  meta?: string;
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

type PipelineStatus = "estimate" | "sent" | "sent_pending" | "viewed" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid";

const normalizePipelineStatus = (s?: string): PipelineStatus => {
  const v = (s || "estimate").toLowerCase();
  if (v === "sent_pending") return "sent_pending";
  if (v === "pending") return "sent_pending";
  if (v === "sent") return "sent";
  if (v === "viewed") return "viewed";
  if (v === "approved") return "approved";
  if (v === "deposit_paid") return "deposit_paid";
  if (v === "scheduled") return "scheduled";
  if (v === "in_progress") return "in_progress";
  if (v === "paid" || v === "completed") return "paid";
  return "estimate";
};

const isApprovedOrLater = (st: PipelineStatus) =>
  st === "approved" || st === "deposit_paid" || st === "scheduled" || st === "in_progress" || st === "paid";

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
  if (s === "in_progress") return "in_progress";
  if (s === "paid" || s === "completed") return "paid";
  return "estimate";
}

/** Normalize status for UI: treat sent_pending as sent, empty as estimate. */
function normalizeStatus(status: string | undefined): string {
  if (!status) return "estimate";
  if (status === "sent_pending") return "sent";
  return status;
}

const getDisplayStage = (status: string) => {
  if (status === "sent_pending") return "Sent — not viewed yet";
  if (status === "sent") return "Pending approval";
  if (status === "viewed") return "Viewed";
  if (status === "approved") return "Approved";
  if (status === "deposit_paid") return "Deposit paid";
  if (status === "scheduled") return "Scheduled";
  if (status === "in_progress") return "Crew On Site";
  if (status === "paid" || status === "completed") return "Completed";
  if (status === "estimate") return "Estimate";
  return status?.toUpperCase?.() ?? "—";
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "estimate", label: "Estimate" },
  { value: "sent", label: "Sent" },
  { value: "sent_pending", label: "Sent — not viewed yet" },
  { value: "approved", label: "Approved" },
  { value: "deposit_paid", label: "Deposit paid" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "On Site" },
  { value: "paid", label: "Completed" },
];

const statusToStage = (s?: string) => {
  const v = normalizePipelineStatus(s);
  if (v === "estimate") return "estimate";
  if (v === "sent" || v === "sent_pending") return "pending";
  if (v === "approved") return "approved";
  if (v === "deposit_paid") return "deposit_paid";
  if (v === "scheduled") return "scheduled";
  if (v === "in_progress") return "in_progress";
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
  | "in_progress"
  | "paid"
  | string;

function statusLabel(status: SavedStatusUI) {
  const s = String(status || "").toLowerCase();

  if (s === "sent_pending") return "Sent — not viewed yet";
  if (s === "sent" || s === "pending_approval") return "Pending approval";
  if (s === "estimate" || s === "draft") return "Estimate";
  if (s === "viewed") return "Viewed";
  if (s === "approved") return "Approved";
  if (s === "deposit_paid") return "Deposit paid";
  if (s === "scheduled") return "Scheduled";
  if (s === "in_progress") return "Crew On Site";
  if (s === "paid" || s === "completed") return "Completed";

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
  if (status === "in_progress") {
    return (
      <span className={`${base} bg-violet-500/10 text-violet-300 ring-violet-500/20`}>
        <span className={`${dot} bg-violet-400`} />
        Crew On Site
      </span>
    );
  }
  if (status === "paid" || status === "completed") {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 ring-amber-500/20`}>
        <span className={`${dot} bg-amber-400`} />
        Completed
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
    sent_pending: "Sent",
    approved: "Approved",
    deposit_paid: "Deposit",
    scheduled: "Scheduled",
    paid: "Completed",
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
                  done ? "bg-emerald-400" : "bg-white/10",
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
  const steps = ["estimate", "sent_pending", "approved", "deposit_paid", "scheduled", "in_progress", "paid"] as const;
  const labels: Record<(typeof steps)[number], string> = {
    estimate: "Estimate",
    sent_pending: "Sent",
    approved: "Approved",
    deposit_paid: "Deposit",
    scheduled: "Scheduled",
    in_progress: "On Site",
    paid: "Completed",
  };
  const stepStatus =
    status === "sent"
      ? "sent_pending"
      : status === "in_progress"
        ? "in_progress"
        : status;

  const idx = steps.indexOf((stepStatus || "estimate") as any);
  const activeIndex = idx === -1 ? 0 : idx;
  const pct = (activeIndex / (steps.length - 1)) * 100;

  return (
    <div className="mt-4">
      {/* labels row */}
      <div className="mb-2 flex items-center justify-between text-xs font-medium tracking-wide">
        {steps.map((s, i) => {
          const done = i <= activeIndex;
          return (
            <span key={s} className={done ? "text-white/70" : "text-white/50"}>
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
              : "bg-white/10";
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
  onMetrics?: (m: {
    pipelineTotal: number;
    collected: number;
    closeRate: number;
    costTotal: number;
    profitTotal: number;
    avgMargin: number; // decimal (0..1)
  }) => void;
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

  const costOf = (e: any) => {
    const m = typeof e.materialsCost === "number" ? e.materialsCost : 0;
    const l = typeof e.laborCost === "number" ? e.laborCost : 0;
    const d = typeof e.disposalCost === "number" ? e.disposalCost : 0;
    const sum = m + l + d;
    return Number.isFinite(sum) && sum > 0 ? sum : 0;
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

  const costTotal = scoped.reduce((acc, e) => acc + costOf(e), 0);
  const profitTotal = pipelineTotal - costTotal;
  const avgMargin = pipelineTotal > 0 ? profitTotal / pipelineTotal : 0;

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
    onMetrics?.({ pipelineTotal, collected, closeRate, costTotal, profitTotal, avgMargin });
  }, [onMetrics, pipelineTotal, collected, closeRate, costTotal, profitTotal, avgMargin]);

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
    n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });

  const fmt0 = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtMoney = (n: number) => fmt0(Math.round(Number(n || 0)));

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
        {fmtMoney(value)}
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
          "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap leading-none min-w-[92px]",
          active
            ? "bg-white/[0.10] border-white/20 text-white"
            : "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.06] hover:border-white/20",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  const getMarginColor = (margin: number) => {
    const pct = margin * 100;
    if (pct >= 20) return "text-green-400";
    if (pct >= 10) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Business Snapshot</div>
          <div className="mt-1 text-xs text-white/45">
            {window === "all"
              ? "All-time totals from your saved pipeline"
              : window === "month"
              ? "This month's totals"
              : "Last 30 days totals"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleBtn id="all" label="All Time" />
          <ToggleBtn id="month" label="This Month" />
          <ToggleBtn id="30d" label="Last 30 Days" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/70">
            Total Pipeline
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-200 tabular-nums">
            {fmt(pipelineTotal)}
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/20">
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
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/50">
            Collected
          </div>
          <div
            className="mt-2 text-2xl font-semibold tabular-nums text-emerald-200"
            title={fmt(collected)}
          >
            {fmt(collected)}
          </div>
          <div className="mt-1 text-xs text-white/45">Paid work collected in this window</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/50">
            Remaining Balance
          </div>
          <div
            className="mt-2 text-2xl font-semibold tabular-nums text-amber-200"
            title={fmt(openPipeline)}
          >
            {fmt(openPipeline)}
          </div>
          <div className="mt-1 text-xs text-white/45">Open pipeline still to collect</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/50">
            Average Job Value
          </div>
          <div
            className="mt-2 text-2xl font-semibold tabular-nums text-white/90"
            title={fmt(averageJobValue)}
          >
            {fmt(averageJobValue)}
          </div>
          <div className="mt-1 text-xs text-white/45">
            {paidJobs} / {totalJobs} jobs completed
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4">
          <Row label="Approved" value={approved} />
          <div className="h-px bg-white/10" />
          <Row label="Scheduled" value={scheduled} />
          <div className="h-px bg-white/10" />
          <Row label="Completed" value={paid} tone="good" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">
            Profit
          </div>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span>Sold</span>
              <span className="tabular-nums text-white/90">{fmt(pipelineTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cost</span>
              <span className="tabular-nums text-white/90">{fmt(costTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Profit</span>
              <span className={`tabular-nums font-semibold ${profitTotal >= 0 ? "text-green-400" : "text-red-400"}`}>
                {fmt(profitTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Margin</span>
              <span className={`tabular-nums font-semibold ${getMarginColor(avgMargin)}`}>
                {Math.round(avgMargin * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function asNum(v: any): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(n: number): string {
  try {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function calcProfitInfo(est: any): {
  sold: number | null;
  cost: number | null;
  profit: number | null;
  marginPct: number | null;
  tone: "good" | "warn" | "bad" | "na";
} {
  const sold =
    asNum(est?.totalContractPrice) ??
    asNum(est?.suggestedPrice) ??
    null;

  const materials = asNum(est?.materialsCost) ?? 0;
  const labor = asNum(est?.laborCost) ?? 0;
  const disposal = asNum(est?.disposalCost) ?? 0;

  const hasAnyCost = (asNum(est?.materialsCost) != null) || (asNum(est?.laborCost) != null) || (asNum(est?.disposalCost) != null);
  const cost = hasAnyCost ? materials + labor + disposal : null;

  if (sold == null || sold <= 0 || cost == null) {
    return { sold, cost, profit: null, marginPct: null, tone: "na" };
  }

  const profit = sold - cost;
  const marginPct = (profit / sold) * 100;

  let tone: "good" | "warn" | "bad" = "good";
  if (marginPct >= 20) tone = "good";
  else if (marginPct >= 10) tone = "warn";
  else tone = "bad";

  return { sold, cost, profit, marginPct, tone };
}

function pctLabel(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

function marginToneClass(marginPct: number): string {
  if (!Number.isFinite(marginPct)) return "text-white/70";
  if (marginPct >= 20) return "text-emerald-300";
  if (marginPct >= 10) return "text-amber-300";
  return "text-rose-300";
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function isDueSince(baseIso: string | undefined | null, hours: number): boolean {
  if (!baseIso || !baseIso.trim()) return false;
  const base = new Date(baseIso);
  if (!Number.isFinite(base.getTime())) return false;
  const now = new Date();
  const elapsedHours = (now.getTime() - base.getTime()) / (60 * 60 * 1000);
  return elapsedHours >= hours;
}

function getFollowUpInfo(
  est: any,
  paymentState?: { depositAmountCents?: number; fullAmountCents?: number; offlinePaidCents?: number } | null,
  batchStatuses?: any
): { due: boolean; reason: string; kind: "confirm" | "questions" | "deposit" | "none" } {
  const viewedAt = getEffectiveViewedAt(est, batchStatuses);
  const sentAt = getEffectiveSentAt(est);
  const approvedAt = est?.approvedAt ?? null;
  const lastSavedAt = est?.lastSavedAt ?? null;
  const rawStatus = (est?.status ?? "estimate") as string;
  const status = normalizePipelineStatus(rawStatus);

  if (est?.lastFollowUpAt && !isDueSince(est.lastFollowUpAt, 24)) {
    return { due: false, reason: "", kind: "none" };
  }

  if (status === "scheduled" || status === "in_progress" || status === "paid") {
    return { due: false, reason: "", kind: "none" };
  }

  const isSent = !!sentAt || status === "sent" || status === "sent_pending";
  const isApproved = status === "approved";
  const depositPaid = (paymentState?.depositAmountCents ?? 0) + ((paymentState as any)?.offlinePaidCents ?? 0);

  if (isSent && !viewedAt && isDueSince(sentAt, 36)) {
    return { due: true, reason: "Confirm they received it", kind: "confirm" };
  }

  if (viewedAt && status !== "approved" && status !== "deposit_paid" && isDueSince(viewedAt, 48)) {
    return { due: true, reason: "Answer questions / ask for approval", kind: "questions" };
  }

  if (isApproved && depositPaid === 0 && isDueSince(approvedAt ?? lastSavedAt ?? sentAt ?? "", 48)) {
    return { due: true, reason: "Collect deposit to lock schedule", kind: "deposit" };
  }

  return { due: false, reason: "", kind: "none" };
}

function getFollowUpReason(est: any, paymentState: any): string | null {
  const status = String(est?.status ?? "estimate");
  const viewed = !!est?.viewedAt;

  const depositPaid =
    (paymentState?.depositAmountCents ?? 0) > 0 ||
    (paymentState?.offlinePaidCents ?? 0) > 0 ||
    status === "deposit_paid" ||
    status === "paid";

  if (depositPaid) return null;

  if (status !== "sent" && status !== "sent_pending" && status !== "approved") return null;

  if ((status === "sent" || status === "sent_pending") && !viewed) {
    return "Confirm they received it";
  }

  if (viewed && status !== "approved") {
    return "Answer questions";
  }

  if (status === "approved" && !depositPaid) {
    return "Collect deposit";
  }

  return null;
}

function SavedEstimateCard({
  estimate,
  batchStatuses,
  paymentState,
  checkoutLoading,
  onStartCheckout,
  onOpenDepositModal,
  onOpenRemainingModal,
  onOpenOfflineModal,
  onOpenTransactions,
  openMoreFor,
  setOpenMoreFor,
  moreMenuRef,
  onLoad,
  onDelete,
  onStatusChange,
  onSend,
  onSchedule,
  onRecordPayment,
  onMarkApproved,
  onView,
  isFlashing,
  showRescheduleButton,
  followUpInfo,
  onSendFollowUp,
  followUpHidden,
  onFollowUpSnooze,
  onFollowUpClear,
  scheduledForLabel,
  scheduleActionLabel,
}: {
  estimate: any;
  batchStatuses?: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>;
  paymentState?: { depositAmountCents?: number; fullAmountCents?: number; offlinePaidCents?: number; offlineTransactions?: Array<{ stage?: string; amountCents?: number }> } | null;
  checkoutLoading?: Record<string, "deposit" | "full" | "balance" | null>;
  onStartCheckout?: (estimateId: string, paymentType: "deposit" | "full", estimate: any, remainingCentsForFull?: number) => void;
  onOpenDepositModal?: (estimate: any) => void;
  onOpenRemainingModal?: (estimate: any, remainingCents: number) => void;
  onOpenOfflineModal?: (estimate: any) => void;
  onOpenTransactions?: (estimate: any) => void;
  openMoreFor: string | null;
  setOpenMoreFor: (v: string | null) => void;
  moreMenuRef?: React.MutableRefObject<HTMLDivElement | null>;
  onLoad: (e: any) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: any) => void;
  onSend?: (e: any) => void;
  onSchedule?: (e: any) => void;
  onRecordPayment?: (e: any) => void;
  onMarkApproved?: (e: any) => void;
  onView?: (e: any) => void;
  isFlashing?: boolean;
  showRescheduleButton?: boolean;
  followUpInfo?: { due: boolean; reason: string; kind: string };
  onSendFollowUp?: (est: any, kind: "confirm" | "questions" | "deposit") => void;
  followUpHidden?: boolean;
  onFollowUpSnooze?: (estimateId: string) => void;
  onFollowUpClear?: (estimateId: string) => void;
  scheduledForLabel?: string | null;
  scheduleActionLabel?: string;
}) {
  const status = normalizePipelineStatus(getStage(estimate));
  const remote = estimate?.approvalToken && batchStatuses ? batchStatuses[estimate.approvalToken] : null;
  const viewedAt = getEffectiveViewedAt(estimate, batchStatuses) as string | null;
  const isSent = status === "sent" || status === "sent_pending";
  const isApproved = status === "approved" || status === "deposit_paid" || status === "scheduled" || status === "in_progress" || status === "paid";
  const effectiveStatus =
    remote?.status === "approved"
      ? "approved"
      : viewedAt
        ? "viewed"
        : status === "sent" || status === "sent_pending"
          ? "sent"
          : status;
  const displayStatus =
    isApproved ? effectiveStatus : isSent && viewedAt ? "viewed" : isSent && !viewedAt ? "not_viewed" : effectiveStatus;
  const isScheduledCard = !!showRescheduleButton || status === "scheduled" || status === "in_progress";
  const totalCents = toEstimateTotalCents(estimate);
  const depositPaid = paymentState?.depositAmountCents || 0;
  const fullPaid = paymentState?.fullAmountCents || 0;
  const offlinePaid =
    (paymentState as { offlineAmountCents?: number })?.offlineAmountCents ??
    (paymentState as { offlinePaidCents?: number })?.offlinePaidCents ??
    sumOfflineCents(paymentState ?? undefined) ??
    0;
  const totalCollected = depositPaid + fullPaid + offlinePaid;
  const isDepositPaid = depositPaid > 0;
  const isFullyPaid = totalCents > 0 && totalCollected >= totalCents;
  const remainingCents = Math.max(0, totalCents - totalCollected);
  const collectedCents = totalCollected;
  const paidSoFarCents = (depositPaid || 0) + (fullPaid || 0) + (offlinePaid || 0);
  const hasAnyPayment = paidSoFarCents > 0;
  const hasRemaining = remainingCents > 0;
  const isFinalPayment = hasAnyPayment && hasRemaining;

  const hasPaymentState = !!paymentState;
  const fallbackDepositPaid =
    estimate?.status === "deposit_paid" ||
    estimate?.status === "scheduled" ||
    estimate?.status === "paid" ||
    estimate?.status === "completed";
  const fallbackPaid =
    estimate?.status === "paid" || estimate?.status === "completed";
  const showPaid = hasPaymentState ? isFullyPaid : fallbackPaid;
  const showDepositPaid = hasPaymentState ? (isDepositPaid || isScheduledCard) : fallbackDepositPaid;
  const pillStatus = (showPaid ? "paid" : showDepositPaid ? "deposit_paid" : displayStatus) as string;
  const stageAgeText = buildStageAgeText({
    status,
    isSent,
    viewedAt,
    estimate,
    showDepositPaid,
    showPaid,
  });
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
  const actionBtn =
    "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const followUpReason = followUpInfo?.due ? followUpInfo.reason : null;
  const profitInfo = calcProfitInfo(estimate);
  const visibleFollowUpInfo = followUpHidden ? undefined : followUpInfo;
  const visibleFollowUpReason = followUpHidden ? null : followUpReason;
  const [followUpMenuOpen, setFollowUpMenuOpen] = useState(false);
  const followUpMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function handleDocMouseDown(ev: MouseEvent) {
      if (!followUpMenuOpen) return;
      const target = ev.target as Node | null;
      if (followUpMenuRef.current && target && followUpMenuRef.current.contains(target)) return;
      setFollowUpMenuOpen(false);
    }
    document.addEventListener("mousedown", handleDocMouseDown);
    return () => document.removeEventListener("mousedown", handleDocMouseDown);
  }, [followUpMenuOpen]);
  const isViewed = Boolean(viewedAt);
  const pillStatusForPill = (pillStatus === "not_viewed" || pillStatus === "viewed") ? "sent" : pillStatus;
  return (
    <div
      className={`group relative rounded-3xl border border-white/12 bg-gradient-to-b from-slate-900/70 to-slate-950/40 p-6 transition-all duration-300
  ${showApprovalActions || status === "sent" || status === "sent_pending"
    ? "border-emerald-300/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]"
    : "hover:border-white/20"}
  ${isFlashing ? "ring-2 ring-emerald-400/60" : ""}`}
    >
      <div className="relative">
        {scheduledForLabel && !showRescheduleButton && (
          <div className="text-xs text-cyan-400 mb-1">
            Scheduled for {scheduledForLabel}
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {showRescheduleButton && scheduledForLabel && (
              <div className="mb-2">
                <div className="text-sm font-semibold text-cyan-300">
                  {scheduledForLabel}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70 ring-1 ring-inset ring-white/10">
                {(estimate.tierLabel ?? estimate.selectedTier ?? "Core").toString()}
              </span>

              <StatusPill status={pillStatusForPill} />

              {isViewed ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                  Viewed
                </span>
              ) : isSent ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/20">
                  Not viewed
                </span>
              ) : null}

              {visibleFollowUpInfo?.due && (
                <span
                  className="inline-flex items-center rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/20"
                  title={visibleFollowUpInfo.reason}
                >
                  Follow-up due
                </span>
              )}

              {visibleFollowUpReason && (
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/15">
                  Follow-up suggested
                </span>
              )}
            </div>

            {visibleFollowUpReason && (
              <div className="mt-1.5 text-xs text-white/40">
                {visibleFollowUpReason}
              </div>
            )}

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

            {(status === "scheduled" || status === "paid") && (estimate?.scheduledStartDate || estimate?.scheduledArrivalWindow) && (
              <div className="mt-2 text-sm text-white/60">
                {estimate.scheduledStartDate
                  ? formatScheduledDisplay(estimate.scheduledStartDate, estimate.scheduledArrivalWindow)
                  : "Schedule: TBD"}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2 text-right">
            {/* Status line (primary) — job stage takes priority over payment stage */}
            <div className="text-emerald-300 text-sm font-semibold">
              {isSent && !viewedAt
                ? "Sent — not viewed yet"
                : isSent && viewedAt
                  ? "Viewed — pending approval"
                  : effectiveStatus === "approved" && estimate.needsScheduling
                    ? "Approved — ready to schedule"
                    : showApprovalActions || isPendingApproval(getStage(estimate))
                      ? "Pending approval"
                      : (() => {
                          const jobStage = getStage(estimate);
                          const headerStage = ["scheduled", "in_progress", "paid", "completed"].includes(String(estimate?.status))
                            ? estimate.status
                            : jobStage;
                          return getDisplayStage(headerStage);
                        })()}
            </div>

            {stageAgeText && (
              <div className="text-xs text-white/50 mt-1">
                {stageAgeText.startsWith("Deposit paid ") ? (
                  <>
                    Deposit paid
                    <div>{stageAgeText.slice("Deposit paid ".length)}</div>
                  </>
                ) : (
                  stageAgeText
                )}
              </div>
            )}

            {estimate.approvedAt && status === "approved" && (
              <div className="mt-0.5 text-xs text-white/35">Approved {formatDatePretty(estimate.approvedAt)}</div>
            )}

            {showRescheduleButton ? (
              <div className="mt-2 flex items-center justify-end">
                <span className="inline-flex items-center rounded-full border border-cyan-400/10 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200/80">
                  Scheduled job
                </span>
              </div>
            ) : (
              <select
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 outline-none hover:bg-white/[0.06]"
                value={getStage(estimate) || "estimate"}
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
            )}
          </div>
        </div>

        <PipelineBar status={getStage(estimate)} isViewed={isSent && !!viewedAt} />

        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-6">
          {/* LEFT: Total + payment summary */}
          <div className="flex flex-col gap-0">
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] tracking-[0.25em] text-white/40">
                TOTAL
              </span>
              <span className="text-4xl font-semibold tracking-tight text-white">
                {(() => {
                  const totalCents = toEstimateTotalCents(estimate);
                  return totalCents <= 0 ? "—" : formatCentsToCurrency(totalCents);
                })()}
              </span>
            </div>
            {(() => {
              const depositPaidCents = paymentState?.depositAmountCents || 0;
              const fullPaidCents = paymentState?.fullAmountCents || 0;
              const offlineTx = ((paymentState as { offlineTransactions?: Array<{ stage?: string; amountCents?: number }> } | undefined)?.offlineTransactions || []) as { stage?: string; amountCents?: number }[];
              const offlineDepositCents = Array.isArray(offlineTx)
                ? offlineTx.filter((t) => t?.stage === "deposit").reduce((sum, t) => sum + (t?.amountCents || 0), 0)
                : 0;
              const offlineAdditionalCents = Array.isArray(offlineTx)
                ? offlineTx.filter((t) => t?.stage !== "deposit").reduce((sum, t) => sum + (t?.amountCents || 0), 0)
                : 0;
              return collectedCents > 0 || remainingCents > 0 ? (
                <div className="mt-2 text-sm text-white/80 space-y-1">
                  {depositPaidCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Card payment</span>
                      <span className="font-medium">{formatCentsToCurrency(depositPaidCents)}</span>
                    </div>
                  )}
                  {fullPaidCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Card payment</span>
                      <span className="font-medium">{formatCentsToCurrency(fullPaidCents)}</span>
                    </div>
                  )}
                  {offlineDepositCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Offline payment</span>
                      <span className="font-medium">{formatCentsToCurrency(offlineDepositCents)}</span>
                    </div>
                  )}
                  {offlineAdditionalCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Offline payment</span>
                      <span className="font-medium">{formatCentsToCurrency(offlineAdditionalCents)}</span>
                    </div>
                  )}
                  {!isFullyPaid && remainingCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Remaining balance</span>
                      <span className="font-semibold">{formatCentsToCurrency(remainingCents)}</span>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
            {(() => {
              const p = profitInfo;
              if (p.profit == null || p.marginPct == null) return null;

              const marginPct = Math.round(p.marginPct);
              const toneClass = marginToneClass(marginPct);

              return (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-white/60">Profit</span>
                    <span className={`text-sm font-semibold ${toneClass}`}>
                      {fmtMoney(p.profit)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-white/60">Margin</span>
                    <span className={`text-sm font-semibold ${toneClass}`}>
                      {pctLabel(p.marginPct)}
                    </span>
                  </div>

                  <div className="mt-2 h-px w-full bg-white/10" />

                  <div className="mt-2 text-xs text-white/60">
                    <span>Sold {fmtMoney(p.sold!)}</span>
                    <span className="text-white/40 mx-1.5">•</span>
                    <span>Cost {fmtMoney(p.cost!)}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* RIGHT: Actions */}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {SHOW_INTERNAL_ACTIONS && (
              <>
                {showApprovalActions && (
                  <>
                    {getApprovalLink(estimate) ? (
                      <button
                        type="button"
                        className={`${actionBtn} rounded-full border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.10]`}
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
                      className={`${actionBtn} rounded-full border border-emerald-400/20 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20`}
                      onClick={() => onMarkApproved?.(estimate)}
                    >
                      Mark Approved
                    </button>
                  </>
                )}

                {(status === "approved" || status === "deposit_paid" || status === "scheduled" || status === "in_progress" || status === "paid") && (
                  <button
                    type="button"
                    className={`${actionBtn} rounded-full border border-emerald-400/20 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20`}
                    onClick={() => onSchedule?.(estimate)}
                    title={status === "scheduled" || status === "in_progress" ? "Update the scheduled date" : "Pick a date to schedule the job"}
                  >
                    {(() => {
                      const norm = normalizeStatusValue(estimate.status || "estimate");
                      return (norm === "scheduled" || norm === "in_progress") ? "Reschedule" : "Schedule Job";
                    })()}
                  </button>
                )}

                {status === "scheduled" && (
                  <button
                    type="button"
                    className={`${actionBtn} rounded-full border border-emerald-400/20 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20`}
                    onClick={() => onStatusChange?.(estimate.id, "in_progress")}
                  >
                    Start Job
                  </button>
                )}

                {status === "in_progress" && (
                  <button
                    type="button"
                    onClick={() => onStatusChange?.(estimate.id, "paid")}
                    className={`${actionBtn} rounded-full border border-emerald-400/20 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20`}
                  >
                    Mark Completed
                  </button>
                )}

                {isFullyPaid && (
                  <div className={`${actionBtn} rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 font-semibold`}>
                    Paid ✅
                  </div>
                )}
              </>
            )}

            {/* ===== PAYMENT ACTIONS ===== */}
            {!isFullyPaid && totalCents > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {!showDepositPaid && collectedCents === 0 && !isFullyPaid && (
                  <button
                    type="button"
                    disabled={checkoutLoading?.[estimate.id] === "deposit"}
                    onClick={() => {
                      onOpenDepositModal?.(estimate);
                    }}
                    className={`${actionBtn} rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white`}
                  >
                    {checkoutLoading?.[estimate.id] === "deposit" ? "Opening…" : "Collect Deposit"}
                  </button>
                )}

                <button
                    type="button"
                    disabled={checkoutLoading?.[estimate.id] === "full" || checkoutLoading?.[estimate.id] === "balance"}
                    onClick={() => {
                      if (isFinalPayment || showDepositPaid || isScheduledCard) {
                        onOpenRemainingModal?.(estimate, remainingCents);
                      } else {
                        onStartCheckout?.(estimate.id, "full", estimate, remainingCents);
                      }
                    }}
                    className={`${actionBtn} rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white`}
                >
                  {checkoutLoading?.[estimate.id] === "full" || checkoutLoading?.[estimate.id] === "balance"
                  ? "Opening…"
                  : (isFinalPayment || showDepositPaid || isScheduledCard)
                    ? "Collect Final"
                    : "Collect Full"}
                </button>
              </div>
            )}

            {isFullyPaid && status !== "paid" && (
              <button
                type="button"
                onClick={() => onStatusChange?.(estimate.id, "paid")}
                className={`${actionBtn} rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white`}
              >
                Mark Completed
              </button>
            )}

            {(visibleFollowUpInfo?.due || visibleFollowUpReason) && (
              <div className="relative" ref={followUpMenuRef}>
                <button
                  type="button"
                  onClick={() => setFollowUpMenuOpen((v) => !v)}
                  className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/15"
                >
                  Follow Up ▾
                </button>

                {followUpMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl z-50">
                    {visibleFollowUpInfo?.kind && visibleFollowUpInfo.kind !== "none" && onSendFollowUp && (
                      <button
                        type="button"
                        className="w-full px-4 py-3 text-left text-sm text-emerald-300 hover:bg-white/5"
                        onClick={() => {
                          setFollowUpMenuOpen(false);
                          onSendFollowUp?.(estimate, visibleFollowUpInfo.kind as "confirm" | "questions" | "deposit");
                        }}
                      >
                        Send follow-up
                      </button>
                    )}
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5"
                      onClick={() => {
                        setFollowUpMenuOpen(false);
                        onFollowUpSnooze?.(estimate.id);
                      }}
                    >
                      Snooze 3 days
                    </button>

                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm text-white/85 hover:bg-white/5"
                      onClick={() => {
                        setFollowUpMenuOpen(false);
                        onFollowUpClear?.(estimate.id);
                      }}
                    >
                      Clear reminder
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="relative" ref={openMoreFor === estimate.id ? moreMenuRef : undefined}>
              <button
                type="button"
                onClick={() => {
                  setOpenMoreFor(openMoreFor === estimate.id ? null : estimate.id);
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10"
                aria-haspopup="menu"
                aria-expanded={openMoreFor === estimate.id}
              >
                More ▾
              </button>

              {openMoreFor === estimate.id && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
                  <button
                    onClick={() => {
                      setOpenMoreFor(null);
                      onOpenTransactions?.(estimate);
                    }}
                    className="block w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/10"
                  >
                    View transactions
                  </button>

                  <button
                    onClick={() => {
                      setOpenMoreFor(null);
                      onOpenOfflineModal?.(estimate);
                    }}
                    className="block w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/10"
                  >
                    Record offline payment
                  </button>

                  <button
                    onClick={() => {
                      setOpenMoreFor(null);
                      onLoad?.(estimate);
                    }}
                    className="block w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/10"
                  >
                    Load estimate
                  </button>

                  <button
                    onClick={() => {
                      setOpenMoreFor(null);
                      onDelete?.(estimate.id);
                    }}
                    className="block w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
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
  const [statusFilter, setStatusFilter] = useState<"all" | "estimate" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid">("all");
  const [scheduledView, setScheduledView] = useState<"upcoming" | "past" | "all">("upcoming");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    completed: true,
  });

  const [flashId, setFlashId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [schedulingForId, setSchedulingForId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleArrivalWindow, setScheduleArrivalWindow] = useState("");
  const [scheduleCustomArrivalWindow, setScheduleCustomArrivalWindow] = useState("");
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
    costTotal: number;
    profitTotal: number;
    avgMargin: number;
  } | null>(null);
  const [paymentContractTotal, setPaymentContractTotal] = useState("");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [batchStatuses, setBatchStatuses] = useState<Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>>({});
  const [checkoutLoading, setCheckoutLoading] = useState<Record<string, "deposit" | "full" | "balance" | null>>({});
  const [paymentStates, setPaymentStates] = useState<Record<string, { depositAmountCents?: number; fullAmountCents?: number; offlinePaidCents?: number; offlineTransactions?: Array<{ stage?: string; amountCents?: number }> } | null>>({});
  const [offlineModal, setOfflineModal] = useState<{
    open: boolean;
    estimateId: string | null;
    estimateTotal: number;
    remaining: number;
    amount: string;
    method: string;
    notes: string;
    stage: "deposit" | "additional";
  }>({
    open: false,
    estimateId: null,
    estimateTotal: 0,
    remaining: 0,
    amount: "",
    method: "cash",
    notes: "",
    stage: "deposit",
  });
  const [depositModal, setDepositModal] = useState<{
    open: boolean;
    estimateId: string | null;
    estimateTotal: number;
    customValue: string;
    mode: "percent" | "dollars";
    percent: number;
  }>({
    open: false,
    estimateId: null,
    estimateTotal: 0,
    customValue: "",
    mode: "percent",
    percent: 10,
  });
  const [remainingModal, setRemainingModal] = useState<{
    open: boolean;
    estimateId: string | null;
    estimateTotalCents: number;
    remainingCents: number;
    mode: "full" | "custom";
    customValue: string;
  }>({
    open: false,
    estimateId: null,
    estimateTotalCents: 0,
    remainingCents: 0,
    mode: "full",
    customValue: "",
  });
  const [openMoreFor, setOpenMoreFor] = useState<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [followUpPrefs, setFollowUpPrefs] = useState<Record<string, FollowUpPrefs>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = safeParseFollowUpJson<Record<string, FollowUpPrefs>>(
      localStorage.getItem(FOLLOWUP_PREFS_KEY),
      {}
    );
    for (const k of Object.keys(stored)) {
      const p = stored[k];
      if (!p) continue;
      if (!p.cleared && isFutureIso(p.clearedUntil)) {
        p.cleared = true;
        p.clearedUntil = null;
      }
    }
    setFollowUpPrefs(stored);
    try {
      localStorage.setItem(FOLLOWUP_PREFS_KEY, JSON.stringify(stored));
    } catch {}
  }, []);
  function updateFollowUpPref(id: string, patch: Partial<FollowUpPrefs>) {
    setFollowUpPrefs((prev) => {
      const next = {
        ...prev,
        [id]: {
          ...(prev[id] ?? {}),
          ...patch,
        },
      };
      try {
        localStorage.setItem(FOLLOWUP_PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  function isFollowUpHidden(id: string) {
    const pref = followUpPrefs[id];
    if (!pref) return false;
    if (pref.cleared) return true;
    return isFutureIso(pref.snoozeUntil) || isFutureIso(pref.clearedUntil);
  }
  const [txModal, setTxModal] = useState<{
    open: boolean;
    estimateId: string | null;
    title?: string;
    loading: boolean;
    items: TxItem[];
    totalCents: number;
    remainingCents: number;
  }>({
    open: false,
    estimateId: null,
    title: "",
    loading: false,
    items: [],
    totalCents: 0,
    remainingCents: 0,
  });
  const router = useRouter();
  const isSyncingRef = useRef(false);
  const lastStatusFetchRef = useRef<Record<string, number>>({});
  const hasRestoredReturnContextRef = useRef(false);

  const shouldFetchPaymentStatus = (estimateId: string) => {
    const now = Date.now();
    const last = lastStatusFetchRef.current[estimateId] ?? 0;
    if (now - last < 60_000) return false;
    lastStatusFetchRef.current[estimateId] = now;
    return true;
  };

  const allowPaymentStatusFetch = (estimateId: string) => {
    lastStatusFetchRef.current[estimateId] = 0;
  };

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!openMoreFor) return;
      const el = moreMenuRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpenMoreFor(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMoreFor]);

  const ARRIVAL_WINDOW_OPTIONS = [
    { value: "", label: "No window" },
    { value: "8–10am", label: "8–10am" },
    { value: "10am–12pm", label: "10am–12pm" },
    { value: "12–2pm", label: "12–2pm" },
    { value: "2–4pm", label: "2–4pm" },
    { value: "4–6pm", label: "4–6pm" },
  ];
  const STAGES = ["estimate", "sent_pending", "approved", "scheduled", "paid"] as const;
  const STAGE_LABELS: Record<string, string> = { estimate: "Estimate", sent: "Pending", sent_pending: "Sent — not viewed yet", approved: "Approved", scheduled: "Scheduled", paid: "Completed" };
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
        allowPaymentStatusFetch(id);
        const res = await fetch(`/api/payments/status?estimateId=${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!json?.ok || !json?.payment?.status) return;

        const payment = json.payment;
        const paymentStatus = payment.status as "deposit_paid" | "paid";
        const current = getSavedEstimateById(id);
        if (paymentStatus === "paid") {
          markSavedEstimateStatus(id, "paid");
          setEstimates(getNormalizedEstimates());
        } else if (paymentStatus === "deposit_paid") {
          if (!current || (current.status !== "scheduled" && current.status !== "in_progress" && current.status !== "paid")) {
            markSavedEstimateStatus(id, "deposit_paid");
            setEstimates(getNormalizedEstimates());
          }
        }
        setPaymentStates((prev) => ({
          ...prev,
          [id]: {
            depositAmountCents: payment.depositAmountCents ?? undefined,
            fullAmountCents: payment.fullAmountCents ?? undefined,
            offlinePaidCents: (payment as { offlinePaidCents?: number }).offlinePaidCents ?? undefined,
            offlineTransactions: (payment as { offlineTransactions?: Array<{ stage?: string; amountCents?: number }> }).offlineTransactions ?? undefined,
          },
        }));
        lastStatusFetchRef.current[id] = Date.now();
        const url = new URL(window.location.href);
        url.searchParams.delete("paid");
        url.searchParams.delete("id");
        url.searchParams.delete("kind");
        router.replace(url.pathname + url.search);
      } catch {
        // ignore
      }
    })();
  }, [searchParams, router]);

  function handleSendFromSaved(savedId: string) {
    sessionStorage.setItem("ttai_autoSendEstimateId", savedId);
    router.push("/tools/roofing");
  }

  const refreshSaved = () => setEstimates(getNormalizedEstimates());

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

  async function openTransactions(estimate: any) {
    const id: string = String(estimate?.id || "").trim();
    if (!id) return;

    const totalCents = toEstimateTotalCents(estimate);

    setTxModal({
      open: true,
      estimateId: id,
      title: estimate?.customerName || estimate?.name || "Transactions",
      loading: true,
      items: [],
      totalCents,
      remainingCents: 0,
    });

    allowPaymentStatusFetch(id);
    const ps: any = await fetchPaymentState(id);

    const depositCents = Number(ps?.depositAmountCents || 0);
    const fullCents = Number(ps?.fullAmountCents || 0);
    const offlineCents = Number(ps?.offlinePaidCents || 0);

    const collected = depositCents + fullCents + offlineCents;
    const remainingCents = Math.max(totalCents - collected, 0);

    const tx: TxItem[] = [];

    if (depositCents > 0) {
      tx.push({
        label: "Stripe deposit",
        amountCents: depositCents,
        whenIso: ps?.depositPaidAt,
        meta: ps?.lastCheckoutSessionId ? `Session ${String(ps.lastCheckoutSessionId).slice(-8)}` : "",
      });
    }

    if (fullCents > 0) {
      tx.push({
        label: "Stripe payment",
        amountCents: fullCents,
        whenIso: ps?.fullPaidAt,
        meta: ps?.lastPaymentIntentId ? `PI ${String(ps.lastPaymentIntentId).slice(-8)}` : "",
      });
    }

    const offlineTx = Array.isArray(ps?.offlineTransactions) ? ps.offlineTransactions : [];
    for (const t of offlineTx) {
      const amt = Number(t?.amountCents || 0);
      if (!amt) continue;
      const stage = "Offline payment";
      const method = t?.method ? String(t.method).replaceAll("_", " ") : "offline";
      const notes = t?.notes ? String(t.notes) : "";
      const meta = [method, notes].filter(Boolean).join(" • ");
      tx.push({
        label: stage,
        amountCents: amt,
        whenIso: t?.recordedAt,
        meta,
      });
    }

    tx.sort((a, b) => {
      const ta = a.whenIso ? new Date(a.whenIso).getTime() : 0;
      const tb = b.whenIso ? new Date(b.whenIso).getTime() : 0;
      return ta - tb;
    });

    setPaymentStates((prev) => ({
      ...prev,
      [id]: {
        depositAmountCents: ps?.depositAmountCents ?? undefined,
        fullAmountCents: ps?.fullAmountCents ?? undefined,
        offlinePaidCents: (ps as { offlinePaidCents?: number })?.offlinePaidCents ?? undefined,
        offlineTransactions: (ps as { offlineTransactions?: Array<{ stage?: string; amountCents?: number }> })?.offlineTransactions ?? undefined,
      },
    }));
    lastStatusFetchRef.current[id] = Date.now();
    setTxModal((s) => ({
      ...s,
      loading: false,
      items: tx,
      remainingCents,
    }));
  }

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
      // Open the GLOBAL scheduling modal
      setSchedulingForId(id);
      const defaultDate =
        (est?.scheduledStartDate || "").trim() ||
        new Date().toISOString().slice(0, 10);
      setScheduleStartDate(defaultDate);
      const existingArrival = String(est?.scheduledArrivalWindow || "").trim();
      if (existingArrival) {
        if (isStandardArrivalValue(existingArrival) || existingArrival === "Anytime") {
          setScheduleArrivalWindow(existingArrival);
          setScheduleCustomArrivalWindow("");
        } else {
          setScheduleArrivalWindow(ARRIVAL_CUSTOM);
          setScheduleCustomArrivalWindow(existingArrival);
        }
      } else {
        setScheduleArrivalWindow("");
        setScheduleCustomArrivalWindow("");
      }
      setScheduleNotes((est?.scheduleNotes || "").trim());
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

  async function sendFollowUpEmail(est: any, kind: "confirm" | "questions" | "deposit") {
    const toEmail = (est?.customerEmail || est?.sentToEmail || "").trim();
    if (!toEmail) {
      setToast("Missing customer email");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    const approveUrl = buildApprovalUrl(est) || "";
    const subjects: Record<"confirm" | "questions" | "deposit", string> = {
      confirm: "Quick check — did you receive your roofing estimate?",
      questions: "Any questions about your roofing estimate?",
      deposit: "Ready to lock your schedule date?",
    };
    const subject = subjects[kind];
    const message =
      kind === "confirm"
        ? "Hi — just checking that you received the roofing estimate we sent. If you have any questions or are ready to move forward, reply to this email or use the link below."
        : kind === "questions"
          ? "Hi — we wanted to follow up on the estimate you viewed. Do you have any questions? If you're ready to approve, you can use the link below."
          : "Hi — your estimate is approved. When you're ready to lock in your schedule date, we'll need a deposit. Use the link below to view details and pay.";
    try {
      const res = await fetch("/api/email/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: toEmail, subject, message, approveUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setToast(json?.error || "Failed to send follow-up");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      updateSavedEstimate(est.id, {
        lastFollowUpAt: new Date().toISOString(),
        followUpCount: (est.followUpCount ?? 0) + 1,
      });
      setEstimates(getNormalizedEstimates());
      setToast("Follow-up sent ✅");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setToast("Failed to send follow-up");
      setTimeout(() => setToast(null), 3000);
    }
  }

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setEstimates(getNormalizedEstimates());
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || hasRestoredReturnContextRef.current) return;
    hasRestoredReturnContextRef.current = true;
    if (typeof window === "undefined") return;
    const validStatusFilter = new Set(["all", "estimate", "sent_pending", "approved", "deposit_paid", "scheduled", "in_progress", "paid"]);
    const validScheduledView = new Set(["upcoming", "past", "all"]);
    const savedStatus = sessionStorage.getItem(ROOFING_SAVED_RETURN_STATUS_FILTER);
    const savedScheduled = sessionStorage.getItem(ROOFING_SAVED_RETURN_SCHEDULED_VIEW);
    const savedQuery = sessionStorage.getItem(ROOFING_SAVED_RETURN_QUERY);
    if (savedStatus != null && validStatusFilter.has(savedStatus)) {
      setStatusFilter(savedStatus as typeof statusFilter);
    }
    if (savedScheduled != null && validScheduledView.has(savedScheduled)) {
      setScheduledView(savedScheduled as typeof scheduledView);
    }
    if (savedQuery != null) {
      setQuery(savedQuery);
    }
    sessionStorage.removeItem(ROOFING_SAVED_RETURN_STATUS_FILTER);
    sessionStorage.removeItem(ROOFING_SAVED_RETURN_SCHEDULED_VIEW);
    sessionStorage.removeItem(ROOFING_SAVED_RETURN_QUERY);
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
    if (!hydrated || !estimates?.length) return;
    let cancelled = false;

    async function syncPaymentStatuses() {
      const candidates = estimates.filter((e) => e?.status !== "paid");
      for (const est of estimates) {
        const id = String(est?.id ?? "").trim();
        if (!id) continue;
        if (!shouldFetchPaymentStatus(id)) continue;
        const payment = await fetchPaymentState(id);
        if (cancelled) return;
        if (payment) {
          setPaymentStates((prev) => ({
            ...prev,
            [id]: {
              depositAmountCents: payment.depositAmountCents ?? undefined,
              fullAmountCents: payment.fullAmountCents ?? undefined,
              offlinePaidCents: (payment as { offlinePaidCents?: number }).offlinePaidCents ?? undefined,
              offlineTransactions: (payment as { offlineTransactions?: Array<{ stage?: string; amountCents?: number }> }).offlineTransactions ?? undefined,
            },
          }));
        }
        if (!candidates.includes(est)) continue;
        const rawStatus = String(est?.status ?? "");
        if (payment?.status === "paid" && rawStatus !== "paid" && rawStatus !== "completed") {
          markSavedEstimateStatus(id, "paid");
        } else if (payment?.status === "deposit_paid" && rawStatus !== "deposit_paid") {
          if (est.status === "approved") {
            markSavedEstimateStatus(id, "deposit_paid");
          }
        }
        const totalCents = toEstimateTotalCents(est);
        const collected =
          (payment?.depositAmountCents ?? 0) +
          (payment?.fullAmountCents ?? 0) +
          (Array.isArray((payment as any)?.offlineTransactions)
            ? (payment as any).offlineTransactions.reduce(
                (s: number, t: any) => s + (Number(t?.amountCents) || 0),
                0
              )
            : 0);
        if (
          totalCents > 0 &&
          collected >= totalCents &&
          rawStatus !== "paid" &&
          rawStatus !== "completed"
        ) {
          markSavedEstimateStatus(id, "paid");
        }
      }
      if (!cancelled) setEstimates(getNormalizedEstimates());
    }

    syncPaymentStatuses();
    return () => {
      cancelled = true;
    };
  }, [hydrated, estimates]);

  useEffect(() => {
    let cancelled = false;

    async function preload() {
      const ids = (estimates || []).map((e) => e?.id).filter(Boolean) as string[];
      const missing = ids.filter((id) => !paymentStates?.[id]);

      await Promise.all(
        missing.map(async (id) => {
          try {
            if (!shouldFetchPaymentStatus(id)) return;
            const ps = await fetchPaymentState(id);
            if (!cancelled && ps) {
              setPaymentStates((prev) => ({
                ...(prev || {}),
                [id]: {
                  depositAmountCents: ps.depositAmountCents ?? undefined,
                  fullAmountCents: ps.fullAmountCents ?? undefined,
                  offlinePaidCents: (ps as { offlinePaidCents?: number }).offlinePaidCents ?? undefined,
                  offlineTransactions: (ps as { offlineTransactions?: Array<{ stage?: string; amountCents?: number }> }).offlineTransactions ?? undefined,
                },
              }));
            }
          } catch {
            // ignore - badge fallback will cover it
          }
        })
      );
    }

    preload();
    return () => {
      cancelled = true;
    };
  }, [estimates]);

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

  let filtered = searchFiltered
    .filter((e) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "scheduled") {
        const hasSchedule = !!getScheduledDateKeyFromEstimate(e);
        const norm = normalizeStatusValue(e.status || "estimate");
        return hasSchedule && (norm === "scheduled" || norm === "in_progress");
      }
      const s = e.status || "estimate";
      const norm = normalizeStatusValue(s);
      if (statusFilter === "sent_pending") return norm === "pending" || s === "sent";
      return norm === normalizeStatusValue(statusFilter);
    });

  if (statusFilter === "scheduled") {
    filtered = filtered
      .filter((est) => {
        if (scheduledView === "all") return true;
        const past = isPastScheduled(est);
        return scheduledView === "past" ? past : !past;
      })
      .sort((a, b) => parseScheduledSortKey(a) - parseScheduledSortKey(b));
  }

  // ===============================
  // Pipeline Insight (contractor-first)
  // "Waiting to Schedule" = Approved + Deposit Paid jobs that are not scheduled/completed.
  const waitingToSchedule = (filtered || []).filter((e: any) => {
    const s = String(e?.status || "").toLowerCase();
    const isWaiting = s === "approved" || s === "deposit_paid";
    return isWaiting;
  });
  const waitingToScheduleCount = waitingToSchedule.length;
  const waitingToScheduleRevenue = waitingToSchedule.reduce((sum: number, e: any) => {
    const total = Number(e?.totalContractPrice ?? e?.suggestedPrice ?? 0);
    return sum + (Number.isFinite(total) ? total : 0);
  }, 0);
  const waitingToScheduleRevenueSafe = Number.isFinite(waitingToScheduleRevenue)
    ? waitingToScheduleRevenue
    : 0;

  const scheduledBoardItems =
    statusFilter === "scheduled"
      ? (filtered || [])
          .map((est) => {
            const key = getScheduledDateKeyFromEstimate(est);
            if (!key) return null;
            const date = parseISODateOnly(key);
            if (!date) return null;
            return { est, key, date };
          })
          .filter((x): x is { est: any; key: string; date: Date } => x != null)
      : [];

  const todayLocal = startOfLocalDay(new Date());
  const endOfTodayLocal = endOfLocalDay(new Date());
  const weekEndLocal = endOfLocalDay(new Date());
  weekEndLocal.setDate(weekEndLocal.getDate() + 7);

  const upcomingScheduledJobs =
    statusFilter === "scheduled"
      ? scheduledBoardItems.filter((x) => startOfLocalDay(x.date).getTime() >= todayLocal.getTime())
      : [];

  const jobsThisWeek =
    statusFilter === "scheduled"
      ? scheduledBoardItems.filter((x) => {
          const t = startOfLocalDay(x.date).getTime();
          return t >= todayLocal.getTime() && t <= weekEndLocal.getTime();
        })
      : [];

  const overdueScheduledJobs =
    statusFilter === "scheduled"
      ? scheduledBoardItems.filter((x) => endOfLocalDay(x.date).getTime() < todayLocal.getTime())
      : [];

  const scheduledRevenueSafe =
    statusFilter === "scheduled"
      ? scheduledBoardItems.reduce((sum: number, x) => {
          const total = Number(x.est?.totalContractPrice ?? x.est?.suggestedPrice ?? 0);
          return sum + (Number.isFinite(total) ? total : 0);
        }, 0)
      : 0;

  const funnel = computeFunnelStats(filtered, batchStatuses);
  const weakest = funnel.weakest;

  const pipelineInsight = getPipelineInsight(searchFiltered || []);
  const currentList = statusFilter === "all" ? (searchFiltered || []) : (filtered || []);
  const sentDueJobs = getSentDueJobs(currentList, batchStatuses);
  const approvedDueJobs = getApprovedDueJobs(currentList, paymentStates ?? {});
  const depositReadyJobs = getDepositReadyJobs(currentList, paymentStates ?? {});

  const statusDrivenGroups = useMemo(() => {
    if (statusFilter !== "all") return [];

    const items = (searchFiltered || []).slice();

    const groups = [
      {
        key: "needs_scheduling",
        label: "Needs Scheduling",
        items: items.filter((e) => {
          const norm = normalizeStatusValue(e.status || "estimate");
          return norm === "approved" || norm === "deposit_paid";
        }),
      },
      {
        key: "awaiting_approval",
        label: "Awaiting Approval",
        items: items.filter((e) => {
          const raw = String(e.status || "").toLowerCase();
          const norm = normalizeStatusValue(e.status || "estimate");
          return (
            norm === "pending" ||
            raw === "sent" ||
            raw === "viewed" ||
            norm === "sent"
          );
        }),
      },
      {
        key: "estimates",
        label: "Estimates",
        items: items.filter((e) => {
          const norm = normalizeStatusValue(e.status || "estimate");
          return norm === "estimate";
        }),
      },
      {
        key: "scheduled",
        label: "Scheduled",
        items: items.filter((e) => {
          const norm = normalizeStatusValue(e.status || "estimate");
          return norm === "scheduled";
        }),
      },
      {
        key: "on_site",
        label: "On Site",
        items: items.filter((e) => {
          const norm = normalizeStatusValue(e.status || "estimate");
          return norm === "in_progress";
        }),
      },
      {
        key: "completed",
        label: "Completed",
        items: items.filter((e) => {
          const norm = normalizeStatusValue(e.status || "estimate");
          return norm === "paid";
        }),
      },
    ];

    return groups.filter((group) => group.items.length > 0);
  }, [searchFiltered, statusFilter]);

  let nextActionText = "No action needed right now.";
  if (statusFilter === "sent_pending") {
    if (sentDueJobs.length === 1) {
      const one = sentDueJobs[0];
      const viewedAt = getEffectiveViewedAt(one, batchStatuses);
      nextActionText = viewedAt
        ? `Follow up with ${getEstimateDisplayName(one)} — estimate viewed but still awaiting approval.`
        : `Follow up with ${getEstimateDisplayName(one)} — estimate has not been viewed yet.`;
    } else if (sentDueJobs.length > 1) {
      nextActionText = `Follow up on ${sentDueJobs.length} sent estimate${sentDueJobs.length === 1 ? "" : "s"} that are due.`;
    }
  } else if (statusFilter === "approved") {
    if (approvedDueJobs.length === 1) {
      nextActionText = `Collect deposit for ${getEstimateDisplayName(approvedDueJobs[0])}.`;
    } else if (approvedDueJobs.length > 1) {
      nextActionText = `Collect deposit for ${approvedDueJobs.length} approved job${approvedDueJobs.length === 1 ? "" : "s"}.`;
    }
  } else if (statusFilter === "deposit_paid") {
    if (depositReadyJobs.length === 1) {
      nextActionText = `Schedule ${getEstimateDisplayName(depositReadyJobs[0])}.`;
    } else if (depositReadyJobs.length > 1) {
      nextActionText = `Schedule ${depositReadyJobs.length} deposit-paid job${depositReadyJobs.length === 1 ? "" : "s"}.`;
    }
  } else if (statusFilter === "estimate") {
    nextActionText = "No action needed right now.";
  } else if (statusFilter === "scheduled") {
    if (overdueScheduledJobs.length > 0) {
      if (overdueScheduledJobs.length === 1) {
        nextActionText = `Review past scheduled job for ${getEstimateDisplayName(overdueScheduledJobs[0].est)}.`;
      } else {
        nextActionText = `Review ${overdueScheduledJobs.length} past scheduled jobs.`;
      }
    } else {
      const now = new Date();
      const todayCount = scheduledBoardItems.filter((x) => getScheduleBucket(x.date, now) === "today").length;
      const tomorrowCount = scheduledBoardItems.filter((x) => getScheduleBucket(x.date, now) === "tomorrow").length;
      const thisWeekCount = scheduledBoardItems.filter((x) => getScheduleBucket(x.date, now) === "this_week").length;
      const nextWeekCount = scheduledBoardItems.filter((x) => getScheduleBucket(x.date, now) === "next_week").length;
      const futureCount = scheduledBoardItems.filter((x) => getScheduleBucket(x.date, now) === "future").length;

      if (todayCount >= 1) {
        nextActionText = todayCount === 1 ? "1 job scheduled today." : `${todayCount} jobs scheduled today.`;
      } else if (tomorrowCount >= 1) {
        nextActionText = tomorrowCount === 1 ? "1 job scheduled tomorrow." : `${tomorrowCount} jobs scheduled tomorrow.`;
      } else if (thisWeekCount >= 1) {
        nextActionText = thisWeekCount === 1 ? "1 job scheduled this week." : `${thisWeekCount} jobs scheduled this week.`;
      } else if (nextWeekCount >= 1) {
        nextActionText = nextWeekCount === 1 ? "1 upcoming job next week." : `${nextWeekCount} upcoming jobs next week.`;
      } else if (futureCount >= 1) {
        nextActionText = futureCount === 1 ? "1 future scheduled job." : `${futureCount} future scheduled jobs.`;
      } else {
        nextActionText = "No scheduled jobs yet.";
      }
    }
  } else if (statusFilter === "all") {
    if (depositReadyJobs.length === 1) {
      nextActionText = `Schedule ${getEstimateDisplayName(depositReadyJobs[0])}.`;
    } else if (depositReadyJobs.length > 1) {
      nextActionText = `Schedule ${depositReadyJobs.length} deposit-paid job${depositReadyJobs.length === 1 ? "" : "s"}.`;
    } else if (approvedDueJobs.length === 1) {
      nextActionText = `Collect deposit for ${getEstimateDisplayName(approvedDueJobs[0])}.`;
    } else if (approvedDueJobs.length > 1) {
      nextActionText = `Collect deposit for ${approvedDueJobs.length} approved job${approvedDueJobs.length === 1 ? "" : "s"}.`;
    } else if (sentDueJobs.length === 1) {
      const one = sentDueJobs[0];
      const viewedAt = getEffectiveViewedAt(one, batchStatuses);
      nextActionText = viewedAt
        ? `Follow up with ${getEstimateDisplayName(one)} — estimate viewed but still awaiting approval.`
        : `Follow up with ${getEstimateDisplayName(one)} — estimate has not been viewed yet.`;
    } else if (sentDueJobs.length > 1) {
      nextActionText = `Follow up on ${sentDueJobs.length} sent estimate${sentDueJobs.length === 1 ? "" : "s"} that are due.`;
    }
  }

  const weakestLabel = `${FUNNEL_LABELS[weakest.from]} → ${FUNNEL_LABELS[weakest.to]}`;
  const weakestPct = weakest.pct;

  // Show numerator/denominator so the % has meaning (ex: 2/6)
  const weakestNumer = weakest.numer ?? 0;
  const weakestDenom = weakest.denom ?? 0;

  // Overall close rate for revenue forecast (derived from funnel)
  const overallCloseRatePct =
    funnel.reached.estimate > 0
      ? Math.round((funnel.reached.completed / funnel.reached.estimate) * 100)
      : 0;

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
      <div className="mx-auto max-w-3xl space-y-6">
        <RoofingTabs active="saved" />
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <a
                href="/tools/roofing"
                className="inline-flex items-center text-[11px] text-white/50 hover:text-white/70"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  window.location.assign("/tools/roofing");
                }}
              >
                ← Back to Calculator
              </a>

              {(() => {
                const pageTitle: Record<typeof statusFilter, string> = {
                  all: "Saved Estimates",
                  estimate: "Estimates",
                  sent_pending: "Sent Estimates",
                  approved: "Approved Jobs",
                  deposit_paid: "Deposit Paid",
                  scheduled: "Scheduled Jobs",
                  in_progress: "Crew On Site",
                  paid: "Completed Jobs",
                };
                const pageSubtitle: Record<typeof statusFilter, string> = {
                  all: "All saved estimates in your pipeline",
                  estimate: "Draft estimates not yet sent",
                  sent_pending: "Sent, awaiting view or response",
                  approved: "Approved, ready to schedule",
                  deposit_paid: "Deposit received, ready to schedule",
                  scheduled: "Jobs currently scheduled in your pipeline",
                  in_progress: "Jobs actively being worked today",
                  paid: "Finished and paid work",
                };
                return (
                  <>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[32px]">
                      {pageTitle[statusFilter]}
                    </h1>
                    <p className="mt-2 text-sm text-white/55">
                      {pageSubtitle[statusFilter]}
                    </p>
                  </>
                );
              })()}
            </div>

            <div className="w-full lg:max-w-md">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search saved estimates..."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/90 placeholder:text-white/40 outline-none focus:border-white/20 focus:bg-white/[0.08]"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[
              ["all", "All"],
              ["estimate", "Estimate"],
              ["sent_pending", "Sent"],
              ["approved", "Approved"],
              ["deposit_paid", "Deposit paid"],
              ["scheduled", "Scheduled"],
              ["in_progress", "On Site"],
              ["paid", "Completed"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key as any)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 " +
                  (statusFilter === key
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                    : "bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white/90")
                }
              >
                {label}
              </button>
            ))}
          </div>

          {statusFilter === "scheduled" && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {(["upcoming", "past", "all"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setScheduledView(key)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 " +
                    (scheduledView === key
                      ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                      : "bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white/90")
                  }
                >
                  {key === "upcoming" ? "Upcoming" : key === "past" ? "Past" : "All"}
                </button>
              ))}
            </div>
          )}
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

        {hydrated && (
          <RevenueSummary
            estimates={searchFiltered}
            onMetrics={setRevenueMetrics}
          />
        )}

        {/* Pipeline Insight (contractor-first) */}
        {hydrated && (
          <div className="mt-10 w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">Pipeline Insight</div>
                <div className="mt-1 text-sm text-white/55">
                  One thing to focus on right now.
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
                Contractor view
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
                <div className="text-xs uppercase tracking-wide text-emerald-200/80">
                  {statusFilter === "scheduled" ? "SCHEDULED REVENUE" : "Revenue waiting"}
                </div>
                <div className="mt-2 text-2xl font-semibold text-emerald-100">
                  ${(statusFilter === "scheduled" ? scheduledRevenueSafe : waitingToScheduleRevenueSafe).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="mt-1 text-sm text-emerald-200/70">
                  {statusFilter === "scheduled" ? "Revenue from scheduled jobs in this view" : "If you schedule these jobs"}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                <div className="text-xs uppercase tracking-wide text-amber-200/80">
                  {statusFilter === "scheduled" ? "Upcoming Jobs" : "Waiting to schedule"}
                </div>
                <div className="mt-2 text-2xl font-semibold text-amber-100">
                  {statusFilter === "scheduled" ? upcomingScheduledJobs.length : waitingToScheduleCount}
                </div>
                <div className="mt-1 text-sm text-amber-200/70">
                  {statusFilter === "scheduled" ? "Jobs on your upcoming schedule" : "Deposit-paid jobs not yet scheduled"}
                </div>
              </div>

              {statusFilter === "scheduled" ? (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-cyan-200/80">
                    JOBS THIS WEEK
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-cyan-100">
                    {jobsThisWeek.length}
                  </div>
                  <div className="mt-1 text-sm text-cyan-200/70">
                    Jobs scheduled in the next 7 days
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-wide text-white/50">Weakest stage</div>
                  <div className="mt-2 text-base font-semibold text-white">
                    {weakestLabel}
                  </div>
                  {weakestDenom > 0 && (
                    <>
                      <div className="mt-1 text-sm text-amber-300">
                        ⚠ {weakestPct}% conversion
                      </div>
                      <div className="mt-1 text-xs text-white/40">
                        {weakestNumer} of {weakestDenom} jobs
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-slate-300">
                <span className="font-semibold text-white">Next action:</span>{" "}
                {nextActionText}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Scheduled UX v2 enabled */}
          {hydrated && statusFilter === "scheduled" && (() => {
            const now = new Date();
            const withDates = filtered
              .map((est) => {
                const key = getScheduledDateKeyFromEstimate(est);
                if (!key) return null;
                const date = parseISODateOnly(key);
                if (!date) return null;
                return { est, key, date };
              })
              .filter((x): x is { est: any; key: string; date: Date } => x != null);

            const byBucket: Record<ScheduleBucket, { est: any; key: string; date: Date }[]> = {
              today: [],
              tomorrow: [],
              this_week: [],
              next_week: [],
              future: [],
              past: [],
            };
            for (const x of withDates) {
              const bucket = getScheduleBucket(x.date, now);
              byBucket[bucket].push(x);
            }

            const bucketOrder: ScheduleBucket[] = ["today", "tomorrow", "this_week", "next_week", "future"];
            const SCHEDULE_LANE_LABELS: Record<string, string> = {
              today: "TODAY",
              tomorrow: "TOMORROW",
              this_week: "THIS WEEK",
              next_week: "NEXT WEEK",
              future: "FUTURE",
              past: "PAST JOBS",
            };

            const renderScheduledCard = (x: { est: any; key: string; date: Date }) => (
              <SavedEstimateCard
                key={x.est.id}
                estimate={x.est}
                batchStatuses={batchStatuses}
                paymentState={paymentStates[x.est.id] ?? null}
                checkoutLoading={checkoutLoading}
                showRescheduleButton
                scheduleActionLabel="Reschedule"
                followUpInfo={getFollowUpInfo(x.est, paymentStates[x.est.id] ?? null, batchStatuses)}
                onSendFollowUp={(est, kind) => sendFollowUpEmail(est, kind)}
                followUpHidden={isFollowUpHidden(x.est.id)}
                onFollowUpSnooze={(estimateId) =>
                  updateFollowUpPref(estimateId, {
                    snoozeUntil: addDaysToIso(3),
                    clearedUntil: null,
                  })
                }
                onFollowUpClear={(estimateId) =>
                  updateFollowUpPref(estimateId, {
                    cleared: true,
                    clearedUntil: null,
                    snoozeUntil: null,
                  })
                }
                onStartCheckout={(id, type, est, remainingCentsForFull) => startCheckout(id, type, est, setCheckoutLoading, remainingCentsForFull, { statusFilter, scheduledView, query })}
                onOpenDepositModal={(est) =>
                  setDepositModal({
                    open: true,
                    estimateId: est.id,
                    estimateTotal: Number(est.totalContractPrice ?? est.suggestedPrice ?? 0),
                    customValue: "",
                    mode: "percent",
                    percent: 10,
                  })
                }
                onOpenRemainingModal={(est, remainingCents) =>
                  setRemainingModal({
                    open: true,
                    estimateId: est.id,
                    estimateTotalCents: toEstimateTotalCents(est),
                    remainingCents,
                    mode: "full",
                    customValue: "",
                  })
                }
                onOpenOfflineModal={(est) => {
                  const total = Number(est.totalContractPrice ?? est.suggestedPrice ?? 0);
                  const totalCents = Math.round(total * 100);
                  const ps = paymentStates[est.id];
                  const depositPaidCents = ps?.depositAmountCents || 0;
                  const fullPaidCents = ps?.fullAmountCents || 0;
                  const offlinePaidCents = ps?.offlinePaidCents || 0;
                  const remainingCents = Math.max(totalCents - (depositPaidCents + fullPaidCents + offlinePaidCents), 0);
                  const remainingDollars = remainingCents / 100;
                  setOfflineModal({
                    open: true,
                    estimateId: est.id,
                    estimateTotal: total,
                    remaining: remainingDollars,
                    amount: remainingDollars ? String(remainingDollars.toFixed(2)) : "",
                    method: "cash",
                    notes: "",
                    stage: "deposit",
                  });
                }}
                onOpenTransactions={openTransactions}
                openMoreFor={openMoreFor}
                setOpenMoreFor={setOpenMoreFor}
                moreMenuRef={moreMenuRef}
                onLoad={(est) => handleAction(est, "load")}
                onDelete={(id) => {
                  const est = filtered.find((x) => x.id === id);
                  if (est) handleAction(est, "delete");
                }}
                onStatusChange={(id, status) => {
                  const statusTyped = status as "estimate" | "sent" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid";
                  if (statusTyped === "scheduled") {
                    const est = filtered.find((x) => x.id === id);
                    if (est && !est.scheduledStartDate) {
                      setToast("Pick a start date to schedule.");
                      setTimeout(() => setToast(null), 2500);
                      setSchedulingForId(id);
                      setScheduleStartDate((est?.scheduledStartDate || "").trim() || new Date().toISOString().slice(0, 10));
                      const existingArrival = String(est?.scheduledArrivalWindow || "").trim();
                      if (existingArrival) {
                        if (isStandardArrivalValue(existingArrival) || existingArrival === "Anytime") {
                          setScheduleArrivalWindow(existingArrival);
                          setScheduleCustomArrivalWindow("");
                        } else {
                          setScheduleArrivalWindow(ARRIVAL_CUSTOM);
                          setScheduleCustomArrivalWindow(existingArrival);
                        }
                      } else {
                        setScheduleArrivalWindow("");
                        setScheduleCustomArrivalWindow("");
                      }
                      setScheduleNotes((est?.scheduleNotes || "").trim());
                      return;
                    }
                  }
                  updateSavedEstimate(id, { status: statusTyped });
                  setEstimates(getNormalizedEstimates());
                  const label = statusTyped.charAt(0).toUpperCase() + statusTyped.slice(1);
                  setToast(statusTyped === "approved" ? "Approved ✅" : statusTyped === "scheduled" ? "Scheduled ✅" : statusTyped === "in_progress" ? "Crew on site ✅" : `Status updated → ${label}`);
                  setTimeout(() => setToast(null), 2500);
                }}
                onSend={(est) => handleAction(est, "send")}
                onSchedule={(est) => handleAction(est, "schedule")}
                onRecordPayment={(est) => handleAction(est, "pay")}
                onMarkApproved={(est) => handleAction(est, "approve")}
                onView={(est) => handleAction(est, "load")}
                isFlashing={x.est.id === flashId}
              />
            );

            return (
              <div className="space-y-8">
                {bucketOrder.map((bucket) => {
                  const items = byBucket[bucket];
                  if (!items.length) return null;
                  const byDateInBucket = new Map<string, { est: any; key: string; date: Date }[]>();
                  for (const x of items) {
                    if (!byDateInBucket.has(x.key)) byDateInBucket.set(x.key, []);
                    byDateInBucket.get(x.key)!.push(x);
                  }
                  const dateKeysInBucket = Array.from(byDateInBucket.keys()).sort((a, b) => a.localeCompare(b));
                  return (
                    <div key={bucket} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] pt-3 px-4 pb-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div className="text-sm font-semibold text-white">
                          {`${SCHEDULE_LANE_LABELS[bucket]} • ${items.length} job${items.length > 1 ? "s" : ""}`}
                        </div>
                      </div>
                      {dateKeysInBucket.map((dateKey) => {
                        const dateItems = byDateInBucket.get(dateKey)!;
                        const dateObj = dateItems[0].date;
                        return (
                          <div key={dateKey} className="space-y-4">
                            <div className="mt-6 mb-3">
                              <div className="text-sm font-medium text-white/80">
                                {formatHeaderDate(dateObj)}
                              </div>
                            </div>
                            <div className="space-y-4">
                              {dateItems.map((x) => renderScheduledCard(x))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {hydrated && statusFilter !== "scheduled" && statusFilter === "all" && (
            <div className="space-y-10">
              {statusDrivenGroups.map((group) => (
                <div
                  key={group.key}
                  className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 pt-3 pb-4"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left"
                  >
                    <div className="text-[13px] font-semibold tracking-wide text-white/90">
                      {group.label} • {group.items.length} job{group.items.length > 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-white/50">
                      {collapsedGroups[group.key] ? "Show" : "Hide"}
                    </div>
                  </button>

                  {!collapsedGroups[group.key] && (
                  <div className="space-y-6">
                    {group.items.map((e) => (
                      <SavedEstimateCard
                        key={e.id}
                        estimate={e}
                        batchStatuses={batchStatuses}
                        paymentState={paymentStates[e.id] ?? null}
                        checkoutLoading={checkoutLoading}
                        followUpInfo={getFollowUpInfo(e, paymentStates[e.id] ?? null, batchStatuses)}
                        onSendFollowUp={(est, kind) => sendFollowUpEmail(est, kind)}
                        followUpHidden={isFollowUpHidden(e.id)}
                        onFollowUpSnooze={(estimateId) =>
                          updateFollowUpPref(estimateId, {
                            snoozeUntil: addDaysToIso(3),
                            clearedUntil: null,
                          })
                        }
                        onFollowUpClear={(estimateId) =>
                          updateFollowUpPref(estimateId, {
                            cleared: true,
                            clearedUntil: null,
                            snoozeUntil: null,
                          })
                        }
                        onStartCheckout={(id, type, est, remainingCentsForFull) =>
                          startCheckout(id, type, est, setCheckoutLoading, remainingCentsForFull, {
                            statusFilter,
                            scheduledView,
                            query,
                          })
                        }
                        onOpenDepositModal={(est) =>
                          setDepositModal({
                            open: true,
                            estimateId: est.id,
                            estimateTotal: Number(est.totalContractPrice ?? est.suggestedPrice ?? 0),
                            customValue: "",
                            mode: "percent",
                            percent: 10,
                          })
                        }
                        onOpenRemainingModal={(est, remainingCents) =>
                          setRemainingModal({
                            open: true,
                            estimateId: est.id,
                            estimateTotalCents: toEstimateTotalCents(est),
                            remainingCents,
                            mode: "full",
                            customValue: "",
                          })
                        }
                        onOpenOfflineModal={(est) => {
                          const total = Number(est.totalContractPrice ?? est.suggestedPrice ?? 0);
                          const totalCents = Math.round(total * 100);
                          const ps = paymentStates[est.id];
                          const depositPaidCents = ps?.depositAmountCents || 0;
                          const fullPaidCents = ps?.fullAmountCents || 0;
                          const offlinePaidCents = ps?.offlinePaidCents || 0;
                          const remainingCents = Math.max(totalCents - (depositPaidCents + fullPaidCents + offlinePaidCents), 0);
                          const remainingDollars = remainingCents / 100;
                          setOfflineModal({
                            open: true,
                            estimateId: est.id,
                            estimateTotal: total,
                            remaining: remainingDollars,
                            amount: remainingDollars ? String(remainingDollars.toFixed(2)) : "",
                            method: "cash",
                            notes: "",
                            stage: "deposit",
                          });
                        }}
                        onOpenTransactions={openTransactions}
                        openMoreFor={openMoreFor}
                        setOpenMoreFor={setOpenMoreFor}
                        moreMenuRef={moreMenuRef}
                        onLoad={(est) => handleAction(est, "load")}
                        onDelete={(id) => {
                          const est = group.items.find((x) => x.id === id);
                          if (est) handleAction(est, "delete");
                        }}
                        onStatusChange={(id, status) => {
                          const statusTyped = status as "estimate" | "sent" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid";
                          if (statusTyped === "scheduled") {
                            const est = searchFiltered.find((x) => x.id === id);
                            if (est && !est.scheduledStartDate) {
                              setToast("Pick a start date to schedule.");
                              setTimeout(() => setToast(null), 2500);
                              setSchedulingForId(id);
                              setScheduleStartDate((est?.scheduledStartDate || "").trim() || new Date().toISOString().slice(0, 10));
                              const existingArrival = String(est?.scheduledArrivalWindow || "").trim();
                              if (existingArrival) {
                                if (isStandardArrivalValue(existingArrival) || existingArrival === "Anytime") {
                                  setScheduleArrivalWindow(existingArrival);
                                  setScheduleCustomArrivalWindow("");
                                } else {
                                  setScheduleArrivalWindow(ARRIVAL_CUSTOM);
                                  setScheduleCustomArrivalWindow(existingArrival);
                                }
                              } else {
                                setScheduleArrivalWindow("");
                                setScheduleCustomArrivalWindow("");
                              }
                              setScheduleNotes((est?.scheduleNotes || "").trim());
                              return;
                            }
                          }
                          updateSavedEstimate(id, { status: statusTyped });
                          setEstimates(getNormalizedEstimates());
                          const label = statusTyped.charAt(0).toUpperCase() + statusTyped.slice(1);
                          setToast(statusTyped === "approved" ? "Approved ✅" : statusTyped === "scheduled" ? "Scheduled ✅" : statusTyped === "in_progress" ? "Crew on site ✅" : `Status updated → ${label}`);
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
                  )}
                </div>
              ))}
            </div>
          )}

          {hydrated && statusFilter !== "scheduled" && statusFilter !== "all" && filtered.map((e) => (
            <SavedEstimateCard
              key={e.id}
              estimate={e}
              batchStatuses={batchStatuses}
              paymentState={paymentStates[e.id] ?? null}
              checkoutLoading={checkoutLoading}
              followUpInfo={getFollowUpInfo(e, paymentStates[e.id] ?? null, batchStatuses)}
              onSendFollowUp={(est, kind) => sendFollowUpEmail(est, kind)}
              followUpHidden={isFollowUpHidden(e.id)}
              onFollowUpSnooze={(estimateId) =>
                updateFollowUpPref(estimateId, {
                  snoozeUntil: addDaysToIso(3),
                  clearedUntil: null,
                })
              }
              onFollowUpClear={(estimateId) =>
                updateFollowUpPref(estimateId, {
                  cleared: true,
                  clearedUntil: null,
                  snoozeUntil: null,
                })
              }
              onStartCheckout={(id, type, est, remainingCentsForFull) => startCheckout(id, type, est, setCheckoutLoading, remainingCentsForFull, { statusFilter, scheduledView, query })}
              onOpenDepositModal={(est) =>
                setDepositModal({
                  open: true,
                  estimateId: est.id,
                  estimateTotal: Number(est.totalContractPrice ?? est.suggestedPrice ?? 0),
                  customValue: "",
                  mode: "percent",
                  percent: 10,
                })
              }
              onOpenRemainingModal={(est, remainingCents) =>
                setRemainingModal({
                  open: true,
                  estimateId: est.id,
                  estimateTotalCents: toEstimateTotalCents(est),
                  remainingCents,
                  mode: "full",
                  customValue: "",
                })
              }
              onOpenOfflineModal={(est) => {
                const total = Number(est.totalContractPrice ?? est.suggestedPrice ?? 0);
                const totalCents = Math.round(total * 100);
                const ps = paymentStates[est.id];
                const depositPaidCents = ps?.depositAmountCents || 0;
                const fullPaidCents = ps?.fullAmountCents || 0;
                const offlinePaidCents = ps?.offlinePaidCents || 0;
                const remainingCents = Math.max(totalCents - (depositPaidCents + fullPaidCents + offlinePaidCents), 0);
                const remainingDollars = remainingCents / 100;
                setOfflineModal({
                  open: true,
                  estimateId: est.id,
                  estimateTotal: total,
                  remaining: remainingDollars,
                  amount: remainingDollars ? String(remainingDollars.toFixed(2)) : "",
                  method: "cash",
                  notes: "",
                  stage: "deposit",
                });
              }}
              onOpenTransactions={openTransactions}
              openMoreFor={openMoreFor}
              setOpenMoreFor={setOpenMoreFor}
              moreMenuRef={moreMenuRef}
              onLoad={(est) => handleAction(est, "load")}
              onDelete={(id) => {
                const est = filtered.find((x) => x.id === id);
                if (est) handleAction(est, "delete");
              }}
              onStatusChange={(id, status) => {
                const statusTyped = status as "estimate" | "sent" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid";
                if (statusTyped === "scheduled") {
                  const est = filtered.find((x) => x.id === id);
                  if (est && !est.scheduledStartDate) {
                    setToast("Pick a start date to schedule.");
                    setTimeout(() => setToast(null), 2500);
                    setSchedulingForId(id);
                    setScheduleStartDate((est?.scheduledStartDate || "").trim() || new Date().toISOString().slice(0, 10));
                    const existingArrival = String(est?.scheduledArrivalWindow || "").trim();
                    if (existingArrival) {
                      if (isStandardArrivalValue(existingArrival) || existingArrival === "Anytime") {
                        setScheduleArrivalWindow(existingArrival);
                        setScheduleCustomArrivalWindow("");
                      } else {
                        setScheduleArrivalWindow(ARRIVAL_CUSTOM);
                        setScheduleCustomArrivalWindow(existingArrival);
                      }
                    } else {
                      setScheduleArrivalWindow("");
                      setScheduleCustomArrivalWindow("");
                    }
                    setScheduleNotes((est?.scheduleNotes || "").trim());
                    return;
                  }
                }
                updateSavedEstimate(id, { status: statusTyped });
                setEstimates(getNormalizedEstimates());
                const label = statusTyped.charAt(0).toUpperCase() + statusTyped.slice(1);
                setToast(statusTyped === "approved" ? "Approved ✅" : statusTyped === "scheduled" ? "Scheduled ✅" : statusTyped === "in_progress" ? "Crew on site ✅" : `Status updated → ${label}`);
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
              setScheduleCustomArrivalWindow("");
              setScheduleNotes("");
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-xl"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="text-sm font-semibold text-white">{e.customerName || "Schedule Job"}</div>
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-medium text-white/70">Start date</label>
                <input
                  type="date"
                  value={scheduleStartDate}
                  onChange={(ev) => setScheduleStartDate(ev.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20"
                />
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-white/70">
                    Arrival window (optional)
                  </label>
                  <select
                    value={scheduleArrivalWindow}
                    onChange={(ev) => {
                      const next = ev.target.value;
                      if (next === ARRIVAL_CUSTOM) {
                        setScheduleArrivalWindow(ARRIVAL_CUSTOM);
                        if (!scheduleCustomArrivalWindow.trim()) {
                          setScheduleCustomArrivalWindow("");
                        }
                        return;
                      }
                      setScheduleArrivalWindow(next);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20"
                  >
                    <option value="">— Select —</option>
                    {ARRIVAL_WINDOWS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    <option value={ARRIVAL_CUSTOM}>Custom time…</option>
                  </select>

                  {scheduleArrivalWindow === ARRIVAL_CUSTOM ? (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-white/60">
                        Custom time (shows internally)
                      </label>
                      <input
                        value={scheduleCustomArrivalWindow}
                        onChange={(ev) => setScheduleCustomArrivalWindow(ev.target.value)}
                        placeholder='e.g., "9:30–11:00" or "After 3 PM"'
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                      />
                      <div className="mt-1 text-[11px] text-white/45">
                        Tip: Keep it customer-friendly (avoid "last stop" language).
                      </div>
                    </div>
                  ) : null}

                  <label className="mt-2 block text-xs font-medium text-white/70">
                    Notes (optional)
                  </label>
                  <textarea
                    value={scheduleNotes}
                    onChange={(ev) => setScheduleNotes(ev.target.value)}
                    placeholder="Gate code, HOA rules, material delivery notes, crew instructions..."
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/35 focus:border-white/20"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (!scheduleStartDate || !String(scheduleStartDate).trim()) {
                      setToast("Pick a start date to schedule.");
                      setTimeout(() => setToast(null), 2500);
                      return;
                    }
                    const iso = normalizeScheduleDateISO(scheduleStartDate.trim());
                    if (!iso) {
                      setToast("Pick a start date to schedule.");
                      setTimeout(() => setToast(null), 2500);
                      return;
                    }
                    setSchedulingId(e.id);
                    const nowIso = new Date().toISOString();
                    const arrivalWindowRaw = String(scheduleArrivalWindow || "").trim();
                    const arrivalWindow =
                      arrivalWindowRaw === ARRIVAL_CUSTOM
                        ? String(scheduleCustomArrivalWindow || "").trim()
                        : arrivalWindowRaw;
                    const notes = String(scheduleNotes || "").trim();
                    setTimeout(() => {
                      markSavedEstimateScheduled(e.id, iso, notes || undefined, arrivalWindow || undefined);
                      updateSavedEstimate(e.id, {
                        ...(e.status !== "paid" ? { status: "scheduled" as const } : {}),
                        scheduledStartDate: iso,
                        scheduledArrivalWindow: arrivalWindow,
                        scheduleNotes: notes,
                        scheduledAt: nowIso,
                        scheduleInfo: { ...((e as any).scheduleInfo ?? {}), date: iso, time: arrivalWindow || "Time TBD" },
                        schedule: { ...((e as any).schedule ?? {}), date: iso },
                      });
                      setEstimates(getNormalizedEstimates());
                      setToast("Scheduled ✅");
                      setTimeout(() => setToast(null), 2500);
                      setSchedulingForId(null);
                      setScheduleStartDate("");
                      setScheduleArrivalWindow("");
                      setScheduleCustomArrivalWindow("");
                      setScheduleNotes("");
                      setStatusFilter("scheduled");
                      setQuery("");
                      setFlashId(e.id);
                      setTimeout(() => setFlashId(null), 1200);
                      setSchedulingId(null);
                    }, 400);
                  }}
                  disabled={!scheduleStartDate.trim() || schedulingId === e.id}
                  className="rounded-xl px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-50"
                >
                  {schedulingId === e.id ? "Scheduling…" : "Save Schedule"}
                </button>
                <button
                  onClick={() => {
                    setSchedulingForId(null);
                    setScheduleStartDate("");
                    setScheduleArrivalWindow("");
                    setScheduleCustomArrivalWindow("");
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

      {/* Deposit picker modal */}
      {depositModal.open && depositModal.estimateId && (() => {
        const ps = paymentStates[depositModal.estimateId] ?? null;
        const stripeCollected = (ps?.depositAmountCents ?? 0) + (ps?.fullAmountCents ?? 0);
        const offlineCollected = (ps as { offlinePaidCents?: number })?.offlinePaidCents ?? 0;
        const hasAnyPayment =
          stripeCollected > 0 ||
          offlineCollected > 0 ||
          (Array.isArray((ps as { offlineTransactions?: unknown[] })?.offlineTransactions) ? (ps as { offlineTransactions: unknown[] }).offlineTransactions.length : 0) > 0;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1220] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-white">Choose deposit amount</div>
              <button
                onClick={() => setDepositModal((s) => ({ ...s, open: false }))}
                className="rounded-xl px-2 py-1 text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 text-sm text-white/70">
              Total: {formatCentsToCurrency(toEstimateTotalCents({ totalContractPrice: depositModal.estimateTotal, suggestedPrice: depositModal.estimateTotal }))}
            </div>

            {hasAnyPayment ? (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Deposit amount is locked after the first payment. To change totals, update the estimate (change order) then collect remaining.
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => !hasAnyPayment && setDepositModal((s) => ({ ...s, mode: "percent" }))}
                disabled={hasAnyPayment}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  depositModal.mode === "percent" ? "bg-white/15 text-white" : "bg-white/5 text-white/80 hover:bg-white/10"
                } ${hasAnyPayment ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Percent
              </button>
              <button
                onClick={() => !hasAnyPayment && setDepositModal((s) => ({ ...s, mode: "dollars" }))}
                disabled={hasAnyPayment}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  depositModal.mode === "dollars" ? "bg-white/15 text-white" : "bg-white/5 text-white/80 hover:bg-white/10"
                } ${hasAnyPayment ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Custom $
              </button>
            </div>

            {depositModal.mode === "percent" ? (
              <div className="mt-4">
                <div className="flex gap-2">
                  {[10, 15, 20, 25].map((p) => (
                    <button
                      key={p}
                      onClick={() => !hasAnyPayment && setDepositModal((s) => ({ ...s, percent: p }))}
                      disabled={hasAnyPayment}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                        depositModal.percent === p ? "bg-emerald-600 text-white" : "bg-white/5 text-white/80 hover:bg-white/10"
                      } ${hasAnyPayment ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-sm text-white/70">
                  Deposit: {formatCentsToCurrency(Math.round(toEstimateTotalCents({ totalContractPrice: depositModal.estimateTotal, suggestedPrice: depositModal.estimateTotal }) * (depositModal.percent / 100)))}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-sm text-white/70">Deposit amount</label>
                <input
                  value={depositModal.customValue}
                  onChange={(e) => !hasAnyPayment && setDepositModal((s) => ({ ...s, customValue: e.target.value }))}
                  disabled={hasAnyPayment}
                  placeholder="Example: 500"
                  className={`mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20 ${hasAnyPayment ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <div className="mt-2 text-xs text-white/50">Enter dollars (numbers only). Example: 500</div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDepositModal((s) => ({ ...s, open: false }))}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                disabled={hasAnyPayment}
                onClick={async () => {
                  if (hasAnyPayment) return;
                  const estimateTotalCents = toEstimateTotalCents({ totalContractPrice: depositModal.estimateTotal, suggestedPrice: depositModal.estimateTotal });
                  const customDepositCents =
                    depositModal.mode === "percent"
                      ? Math.round(estimateTotalCents * (depositModal.percent / 100))
                      : Math.round(Number(depositModal.customValue || 0) * 100);

                  await startCheckout(depositModal.estimateId!, "deposit", {
                    estimateTotalCents,
                    customDepositCents,
                  }, setCheckoutLoading, undefined, { statusFilter, scheduledView, query });

                  setDepositModal((s) => ({ ...s, open: false }));
                }}
                className={`flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 ${hasAnyPayment ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Continue to payment
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Remaining balance modal (Collect Final: full or custom amount) */}
      {remainingModal.open && remainingModal.estimateId && remainingModal.remainingCents > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1220] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-white">Collect remaining balance</div>
              <button
                onClick={() => setRemainingModal((s) => ({ ...s, open: false }))}
                className="rounded-xl px-2 py-1 text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 text-sm text-white/70">
              Remaining: {formatCentsToCurrency(remainingModal.remainingCents)}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRemainingModal((s) => ({ ...s, mode: "full" }))}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  remainingModal.mode === "full" ? "bg-white/15 text-white" : "bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                Remaining balance
              </button>
              <button
                onClick={() => setRemainingModal((s) => ({ ...s, mode: "custom" }))}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  remainingModal.mode === "custom" ? "bg-white/15 text-white" : "bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                Custom amount
              </button>
            </div>

            {remainingModal.mode === "custom" ? (
              <div className="mt-4">
                <label className="text-sm text-white/70">Amount</label>
                <input
                  value={remainingModal.customValue}
                  onChange={(e) => setRemainingModal((s) => ({ ...s, customValue: e.target.value }))}
                  placeholder="Example: 500"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
                />
                <div className="mt-2 text-xs text-white/50">Enter dollars. Max: {formatCentsToCurrency(remainingModal.remainingCents)}</div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/70">
                Collect full remaining: {formatCentsToCurrency(remainingModal.remainingCents)}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setRemainingModal((s) => ({ ...s, open: false }))}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const amountCents =
                    remainingModal.mode === "full"
                      ? remainingModal.remainingCents
                      : Math.min(
                          Math.round(Number(remainingModal.customValue || 0) * 100),
                          remainingModal.remainingCents
                        );
                  if (amountCents <= 0) return;
                  await startCheckout(
                    remainingModal.estimateId!,
                    "balance",
                    { estimateTotalCents: remainingModal.estimateTotalCents },
                    setCheckoutLoading,
                    amountCents,
                    { statusFilter, scheduledView, query }
                  );
                  setRemainingModal((s) => ({ ...s, open: false }));
                }}
                className="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Proceed to checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline payment modal */}
      {offlineModal.open && offlineModal.estimateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1220] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-white">Record offline payment</div>
              <button
                onClick={() => setOfflineModal((s) => ({ ...s, open: false }))}
                className="rounded-xl px-2 py-1 text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 text-sm text-white/70">
              Remaining: {Number(offlineModal.remaining || 0).toLocaleString(undefined, { style: "currency", currency: "USD" })}
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/70">Amount</label>
              <input
                value={offlineModal.amount}
                onChange={(e) => setOfflineModal((s) => ({ ...s, amount: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
                placeholder="Example: 500.00"
              />
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/70">This payment is for</label>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setOfflineModal((s) => ({ ...s, stage: "deposit" }))}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    offlineModal.stage === "deposit" ? "bg-emerald-600 text-white" : "bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  Deposit
                </button>
                <button
                  onClick={() => setOfflineModal((s) => ({ ...s, stage: "additional" }))}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    offlineModal.stage === "additional" ? "bg-emerald-600 text-white" : "bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  Additional / Final
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/70">Method</label>
              <select
                value={offlineModal.method}
                onChange={(e) => setOfflineModal((s) => ({ ...s, method: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="zelle">Zelle</option>
                <option value="venmo">Venmo</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="insurance">Insurance</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="text-sm text-white/70">Notes (optional)</label>
              <input
                value={offlineModal.notes}
                onChange={(e) => setOfflineModal((s) => ({ ...s, notes: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-white/20"
                placeholder="Example: Check #1042 / Insurance claim / etc."
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOfflineModal((s) => ({ ...s, open: false }))}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  const estimateTotalCents = Math.round((offlineModal.estimateTotal || 0) * 100);
                  const ps = paymentStates[offlineModal.estimateId ?? ""];
                  const totalCollected =
                    (ps?.depositAmountCents ?? 0) +
                    (ps?.fullAmountCents ?? 0) +
                    ((ps as { offlinePaidCents?: number })?.offlinePaidCents ?? sumOfflineCents(ps ?? undefined) ?? 0);
                  const remainingCents = Math.max(estimateTotalCents - totalCollected, 0);

                  let enteredCents = Math.round(Number(offlineModal.amount || 0) * 100);
                  if (enteredCents > remainingCents) {
                    enteredCents = remainingCents;
                  }

                  const res = await fetch("/api/payments/record-offline", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      estimateId: offlineModal.estimateId,
                      amountCents: enteredCents,
                      method: offlineModal.method,
                      notes: offlineModal.notes,
                      estimateTotalCents,
                      stage: offlineModal.stage,
                    }),
                  });

                  const json = await res.json().catch(() => null);

                  if (!res.ok || !json?.ok) {
                    alert(json?.error || "Failed to record offline payment");
                    return;
                  }

                  const id = offlineModal.estimateId;
                  if (!id) return;

                  allowPaymentStatusFetch(id);
                  const payment = await fetchPaymentState(id);
                  if (payment) {
                    setPaymentStates((prev) => ({
                      ...prev,
                      [id]: {
                        depositAmountCents: payment.depositAmountCents ?? undefined,
                        fullAmountCents: payment.fullAmountCents ?? undefined,
                        offlinePaidCents: (payment as { offlinePaidCents?: number }).offlinePaidCents ?? undefined,
                        offlineTransactions: (payment as { offlineTransactions?: Array<{ stage?: string; amountCents?: number }> }).offlineTransactions ?? undefined,
                      },
                    }));
                  }
                  if (json?.status === "paid") {
                    markSavedEstimateStatus(id, "paid");
                  } else if (json?.status === "deposit_paid") {
                    const est = estimates.find((e) => e.id === id);
                    if (est && est.status !== "scheduled" && est.status !== "in_progress" && est.status !== "paid") {
                      markSavedEstimateStatus(id, "deposit_paid");
                    }
                  }
                  lastStatusFetchRef.current[id] = Date.now();
                  setEstimates(getNormalizedEstimates());
                  setOfflineModal((s) => ({ ...s, open: false }));
                }}
                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Save payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions modal */}
      {txModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTxModal((s) => ({ ...s, open: false }));
          }}
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1220] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-white">
                Transactions{txModal.title ? ` — ${txModal.title}` : ""}
              </div>
              <button
                onClick={() => setTxModal((s) => ({ ...s, open: false }))}
                className="rounded-xl px-2 py-1 text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span className="font-semibold">{formatCentsToCurrency(txModal.totalCents)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Collected</span>
                <span className="font-semibold">
                  {formatCentsToCurrency(Math.max(txModal.totalCents - txModal.remainingCents, 0))}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Remaining balance</span>
                <span className="font-semibold">{formatCentsToCurrency(txModal.remainingCents)}</span>
              </div>
            </div>

            <div className="mt-4">
              {txModal.loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  Loading…
                </div>
              ) : txModal.items.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  No transactions recorded yet.
                </div>
              ) : (
                <div className="max-h-[50vh] overflow-auto rounded-2xl border border-white/10">
                  {txModal.items.map((t, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-3 ${idx ? "border-t border-white/10" : ""} bg-[#0b1220]`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-white/90">{t.label}</div>
                            {t.label.toLowerCase().includes("stripe") ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                                Stripe
                              </span>
                            ) : t.label.toLowerCase().includes("offline") ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                                Offline
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-xs text-white/60">
                            {formatDateTime(t.whenIso)}{t.meta ? ` • ${t.meta}` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 text-sm font-semibold text-white">
                          {formatCentsToCurrency(t.amountCents)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setTxModal((s) => ({ ...s, open: false }))}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
