"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  PhoneCall,
  CreditCard,
  CalendarCheck2,
  Factory,
  ArrowRight,
} from "lucide-react";
import FieldDiveAppShell from "../FieldDiveAppShell";
import ScheduleJobModal, {
  type ScheduleModalMode,
} from "../jobCard/ScheduleJobModal";
import JobsBoardHeader from "./components/JobsBoardHeader";
import JobsBoardColumn from "./components/JobsBoardColumn";
import JobsBoardListView from "./components/JobsBoardListView";
import JobsBoardCard from "./components/JobsBoardCard";
import JobsBoardPipelineGuidance from "./components/JobsBoardPipelineGuidance";
import JobsBoardEmptyState from "./components/JobsBoardEmptyState";
import JobsBoardErrorState from "./components/JobsBoardErrorState";
import JobsBoardLegacySection from "./components/JobsBoardLegacySection";
import JobsBoardSearchResults from "./components/JobsBoardSearchResults";
import { useWorkspaceSearch } from "./useWorkspaceSearch";
import { restoreCanonicalBoardFromReturnStatus } from "@/app/lib/boardCanonicalSurface";
import { useCompanySetupReadiness } from "./useCompanySetupReadiness";
import { useBoardCanonicalJobs } from "./useBoardCanonicalJobs";
import {
  applyBoardDispositionFilter,
  applyBoardUpdatedDateFilter,
  BOARD_DEFAULT_DISPOSITION_FILTER,
  BOARD_DEFAULT_SORT_KEY,
  BOARD_DEFAULT_VIEW_MODE,
  buildJobsBoardCardModel,
  filterJobsByVisibleStages,
  getJobsForBoardColumn,
  getBoardColumnByKey,
  getBoardColumnKeyForJob,
  getDefaultVisibleColumnKeys,
  isBoardFiltersActive,
  JOBS_BOARD_CATEGORY_GROUPS,
  loadBoardViewState,
  saveBoardViewState,
  sortJobsForBoardColumn,
  sumJobsValueCents,
  type BoardColumnKey,
  type BoardDispositionFilter,
  type BoardSortKey,
  type BoardViewMode,
} from "./jobsBoardUtils";
import {
  getSavedEstimates,
  getSavedEstimateById,
  setCurrentLoadedSavedId,
  deleteSavedEstimate,
  updateSavedEstimate,
  markSavedEstimateApproved,
  markSavedEstimateApprovedByToken,
  markEstimateViewedByToken,
  markSavedEstimateStatus,
  addPaymentToEstimate,
  setEstimateStoreCompanyScope,
  type RoofingEstimate,
} from "@/app/lib/estimateStore";
import {
  filterBoardEntriesByLaneStatus,
  getDbJobIdFromBoardEntry,
  isDbBoardJobEntry,
  isLegacyBoardEstimateEntry,
  LAST_DB_JOB_ID_STORAGE_KEY,
  mapDbJobsToBoardEstimates,
  partitionLegacyEstimatesForBoardSection,
  resolveBoardEntryOpenHref,
  resolveLastDbJobRecoveryHref,
  searchBoardEntries,
} from "@/app/lib/jobBoardAdapter";
import { visibleDispositionLabel } from "@/app/lib/jobDispositionManagement";
import {
  hasActivePlannedWorkSchedule,
  isActiveJobDisposition,
  resolveDbBoardJobActionEligibility,
} from "@/app/lib/jobLifecycleActionEligibility";
import { formatJobCompletedAt } from "@/app/lib/jobCompleteTypes";
import { formatProductionStartedAt } from "@/app/lib/jobProductionTypes";
import {
  companyTimezoneForScheduling,
  formatScheduleBoardMeta,
  parseScheduleResumeContext,
  resolveCompanyTimezoneReadState,
  stripScheduleResumeParams,
} from "@/app/lib/jobScheduleMapper";
import type {
  JobSchedule,
  ScheduleCandidateJob,
} from "@/app/lib/jobScheduleTypes";
import { buildJobCardAttentionHref } from "@/app/lib/jobAttentionReadModel";
import {
  fetchJobAttentionDetail,
  notifyJobAttentionChanged,
} from "@/app/lib/jobAttentionReadClient";
import { useJobAttentionSummaries } from "@/app/lib/useJobAttention";
import {
  BOARD_APPROVE_CONFIRM_TITLE,
  BOARD_COMPLETE_CONFIRM_TITLE,
  BOARD_MOVEMENT_ACCEPTANCE_REQUIRED_COPY,
  BOARD_START_WORK_CONFIRM_TITLE,
  BOARD_UNSCHEDULE_CONFIRM_BODY,
  BOARD_UNSCHEDULE_CONFIRM_TITLE,
  approvalPendingFromAttentionType,
  boardDropTargetValidity,
  buildBoardProposalCreateHref,
  findApproveJobAcceptanceItem,
  hitTestBoardColumnKey,
  mapBoardColumnKeyToCanonicalStage,
  resolveBoardGuardedMovement,
  type BoardMovementIntentKind,
} from "@/app/lib/boardGuardedMovement";
import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";
import BoardMovementConfirmDialog from "./components/BoardMovementConfirmDialog";

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

const ROOFING_SAVED_RETURN_STATUS_FILTER = "roofing_saved_return_status_filter";
const ROOFING_SAVED_RETURN_SCHEDULED_VIEW = "roofing_saved_return_scheduled_view";
const ROOFING_SAVED_RETURN_QUERY = "roofing_saved_return_query";

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

type BoardPaymentStatusRow = {
  status?: string;
  depositAmountCents?: number;
  fullAmountCents?: number;
  offlinePaidCents?: number;
  offlineTransactions?: Array<{ stage?: string; amountCents?: number }>;
};

async function fetchPaymentStatesBatch(estimateIds: string[]) {
  const ids = estimateIds.map((id) => String(id ?? "").trim()).filter(Boolean);
  if (ids.length === 0) return {} as Record<string, BoardPaymentStatusRow | null>;
  const res = await fetch(
    `/api/payments/status-batch?estimateIds=${encodeURIComponent(ids.join(","))}`,
    { cache: "no-store" }
  );
  if (!res.ok) return {} as Record<string, BoardPaymentStatusRow | null>;
  const data = await res.json().catch(() => null);
  if (!data?.ok || !data?.payments || typeof data.payments !== "object") {
    return {} as Record<string, BoardPaymentStatusRow | null>;
  }
  return data.payments as Record<string, BoardPaymentStatusRow | null>;
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

function toEstimateTotalCents(
  estimate: { totalContractPrice?: number; suggestedPrice?: number } | null | undefined
): number {
  const v = Number(estimate?.totalContractPrice ?? estimate?.suggestedPrice ?? 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
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
  source?: "stripe" | "offline";
  kind?: "summary" | "recorded";
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatPaymentMethodLabel(method?: string | null): string {
  const rawMethod = String(method || "").trim().toLowerCase();
  if (rawMethod === "cash_app") return "Cash App";
  if (rawMethod === "cash") return "Cash";
  if (rawMethod === "check") return "Check";
  if (rawMethod === "zelle") return "Zelle";
  if (rawMethod === "venmo") return "Venmo";
  if (rawMethod === "bank_transfer") return "Bank transfer";
  if (rawMethod === "insurance") return "Insurance";
  if (rawMethod === "other") return "Offline";
  if (rawMethod) return rawMethod.replace(/\b\w/g, (c) => c.toUpperCase());
  return "Offline";
}

function formatStageLabel(stage?: string | null): "deposit" | "payment" {
  return stage === "deposit" ? "deposit" : "payment";
}

function formatOfflinePaymentLabel(method?: string | null, stage?: string | null): string {
  return `${formatPaymentMethodLabel(method)} (${formatStageLabel(stage)})`;
}

function formatStripePaymentLabel(kind: "deposit" | "payment"): string {
  return kind === "deposit" ? "Stripe deposit" : "Stripe payment";
}

function formatStripeSummaryMeta(kind: "deposit" | "payment"): string {
  return kind === "deposit" ? "Stripe total collected" : "Stripe total collected";
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
  if (status === "in_progress") return "Production";
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
  { value: "paid", label: "Completed" },
];

type SavedPaymentNote = "check_pending" | "insurance_pending" | "financing_approved" | "waived_deposit";

const PAYMENT_NOTE_VALUES = new Set<string>([
  "check_pending",
  "insurance_pending",
  "financing_approved",
  "waived_deposit",
]);

const PAYMENT_NOTE_OPTIONS: Array<{ value: SavedPaymentNote; label: string }> = [
  { value: "check_pending", label: "Check pending" },
  { value: "insurance_pending", label: "Insurance pending" },
  { value: "financing_approved", label: "Financing approved" },
  { value: "waived_deposit", label: "Waived deposit" },
];

function formatPaymentNoteLabel(note: SavedPaymentNote): string {
  const row = PAYMENT_NOTE_OPTIONS.find((o) => o.value === note);
  return row?.label ?? note;
}

function normalizePaymentNote(raw: unknown): SavedPaymentNote | null {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  return PAYMENT_NOTE_VALUES.has(s) ? (s as SavedPaymentNote) : null;
}

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
  if (s === "in_progress") return "Production";
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
        Production
      </span>
    );
  }
  if (status === "completed_due") {
    return (
      <span className={`${base} bg-amber-500/15 text-amber-200 ring-amber-400/30`}>
        <span className={`${dot} bg-amber-300`} />
        Final Payment Due
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

function PipelineBar({
  status,
  isViewed,
  hasRealPayment,
  hasSchedulingOverride,
}: {
  status: string;
  isViewed?: boolean;
  hasRealPayment?: boolean;
  hasSchedulingOverride?: boolean;
}) {
  const steps = ["estimate", "sent_pending", "approved", "deposit_paid", "scheduled", "in_progress", "paid"] as const;
  const labels: Record<(typeof steps)[number], string> = {
    estimate: "Estimate",
    sent_pending: "Sent",
    approved: "Approved",
    deposit_paid: "Deposit",
    scheduled: "Scheduled",
    in_progress: "Production",
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

  const depositIndex = steps.indexOf("deposit_paid");
  const scheduledIndex = steps.indexOf("scheduled");

  const isPastDeposit = activeIndex >= scheduledIndex;

  const depositWasBypassed =
    isPastDeposit &&
    !hasRealPayment &&
    hasSchedulingOverride;

  return (
    <div className="mt-4">
      {/* labels row */}
      <div className="mb-2 flex items-center justify-between text-xs font-medium tracking-wide">
        {steps.map((s, i) => {
          const done = i <= activeIndex;
          return (
            <span
              key={s}
              className={
                s === "deposit_paid" && depositWasBypassed
                  ? "text-white/40"
                  : done
                    ? "text-white/70"
                    : "text-white/50"
              }
              title={
                s === "deposit_paid" && depositWasBypassed
                  ? "Deposit not recorded (override used)"
                  : undefined
              }
            >
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
          let dotClass;

          if (s === "deposit_paid" && depositWasBypassed) {
            dotClass = "bg-white/10 opacity-60"; // dimmed
          } else {
            dotClass =
              done
                ? isPendingStep && isViewed
                  ? "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]"
                  : "bg-emerald-400"
                : "bg-white/10";
          }
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
    return { due: true, reason: "Follow-up needed", kind: "questions" };
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
  onPaymentNoteChange,
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
  onPaymentNoteChange?: (estimateId: string, paymentNote: SavedPaymentNote | null) => void;
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
  const resolvedStatus =
    status === "approved" || status === "deposit_paid" || status === "scheduled" || status === "in_progress" || status === "paid"
      ? status
      : effectiveStatus;
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
  const hasRealPayment = collectedCents > 0;
  const paidSoFarCents = (depositPaid || 0) + (fullPaid || 0) + (offlinePaid || 0);
  const hasAnyPayment = paidSoFarCents > 0;
  const hasRemaining = remainingCents > 0;
  const isFinalPayment = hasAnyPayment && hasRemaining;

  const hasPaymentState = !!paymentState;
  const fallbackDepositPaid =
    estimate?.status === "deposit_paid" ||
    estimate?.status === "paid" ||
    estimate?.status === "completed";
  const fallbackPaid =
    estimate?.status === "paid" || estimate?.status === "completed";
  const showPaid = hasPaymentState ? isFullyPaid : fallbackPaid;
  const showDepositPaid = hasPaymentState ? isDepositPaid : fallbackDepositPaid;
  const isCompletedWithBalance = resolvedStatus === "paid" && hasRemaining;
  const pillStatus = (
    showPaid
      ? "paid"
      : isCompletedWithBalance
        ? "completed_due"
        : showDepositPaid
          ? "deposit_paid"
          : displayStatus
  ) as string;

  const isPreApproval =
    resolvedStatus === "sent" || resolvedStatus === "viewed";
  const isPostApproval =
    resolvedStatus === "approved" ||
    resolvedStatus === "deposit_paid" ||
    resolvedStatus === "scheduled" ||
    resolvedStatus === "in_progress" ||
    resolvedStatus === "paid";
  const pillStatusForPill =
    isPostApproval
      ? (isCompletedWithBalance ? "completed_due" : resolvedStatus)
      : (displayStatus === "not_viewed" || displayStatus === "viewed")
        ? "sent"
        : displayStatus;
  const showViewedBadge = isPreApproval && !!viewedAt;
  const showNotViewedBadge = isPreApproval && !viewedAt;
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
  const savedCardAddressDisplay = (() => {
    const fromAddress = (estimate.address || "").trim();
    if (fromAddress) return fromAddress;
    const base = (estimate.jobAddress || estimate.jobAddress1 || "").trim();
    const locality = [estimate.city ?? estimate.jobCity, estimate.state ?? estimate.jobState, estimate.zip ?? estimate.jobZip]
      .filter(Boolean)
      .join(", ");
    if (base && locality) return `${base}, ${locality}`;
    if (base) return base;
    if (locality) return locality;
    return "";
  })();
  const actionBtn =
    "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const followUpReason = followUpInfo?.due ? followUpInfo.reason : null;
  const profitInfo = calcProfitInfo(estimate);
  const visibleFollowUpInfo = followUpHidden ? undefined : followUpInfo;
  const visibleFollowUpReason = followUpHidden ? null : followUpReason;
  const paymentNote = normalizePaymentNote(estimate?.paymentNote);

  const showDepositRecordedPill =
    hasRealPayment &&
    showDepositPaid &&
    !isFullyPaid;

  const showOverrideDepositHelper =
    (resolvedStatus === "scheduled" ||
      resolvedStatus === "in_progress" ||
      resolvedStatus === "paid") &&
    !hasRealPayment &&
    !!paymentNote;

  const overrideDepositHelperText = showOverrideDepositHelper
    ? `Deposit pending — ${formatPaymentNoteLabel(paymentNote)}`
    : null;

  const [followUpMenuOpen, setFollowUpMenuOpen] = useState(false);
  const followUpMenuRef = useRef<HTMLDivElement | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [depositReasonStep, setDepositReasonStep] = useState<"idle" | "pick_reason">("idle");
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
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
  useEffect(() => {
    function handleDocMouseDown(ev: MouseEvent) {
      if (!statusMenuOpen) return;
      const target = ev.target as Node | null;
      if (statusMenuRef.current && target && statusMenuRef.current.contains(target)) return;
      setStatusMenuOpen(false);
    }
    document.addEventListener("mousedown", handleDocMouseDown);
    return () => document.removeEventListener("mousedown", handleDocMouseDown);
  }, [statusMenuOpen]);
  useEffect(() => {
    if (!statusMenuOpen) setDepositReasonStep("idle");
  }, [statusMenuOpen]);
  return (
    <div
      className={`group relative rounded-3xl border border-white/12 bg-gradient-to-b from-slate-900/70 to-slate-950/40 p-6 transition-all duration-300
  ${showApprovalActions || status === "sent" || status === "sent_pending"
    ? "border-emerald-300/25 shadow-[0_0_0_1px_rgba(16,185,129,0.10)]"
    : isCompletedWithBalance
      ? "border-amber-300/25 shadow-[0_0_0_1px_rgba(251,191,36,0.10)]"
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

              {showViewedBadge ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                  Viewed
                </span>
              ) : null}
              {showNotViewedBadge ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/20">
                  Not viewed
                </span>
              ) : null}

{visibleFollowUpInfo?.due && (
  <span
    className="inline-flex items-center rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-200 ring-1 ring-inset ring-rose-400/20"
    title={visibleFollowUpInfo.reason}
  >
    {visibleFollowUpInfo.reason}
  </span>
)}
              {paymentNote && !hasRealPayment ? (
                <span
                  className="inline-flex items-center rounded-full bg-sky-500/12 px-2.5 py-1 text-[11px] font-semibold text-sky-100 ring-1 ring-inset ring-sky-400/25"
                  title={formatPaymentNoteLabel(paymentNote)}
                >
                  {formatPaymentNoteLabel(paymentNote)}
                </span>
              ) : null}
              {showDepositRecordedPill ? (
                <span
                  className="inline-flex items-center rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/25"
                  title="Deposit recorded"
                >
                  Deposit recorded
                </span>
              ) : null}

            </div>

            <div className="mt-4 text-xl font-bold text-white tracking-tight">
              {estimate.customerName || "Unnamed Customer"}
            </div>

            <div className="mt-2 text-sm text-white/70 truncate">
              {estimate.customerEmail || "No email"}
            </div>

            <div className="mt-1 text-sm text-white/45 leading-relaxed">
              {savedCardAddressDisplay || "No address"}
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
            <div className={`${isCompletedWithBalance ? "text-amber-300" : "text-emerald-300"} text-sm font-semibold`}>
              {resolvedStatus === "sent"
                ? "Sent — not viewed yet"
                : resolvedStatus === "viewed"
                  ? "Viewed — pending approval"
                  : resolvedStatus === "approved" && estimate.needsScheduling
                    ? "Approved — ready to schedule"
                    : isCompletedWithBalance
                      ? "Completed — final payment due"
                      : getDisplayStage(resolvedStatus)}
            </div>

            {showOverrideDepositHelper ? (
              <div className="mt-1 text-xs text-amber-200/80">
                {overrideDepositHelperText}
              </div>
            ) : stageAgeText ? (
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
            ) : null}

            {estimate.approvedAt && status === "approved" && (
              <div className="mt-0.5 text-xs text-white/35">Approved {formatDatePretty(estimate.approvedAt)}</div>
            )}

            <div className="relative mt-2" ref={statusMenuRef}>
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((v) => !v)}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/85 ring-1 ring-inset ring-white/8 transition hover:border-white/18 hover:bg-white/[0.09]"
                  aria-haspopup="menu"
                  aria-expanded={statusMenuOpen}
                >
                  <span className="max-w-[200px] truncate text-left">
                    {getDisplayStage(getStage(estimate) || "estimate")}
                  </span>
                  <span className="shrink-0 text-[10px] text-white/45" aria-hidden>
                    ▾
                  </span>
                </button>
                {statusMenuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] py-1 shadow-2xl backdrop-blur-xl">
                    {depositReasonStep === "pick_reason" && onPaymentNoteChange ? (
                      <>
                        <div className="border-b border-white/10 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setDepositReasonStep("idle")}
                            className="text-[11px] font-semibold text-white/55 transition hover:text-white/90"
                          >
                            ← Back
                          </button>
                          <div className="mt-2.5 px-0.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/95">
                              Reason required to move to Deposit
                            </div>
                            <p className="mt-1.5 text-[11px] leading-snug text-white/50">
                              No recorded Stripe or offline payment yet. Select one reason to continue.
                            </p>
                          </div>
                        </div>
                        {PAYMENT_NOTE_OPTIONS.map((opt) => {
                          const isNoteCurrent = paymentNote === opt.value;
                          return (
                            <button
                              key={`deposit-reason-${opt.value}`}
                              type="button"
                              onClick={() => {
                                onPaymentNoteChange(estimate.id, opt.value);
                                onStatusChange(estimate.id, "deposit_paid");
                                setDepositReasonStep("idle");
                                setStatusMenuOpen(false);
                              }}
                              className={[
                                "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-medium transition",
                                isNoteCurrent
                                  ? "bg-sky-500/12 text-sky-100 ring-1 ring-inset ring-sky-400/25"
                                  : "text-white/80 hover:bg-white/[0.06]",
                              ].join(" ")}
                            >
                              <span className="min-w-0 truncate">{opt.label}</span>
                              {isNoteCurrent ? <span className="shrink-0 text-sky-300/90">✓</span> : null}
                            </button>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        {STATUS_OPTIONS.map((opt) => {
                          const raw = opt.value;
                          const currentStage = getStage(estimate) || "estimate";
                          const isCurrent = currentStage === raw;
                          const nextStatus = raw === "pending" ? "sent_pending" : raw;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                if (
                                  nextStatus === "deposit_paid" &&
                                  !hasRealPayment &&
                                  onPaymentNoteChange
                                ) {
                                  setDepositReasonStep("pick_reason");
                                  return;
                                }
                                onStatusChange(estimate.id, nextStatus);
                                setDepositReasonStep("idle");
                                setStatusMenuOpen(false);
                              }}
                              className={[
                                "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-medium transition",
                                isCurrent
                                  ? "bg-emerald-500/12 text-emerald-200 ring-1 ring-inset ring-emerald-500/20"
                                  : "text-white/80 hover:bg-white/[0.06]",
                              ].join(" ")}
                            >
                              <span className="min-w-0 truncate">{opt.label}</span>
                              {isCurrent ? <span className="shrink-0 text-emerald-400/90">✓</span> : null}
                            </button>
                          );
                        })}
                        {onPaymentNoteChange ? (
                          <>
                            <div className="my-1 border-t border-white/10" role="separator" />
                            <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                              Payment Note
                            </div>
                            {PAYMENT_NOTE_OPTIONS.map((opt) => {
                              const isNoteCurrent = paymentNote === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    onPaymentNoteChange(estimate.id, opt.value);
                                    setStatusMenuOpen(false);
                                  }}
                                  className={[
                                    "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-xs font-medium transition",
                                    isNoteCurrent
                                      ? "bg-sky-500/12 text-sky-100 ring-1 ring-inset ring-sky-400/25"
                                      : "text-white/80 hover:bg-white/[0.06]",
                                  ].join(" ")}
                                >
                                  <span className="min-w-0 truncate">{opt.label}</span>
                                  {isNoteCurrent ? <span className="shrink-0 text-sky-300/90">✓</span> : null}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => {
                                onPaymentNoteChange(estimate.id, null);
                                setStatusMenuOpen(false);
                              }}
                              className={[
                                "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-xs font-medium transition",
                                !paymentNote
                                  ? "text-white/40 hover:bg-white/[0.04] hover:text-white/55"
                                  : "text-white/65 hover:bg-white/[0.06] hover:text-white/85",
                              ].join(" ")}
                            >
                              <span className="min-w-0 truncate">Clear payment note</span>
                            </button>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
          </div>
        </div>

        <PipelineBar
          status={getStage(estimate)}
          isViewed={isSent && !!viewedAt}
          hasRealPayment={hasRealPayment}
          hasSchedulingOverride={!!paymentNote}
        />

        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-6">
          {/* LEFT: Total + payment summary */}
          <div className="flex max-w-[360px] flex-col gap-0">
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
              const offlineTx = ((paymentState as { offlineTransactions?: Array<{ stage?: string; amountCents?: number; method?: string; notes?: string }> } | undefined)?.offlineTransactions || []) as { stage?: string; amountCents?: number; method?: string; notes?: string }[];
              return collectedCents > 0 || remainingCents > 0 ? (
                <div className="mt-3 space-y-1.5 text-sm text-white/78">
                  {depositPaidCents > 0 && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="min-w-0 text-white/68">{formatStripePaymentLabel("deposit")}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-white">{formatCentsToCurrency(depositPaidCents)}</span>
                    </div>
                  )}
                  {fullPaidCents > 0 && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="min-w-0 text-white/68">{formatStripePaymentLabel("payment")}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-white">{formatCentsToCurrency(fullPaidCents)}</span>
                    </div>
                  )}
                  {Array.isArray(offlineTx) &&
                    offlineTx.map((t, idx) => {
                      const amt = t?.amountCents || 0;
                      if (!amt) return null;

                      const label = formatOfflinePaymentLabel(t?.method, t?.stage);

                      return (
                        <div key={`${t?.stage || "offline"}-${idx}`} className="flex items-start justify-between gap-4">
                          <span className="min-w-0 text-white/68">{label}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-white">{formatCentsToCurrency(amt)}</span>
                        </div>
                      );
                    })}
                  {!isFullyPaid && remainingCents > 0 && (
                    <div
                      className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 ${
                        isCompletedWithBalance
                          ? "bg-amber-500/10 text-amber-100 ring-1 ring-inset ring-amber-400/20"
                          : "bg-white/[0.04] ring-1 ring-inset ring-white/8"
                      }`}
                    >
                      <span className={`${isCompletedWithBalance ? "text-amber-100" : "text-white/78"}`}>
                        {isCompletedWithBalance ? "Final payment due" : "Remaining balance"}
                      </span>
                      <span className="font-semibold tabular-nums text-white">{formatCentsToCurrency(remainingCents)}</span>
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
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
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

                {onSchedule && (status === "approved" || status === "deposit_paid" || status === "scheduled" || status === "in_progress" || status === "paid") && (
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
                        {visibleFollowUpInfo.kind === "confirm"
                          ? "📧 Confirm receipt"
                          : visibleFollowUpInfo.kind === "questions"
                          ? "📧 Check in"
                          : "📧 Move forward"}
                      </button>
                    )}
                    <div className="h-px w-full bg-white/10" />
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

export default function SavedClient({ companyId }: { companyId?: string }) {
  setEstimateStoreCompanyScope(companyId ?? null);
  const { summaries: attentionByJobId } = useJobAttentionSummaries(
    Boolean(companyId)
  );
  const buildSha = (process.env.NEXT_PUBLIC_BUILD_SHA || "local").toString().slice(0, 7);
  useEffect(() => {
    console.log("[BUILD]", buildSha);
  }, [buildSha]);
  const [hydrated, setHydrated] = useState(false);
  const [estimates, setEstimates] = useState<RoofingEstimate[]>([]);
  const {
    dbJobs,
    dbJobsLoaded,
    dbJobsStatus,
    dbJobsRefreshError,
    r3fSchedulesByJobId,
    r3fTimezone,
    r3fTimezoneLoadStatus,
    refreshDbJobs,
    setR3fSchedulesByJobId,
    setR3fTimezone,
    setR3fTimezoneLoadStatus,
  } = useBoardCanonicalJobs({
    enabled: hydrated,
    companyId,
  });
  const coreBoardReady = hydrated && dbJobsStatus === "ready";
  const companySetupReadiness = useCompanySetupReadiness(companyId, {
    enabled: coreBoardReady,
  });
  const secondarySetupReady = !companySetupReadiness.loading;
  const [lastDbJobId, setLastDbJobId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "estimate" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid">("all");
  const [focusedCanonicalColumn, setFocusedCanonicalColumn] = useState<BoardColumnKey | null>(null);
  const [boardSortKey, setBoardSortKey] = useState<BoardSortKey>(BOARD_DEFAULT_SORT_KEY);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<BoardColumnKey[]>(() =>
    getDefaultVisibleColumnKeys()
  );
  const [updatedOnOrAfter, setUpdatedOnOrAfter] = useState<string | null>(null);
  const [dispositionFilter, setDispositionFilter] =
    useState<BoardDispositionFilter>(BOARD_DEFAULT_DISPOSITION_FILTER);
  const [boardViewMode, setBoardViewMode] = useState<BoardViewMode>(BOARD_DEFAULT_VIEW_MODE);
  const [scheduledView, setScheduledView] = useState<"upcoming" | "past" | "all">("upcoming");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    completed: true,
  });
  const [r3fDepositDueByJobId, setR3fDepositDueByJobId] = useState<
    Record<string, boolean>
  >({});
  const [r3fScheduleModal, setR3fScheduleModal] = useState<{
    mode: ScheduleModalMode;
    jobId: string;
    schedule: JobSchedule | null;
    startsOn?: string;
    endsOn?: string;
    depositNotReceived?: boolean;
  } | null>(null);
  const [r3fScheduleBusy, setR3fScheduleBusy] = useState(false);
  const [r3fScheduleError, setR3fScheduleError] = useState<string | null>(null);
  const [r3gStartingJobId, setR3gStartingJobId] = useState<string | null>(null);
  const [r3hCompletingJobId, setR3hCompletingJobId] = useState<string | null>(null);
  const [r3cApprovingJobId, setR3cApprovingJobId] = useState<string | null>(null);
  const [boardDragJob, setBoardDragJob] = useState<RoofingEstimate | null>(null);
  const [boardDragHoverColumn, setBoardDragHoverColumn] =
    useState<BoardColumnKey | null>(null);
  const boardDragGhostRef = useRef<HTMLDivElement>(null);
  const boardDragHoverRef = useRef<BoardColumnKey | null>(null);
  const boardDragJobRef = useRef<RoofingEstimate | null>(null);
  const [boardMovementConfirm, setBoardMovementConfirm] = useState<{
    kind: Extract<
      BoardMovementIntentKind,
      "approve_job" | "start_work" | "complete_job" | "unschedule"
    >;
    job: RoofingEstimate;
    jobId: string;
    acceptanceId?: string;
  } | null>(null);
  const [boardMovementConfirmBusy, setBoardMovementConfirmBusy] = useState(false);
  const [boardMovementConfirmError, setBoardMovementConfirmError] = useState<
    string | null
  >(null);

  const [flashId, setFlashId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
  const [businessSnapshotOpen, setBusinessSnapshotOpen] = useState(false);
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

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      try {
        allowPaymentStatusFetch(id);
        let payment: { status?: string; depositAmountCents?: number; fullAmountCents?: number; [k: string]: unknown } | null = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          const res = await fetch(`/api/payments/status?estimateId=${encodeURIComponent(id)}`, {
            cache: "no-store",
          });
          const json = await res.json();
          if (json?.ok && json?.payment?.status) {
            const status = json.payment.status;
            if (status === "deposit_paid" || status === "paid") {
              payment = json.payment;
              break;
            }
          }
          if (attempt < 5) await wait(1500);
        }

        if (payment) {
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
        }

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
    const est = getSavedEstimateById(activeId) ?? estimates.find((x) => x.id === activeId);
    const contractTotal = est ? (Number(est.totalContractPrice ?? est.suggestedPrice ?? 0)) : 0;
    const isFullyPaid = contractTotal > 0 && paidAmount >= contractTotal;
    const newStatus = isFullyPaid ? "paid" : "deposit_paid";
    try {
      markSavedEstimateStatus(activeId, newStatus as "paid" | "deposit_paid", {
        paidAt: paymentDate
          ? new Date(paymentDate).toISOString()
          : new Date().toISOString(),
      });
      updateSavedEstimate(activeId, {
        amountPaid: paidAmount,
        paidDate: paymentDate || new Date().toISOString().slice(0, 10),
      });
      refreshSaved();
      setToast(isFullyPaid ? "Payment recorded ✅" : "Deposit recorded ✅");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      console.error("[SAVED] record payment failed", e);
    }
    setIsPaymentOpen(false);
    setActiveId(null);
  };

  const resolveJobOpenHref = useCallback(
    (estimate: RoofingEstimate) => {
      const jobId = getDbJobIdFromBoardEntry(estimate);
      const attention = jobId ? attentionByJobId[jobId] : null;
      return jobId && attention
        ? buildJobCardAttentionHref(jobId, attention.primaryAttentionId)
        : resolveBoardEntryOpenHref(estimate);
    },
    [attentionByJobId]
  );

  const handleViewDetails = (estimate: RoofingEstimate) => {
    const href = resolveJobOpenHref(estimate);
    if (href.includes("loadSaved=")) {
      setCurrentLoadedSavedId(estimate.id);
    } else {
      // DB job= route — clear any legacy pointer so it cannot bleed into the DB flow.
      setCurrentLoadedSavedId(null);
    }
    router.push(href);
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
        label: formatStripePaymentLabel("deposit"),
        amountCents: depositCents,
        whenIso: null,
        meta: formatStripeSummaryMeta("deposit"),
        source: "stripe",
        kind: "summary",
      });
    }

    if (fullCents > 0) {
      tx.push({
        label: formatStripePaymentLabel("payment"),
        amountCents: fullCents,
        whenIso: null,
        meta: formatStripeSummaryMeta("payment"),
        source: "stripe",
        kind: "summary",
      });
    }

    const offlineTx = Array.isArray(ps?.offlineTransactions) ? ps.offlineTransactions : [];
    for (const t of offlineTx) {
      const amt = Number(t?.amountCents || 0);
      if (!amt) continue;

      const label = formatOfflinePaymentLabel(t?.method, t?.stage);

      const notes = t?.notes ? String(t.notes) : "";
      const meta = notes || "";

      tx.push({
        label,
        amountCents: amt,
        whenIso: t?.recordedAt,
        meta,
        source: "offline",
        kind: "recorded",
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
      const href = resolveJobOpenHref(est);
      if (href.includes("loadSaved=")) {
        setCurrentLoadedSavedId(id);
      } else {
        // DB job= route — clear any legacy pointer so it cannot bleed into the DB flow.
        setCurrentLoadedSavedId(null);
      }
      router.push(href);
      return;
    }

    if (action === "delete") {
      if (isDbBoardJobEntry(est)) return;
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
      const dbJobId = getDbJobIdFromBoardEntry(est);
      if (dbJobId) {
        setR3fScheduleError(null);
        setR3fScheduleModal({
          mode: r3fSchedulesByJobId[dbJobId] ? "reschedule" : "schedule",
          jobId: dbJobId,
          schedule: r3fSchedulesByJobId[dbJobId] ?? null,
          depositNotReceived: r3fDepositDueByJobId[dbJobId] === true,
        });
        return;
      }
      setToast("Scheduling is available from canonical Jobs.");
      setTimeout(() => setToast(null), 2500);
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
      if ((out.totalContractPrice ?? 0) <= 0 && (out.suggestedPrice ?? 0) > 0) {
        (out as any).totalContractPrice = out.suggestedPrice;
      }
      return out;
    });
  }

  type SavedStatusTransitionVariant = "scheduledBoard" | "paymentGate";

  function applyStatusTransition(args: {
    id: string;
    nextStatus: string;
    estimate: any | undefined;
    variant: SavedStatusTransitionVariant;
    paymentStates: Record<
      string,
      | {
          depositAmountCents?: number;
          fullAmountCents?: number;
          offlinePaidCents?: number;
          offlineTransactions?: Array<{ stage?: string; amountCents?: number }>;
        }
      | null
      | undefined
    >;
    setEstimates: (v: RoofingEstimate[]) => void;
  }) {
    const { id, nextStatus, estimate: est, paymentStates, setEstimates } = args;
    const statusTyped = nextStatus as
      | "estimate"
      | "sent"
      | "sent_pending"
      | "approved"
      | "deposit_paid"
      | "scheduled"
      | "in_progress"
      | "paid";

    if (statusTyped === "in_progress") {
      setToast("Start work is available from canonical Jobs.");
      setTimeout(() => setToast(null), 2500);
      return;
    }

    if (statusTyped === "paid") {
      if (est && isDbBoardJobEntry(est)) {
        setToast("Complete job is available from canonical Jobs.");
        setTimeout(() => setToast(null), 2500);
        return;
      }
    }

    if (statusTyped === "scheduled") {
      if (est && isDbBoardJobEntry(est)) {
        const dbJobId = getDbJobIdFromBoardEntry(est);
        if (dbJobId) {
          setR3fScheduleError(null);
          setR3fScheduleModal({
            mode: r3fSchedulesByJobId[dbJobId] ? "reschedule" : "schedule",
            jobId: dbJobId,
            schedule: r3fSchedulesByJobId[dbJobId] ?? null,
            depositNotReceived: r3fDepositDueByJobId[dbJobId] === true,
          });
        }
        return;
      }
      setToast("Legacy estimates cannot create a Job schedule.");
      setTimeout(() => setToast(null), 2500);
      return;
    }

    updateSavedEstimate(id, { status: statusTyped });
    const refreshed = getNormalizedEstimates();
    setEstimates(refreshed);
    const updatedEstimate = refreshed.find((x) => x.id === id);
    const updatedTotalCents = updatedEstimate ? toEstimateTotalCents(updatedEstimate) : 0;
    const updatedPaymentState = updatedEstimate ? paymentStates[updatedEstimate.id] ?? undefined : undefined;
    const updatedDepositCents = updatedPaymentState?.depositAmountCents || 0;
    const updatedFullCents = updatedPaymentState?.fullAmountCents || 0;
    const updatedOfflineCents =
      (updatedPaymentState as { offlineAmountCents?: number })?.offlineAmountCents ??
      (updatedPaymentState as { offlinePaidCents?: number })?.offlinePaidCents ??
      sumOfflineCents(updatedPaymentState ?? undefined) ??
      0;
    const updatedCollectedCents = updatedDepositCents + updatedFullCents + updatedOfflineCents;
    const updatedRemainingCents = Math.max(0, updatedTotalCents - updatedCollectedCents);
    const label = statusTyped.charAt(0).toUpperCase() + statusTyped.slice(1);

    setToast(
      statusTyped === "approved"
        ? "Approved ✅"
        : statusTyped === "paid" && updatedRemainingCents > 0
            ? "Job marked completed. Final payment still due."
            : statusTyped === "paid"
              ? "Completed & paid ✅"
              : `Status updated → ${label}`
    );
    setTimeout(() => setToast(null), 2500);
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
      confirm: "Did you receive your roofing estimate?",
      questions: "Any questions about your roofing estimate?",
      deposit: "Ready to lock in your roofing project?",
    };
    const subject = subjects[kind];
    const message =
      kind === "confirm"
        ? "Hi — just checking in to make sure you received the roofing estimate we sent. If you have any questions or would like to move forward, you can reply to this email or use the link below to review the estimate."
        : kind === "questions"
          ? "Hi — we saw that you reviewed your roofing estimate and wanted to follow up to see if you had any questions. If everything looks good, you can approve the estimate using the link below."
          : "Hi — your roofing estimate has been approved. The next step is securing your schedule date with a deposit. You can review the estimate and submit the deposit using the link below.";
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
    if (!hydrated || !companyId) return;
    let cancelled = false;
    void fetch("/api/jobs/schedules?candidates=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((candidatesJson) => {
        if (cancelled) return;
        const due: Record<string, boolean> = {};
        const candidates: ScheduleCandidateJob[] = Array.isArray(
          candidatesJson?.candidates
        )
          ? candidatesJson.candidates
          : [];
        for (const candidate of candidates) {
          due[candidate.jobId] = candidate.depositDue === true;
        }
        setR3fDepositDueByJobId(due);
      })
      .catch(() => {
        // candidate failure must not block schedules/timezone truth
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, companyId, dbJobsLoaded]);

  useEffect(() => {
    const tzReady = companyTimezoneForScheduling(
      resolveCompanyTimezoneReadState({
        loadStatus: r3fTimezoneLoadStatus,
        savedTimezone: r3fTimezone,
      })
    );
    if (!hydrated || !tzReady) return;
    const resume = parseScheduleResumeContext(window.location.search);
    if (!resume) return;
    setR3fScheduleError(null);
    setR3fScheduleModal({
      mode: "schedule",
      jobId: resume.jobId,
      schedule: null,
      startsOn: resume.startsOn,
      endsOn: resume.endsOn,
      depositNotReceived: r3fDepositDueByJobId[resume.jobId] === true,
    });
    window.history.replaceState(
      {},
      "",
      stripScheduleResumeParams(
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      )
    );
  }, [hydrated, r3fDepositDueByJobId, r3fTimezone, r3fTimezoneLoadStatus]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      setLastDbJobId(window.localStorage.getItem(LAST_DB_JOB_ID_STORAGE_KEY));
    } catch {
      setLastDbJobId(null);
    }
  }, [hydrated, dbJobsLoaded]);

  useEffect(() => {
    const saved = loadBoardViewState();
    setBoardSortKey(saved.sortKey);
    setVisibleColumnKeys(saved.visibleColumnKeys);
    setUpdatedOnOrAfter(saved.updatedOnOrAfter);
    setDispositionFilter(saved.dispositionFilter);
    setBoardViewMode(saved.viewMode);
  }, []);

  useEffect(() => {
    saveBoardViewState({
      sortKey: boardSortKey,
      visibleColumnKeys,
      updatedOnOrAfter,
      viewMode: boardViewMode,
      dispositionFilter,
    });
  }, [boardSortKey, visibleColumnKeys, updatedOnOrAfter, boardViewMode, dispositionFilter]);

  useEffect(() => {
    if (!hydrated) return;
    const next = getNormalizedEstimates();
    const broken = next.find(
      (e) =>
        (e.customerName || "").trim() === "baby Ray123" ||
        (e.customerName || "").trim() === "baby Ray" ||
        /baby\s*Ray/i.test((e.customerName || "").trim())
    );
    if (broken) {
      console.log("[DEBUG] broken estimate by name", {
        id: broken.id,
        customerName: broken.customerName,
        totalContractPrice: broken.totalContractPrice,
        suggestedPrice: broken.suggestedPrice,
        amountPaid: broken.amountPaid,
        paymentHistory: broken.paymentHistory,
        materialsCost: broken.materialsCost,
        laborCost: broken.laborCost,
        disposalCost: broken.disposalCost,
        status: broken.status,
        raw: broken,
      });
    }
    const working = next.find((e) => (e.customerName || "").trim() === "Mark84");
    if (working) {
      console.log("[DEBUG] working estimate by name", {
        id: working.id,
        customerName: working.customerName,
        totalContractPrice: working.totalContractPrice,
        suggestedPrice: working.suggestedPrice,
        amountPaid: working.amountPaid,
        paymentHistory: working.paymentHistory,
        materialsCost: working.materialsCost,
        laborCost: working.laborCost,
        disposalCost: working.disposalCost,
        status: working.status,
        raw: working,
      });
    }
    setEstimates(next);
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
      const restored = restoreCanonicalBoardFromReturnStatus(savedStatus);
      setStatusFilter(restored.statusFilter);
      setFocusedCanonicalColumn(restored.focusedColumnKey);
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

    const run = () => {
      runApprovalSync();
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        run();
      }
    };

    const onFocus = () => {
      run();
    };

    const onPageShow = () => {
      run();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [hydrated, runApprovalSync]);

  useEffect(() => {
    if (!hydrated || !estimates?.length) return;
    let cancelled = false;

    async function syncPaymentStatuses() {
      let didMutate = false;
      const candidates = estimates.filter((e) => e?.status !== "paid");
      const batchIds: string[] = [];
      for (const est of estimates) {
        if (est?.supabaseBacked !== true) continue;
        const id = String(est?.id ?? "").trim();
        if (!id) continue;
        if (!shouldFetchPaymentStatus(id)) continue;
        batchIds.push(id);
      }

      const batchPayments =
        batchIds.length > 0 ? await fetchPaymentStatesBatch(batchIds) : {};

      for (const est of estimates) {
        if (est?.supabaseBacked !== true) continue;
        const id = String(est?.id ?? "").trim();
        if (!id) continue;
        const payment = batchIds.includes(id)
          ? (batchPayments[id] ?? null)
          : null;
        if (cancelled) return;
        if (payment) {
          setPaymentStates((prev) => ({
            ...prev,
            [id]: {
              depositAmountCents: payment.depositAmountCents ?? undefined,
              fullAmountCents: payment.fullAmountCents ?? undefined,
              offlinePaidCents: payment.offlinePaidCents ?? undefined,
              offlineTransactions: payment.offlineTransactions ?? undefined,
            },
          }));
        }
        if (!candidates.includes(est)) continue;
        const rawStatus = String(est?.status ?? "");
        if (payment?.status === "paid" && rawStatus !== "paid" && rawStatus !== "completed") {
          markSavedEstimateStatus(id, "paid");
          didMutate = true;
        } else if (payment?.status === "deposit_paid" && rawStatus !== "deposit_paid") {
          if (rawStatus !== "scheduled" && rawStatus !== "in_progress" && rawStatus !== "paid") {
            markSavedEstimateStatus(id, "deposit_paid");
            didMutate = true;
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
          didMutate = true;
        }
      }
      if (!cancelled && didMutate) {
        setEstimates(getNormalizedEstimates());
      }
    }

    syncPaymentStatuses();
    return () => {
      cancelled = true;
    };
  }, [hydrated, estimates]);

  useEffect(() => {
    let cancelled = false;

    async function preload() {
      const ids = (estimates || []).filter((e) => e?.supabaseBacked === true).map((e) => e?.id).filter(Boolean) as string[];
      const missing = ids.filter((id) => !paymentStates?.[id]);
      const fetchIds = missing.filter((id) => shouldFetchPaymentStatus(id));
      if (fetchIds.length === 0) return;

      try {
        const batchPayments = await fetchPaymentStatesBatch(fetchIds);
        if (cancelled) return;
        setPaymentStates((prev) => {
          const next = { ...(prev || {}) };
          for (const id of fetchIds) {
            const ps = batchPayments[id];
            if (!ps) continue;
            next[id] = {
              depositAmountCents: (ps as BoardPaymentStatusRow).depositAmountCents ?? undefined,
              fullAmountCents: (ps as BoardPaymentStatusRow).fullAmountCents ?? undefined,
              offlinePaidCents: (ps as BoardPaymentStatusRow).offlinePaidCents ?? undefined,
              offlineTransactions: (ps as BoardPaymentStatusRow).offlineTransactions ?? undefined,
            };
          }
          return next;
        });
      } catch {
        // ignore - badge fallback will cover it
      }
    }

    preload();
    return () => {
      cancelled = true;
    };
  }, [estimates]);

  const searchFiltered = useMemo(
    () => searchBoardEntries(estimates, query),
    [estimates, query]
  );

  const dbBoardEntries = useMemo(
    () => mapDbJobsToBoardEstimates(dbJobs),
    [dbJobs]
  );

  const legacyBoardEntries = useMemo(
    () => partitionLegacyEstimatesForBoardSection(estimates, dbJobs.map((job) => job.id)),
    [estimates, dbJobs]
  );

  const dbBoardSearchFiltered = dbBoardEntries;
  const boardReady = hydrated && dbJobsStatus === "ready";
  const companyJobSearch = useWorkspaceSearch(
    query,
    statusFilter === "all" && hydrated
  );

  const legacySearchFiltered = useMemo(
    () => searchBoardEntries(legacyBoardEntries, query),
    [legacyBoardEntries, query]
  );
  const boardReadError = hydrated && dbJobsStatus === "error";
  const canonicalLifecycleActionsEnabled = dbJobsStatus === "ready";
  const hasBoardJobs = dbBoardEntries.length > 0;
  const hasLegacyEstimates = legacyBoardEntries.length > 0;

  const lastDbJobRecoveryHref = useMemo(
    () => resolveLastDbJobRecoveryHref(lastDbJobId, dbJobs.length),
    [lastDbJobId, dbJobs.length]
  );

  const laneScheduleOptions = useMemo(
    () => ({
      hasSchedule: (e: RoofingEstimate) => !!getScheduledDateKeyFromEstimate(e),
      scheduledView,
      isPastScheduled,
      parseScheduledSortKey,
    }),
    [scheduledView]
  );

  /** Legacy estimates only — revenue, legacy queue, funnel metrics. */
  const estimateLaneFiltered = useMemo(
    () => filterBoardEntriesByLaneStatus(searchFiltered, statusFilter, laneScheduleOptions),
    [searchFiltered, statusFilter, laneScheduleOptions]
  );

  /** DB jobs only — Job Board lane cards, lane counts, kanban columns. */
  const filtered = useMemo(
    () => filterBoardEntriesByLaneStatus(dbBoardSearchFiltered, statusFilter, laneScheduleOptions),
    [dbBoardSearchFiltered, statusFilter, laneScheduleOptions]
  );

  // ===============================
  // Pipeline Insight (contractor-first)
  // "Waiting to Schedule" = Approved + Deposit Paid jobs that are not scheduled/completed.
  const waitingToSchedule = (estimateLaneFiltered || []).filter((e: any) => {
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
      ? (estimateLaneFiltered || [])
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

  const funnel = computeFunnelStats(estimateLaneFiltered, batchStatuses);
  const weakest = funnel.weakest;

  const pipelineInsight = getPipelineInsight(searchFiltered || []);
  const currentList =
    statusFilter === "all" ? (searchFiltered || []) : (estimateLaneFiltered || []);
  const sentDueJobs = getSentDueJobs(currentList, batchStatuses);
  const approvedDueJobs = getApprovedDueJobs(currentList, paymentStates ?? {});
  const depositReadyJobs = getDepositReadyJobs(currentList, paymentStates ?? {});

  const boardFilteredJobs = useMemo(
    () =>
      applyBoardDispositionFilter(
        applyBoardUpdatedDateFilter(dbBoardSearchFiltered || [], updatedOnOrAfter),
        dispositionFilter
      ),
    [dbBoardSearchFiltered, updatedOnOrAfter, dispositionFilter]
  );

  const boardFiltersActive = isBoardFiltersActive({
    sortKey: boardSortKey,
    visibleColumnKeys,
    updatedOnOrAfter,
    dispositionFilter,
  });

  const startBoardJobWork = useCallback(
    async (job: RoofingEstimate) => {
      const jobId = getDbJobIdFromBoardEntry(job);
      if (!jobId || r3gStartingJobId) return;
      setR3gStartingJobId(jobId);
      try {
        const response = await fetch("/api/jobs/start-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.ok !== true) {
          const code = String(result?.code ?? "internal_error");
          setToast(
            code === "disposition_blocks_start_work"
              ? "This Job must be Active before work can start."
              : code === "start_work_schedule_integrity_error"
                ? "Work cannot start because the active schedule is inconsistent."
                : "Work could not be started. Refresh and try again."
          );
        } else {
          setToast("Work started.");
        }
      } catch {
        setToast(
          "Could not confirm whether work started. Refreshing current Job status."
        );
      } finally {
        if (companyId) refreshDbJobs();
        setR3gStartingJobId(null);
      }
    },
    [companyId, r3gStartingJobId, refreshDbJobs]
  );

  const completeBoardJobWork = useCallback(
    async (job: RoofingEstimate) => {
      const jobId = getDbJobIdFromBoardEntry(job);
      if (!jobId || r3hCompletingJobId) return;
      setR3hCompletingJobId(jobId);
      try {
        const response = await fetch("/api/jobs/complete-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.ok !== true) {
          const code = String(result?.code ?? "internal_error");
          setToast(
            code === "disposition_blocks_complete"
              ? "This Job must be Active before it can be completed."
              : code === "complete_work_schedule_integrity_error"
                ? "This Job cannot be completed because the planned schedule is inconsistent."
                : "This Job could not be completed. Refresh and try again."
          );
        } else {
          setToast("Work completed.");
        }
      } catch {
        setToast(
          "Could not confirm whether the Job was completed. Refreshing current Job status."
        );
      } finally {
        if (companyId) refreshDbJobs();
        setR3hCompletingJobId(null);
      }
    },
    [companyId, r3hCompletingJobId, refreshDbJobs]
  );

  const openBoardScheduleWorkspace = useCallback(
    (job: RoofingEstimate) => {
      const jobId = getDbJobIdFromBoardEntry(job);
      if (!jobId) return;
      setR3fScheduleError(null);
      setR3fScheduleModal({
        mode: "schedule",
        jobId,
        schedule: null,
        depositNotReceived: r3fDepositDueByJobId[jobId] === true,
      });
    },
    [r3fDepositDueByJobId]
  );

  const resolveBoardMovementFacts = useCallback(
    (job: RoofingEstimate) => {
      const jobId = getDbJobIdFromBoardEntry(job);
      const schedule = jobId ? r3fSchedulesByJobId[jobId] ?? null : null;
      const attention = jobId ? attentionByJobId[jobId] ?? null : null;
      const fromColumn = getBoardColumnKeyForJob(job);
      const fromStage: CanonicalJobStage =
        (job as { canonicalJobStage?: CanonicalJobStage }).canonicalJobStage ??
        mapBoardColumnKeyToCanonicalStage(fromColumn) ??
        "intake";
      const eligibility = resolveDbBoardJobActionEligibility(job, schedule, {
        approvalAcceptancePending: approvalPendingFromAttentionType(
          attention?.primaryType
        ),
      });
      return {
        jobId,
        fromStage,
        fromColumn,
        dispositionActive: isActiveJobDisposition(
          (job as { jobDisposition?: string | null }).jobDisposition
        ),
        canApproveJob: eligibility?.canApproveJob ?? false,
        hasActivePlannedSchedule: hasActivePlannedWorkSchedule(schedule),
        schedule,
      };
    },
    [attentionByJobId, r3fSchedulesByJobId]
  );

  const closeBoardMovementConfirm = useCallback(() => {
    if (boardMovementConfirmBusy) return;
    setBoardMovementConfirm(null);
    setBoardMovementConfirmError(null);
  }, [boardMovementConfirmBusy]);

  const beginApproveBoardJob = useCallback(
    async (job: RoofingEstimate) => {
      const facts = resolveBoardMovementFacts(job);
      if (!facts.jobId) return;
      if (!facts.canApproveJob) {
        setToast(BOARD_MOVEMENT_ACCEPTANCE_REQUIRED_COPY);
        return;
      }
      const detail = await fetchJobAttentionDetail(facts.jobId);
      const acceptanceItem =
        detail.ok ? findApproveJobAcceptanceItem(detail.items) : null;
      const acceptanceId = acceptanceItem?.acceptance?.acceptanceId;
      if (!acceptanceId) {
        setToast(BOARD_MOVEMENT_ACCEPTANCE_REQUIRED_COPY);
        return;
      }
      setBoardMovementConfirmError(null);
      setBoardMovementConfirm({
        kind: "approve_job",
        job,
        jobId: facts.jobId,
        acceptanceId,
      });
    },
    [resolveBoardMovementFacts]
  );

  const confirmBoardMovement = useCallback(async () => {
    const pending = boardMovementConfirm;
    if (!pending || boardMovementConfirmBusy) return;
    setBoardMovementConfirmBusy(true);
    setBoardMovementConfirmError(null);
    try {
      if (pending.kind === "approve_job") {
        if (!pending.acceptanceId) {
          setBoardMovementConfirmError(BOARD_MOVEMENT_ACCEPTANCE_REQUIRED_COPY);
          return;
        }
        setR3cApprovingJobId(pending.jobId);
        const response = await fetch("/api/jobs/confirm-acceptance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: pending.jobId,
            acceptanceId: pending.acceptanceId,
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.ok !== true) {
          setBoardMovementConfirmError(
            "This job could not be approved. Customer acceptance is required."
          );
          return;
        }
        notifyJobAttentionChanged({ jobId: pending.jobId });
        setToast("Job approved.");
        setBoardMovementConfirm(null);
      } else if (pending.kind === "start_work") {
        setBoardMovementConfirm(null);
        await startBoardJobWork(pending.job);
      } else if (pending.kind === "complete_job") {
        setBoardMovementConfirm(null);
        await completeBoardJobWork(pending.job);
      } else if (pending.kind === "unschedule") {
        const expectedRowVersion =
          r3fSchedulesByJobId[pending.jobId]?.row_version ?? null;
        const response = await fetch("/api/jobs/unschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: pending.jobId,
            expectedRowVersion,
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.ok !== true) {
          setBoardMovementConfirmError("This job could not be unscheduled.");
          return;
        }
        setToast("Job unscheduled.");
        setBoardMovementConfirm(null);
      }
      if (companyId) refreshDbJobs();
    } catch {
      setBoardMovementConfirmError("That action could not be completed. Try again.");
    } finally {
      setBoardMovementConfirmBusy(false);
      setR3cApprovingJobId(null);
    }
  }, [
    boardMovementConfirm,
    boardMovementConfirmBusy,
    companyId,
    completeBoardJobWork,
    r3fSchedulesByJobId,
    refreshDbJobs,
    startBoardJobWork,
  ]);

  const applyBoardDropIntent = useCallback(
    async (job: RoofingEstimate, intentKind: BoardMovementIntentKind) => {
      if (intentKind === "proposal_create") {
        const jobId = getDbJobIdFromBoardEntry(job);
        if (!jobId) return;
        router.push(buildBoardProposalCreateHref(jobId));
        return;
      }
      if (intentKind === "open_schedule_workspace") {
        openBoardScheduleWorkspace(job);
        return;
      }
      if (intentKind === "approve_job") {
        await beginApproveBoardJob(job);
        return;
      }
      const jobId = getDbJobIdFromBoardEntry(job);
      if (!jobId) return;
      setBoardMovementConfirmError(null);
      setBoardMovementConfirm({
        kind: intentKind,
        job,
        jobId,
      });
    },
    [beginApproveBoardJob, openBoardScheduleWorkspace, router]
  );

  const handleBoardDragStart = useCallback((job: RoofingEstimate) => {
    if (!isDbBoardJobEntry(job)) return;
    boardDragHoverRef.current = null;
    boardDragJobRef.current = job;
    setBoardDragHoverColumn(null);
    setBoardDragJob(job);
  }, []);

  const handleBoardDragMove = useCallback((clientX: number, clientY: number) => {
    const ghost = boardDragGhostRef.current;
    if (ghost) {
      ghost.style.transform = `translate(${clientX + 10}px, ${clientY + 10}px)`;
    }
    const next = hitTestBoardColumnKey(clientX, clientY);
    if (next !== boardDragHoverRef.current) {
      boardDragHoverRef.current = next;
      setBoardDragHoverColumn(next);
    }
  }, []);

  const resetBoardDrag = useCallback(() => {
    boardDragHoverRef.current = null;
    boardDragJobRef.current = null;
    setBoardDragJob(null);
    setBoardDragHoverColumn(null);
  }, []);

  const handleBoardDragEnd = useCallback(
    (clientX: number, clientY: number) => {
      const job = boardDragJobRef.current;
      const targetColumn =
        hitTestBoardColumnKey(clientX, clientY) ?? boardDragHoverRef.current;
      resetBoardDrag();
      if (!job) return;
      const facts = resolveBoardMovementFacts(job);
      const resolution = resolveBoardGuardedMovement({
        fromStage: facts.fromStage,
        toStage: mapBoardColumnKeyToCanonicalStage(targetColumn),
        dispositionActive: facts.dispositionActive,
        canApproveJob: facts.canApproveJob,
        hasActivePlannedSchedule: facts.hasActivePlannedSchedule,
      });
      if (!resolution.allowed) {
        if (resolution.message) setToast(resolution.message);
        return;
      }
      void applyBoardDropIntent(job, resolution.intent.kind);
    },
    [applyBoardDropIntent, resetBoardDrag, resolveBoardMovementFacts]
  );

  const focusCanonicalColumn = useCallback((columnKey: BoardColumnKey) => {
    setFocusedCanonicalColumn(columnKey);
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      document
        .getElementById(`jobs-board-column-${columnKey}`)
        ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }, []);

  const buildBoardCardModel = useCallback(
    (job: RoofingEstimate, columnKey: BoardColumnKey) => {
      const jobId = getDbJobIdFromBoardEntry(job);
      const schedule = jobId ? r3fSchedulesByJobId[jobId] ?? null : null;
      const attention = jobId ? attentionByJobId[jobId] ?? null : null;
      const canonicalActions = resolveDbBoardJobActionEligibility(job, schedule, {
        approvalAcceptancePending: approvalPendingFromAttentionType(
          attention?.primaryType
        ),
      });
      return {
        ...buildJobsBoardCardModel(job, batchStatuses, { columnKey }),
        sourceBadge: isLegacyBoardEstimateEntry(job) ? "Legacy" : null,
        dispositionLabel: visibleDispositionLabel(
          (job as { jobDisposition?: string | null }).jobDisposition
        ),
        attention,
        scheduleLabel: schedule
          ? columnKey === "in_progress" || columnKey === "paid"
            ? `Planned · ${formatScheduleBoardMeta(schedule)}`
            : formatScheduleBoardMeta(schedule)
          : null,
        productionStartedLabel:
          columnKey === "in_progress" || columnKey === "paid"
            ? formatProductionStartedAt(
                (job as { productionStartedAt?: string | null })
                  .productionStartedAt,
                schedule?.timezone ?? r3fTimezone
              )
            : null,
        completedAtLabel:
          columnKey === "paid"
            ? formatJobCompletedAt(
                (job as { completedAt?: string | null }).completedAt,
                schedule?.timezone ?? r3fTimezone
              )
            : null,
        showScheduleAction: canonicalActions?.canSchedule ?? false,
        showStartWorkAction: canonicalActions?.canStartWork ?? false,
        showCompleteJobAction: canonicalActions?.canCompleteJob ?? false,
        showApproveAction: canonicalActions?.canApproveJob ?? false,
        startWorkBusy: Boolean(jobId && r3gStartingJobId === jobId),
        completeJobBusy: Boolean(jobId && r3hCompletingJobId === jobId),
        approveBusy: Boolean(jobId && r3cApprovingJobId === jobId),
      };
    },
    [
      attentionByJobId,
      batchStatuses,
      r3fSchedulesByJobId,
      r3fTimezone,
      r3gStartingJobId,
      r3hCompletingJobId,
      r3cApprovingJobId,
    ]
  );

  const boardVisibleJobs = useMemo(
    () => filterJobsByVisibleStages(boardFilteredJobs, visibleColumnKeys),
    [boardFilteredJobs, visibleColumnKeys]
  );

  const boardListJobs = useMemo(
    () => {
      const sorted = sortJobsForBoardColumn(boardVisibleJobs, boardSortKey, batchStatuses);
      if (!focusedCanonicalColumn) return sorted;
      return sorted.filter((job) => getBoardColumnKeyForJob(job) === focusedCanonicalColumn);
    },
    [boardVisibleJobs, boardSortKey, batchStatuses, focusedCanonicalColumn]
  );

  const boardFilterZeroMatch =
    boardFilteredJobs.length === 0 &&
    (!!updatedOnOrAfter ||
      dispositionFilter !== BOARD_DEFAULT_DISPOSITION_FILTER ||
      (dbBoardSearchFiltered?.length ?? 0) < dbBoardEntries.length);

  const statusDrivenGroups = useMemo(() => {
    if (statusFilter !== "all") return [];

    const items = (dbBoardSearchFiltered || []).slice();

    const groups = [
      {
        key: "needs_scheduling",
        label: "Ready to Schedule",
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
        label: "Production",
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
  }, [dbBoardSearchFiltered, statusFilter]);

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

  const boardDragFacts = boardDragJob
    ? resolveBoardMovementFacts(boardDragJob)
    : null;

  return (
    <>
      {toast !== null && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
        >
          {/not available|required|Reactivate|could not|Could not/i.test(
            toast
          ) ? null : (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
              aria-hidden
            >
              ✓
            </span>
          )}
          <span className="text-sm font-medium text-slate-800">{toast}</span>
        </div>
      )}
      {boardDragJob ? (
        <div
          ref={boardDragGhostRef}
          className="pointer-events-none fixed left-0 top-0 z-[80] w-56 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-md"
          style={{ transform: "translate(-9999px, -9999px)" }}
          data-board-drag-ghost
        >
          {boardDragJob.customerName || "Job"}
        </div>
      ) : null}
      {boardMovementConfirm ? (
        <BoardMovementConfirmDialog
          title={
            boardMovementConfirm.kind === "approve_job"
              ? BOARD_APPROVE_CONFIRM_TITLE
              : boardMovementConfirm.kind === "start_work"
                ? BOARD_START_WORK_CONFIRM_TITLE
                : boardMovementConfirm.kind === "complete_job"
                  ? BOARD_COMPLETE_CONFIRM_TITLE
                  : BOARD_UNSCHEDULE_CONFIRM_TITLE
          }
          body={
            boardMovementConfirm.kind === "unschedule"
              ? BOARD_UNSCHEDULE_CONFIRM_BODY
              : null
          }
          confirmLabel={
            boardMovementConfirm.kind === "approve_job"
              ? "Approve"
              : boardMovementConfirm.kind === "start_work"
                ? "Start work"
                : boardMovementConfirm.kind === "complete_job"
                  ? "Complete job"
                  : "Unschedule"
          }
          busy={boardMovementConfirmBusy}
          error={boardMovementConfirmError}
          onConfirm={() => {
            void confirmBoardMovement();
          }}
          onCancel={closeBoardMovementConfirm}
        />
      ) : null}
      {flashBanner && (
        <div
          role="status"
          className="fixed top-16 left-1/2 z-40 -translate-x-1/2 max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800 shadow-md"
        >
          {flashBanner}
        </div>
      )}

      <FieldDiveAppShell activeNav="jobs">
          {boardReady && lastDbJobRecoveryHref ? (
            <div className="mx-auto mb-3 max-w-[1800px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Link
                href={lastDbJobRecoveryHref}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Reopen last Job Card
              </Link>
            </div>
          ) : null}
          <div
            className={statusFilter !== "all" ? "bg-slate-100" : ""}
            data-canonical-jobs-board={statusFilter === "all" ? "true" : "false"}
            data-legacy-estimate-lane={statusFilter !== "all" ? "true" : "false"}
            data-jobs-board-read-status={dbJobsStatus}
            data-focused-canonical-column={focusedCanonicalColumn ?? ""}
          >
            {statusFilter === "all" && !boardReady && !boardReadError && (
              <div className="py-12 text-center text-sm text-slate-500">Loading jobs…</div>
            )}
            {statusFilter === "all" && boardReadError && (
              <div className="w-full space-y-3">
                <JobsBoardErrorState onRetry={() => refreshDbJobs()} />
              </div>
            )}
            {statusFilter === "all" && boardReady && (
              <div
                className="w-full space-y-3"
                data-board-core-ready="true"
                data-board-secondary-setup-ready={
                  secondarySetupReady ? "true" : "false"
                }
              >
                <JobsBoardHeader
                  query={query}
                  onQueryChange={setQuery}
                  viewMode={boardViewMode}
                  onViewModeChange={setBoardViewMode}
                  sortKey={boardSortKey}
                  onSortKeyChange={setBoardSortKey}
                  visibleColumnKeys={visibleColumnKeys}
                  onVisibleColumnKeysChange={setVisibleColumnKeys}
                  updatedOnOrAfter={updatedOnOrAfter}
                  onUpdatedOnOrAfterChange={setUpdatedOnOrAfter}
                  dispositionFilter={dispositionFilter}
                  onDispositionFilterChange={setDispositionFilter}
                  filtersActive={boardFiltersActive}
                />

                <JobsBoardPipelineGuidance readiness={companySetupReadiness} />

                {dbJobsRefreshError ? (
                  <JobsBoardErrorState
                    refreshFailed
                    onRetry={() => refreshDbJobs()}
                  />
                ) : null}

                {companyJobSearch.active ? (
                  <JobsBoardSearchResults
                    query={query}
                    status={companyJobSearch.status}
                    results={companyJobSearch.results}
                    onOpen={(href) => {
                      setCurrentLoadedSavedId(null);
                      router.push(href);
                    }}
                  />
                ) : focusedCanonicalColumn ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span>
                      Focusing {getBoardColumnByKey(focusedCanonicalColumn).label} on the Jobs Board
                    </span>
                    <button
                      type="button"
                      className="font-semibold text-blue-700 hover:text-blue-800"
                      onClick={() => setFocusedCanonicalColumn(null)}
                      data-canonical-board-all-stages
                    >
                      All stages
                    </button>
                  </div>
                ) : null}

                {!companyJobSearch.active && !hasBoardJobs ? (
                  <JobsBoardEmptyState
                    setupIncomplete={companySetupReadiness.showBanner}
                    setupPrimaryHref={companySetupReadiness.primaryHref}
                    searchActive={boardFiltersActive}
                  />
                ) : !companyJobSearch.active ? (
                  <>
                {boardFilterZeroMatch ? (
                  <p className="rounded-md border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    No jobs match your search or filter.
                    {boardViewMode === "board" ? " Stages remain below." : null}
                  </p>
                ) : null}

                {boardViewMode === "list" ? (
                  <JobsBoardListView
                    jobs={boardListJobs}
                    buildCardModel={buildBoardCardModel}
                    onOpenJob={(job) => handleAction(job, "load")}
                    onStartWork={canonicalLifecycleActionsEnabled ? startBoardJobWork : undefined}
                    onCompleteJob={canonicalLifecycleActionsEnabled ? completeBoardJobWork : undefined}
                    onScheduleJob={
                      canonicalLifecycleActionsEnabled
                        ? openBoardScheduleWorkspace
                        : undefined
                    }
                    onApproveJob={
                      canonicalLifecycleActionsEnabled
                        ? (job) => {
                            void beginApproveBoardJob(job);
                          }
                        : undefined
                    }
                  />
                ) : (
                  <div
                    className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white pb-2 shadow-sm [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60 [&::-webkit-scrollbar-track]:bg-transparent"
                    data-board-guarded-movement
                  >
                    <div className="inline-flex min-w-min items-stretch pr-2">
                      {JOBS_BOARD_CATEGORY_GROUPS.map((group) => {
                        const visibleKeysInGroup = group.columnKeys.filter((k) =>
                          visibleColumnKeys.includes(k) &&
                          (focusedCanonicalColumn == null || k === focusedCanonicalColumn)
                        );
                        if (visibleKeysInGroup.length === 0) return null;
                        return (
                          <div key={group.id} className="flex shrink-0">
                            {visibleKeysInGroup.map((columnKey, columnIndex) => {
                              const column = getBoardColumnByKey(columnKey);
                              const columnJobs = sortJobsForBoardColumn(
                                getJobsForBoardColumn(boardVisibleJobs, column.key),
                                boardSortKey,
                                batchStatuses
                              );
                              const columnTotalCents = sumJobsValueCents(columnJobs);
                              const showCategoryLabel = columnIndex === 0;
                              return (
                                <JobsBoardColumn
                                  key={column.key}
                                  column={column}
                                  jobs={columnJobs}
                                  buildCardModel={(job) => buildBoardCardModel(job, column.key)}
                                  onOpenJob={(job) => handleAction(job, "load")}
                                  onScheduleJob={
                                    canonicalLifecycleActionsEnabled
                                      ? openBoardScheduleWorkspace
                                      : undefined
                                  }
                                  onStartWork={
                                    canonicalLifecycleActionsEnabled
                                      ? startBoardJobWork
                                      : undefined
                                  }
                                  onCompleteJob={
                                    canonicalLifecycleActionsEnabled
                                      ? completeBoardJobWork
                                      : undefined
                                  }
                                  onApproveJob={
                                    canonicalLifecycleActionsEnabled
                                      ? (job) => {
                                          void beginApproveBoardJob(job);
                                        }
                                      : undefined
                                  }
                                  dragEnabled={
                                    canonicalLifecycleActionsEnabled &&
                                    boardViewMode === "board"
                                  }
                                  draggingJobId={boardDragJob?.id ?? null}
                                  dropTargetState={
                                    boardDragFacts &&
                                    boardDragHoverColumn === column.key
                                      ? (() => {
                                          const validity = boardDropTargetValidity({
                                            fromStage: boardDragFacts.fromStage,
                                            toStage:
                                              mapBoardColumnKeyToCanonicalStage(
                                                column.key
                                              ),
                                            dispositionActive:
                                              boardDragFacts.dispositionActive,
                                            canApproveJob:
                                              boardDragFacts.canApproveJob,
                                            hasActivePlannedSchedule:
                                              boardDragFacts.hasActivePlannedSchedule,
                                          });
                                          return validity === "none"
                                            ? null
                                            : validity;
                                        })()
                                      : null
                                  }
                                  onBoardDragStart={handleBoardDragStart}
                                  onBoardDragMove={handleBoardDragMove}
                                  onBoardDragEnd={handleBoardDragEnd}
                                  onBoardDragCancel={resetBoardDrag}
                                  onFocusColumn={() => focusCanonicalColumn(column.key)}
                                  filterActive={boardFilterZeroMatch}
                                  columnFocused={focusedCanonicalColumn === column.key}
                                  columnTotalLabel={
                                    columnTotalCents > 0 ? formatCentsToCurrency(columnTotalCents) : null
                                  }
                                  categoryLabel={showCategoryLabel ? group.label : null}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                  </>
                ) : null}

                {!companyJobSearch.active && hasLegacyEstimates ? (
                  <JobsBoardLegacySection
                    count={legacyBoardEntries.length}
                    jobs={legacySearchFiltered}
                    buildCardModel={buildBoardCardModel}
                    getColumnKey={(job) => getBoardColumnKeyForJob(job) ?? "estimate"}
                    onOpenJob={(est) => handleAction(est, "load")}
                    searchEmpty={legacySearchFiltered.length === 0}
                  />
                ) : null}
              </div>
            )}

            {statusFilter !== "all" && (
              <div className="mx-auto max-w-[1800px] space-y-4">
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    ← Job Board
                  </button>
                  <span className="h-4 w-px bg-slate-200" aria-hidden />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search jobs…"
                    className="h-8 min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-300"
                  />
                </div>
        <div className="relative overflow-hidden rounded-[22px] border border-slate-300/40 bg-gradient-to-br from-[#061120]/82 via-[#071426]/72 to-[#06101d]/70 shadow-lg ring-1 ring-inset ring-white/[0.025] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_4%_8%,rgba(6,182,212,0.13),transparent_30%),radial-gradient(circle_at_86%_0%,rgba(59,130,246,0.10),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/22 to-transparent" aria-hidden />
          <div className="relative px-4 py-3.5 sm:px-5 lg:px-5 lg:py-3.5">
            {(() => {
              type LaneFilter = Exclude<typeof statusFilter, "all">;
              const pageTitle: Record<LaneFilter, string> = {
                estimate: "Intake",
                sent_pending: "Proposal",
                approved: "Approved",
                deposit_paid: "Ready to Schedule",
                scheduled: "Scheduled",
                in_progress: "Production",
                paid: "Complete",
              };
              const pageSubtitle: Record<LaneFilter, string> = {
                estimate: "Jobs in Intake — capture the job and create a proposal.",
                sent_pending: "Jobs in Proposal — draft, sent, or revision in progress.",
                approved: "Approved jobs ready for scheduling.",
                deposit_paid: "Retired lane — not a canonical job stage.",
                scheduled: "Planned work ready to start.",
                in_progress: "Jobs where work has started.",
                paid: "Operationally complete jobs. Payment is separate.",
              };
              return (
                <>
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-300/78">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                      Job Board lane
                    </div>
                    <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.035em] text-white sm:text-[32px]">
                      {pageTitle[statusFilter]}
                    </h1>
                    <p className="mt-1 max-w-xl text-sm leading-snug text-white/55">
                      {pageSubtitle[statusFilter]}
                    </p>
                    <p className="mt-2 max-w-xl text-xs leading-snug text-white/40">
                      Interim operational stage view — DB jobs open in Job Card. Proposal document lifecycle lists
                      belong to the future Proposals hub, not this board lane.
                    </p>
                  </div>

                  {statusFilter === "scheduled" && (
                    <div className="mt-3 text-xs text-white/45">
                      {scheduledView === "upcoming"
                        ? `${upcomingScheduledJobs.length} upcoming · ${jobsThisWeek.length} in the next 7 days`
                        : scheduledView === "past"
                          ? "Showing past dates in this lane"
                          : "All dates in this lane"}
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search jobs, customers, addresses…"
                      className="h-9 w-full rounded-xl border border-white/[0.07] bg-slate-950/[0.22] px-3.5 text-sm text-white/86 placeholder:text-white/34 outline-none transition focus:border-cyan-400/28 focus:bg-white/[0.05] lg:max-w-[420px]"
                    />

                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-end">
                      <span className="mr-1 text-[11px] font-medium text-white/42">Board stages:</span>
                      {[
                        ["all", "Overview"],
                        ["estimate", "New lead"],
                        ["sent_pending", "Sent"],
                        ["approved", "Signed"],
                        ["deposit_paid", "Ready to schedule"],
                        ["scheduled", "Scheduled"],
                        ["in_progress", "Production"],
                        ["paid", "Completed"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setStatusFilter(key as any)}
                          className={
                            "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 " +
                            (statusFilter === key
                              ? "border-cyan-300/24 bg-cyan-500/16 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.14)]"
                              : "border-white/[0.06] bg-white/[0.035] text-white/58 hover:border-white/[0.10] hover:bg-white/[0.06] hover:text-white/84")
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {statusFilter === "scheduled" && (
                    <div className="mt-2 flex flex-wrap gap-2 border-t border-white/[0.06] pt-2">
                      <div className="mr-1 self-center text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30">View</div>
                      {(["upcoming", "past", "all"] as const).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setScheduledView(key)}
                          className={
                            "rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-150 " +
                            (scheduledView === key
                              ? "bg-cyan-500/16 text-cyan-300"
                              : "bg-white/[0.04] text-white/58 hover:bg-white/[0.065] hover:text-white/84")
                          }
                        >
                          {key === "upcoming" ? "Upcoming" : key === "past" ? "Past" : "All"}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        {/* Job Board lane overview — filtered operational stages */}
        {hydrated && (
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                DB jobs in this lane
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-white">{filtered.length}</div>
            </div>
            {statusFilter === "scheduled" && (
              <>
                <div className="h-8 w-px bg-white/[0.08]" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/60">This week</div>
                  <div className="mt-0.5 text-sm font-semibold text-amber-100">{jobsThisWeek.length} jobs</div>
                </div>
              </>
            )}
            <div className="h-8 w-px bg-white/[0.08]" />
            <div className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/75">
              FieldDive reviewed
            </div>
          </div>
        )}

        {!hydrated && (
          <div className="py-8 text-center text-sm text-white/60">Loading jobs…</div>
        )}
        {hydrated && boardReady && !hasBoardJobs && (
          <div className="text-center text-sm text-white/60">No jobs found.</div>
        )}
        {hydrated &&
          boardReady &&
          hasBoardJobs &&
          statusFilter !== "scheduled" &&
          filtered.length === 0 && (
            <div className="text-center text-sm text-white/60">No jobs match this view.</div>
          )}
        {process.env.NODE_ENV === "development" &&
        !query.trim() &&
        filterBoardEntriesByLaneStatus(
          dbBoardEntries,
          statusFilter,
          laneScheduleOptions
        ).length > 0 &&
        filtered.filter(isDbBoardJobEntry).length === 0 ? (
          <p className="sr-only" data-board-db-lane-wiring>
            DB jobs match this lane filter but are missing from the unified lane list.
          </p>
        ) : null}

        {/* ── Legacy saved-estimate queue — secondary to primary Job Board (filtered lanes only) ── */}
        {hydrated && (() => {
          const lanes = [
            {
              key: "follow",
              label: "Follow-ups prepared",
              hint: "Sent proposals waiting on contractor follow-up.",
              count: sentDueJobs.length,
              icon: PhoneCall,
              accent: "from-rose-400/70 to-rose-500/0",
              chipBorder: "border-rose-400/25",
              chipBg: "bg-rose-500/[0.10]",
              chipText: "text-rose-100",
              tagText: "text-rose-200/85",
              ring: "ring-rose-400/15",
              hover: "hover:border-rose-300/35 hover:bg-rose-500/[0.16]",
              ctaLabel: "Review",
              empty: "FieldDive found nothing pending in this lane.",
              rows: sentDueJobs.slice(0, 3).map((est) => ({
                est,
                sub: !!getEffectiveViewedAt(est, batchStatuses) ? "Viewed by customer" : "Not yet opened",
              })),
            },
            {
              key: "deposit",
              label: "Deposit path ready",
              hint: "Approved jobs with a deposit path prepared.",
              count: approvedDueJobs.length,
              icon: CreditCard,
              accent: "from-sky-400/70 to-sky-500/0",
              chipBorder: "border-sky-400/25",
              chipBg: "bg-sky-500/[0.10]",
              chipText: "text-sky-100",
              tagText: "text-sky-200/85",
              ring: "ring-sky-400/15",
              hover: "hover:border-sky-300/35 hover:bg-sky-500/[0.16]",
              ctaLabel: "Review",
              empty: "FieldDive found nothing pending in this lane.",
              rows: approvedDueJobs.slice(0, 3).map((est) => ({
                est,
                sub: "Approved · needs contractor approval",
              })),
            },
            {
              key: "schedule",
              label: "Schedule confirmation ready",
              hint: "Deposit received — holding for your schedule confirmation.",
              count: depositReadyJobs.length,
              icon: CalendarCheck2,
              accent: "from-emerald-400/70 to-emerald-500/0",
              chipBorder: "border-emerald-400/25",
              chipBg: "bg-emerald-500/[0.10]",
              chipText: "text-emerald-100",
              tagText: "text-emerald-200/85",
              ring: "ring-emerald-400/15",
              hover: "hover:border-emerald-300/35 hover:bg-emerald-500/[0.16]",
              ctaLabel: "Confirm",
              empty: "FieldDive found nothing pending in this lane.",
              rows: depositReadyJobs.slice(0, 3).map((est) => ({
                est,
                sub: "Needs contractor approval",
              })),
            },
            {
              key: "production",
              label: "Production check",
              hint:
                statusFilter === "scheduled"
                  ? "Jobs in your 7-day production window."
                  : "Switch to Scheduled lane for this week's production view.",
              count: jobsThisWeek.length,
              icon: Factory,
              accent: "from-amber-400/70 to-amber-500/0",
              chipBorder: "border-amber-400/25",
              chipBg: "bg-amber-500/[0.10]",
              chipText: "text-amber-100",
              tagText: "text-amber-200/85",
              ring: "ring-amber-400/15",
              hover: "hover:border-amber-300/35 hover:bg-amber-500/[0.16]",
              ctaLabel: "Open",
              empty:
                statusFilter !== "scheduled"
                  ? "Switch to Scheduled lane to view production checks for this week."
                  : "FieldDive found nothing pending in this lane.",
              rows:
                statusFilter !== "scheduled"
                  ? []
                  : jobsThisWeek.slice(0, 3).map(({ est, key }) => {
                      const dateKey = normalizeDateKey(est?.scheduledStartDate) ?? key;
                      return { est, sub: formatDateKeyLocal(dateKey) };
                    }),
            },
          ];

          return (
            <section
              aria-label="Legacy saved-estimate queue"
              className="relative overflow-hidden rounded-[26px] border border-cyan-400/10 bg-[radial-gradient(ellipse_120%_90%_at_50%_-8%,rgba(18,40,72,0.52)_0%,rgba(7,16,30,0.96)_48%,rgba(4,9,18,1)_100%)] shadow-[0_28px_72px_-28px_rgba(0,0,0,0.48)] ring-1 ring-cyan-400/[0.07]"
            >
              <div className="pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full bg-cyan-500/[0.05] blur-[110px]" aria-hidden />
              <div className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-indigo-500/[0.06] blur-[110px]" aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" aria-hidden />

              <div className="relative flex flex-col gap-3 border-b border-white/[0.04] px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:pb-5 sm:pt-6">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/15 to-indigo-500/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400/70">
                      Legacy saved-estimate queue
                    </div>
                    <div className="mt-0.5 text-[15px] font-semibold text-white">
                      Follow-ups from prior saved estimates
                    </div>
                    <div className="mt-0.5 text-[11px] font-normal text-white/40">
                      Secondary to the Job Board — DB jobs above open in Job Card, not here.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200/85 sm:inline-flex">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden />
                    Live
                  </span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                    Legacy queue
                  </span>
                </div>
              </div>

              <div className="relative grid grid-cols-1 gap-6 p-4 sm:p-5 lg:p-6">
                {/* ── Prepared Work Queue (mock-accurate horizontal lanes) ── */}
                <div>
                  <div className="space-y-2.5">
                    {lanes.map((lane) => {
                      const Icon = lane.icon;
                      const hasRows = lane.rows.length > 0;

                      return (
                        <article
                          key={lane.key}
                          className={`group relative overflow-hidden rounded-2xl border border-white/[0.075] bg-gradient-to-r from-white/[0.04] via-white/[0.022] to-white/[0.012] shadow-[0_14px_34px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.045)] ring-1 ring-inset ${lane.ring} transition hover:border-white/[0.12]`}
                        >
                          <div className={`pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-gradient-to-b ${lane.accent}`} aria-hidden />
                          <div className="pointer-events-none absolute -left-20 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-white/[0.025] blur-3xl" aria-hidden />

                          <div className="relative grid grid-cols-1 gap-3 px-4 py-3.5 md:grid-cols-[300px_minmax(0,1fr)_28px] md:items-center lg:grid-cols-[315px_minmax(0,1fr)_28px]">
                            {/* Lane identity */}
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${lane.chipBorder} ${lane.chipBg} shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}>
                                <Icon className={`h-5 w-5 ${lane.tagText}`} aria-hidden />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                  <div className="truncate text-[12px] font-bold uppercase tracking-[0.095em] text-white/72">
                                    {lane.label}
                                  </div>
                                  <div className={`shrink-0 rounded-lg border ${lane.chipBorder} ${lane.chipBg} px-2.5 py-1 text-base font-bold leading-none tabular-nums ${lane.chipText}`}>
                                    {lane.count}
                                  </div>
                                </div>
                                <div className="mt-1 max-w-[245px] text-[11px] leading-snug text-white/42">
                                  {lane.hint}
                                </div>
                              </div>
                            </div>

                            {/* Vertical job list with name / status / action columns */}
                            <div className="min-w-0 md:border-l md:border-white/[0.055] md:pl-3.5 md:pr-3">
                              {hasRows ? (
                                <ul className="space-y-0.5">
                                  {lane.rows.map(({ est, sub }) => (
                                    <li
                                      key={est.id}
                                      className="grid grid-cols-[minmax(0,0.82fr)_minmax(175px,1.12fr)_76px] items-center gap-3 rounded-lg px-2.5 py-1.5 transition hover:bg-white/[0.032]"
                                    >
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${lane.chipBg} shadow-[0_0_8px_rgba(255,255,255,0.10)] ring-1 ring-inset ${lane.chipBorder}`} aria-hidden />
                                        <div className="truncate text-[12.5px] font-semibold text-white/92">
                                          {getEstimateDisplayName(est)}
                                        </div>
                                      </div>

                                      <div className="truncate text-[11px] text-white/50">
                                        {sub}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleAction(est as RoofingEstimate, "load")}
                                        className={`inline-flex w-[68px] shrink-0 items-center justify-center gap-1 rounded-lg border ${lane.chipBorder} ${lane.chipBg} px-2 py-1 text-[11px] font-semibold ${lane.chipText} shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition ${lane.hover}`}
                                      >
                                        {lane.ctaLabel}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white/82">
                                      {lane.key === "production" ? "No jobs in the 7-day production window." : "All clear in this lane."}
                                    </div>
                                    <div className="mt-0.5 text-[11px] leading-snug text-white/46">
                                      {lane.key === "production" ? "Great job keeping the schedule clean." : lane.empty}
                                    </div>
                                  </div>

                                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border ${lane.chipBorder} ${lane.chipBg} px-3 py-1.5 text-[11px] font-semibold ${lane.chipText}`}>
                                    {lane.key === "production" ? "View calendar" : "Clear"}
                                    <ArrowRight className="h-3 w-3 opacity-70" aria-hidden />
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="hidden h-full items-center justify-center text-white/18 transition group-hover:text-white/45 md:flex">
                              <ArrowRight className="h-4 w-4" aria-hidden />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

              </div>
            </section>
          );
        })()}

        <div className="space-y-5 lg:space-y-6">
          {/* Scheduled UX v2 enabled */}
          {hydrated && statusFilter === "scheduled" && (() => {
            const now = new Date();
            const withDates = estimateLaneFiltered
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
                onPaymentNoteChange={(id, note) => {
                  updateSavedEstimate(id, { paymentNote: note });
                  setEstimates(getNormalizedEstimates());
                }}
                onStatusChange={(id, status) => {
                  applyStatusTransition({
                    id,
                    nextStatus: status,
                    estimate: filtered.find((x) => x.id === id),
                    variant: "scheduledBoard",
                    paymentStates,
                    setEstimates,
                  });
                }}
                onSend={(est) => handleAction(est, "send")}
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

          {hydrated && statusFilter !== "scheduled" && (
            <div className="flex items-center gap-4 pb-1">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/30">
                  DB jobs in this lane
                </div>
                <div className="mt-0.5 text-sm font-semibold text-white/70">
                  {filtered.length} job{filtered.length !== 1 ? "s" : ""} · open in Job Card
                </div>
              </div>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
          )}
          {hydrated && statusFilter !== "scheduled" && filtered.map((e) => {
            const columnKey = getBoardColumnKeyForJob(e) ?? "estimate";
            return (
              <JobsBoardCard
                key={e.id}
                model={buildBoardCardModel(e, columnKey)}
                onOpen={() => handleAction(e, "load")}
                onScheduleJob={
                  columnKey === "approved"
                    ? () => {
                        const jobId = getDbJobIdFromBoardEntry(e);
                        if (!jobId) return;
                        setR3fScheduleError(null);
                        setR3fScheduleModal({
                          mode: "schedule",
                          jobId,
                          schedule: null,
                          depositNotReceived:
                            r3fDepositDueByJobId[jobId] === true,
                        });
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
              </div>
            )}
          </div>
      <ScheduleJobModal
        open={r3fScheduleModal != null}
        mode={r3fScheduleModal?.mode ?? "schedule"}
        timezone={companyTimezoneForScheduling(
          resolveCompanyTimezoneReadState({
            loadStatus: r3fTimezoneLoadStatus,
            savedTimezone: r3fTimezone,
          })
        )}
        timezoneLoadStatus={r3fTimezoneLoadStatus}
        schedule={r3fScheduleModal?.schedule ?? null}
        prefillStartsOn={r3fScheduleModal?.startsOn ?? null}
        prefillEndsOn={r3fScheduleModal?.endsOn ?? null}
        timezoneReturnPath="/tools/roofing/saved"
        timezoneReturnJobId={r3fScheduleModal?.jobId ?? null}
        depositNotReceived={
          r3fScheduleModal?.depositNotReceived === true
        }
        busy={r3fScheduleBusy}
        error={r3fScheduleError}
        onClose={() => {
          setR3fScheduleModal(null);
          setR3fScheduleError(null);
        }}
        onSubmitSchedule={(input) => {
          if (!r3fScheduleModal) return;
          setR3fScheduleBusy(true);
          setR3fScheduleError(null);
          const path =
            r3fScheduleModal.mode === "reschedule"
              ? "/api/jobs/reschedule"
              : "/api/jobs/schedule";
          void fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: r3fScheduleModal.jobId,
              ...input,
              expectedRowVersion:
                r3fScheduleModal.schedule?.row_version,
            }),
          })
            .then((res) => res.json())
            .then(async (json) => {
              setR3fScheduleBusy(false);
              if (!json?.ok) {
                if (json?.code === "company_timezone_required") {
                  setR3fTimezoneLoadStatus("ready");
                  setR3fTimezone(null);
                }
                if (json?.code === "schedule_stale") {
                  const currentRes = await fetch(
                    `/api/jobs/schedules?jobId=${encodeURIComponent(r3fScheduleModal.jobId)}`,
                    { cache: "no-store" }
                  );
                  const currentJson = await currentRes.json().catch(() => null);
                  const current = Array.isArray(currentJson?.schedules)
                    ? currentJson.schedules.find(
                        (row: JobSchedule) => row.status === "scheduled"
                      )
                    : null;
                  if (current) {
                    setR3fScheduleModal((previous) =>
                      previous
                        ? {
                            ...previous,
                            mode: "reschedule",
                            schedule: current,
                          }
                        : previous
                    );
                  }
                }
                setR3fScheduleError(
                  json?.code === "company_timezone_required"
                    ? "Set company timezone to schedule work."
                    : json?.code === "schedule_stale"
                      ? "This schedule changed in another session. Current schedule reloaded."
                    : "Could not schedule this job."
                );
                return;
              }
              setR3fScheduleModal(null);
              if (json.schedule?.job_id) {
                setR3fSchedulesByJobId((prev) => ({
                  ...prev,
                  [json.schedule.job_id]: json.schedule,
                }));
              }
              if (companyId) refreshDbJobs();
            })
            .catch(() => {
              setR3fScheduleBusy(false);
              setR3fScheduleError("Could not schedule this job.");
            });
        }}
        onConfirmUnschedule={() => undefined}
      />
      </FieldDiveAppShell>

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
                <option value="cash_app">Cash App</option>
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
                            {t.source === "stripe" ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                                Stripe
                              </span>
                            ) : t.source === "offline" ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                                Offline
                              </span>
                            ) : null}
                            {t.kind === "summary" ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                                Summary
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-xs text-white/60">
                            {t.kind === "summary"
                              ? (t.meta || "Summary")
                              : [formatDateTime(t.whenIso), t.meta].filter(Boolean).join(" • ")}
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
    </>
  );
}
