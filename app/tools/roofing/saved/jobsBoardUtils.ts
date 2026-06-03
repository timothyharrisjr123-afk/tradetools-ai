import type { RoofingEstimate } from "@/app/lib/estimateStore";

export type BoardColumnKey =
  | "estimate"
  | "leads"
  | "approved"
  | "deposit_paid"
  | "scheduled"
  | "in_progress"
  | "paid";

export type BoardQuickFilter = "all" | "today" | "waiting" | "ready" | "review";

export type BoardColumnDef = {
  key: BoardColumnKey;
  label: string;
  listFilter: "estimate" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid";
  columnClass: string;
  labelClass: string;
  countClass: string;
};

export const JOBS_BOARD_COLUMNS: BoardColumnDef[] = [
  {
    key: "estimate",
    label: "New / Draft",
    listFilter: "estimate",
    columnClass: "bg-slate-50 border-slate-200",
    labelClass: "text-slate-700",
    countClass: "text-slate-600",
  },
  {
    key: "leads",
    label: "Sent / Waiting",
    listFilter: "sent_pending",
    columnClass: "bg-rose-50/80 border-rose-100",
    labelClass: "text-rose-800",
    countClass: "text-rose-700",
  },
  {
    key: "approved",
    label: "Approved",
    listFilter: "approved",
    columnClass: "bg-violet-50/80 border-violet-100",
    labelClass: "text-violet-800",
    countClass: "text-violet-700",
  },
  {
    key: "deposit_paid",
    label: "Ready to Schedule",
    listFilter: "deposit_paid",
    columnClass: "bg-emerald-50/80 border-emerald-100",
    labelClass: "text-emerald-800",
    countClass: "text-emerald-700",
  },
  {
    key: "scheduled",
    label: "Scheduled",
    listFilter: "scheduled",
    columnClass: "bg-cyan-50/80 border-cyan-100",
    labelClass: "text-cyan-800",
    countClass: "text-cyan-700",
  },
  {
    key: "in_progress",
    label: "On Site",
    listFilter: "in_progress",
    columnClass: "bg-amber-50/80 border-amber-100",
    labelClass: "text-amber-900",
    countClass: "text-amber-800",
  },
  {
    key: "paid",
    label: "Completed",
    listFilter: "paid",
    columnClass: "bg-slate-100/90 border-slate-200",
    labelClass: "text-slate-700",
    countClass: "text-slate-600",
  },
];

export type BoardQuickFilterDef = {
  id: BoardQuickFilter;
  label: string;
  hint: string;
};

export const BOARD_QUICK_FILTERS: BoardQuickFilterDef[] = [
  { id: "all", label: "All jobs", hint: "Show every job on the board" },
  { id: "today", label: "Today", hint: "Scheduled today or crew on site" },
  { id: "waiting", label: "Waiting", hint: "Sent proposals awaiting customer" },
  { id: "ready", label: "Ready to schedule", hint: "Deposit paid or approved and ready" },
  { id: "review", label: "Needs review", hint: "Follow-ups or confirmations due" },
];

export type BoardFilterContext = {
  todayIds: Set<string>;
  waitingIds: Set<string>;
  readyIds: Set<string>;
  reviewIds: Set<string>;
};

export function normalizeStatusValue(input: unknown): string {
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

export function getStage(e: RoofingEstimate): string {
  if (e?.status) return e.status;
  if ((e as { isPaid?: boolean }).isPaid) return "paid";
  if ((e as { isScheduled?: boolean }).isScheduled) return "scheduled";
  if ((e as { isApproved?: boolean }).isApproved) return "approved";
  if (e?.sentAt || (e as { sentTo?: string }).sentTo || (e as { sentToEmail?: string }).sentToEmail) {
    return "sent_pending";
  }
  return "estimate";
}

export function getJobsForBoardColumn(jobs: RoofingEstimate[], columnKey: BoardColumnKey): RoofingEstimate[] {
  return jobs.filter((e) => {
    const raw = String(e.status || "").toLowerCase();
    const norm = normalizeStatusValue(e.status || "estimate");
    switch (columnKey) {
      case "estimate":
        return norm === "estimate";
      case "leads":
        return raw === "sent" || raw === "viewed" || norm === "sent" || norm === "pending";
      case "approved":
        return norm === "approved";
      case "deposit_paid":
        return norm === "deposit_paid";
      case "scheduled":
        return norm === "scheduled";
      case "in_progress":
        return norm === "in_progress";
      case "paid":
        return norm === "paid";
      default:
        return false;
    }
  });
}

export function applyBoardQuickFilter(
  jobs: RoofingEstimate[],
  filter: BoardQuickFilter,
  ctx: BoardFilterContext
): RoofingEstimate[] {
  if (filter === "all") return jobs;
  const idSet =
    filter === "today"
      ? ctx.todayIds
      : filter === "waiting"
        ? ctx.waitingIds
        : filter === "ready"
          ? ctx.readyIds
          : ctx.reviewIds;
  return jobs.filter((j) => j.id && idSet.has(j.id));
}

function firstValidIsoDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const ts = new Date(value).getTime();
    if (!Number.isNaN(ts)) return value;
  }
  return null;
}

export function getEffectiveSentAt(est: RoofingEstimate) {
  return firstValidIsoDate(est?.sentAt, (est as { sent_at?: string }).sent_at, (est as { sentDate?: string }).sentDate, est?.createdAt, (est as { created_at?: string }).created_at);
}

export function getEffectiveViewedAt(
  est: RoofingEstimate,
  batchStatuses?: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>
) {
  const remote =
    est?.approvalToken && batchStatuses ? batchStatuses[est.approvalToken] ?? null : null;
  const sentAt = getEffectiveSentAt(est);
  const rawViewedAt = firstValidIsoDate(
    (est as { viewedAt?: string }).viewedAt,
    (est as { lastViewedAt?: string }).lastViewedAt,
    remote?.viewedAt,
    (remote as { lastViewedAt?: string | null })?.lastViewedAt
  );
  if (!rawViewedAt) return null;
  if (!sentAt) return rawViewedAt;
  const viewedTs = new Date(rawViewedAt).getTime();
  const sentTs = new Date(sentAt).getTime();
  if (!Number.isNaN(viewedTs) && !Number.isNaN(sentTs) && viewedTs < sentTs) return null;
  return rawViewedAt;
}

function smartTimeAgoLabel(date?: string | null) {
  if (!date) return null;
  const ts = new Date(date).getTime();
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function getBoardCardAddress(estimate: RoofingEstimate): string {
  const fromAddress = (estimate.address || "").trim();
  if (fromAddress) return fromAddress;
  const base = ((estimate as { jobAddress?: string }).jobAddress || (estimate as { jobAddress1?: string }).jobAddress1 || "").trim();
  const locality = [
    (estimate as { city?: string }).city ?? (estimate as { jobCity?: string }).jobCity,
    (estimate as { state?: string }).state ?? (estimate as { jobState?: string }).jobState,
    (estimate as { zip?: string }).zip ?? (estimate as { jobZip?: string }).jobZip,
  ]
    .filter(Boolean)
    .join(", ");
  if (base && locality) return `${base}, ${locality}`;
  if (base) return base;
  if (locality) return locality;
  return "";
}

export function getEstimateDisplayName(est: RoofingEstimate) {
  return est?.customerName || (est as { name?: string }).name || (est as { customer?: string }).customer || "Unnamed customer";
}

export function toEstimateTotalCents(
  estimate: { totalContractPrice?: number; suggestedPrice?: number } | null | undefined
): number {
  const v = Number(estimate?.totalContractPrice ?? estimate?.suggestedPrice ?? 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v * 100);
}

export function formatCentsToCurrency(cents: number | undefined | null): string {
  const c = Number(cents);
  if (!Number.isFinite(c) || c < 0) return "$0.00";
  const dollars = (Math.round(c) / 100).toFixed(2);
  const [whole, dec] = dollars.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${dec}`;
}

export type StatusSignal = {
  label: string;
  tone: "neutral" | "warn" | "ok" | "pending";
};

export function getProposalStatusSignal(
  est: RoofingEstimate,
  batchStatuses?: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>
): StatusSignal {
  const norm = normalizeStatusValue(est.status || "estimate");
  const raw = String(est.status || "").toLowerCase();
  if (norm === "paid" || norm === "in_progress" || norm === "scheduled" || norm === "deposit_paid") {
    return { label: "Proposal approved", tone: "ok" };
  }
  if (norm === "approved") return { label: "Approved", tone: "ok" };
  if (raw === "sent" || raw === "viewed" || norm === "sent" || norm === "pending") {
    const viewedAt = getEffectiveViewedAt(est, batchStatuses);
    if (viewedAt) return { label: "Proposal viewed", tone: "pending" };
    return { label: "Proposal sent", tone: "pending" };
  }
  return { label: "No proposal sent", tone: "neutral" };
}

export function getMeasurementStatusSignal(est: RoofingEstimate): StatusSignal {
  const area = Number(est.area ?? (est as { roofAreaSqFt?: number }).roofAreaSqFt ?? 0);
  if (Number.isFinite(area) && area > 0) return { label: "Measured", tone: "ok" };
  return { label: "Not measured", tone: "neutral" };
}

export function getLastUpdatedLabel(est: RoofingEstimate): string | null {
  const iso = firstValidIsoDate(est.lastSavedAt, est.approvedAt, est.sentAt, est.createdAt);
  return smartTimeAgoLabel(iso);
}

export function buildStageAgeText(args: {
  status: string;
  isSent: boolean;
  viewedAt?: string | null;
  estimate: RoofingEstimate;
  showDepositPaid: boolean;
  showPaid: boolean;
}): string | null {
  const { status, isSent, viewedAt, estimate, showDepositPaid, showPaid } = args;
  const createdAt = estimate?.createdAt ?? (estimate as { created_at?: string }).created_at ?? null;
  const sentAt =
    estimate?.sentAt ??
    (estimate as { sent_at?: string }).sent_at ??
    (estimate as { sentDate?: string }).sentDate ??
    createdAt ??
    null;
  const approvedAt = estimate?.approvedAt ?? (estimate as { approved_at?: string }).approved_at ?? null;
  const depositPaidAt =
    (estimate as { depositPaidAt?: string }).depositPaidAt ??
    (estimate as { deposit_paid_at?: string }).deposit_paid_at ??
    (estimate as { paidAt?: string }).paidAt ??
    null;
  const scheduledAt =
    (estimate as { scheduledAt?: string }).scheduledAt ??
    (estimate as { scheduled_at?: string }).scheduled_at ??
    (estimate as { scheduledStartDate?: string }).scheduledStartDate ??
    null;
  const completedAt =
    (estimate as { completedAt?: string }).completedAt ??
    (estimate as { completed_at?: string }).completed_at ??
    (estimate as { paidAt?: string }).paidAt ??
    null;

  if (showPaid) {
    const best = firstValidIsoDate(completedAt, depositPaidAt, scheduledAt, approvedAt, sentAt, createdAt);
    const age = smartTimeAgoLabel(best);
    return age ? `Paid ${age}` : null;
  }
  if (status === "scheduled") {
    const age = smartTimeAgoLabel(firstValidIsoDate(scheduledAt, depositPaidAt, approvedAt, sentAt, createdAt));
    return age ? `Scheduled ${age}` : null;
  }
  if (showDepositPaid || status === "deposit_paid") {
    const age = smartTimeAgoLabel(firstValidIsoDate(depositPaidAt, approvedAt, sentAt, createdAt));
    return age ? `Deposit ${age}` : null;
  }
  if (status === "approved") {
    const age = smartTimeAgoLabel(firstValidIsoDate(approvedAt, viewedAt, sentAt, createdAt));
    return age ? `Approved ${age}` : null;
  }
  if (isSent && viewedAt) {
    const age = smartTimeAgoLabel(firstValidIsoDate(viewedAt, sentAt, createdAt));
    return age ? `Viewed ${age}` : null;
  }
  if (isSent) {
    const age = smartTimeAgoLabel(firstValidIsoDate(sentAt, createdAt));
    return age ? `Sent ${age}` : null;
  }
  const age = smartTimeAgoLabel(createdAt);
  return age ? `Draft ${age}` : null;
}

export function stageAgeTone(stageAge: string | null): "fresh" | "aging" | "stale" | "neutral" {
  if (!stageAge) return "neutral";
  const match = stageAge.match(/(\d+)d ago/);
  if (match) {
    const days = Number(match[1]);
    if (days >= 14) return "stale";
    if (days >= 7) return "aging";
    return "fresh";
  }
  if (stageAge.includes("h ago") || stageAge.includes("m ago") || stageAge.includes("just now")) return "fresh";
  return "neutral";
}

export type JobsBoardCardModel = {
  id: string;
  customerName: string;
  address: string;
  valueLabel: string | null;
  proposalSignal: StatusSignal;
  measurementSignal: StatusSignal;
  stageAge: string | null;
  stageAgeTone: "fresh" | "aging" | "stale" | "neutral";
  lastUpdated: string | null;
  blockers: string[];
  showStageLabel: boolean;
  stageLabel: string;
};

export function buildJobsBoardCardModel(
  estimate: RoofingEstimate,
  batchStatuses: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }> | undefined,
  opts: { showStageLabel: boolean; blockerLabels?: string[] }
): JobsBoardCardModel {
  const status = normalizeStatusValue(getStage(estimate));
  const raw = String(estimate.status || "").toLowerCase();
  const isSent = raw === "sent" || raw === "viewed" || status === "sent" || status === "pending";
  const viewedAt = getEffectiveViewedAt(estimate, batchStatuses);
  const showDepositPaid = status === "deposit_paid";
  const showPaid = status === "paid";
  const stageAge = buildStageAgeText({
    status,
    isSent,
    viewedAt,
    estimate,
    showDepositPaid,
    showPaid,
  });
  const totalCents = toEstimateTotalCents(estimate);
  const stageLabels: Record<string, string> = {
    estimate: "Draft",
    sent: "Sent",
    pending: "Sent",
    viewed: "Viewed",
    approved: "Approved",
    deposit_paid: "Ready",
    scheduled: "Scheduled",
    in_progress: "On site",
    paid: "Done",
  };

  return {
    id: estimate.id,
    customerName: getEstimateDisplayName(estimate),
    address: getBoardCardAddress(estimate),
    valueLabel: totalCents > 0 ? formatCentsToCurrency(totalCents) : null,
    proposalSignal: getProposalStatusSignal(estimate, batchStatuses),
    measurementSignal: getMeasurementStatusSignal(estimate),
    stageAge,
    stageAgeTone: stageAgeTone(stageAge),
    lastUpdated: getLastUpdatedLabel(estimate),
    blockers: opts.blockerLabels ?? [],
    showStageLabel: opts.showStageLabel,
    stageLabel: stageLabels[status] ?? status,
  };
}

export function signalToneClass(tone: StatusSignal["tone"]): string {
  switch (tone) {
    case "ok":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200/80";
    case "pending":
      return "bg-amber-50 text-amber-900 ring-amber-200/80";
    case "warn":
      return "bg-rose-50 text-rose-800 ring-rose-200/80";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200/80";
  }
}

export function stageAgeToneClass(tone: JobsBoardCardModel["stageAgeTone"]): string {
  switch (tone) {
    case "stale":
      return "text-rose-600";
    case "aging":
      return "text-amber-700";
    case "fresh":
      return "text-slate-500";
    default:
      return "text-slate-400";
  }
}
