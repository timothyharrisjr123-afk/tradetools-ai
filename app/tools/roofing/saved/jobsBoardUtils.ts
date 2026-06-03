import type { RoofingEstimate } from "@/app/lib/estimateStore";

export type BoardColumnKey =
  | "estimate"
  | "leads"
  | "approved"
  | "deposit_paid"
  | "scheduled"
  | "in_progress"
  | "paid";

export type BoardSortKey = "last_updated" | "created_date" | "job_value" | "time_in_stage";
export type BoardViewMode = "board" | "list";

export const BOARD_DEFAULT_SORT_KEY: BoardSortKey = "last_updated";
export const BOARD_DEFAULT_VIEW_MODE: BoardViewMode = "board";
export const JOBS_BOARD_VIEW_STATE_STORAGE_KEY = "fielddive.jobBoard.viewState";

export type BoardColumnDef = {
  key: BoardColumnKey;
  label: string;
  listFilter: "estimate" | "sent_pending" | "approved" | "deposit_paid" | "scheduled" | "in_progress" | "paid";
};

export const JOBS_BOARD_COLUMNS: BoardColumnDef[] = [
  { key: "estimate", label: "New Lead", listFilter: "estimate" },
  { key: "leads", label: "Proposal Sent", listFilter: "sent_pending" },
  { key: "approved", label: "Proposal Signed", listFilter: "approved" },
  { key: "deposit_paid", label: "Ready to Schedule", listFilter: "deposit_paid" },
  { key: "scheduled", label: "Scheduled", listFilter: "scheduled" },
  { key: "in_progress", label: "Production", listFilter: "in_progress" },
  { key: "paid", label: "Completed", listFilter: "paid" },
];

export type BoardCategoryGroup = {
  id: "incoming" | "qualified" | "won" | "completed";
  label: string;
  columnKeys: BoardColumnKey[];
};

/** Visual-only Roofr category bands — no status logic. */
export const JOBS_BOARD_CATEGORY_GROUPS: BoardCategoryGroup[] = [
  { id: "incoming", label: "New Incoming Leads", columnKeys: ["estimate"] },
  { id: "qualified", label: "Qualified Leads", columnKeys: ["leads", "approved"] },
  { id: "won", label: "Won Jobs", columnKeys: ["deposit_paid", "scheduled", "in_progress"] },
  { id: "completed", label: "Completed", columnKeys: ["paid"] },
];

export function getBoardColumnByKey(key: BoardColumnKey): BoardColumnDef {
  const column = JOBS_BOARD_COLUMNS.find((c) => c.key === key);
  if (!column) throw new Error(`Unknown board column: ${key}`);
  return column;
}

export type BoardSortOptionDef = {
  id: BoardSortKey;
  label: string;
};

export const BOARD_SORT_OPTIONS: BoardSortOptionDef[] = [
  { id: "last_updated", label: "Last updated" },
  { id: "created_date", label: "Created date" },
  { id: "job_value", label: "Address value" },
  { id: "time_in_stage", label: "Time in stage" },
];

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
  return jobs.filter((e) => getBoardColumnKeyForJob(e) === columnKey);
}

export function getBoardColumnKeyForJob(job: RoofingEstimate): BoardColumnKey | null {
  const raw = String(job.status || "").toLowerCase();
  const norm = normalizeStatusValue(job.status || "estimate");
  if (norm === "estimate") return "estimate";
  if (raw === "sent" || raw === "viewed" || norm === "sent" || norm === "pending") return "leads";
  if (norm === "approved") return "approved";
  if (norm === "deposit_paid") return "deposit_paid";
  if (norm === "scheduled") return "scheduled";
  if (norm === "in_progress") return "in_progress";
  if (norm === "paid") return "paid";
  return null;
}

export function getBoardStageLabelForJob(job: RoofingEstimate): string {
  const key = getBoardColumnKeyForJob(job);
  if (!key) return "Unknown";
  return getBoardColumnByKey(key).label;
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
  return firstValidIsoDate(
    est?.sentAt,
    (est as { sent_at?: string }).sent_at,
    (est as { sentDate?: string }).sentDate,
    est?.createdAt,
    (est as { created_at?: string }).created_at
  );
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
  const base = (
    (estimate as { jobAddress?: string }).jobAddress ||
    (estimate as { jobAddress1?: string }).jobAddress1 ||
    ""
  ).trim();
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
  return (
    est?.customerName ||
    (est as { name?: string }).name ||
    (est as { customer?: string }).customer ||
    "Unnamed customer"
  );
}

export function toEstimateTotalCents(
  estimate: { totalContractPrice?: number; suggestedPrice?: number } | null | undefined
): number {
  const v = Number(estimate?.totalContractPrice ?? estimate?.suggestedPrice ?? 0);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v * 100);
}

export function sumJobsValueCents(jobs: RoofingEstimate[]): number {
  return jobs.reduce((sum, job) => sum + toEstimateTotalCents(job), 0);
}

export function formatCentsToCurrency(cents: number | undefined | null): string {
  const c = Number(cents);
  if (!Number.isFinite(c) || c < 0) return "$0.00";
  const dollars = (Math.round(c) / 100).toFixed(2);
  const [whole, dec] = dollars.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${dec}`;
}

export type CardStatusBadgeTone =
  | "report_ok"
  | "report_missing"
  | "proposal_signed"
  | "proposal_sent"
  | "proposal_draft"
  | "proposal_none";

export type CardStatusBadge = {
  label: string;
  tone: CardStatusBadgeTone;
};

function isJobMeasured(est: RoofingEstimate): boolean {
  const area = Number(est.area ?? (est as { roofAreaSqFt?: number }).roofAreaSqFt ?? 0);
  return Number.isFinite(area) && area > 0;
}

function getReportStatusBadge(est: RoofingEstimate): CardStatusBadge {
  if (isJobMeasured(est)) {
    return { label: "Report Complete", tone: "report_ok" };
  }
  return { label: "Report Missing", tone: "report_missing" };
}

function getProposalStatusBadge(est: RoofingEstimate): CardStatusBadge {
  const norm = normalizeStatusValue(est.status || "estimate");
  const raw = String(est.status || "").toLowerCase();
  const isSent = raw === "sent" || raw === "viewed" || norm === "sent" || norm === "pending";

  if (
    norm === "approved" ||
    norm === "deposit_paid" ||
    norm === "scheduled" ||
    norm === "in_progress" ||
    norm === "paid"
  ) {
    return { label: "Proposal Signed", tone: "proposal_signed" };
  }
  if (isSent) {
    return { label: "Proposal Sent", tone: "proposal_sent" };
  }
  if (norm === "estimate") {
    return { label: "Proposal Draft", tone: "proposal_draft" };
  }
  return { label: "No Proposal", tone: "proposal_none" };
}

export function getLastUpdatedIso(est: RoofingEstimate): string | null {
  return firstValidIsoDate(est.lastSavedAt, est.approvedAt, est.sentAt, est.createdAt);
}

export function getLastUpdatedLabel(est: RoofingEstimate): string | null {
  return smartTimeAgoLabel(getLastUpdatedIso(est));
}

export function getCreatedIso(est: RoofingEstimate): string | null {
  return firstValidIsoDate(est.createdAt, (est as { created_at?: string }).created_at);
}

export function getStageAnchorIso(
  estimate: RoofingEstimate,
  batchStatuses?: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>
): string | null {
  const status = normalizeStatusValue(getStage(estimate));
  const raw = String(estimate.status || "").toLowerCase();
  const isSent = raw === "sent" || raw === "viewed" || status === "sent" || status === "pending";
  const viewedAt = getEffectiveViewedAt(estimate, batchStatuses);
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

  if (status === "paid") {
    return firstValidIsoDate(completedAt, depositPaidAt, scheduledAt, approvedAt, sentAt, createdAt);
  }
  if (status === "scheduled" || status === "in_progress") {
    return firstValidIsoDate(scheduledAt, depositPaidAt, approvedAt, sentAt, createdAt);
  }
  if (status === "deposit_paid") {
    return firstValidIsoDate(depositPaidAt, approvedAt, sentAt, createdAt);
  }
  if (status === "approved") {
    return firstValidIsoDate(approvedAt, viewedAt, sentAt, createdAt);
  }
  if (isSent && viewedAt) {
    return firstValidIsoDate(viewedAt, sentAt, createdAt);
  }
  if (isSent) {
    return firstValidIsoDate(sentAt, createdAt);
  }
  return firstValidIsoDate(createdAt);
}

function daysInStage(anchorIso: string | null): number | null {
  if (!anchorIso) return null;
  const ts = new Date(anchorIso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

export function buildTimeInStageLabel(anchorIso: string | null): string | null {
  const days = daysInStage(anchorIso);
  if (days === null) return null;
  if (days < 1) return "• New";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  return `${days}d in stage`;
}

export type TimeInStageTone = "fresh" | "normal" | "aged" | "very_aged" | "neutral";

export function timeInStageTone(anchorIso: string | null): TimeInStageTone {
  const days = daysInStage(anchorIso);
  if (days === null) return "neutral";
  if (days >= 90) return "very_aged";
  if (days >= 30) return "aged";
  if (days >= 3) return "normal";
  return "fresh";
}

export function timeInStageToneClass(tone: TimeInStageTone): string {
  switch (tone) {
    case "very_aged":
      return "text-rose-400/60";
    case "aged":
      return "text-amber-700/55";
    case "normal":
      return "text-slate-400";
    case "fresh":
      return "text-emerald-600/65";
    default:
      return "text-slate-400";
  }
}

export function buildLastUpdatedDisplay(iso: string | null): string | null {
  const ago = smartTimeAgoLabel(iso);
  if (!ago) return null;
  return `Updated ${ago}`;
}

export function statusMetaTextClass(tone: CardStatusBadgeTone): string {
  switch (tone) {
    case "report_ok":
      return "text-emerald-700/85";
    case "report_missing":
      return "text-slate-500";
    case "proposal_signed":
      return "text-emerald-700/85";
    case "proposal_sent":
      return "text-slate-600";
    case "proposal_draft":
      return "text-slate-500";
    case "proposal_none":
      return "text-slate-400";
    default:
      return "text-slate-500";
  }
}

export function statusBadgeClass(tone: CardStatusBadgeTone): string {
  switch (tone) {
    case "report_ok":
      return "bg-emerald-50/70 text-emerald-700/80";
    case "report_missing":
      return "bg-slate-100/60 text-slate-500";
    case "proposal_signed":
      return "bg-emerald-50/60 text-emerald-800/75";
    case "proposal_sent":
      return "bg-slate-100/80 text-slate-600";
    case "proposal_draft":
      return "bg-slate-100/60 text-slate-500";
    case "proposal_none":
      return "bg-slate-100/60 text-slate-500";
    default:
      return "bg-slate-100/60 text-slate-500";
  }
}

export type JobsBoardCardModel = {
  id: string;
  customerName: string;
  address: string;
  /** Structural placeholder — FieldDive has no task system yet. */
  tasksLabel: string;
  reportStatus: CardStatusBadge;
  proposalStatus: CardStatusBadge;
  /** Always null until real assignee data exists. */
  assigneeInitials: string | null;
  lastUpdatedDisplay: string | null;
  timeInStage: string | null;
  timeInStageTone: TimeInStageTone;
  valueLabel: string | null;
};

export function buildJobsBoardCardModel(
  estimate: RoofingEstimate,
  batchStatuses: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }> | undefined,
  opts: { columnKey: BoardColumnKey }
): JobsBoardCardModel {
  void opts;
  const anchorIso = getStageAnchorIso(estimate, batchStatuses);
  const totalCents = toEstimateTotalCents(estimate);
  const lastUpdatedIso = getLastUpdatedIso(estimate);

  return {
    id: estimate.id,
    customerName: getEstimateDisplayName(estimate),
    address: getBoardCardAddress(estimate),
    tasksLabel: "0/0",
    reportStatus: getReportStatusBadge(estimate),
    proposalStatus: getProposalStatusBadge(estimate),
    assigneeInitials: null,
    lastUpdatedDisplay: buildLastUpdatedDisplay(lastUpdatedIso),
    timeInStage: buildTimeInStageLabel(anchorIso),
    timeInStageTone: timeInStageTone(anchorIso),
    valueLabel: totalCents > 0 ? formatCentsToCurrency(totalCents) : null,
  };
}

export function applyBoardUpdatedDateFilter(
  jobs: RoofingEstimate[],
  updatedOnOrAfter: string | null
): RoofingEstimate[] {
  if (!updatedOnOrAfter) return jobs;
  const [y, m, d] = updatedOnOrAfter.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return jobs;
  const cutoff = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  return jobs.filter((job) => {
    const iso = getLastUpdatedIso(job);
    if (!iso) return false;
    const ts = new Date(iso).getTime();
    return !Number.isNaN(ts) && ts >= cutoff;
  });
}

export function sortJobsForBoardColumn(
  jobs: RoofingEstimate[],
  sortKey: BoardSortKey,
  batchStatuses?: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }>
): RoofingEstimate[] {
  const sorted = [...jobs];
  const ts = (iso: string | null, fallback = 0) => {
    if (!iso) return fallback;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? fallback : t;
  };

  sorted.sort((a, b) => {
    switch (sortKey) {
      case "last_updated": {
        return ts(getLastUpdatedIso(b)) - ts(getLastUpdatedIso(a));
      }
      case "created_date": {
        return ts(getCreatedIso(b)) - ts(getCreatedIso(a));
      }
      case "job_value": {
        const diff = toEstimateTotalCents(b) - toEstimateTotalCents(a);
        if (diff !== 0) return diff;
        return ts(getLastUpdatedIso(b)) - ts(getLastUpdatedIso(a));
      }
      case "time_in_stage": {
        const aTs = ts(getStageAnchorIso(a, batchStatuses), Number.MAX_SAFE_INTEGER);
        const bTs = ts(getStageAnchorIso(b, batchStatuses), Number.MAX_SAFE_INTEGER);
        return aTs - bTs;
      }
      default:
        return 0;
    }
  });

  return sorted;
}

export function filterJobsByVisibleStages(
  jobs: RoofingEstimate[],
  visibleColumnKeys: BoardColumnKey[]
): RoofingEstimate[] {
  return jobs.filter((job) => {
    const key = getBoardColumnKeyForJob(job);
    return key !== null && visibleColumnKeys.includes(key);
  });
}

export function getAllBoardColumnKeys(): BoardColumnKey[] {
  return JOBS_BOARD_COLUMNS.map((c) => c.key);
}

export function getDefaultVisibleColumnKeys(): BoardColumnKey[] {
  return getAllBoardColumnKeys();
}

export type BoardViewState = {
  sortKey: BoardSortKey;
  visibleColumnKeys: BoardColumnKey[];
  updatedOnOrAfter: string | null;
  viewMode: BoardViewMode;
};

export function loadBoardViewState(): BoardViewState {
  const fallback: BoardViewState = {
    sortKey: BOARD_DEFAULT_SORT_KEY,
    visibleColumnKeys: getDefaultVisibleColumnKeys(),
    updatedOnOrAfter: null,
    viewMode: BOARD_DEFAULT_VIEW_MODE,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(JOBS_BOARD_VIEW_STATE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BoardViewState>;
    const all = getAllBoardColumnKeys();
    const validKeys = Array.isArray(parsed.visibleColumnKeys)
      ? parsed.visibleColumnKeys.filter(
          (k): k is BoardColumnKey => typeof k === "string" && all.includes(k as BoardColumnKey)
        )
      : fallback.visibleColumnKeys;
    const sortKey = BOARD_SORT_OPTIONS.some((o) => o.id === parsed.sortKey)
      ? (parsed.sortKey as BoardSortKey)
      : fallback.sortKey;
    const updatedOnOrAfter =
      typeof parsed.updatedOnOrAfter === "string" && parsed.updatedOnOrAfter
        ? parsed.updatedOnOrAfter
        : null;
    const viewMode = parsed.viewMode === "list" ? "list" : "board";
    return {
      sortKey,
      visibleColumnKeys: validKeys.length > 0 ? validKeys : fallback.visibleColumnKeys,
      updatedOnOrAfter,
      viewMode,
    };
  } catch {
    return fallback;
  }
}

export function saveBoardViewState(state: BoardViewState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(JOBS_BOARD_VIEW_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function isBoardFiltersActive(args: {
  sortKey: BoardSortKey;
  visibleColumnKeys: BoardColumnKey[];
  updatedOnOrAfter: string | null;
}): boolean {
  const defaultVisible = getDefaultVisibleColumnKeys();
  const allStagesVisible =
    args.visibleColumnKeys.length === defaultVisible.length &&
    defaultVisible.every((k) => args.visibleColumnKeys.includes(k));
  return (
    args.sortKey !== BOARD_DEFAULT_SORT_KEY || !allStagesVisible || !!args.updatedOnOrAfter
  );
}
