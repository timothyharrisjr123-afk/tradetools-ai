import type { RoofingEstimate } from "@/app/lib/estimateStore";
import type { JobAttentionSummary } from "@/app/lib/jobAttentionReadModel";

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
  if (Number.isFinite(area) && area > 0) return true;
  const measurementId = (est as { selected_measurement_id?: string | null }).selected_measurement_id;
  return Boolean(measurementId?.trim());
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

function daysSinceIso(iso: string | null): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

function daysInStage(anchorIso: string | null): number | null {
  return daysSinceIso(anchorIso);
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
      return "No Proposal";
    default:
      return "bg-slate-100/60 text-slate-500";
  }
}

export type JobsBoardOverviewMetricKind = "count" | "currency";

export type JobsBoardOverviewMetric = {
  id:
    | "active_jobs"
    | "proposal_drafts"
    | "reports_missing"
    | "recently_updated"
    | "stalled_30d"
    | "pipeline_value";
  label: string;
  value: number;
  kind?: JobsBoardOverviewMetricKind;
  /** Pre-formatted display for currency metrics. */
  displayValue?: string;
  /** When true, show even if value is 0. */
  alwaysShow?: boolean;
};

export type JobsBoardCommandSummary = {
  activeJobs: number;
  metrics: JobsBoardOverviewMetric[];
  /** Plain-language insight when count chips would be redundant. */
  insight: string | null;
};

/** Stage-specific empty-column guidance (visual only). */
export const BOARD_STAGE_EMPTY_HINTS: Partial<Record<BoardColumnKey, string>> = {
  estimate: "New leads start here when you create a job.",
  leads: "Jobs land here after a proposal is sent to the customer.",
  approved: "Signed proposals appear here while deposit or scheduling is pending.",
  deposit_paid: "Deposit-collected jobs ready for scheduling show here.",
  scheduled: "Scheduled install dates appear in this column.",
  in_progress: "Jobs currently in production appear here.",
  paid: "Completed jobs are archived in this stage.",
};

export type JobsBoardTaskDisplay = {
  /** True when linked_counts (or equivalent) provides task data. */
  available: boolean;
  label: string | null;
};

export function deriveJobsBoardTaskDisplay(est: RoofingEstimate): JobsBoardTaskDisplay {
  const counts = (
    est as {
      linked_counts?: {
        tasks?: number | null;
        blocking_tasks?: number | null;
      } | null;
    }
  ).linked_counts;

  const blocking = counts?.blocking_tasks;
  if (typeof blocking === "number" && Number.isFinite(blocking) && blocking > 0) {
    return {
      available: true,
      label: `${blocking} blocking task${blocking !== 1 ? "s" : ""}`,
    };
  }

  const taskCount = counts?.tasks;
  if (typeof taskCount === "number" && Number.isFinite(taskCount)) {
    if (taskCount === 0) return { available: true, label: "0 tasks" };
    return { available: true, label: `${taskCount} open task${taskCount !== 1 ? "s" : ""}` };
  }

  return { available: false, label: null };
}

export type CardHeadlineTone = "action" | "ready" | "neutral";

export function deriveJobsBoardHeadline(
  columnKey: BoardColumnKey,
  reportStatus: CardStatusBadge,
  proposalStatus: CardStatusBadge
): { headline: string; tone: CardHeadlineTone } {
  if (columnKey === "estimate") {
    if (reportStatus.tone === "report_missing") {
      return { headline: "Needs measurement", tone: "action" };
    }
    if (proposalStatus.tone === "proposal_draft") {
      return { headline: "Proposal draft", tone: "neutral" };
    }
    if (proposalStatus.tone === "proposal_none") {
      return { headline: "Proposal not started", tone: "action" };
    }
    if (reportStatus.tone === "report_ok") {
      return { headline: "Report complete", tone: "ready" };
    }
  }

  if (columnKey === "leads") {
    if (proposalStatus.tone === "proposal_sent") {
      return { headline: "Proposal sent", tone: "neutral" };
    }
    if (reportStatus.tone === "report_missing") {
      return { headline: "Needs measurement", tone: "action" };
    }
    return { headline: "Awaiting customer review", tone: "neutral" };
  }

  if (columnKey === "approved") return { headline: "Proposal signed", tone: "ready" };
  if (columnKey === "deposit_paid") return { headline: "Ready to schedule", tone: "neutral" };
  if (columnKey === "scheduled") return { headline: "Scheduled", tone: "neutral" };
  if (columnKey === "in_progress") return { headline: "In production", tone: "neutral" };
  if (columnKey === "paid") return { headline: "Completed", tone: "ready" };

  return { headline: getBoardColumnByKey(columnKey).label, tone: "neutral" };
}

function compactReportLabel(status: CardStatusBadge): string {
  return status.tone === "report_ok" ? "Report complete" : "Report missing";
}

function compactProposalLabel(status: CardStatusBadge): string {
  switch (status.tone) {
    case "proposal_draft":
      return "Proposal draft";
    case "proposal_none":
      return "No proposal";
    case "proposal_sent":
      return "Proposal sent";
    case "proposal_signed":
      return "Proposal signed";
    default:
      return status.label;
  }
}

export function buildJobsBoardStatusLine(
  columnKey: BoardColumnKey,
  reportStatus: CardStatusBadge,
  proposalStatus: CardStatusBadge,
  tasksDisplay: JobsBoardTaskDisplay
): string {
  const parts: string[] = [];

  if (columnKey === "estimate" || columnKey === "leads" || columnKey === "approved") {
    parts.push(compactReportLabel(reportStatus));
    parts.push(compactProposalLabel(proposalStatus));
  } else if (columnKey === "deposit_paid" || columnKey === "scheduled" || columnKey === "in_progress") {
    parts.push(getBoardColumnByKey(columnKey).label);
    if (proposalStatus.tone === "proposal_signed") parts.push("Proposal signed");
  } else if (columnKey === "paid") {
    parts.push("Completed");
  }

  if (tasksDisplay.available && tasksDisplay.label) {
    parts.push(tasksDisplay.label);
  }

  return parts.filter(Boolean).join(" · ");
}

export function cardHeadlineToneClass(tone: CardHeadlineTone): string {
  switch (tone) {
    case "action":
      return "text-amber-800/90";
    case "ready":
      return "text-emerald-700/90";
    default:
      return "text-slate-700";
  }
}

export function shouldEmphasizeCardValue(columnKey: BoardColumnKey, hasValue: boolean): boolean {
  if (!hasValue) return false;
  return (
    columnKey === "approved" ||
    columnKey === "deposit_paid" ||
    columnKey === "scheduled" ||
    columnKey === "in_progress" ||
    columnKey === "paid"
  );
}

function deriveNextStepLabel(
  reportStatus: CardStatusBadge,
  proposalStatus: CardStatusBadge
): string {
  if (reportStatus.tone === "report_missing") return "Add measurement";
  if (proposalStatus.tone === "proposal_none") return "Create proposal";
  if (proposalStatus.tone === "proposal_draft") return "Open proposal";
  if (proposalStatus.tone === "proposal_sent") return "Review proposal";
  if (proposalStatus.tone === "proposal_signed") return "Open job card";
  return "Open job card";
}

function deriveAssigneeLabel(est: RoofingEstimate): string | null {
  const assigned =
    (est as { assigned_to?: string | null }).assigned_to ??
    (est as { assignedTo?: string | null }).assignedTo;
  if (!assigned?.trim()) return "Unassigned";
  return "Assigned";
}

function deriveTasksLabel(est: RoofingEstimate): string {
  const counts = (
    est as {
      linked_counts?: {
        tasks?: number | null;
        completed_tasks?: number | null;
      } | null;
    }
  ).linked_counts;

  const open = counts?.tasks;
  const completed = counts?.completed_tasks;

  if (typeof open === "number" && typeof completed === "number" && Number.isFinite(open) && Number.isFinite(completed)) {
    const total = open + completed;
    return `${completed}/${total}`;
  }
  if (typeof open === "number" && Number.isFinite(open)) {
    return `0/${open}`;
  }
  return "0/0";
}

export type JobsBoardCardModel = {
  id: string;
  customerName: string;
  address: string;
  tasksLabel: string;
  reportStatus: CardStatusBadge;
  proposalStatus: CardStatusBadge;
  assigneeLabel: string | null;
  lastUpdatedDisplay: string | null;
  timeInStage: string | null;
  timeInStageTone: TimeInStageTone;
  /** Shown on legacy saved-estimate cards only. */
  sourceBadge?: string | null;
  /** Operational attention is separate from tasks, activity, and stage. */
  attention?: JobAttentionSummary | null;
};

export function buildJobsBoardCardModel(
  estimate: RoofingEstimate,
  batchStatuses: Record<string, { status: string; viewedAt?: string | null; approvedAt?: string | null }> | undefined,
  opts: { columnKey: BoardColumnKey }
): JobsBoardCardModel {
  void opts;
  const anchorIso = getStageAnchorIso(estimate, batchStatuses);
  const lastUpdatedIso = getLastUpdatedIso(estimate);
  const reportStatus = getReportStatusBadge(estimate);
  const proposalStatus = getProposalStatusBadge(estimate);

  return {
    id: estimate.id,
    customerName: getEstimateDisplayName(estimate),
    address: getBoardCardAddress(estimate),
    tasksLabel: deriveTasksLabel(estimate),
    reportStatus,
    proposalStatus,
    assigneeLabel: deriveAssigneeLabel(estimate),
    lastUpdatedDisplay: buildLastUpdatedDisplay(lastUpdatedIso),
    timeInStage: buildTimeInStageLabel(anchorIso),
    timeInStageTone: timeInStageTone(anchorIso),
  };
}

export type JobCardDisplayModel = {
  customerName: string;
  address: string;
  stageLabel: string;
  valueLabel: string | null;
  lastUpdatedDisplay: string | null;
  timeInStage: string | null;
  timeInStageTone: TimeInStageTone;
  reportLabel: string;
  proposalLabel: string;
  tasksLabel: string;
};

export function buildJobCardDisplayModel(
  estimate: RoofingEstimate | null | undefined,
  fallback?: {
    customerName?: string;
    address?: string;
    roofAreaSqFt?: number;
  }
): JobCardDisplayModel {
  if (estimate) {
    const columnKey = getBoardColumnKeyForJob(estimate) ?? "estimate";
    const board = buildJobsBoardCardModel(estimate, undefined, { columnKey });
    return {
      customerName: board.customerName,
      address: board.address || "—",
      stageLabel: getBoardStageLabelForJob(estimate),
      valueLabel: null,
      lastUpdatedDisplay: board.lastUpdatedDisplay,
      timeInStage: board.timeInStage,
      timeInStageTone: board.timeInStageTone,
      reportLabel: board.reportStatus.label,
      proposalLabel: board.proposalStatus.label,
      tasksLabel: `Tasks ${board.tasksLabel}`,
    };
  }

  const hasMeasurement = (fallback?.roofAreaSqFt ?? 0) > 0;
  const customerName = (fallback?.customerName || "").trim() || "New roofing job";
  const address = (fallback?.address || "").trim() || "—";

  return {
    customerName,
    address,
    stageLabel: "New Lead",
    valueLabel: null,
    lastUpdatedDisplay: null,
    timeInStage: null,
    timeInStageTone: "neutral",
    reportLabel: hasMeasurement ? "Report Complete" : "Report Missing",
    proposalLabel: "Proposal Draft",
    tasksLabel: "Tasks 0/0",
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
