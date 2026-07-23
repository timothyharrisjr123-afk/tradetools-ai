import { isUuidLike } from "@/app/lib/jobStore";
import type {
  JobAttentionDestinationKind,
  JobAttentionSeverity,
  JobAttentionStatus,
  JobAttentionType,
} from "@/app/lib/jobAttentionPersistence";

export const ACTIVE_JOB_ATTENTION_STATUSES = [
  "open",
  "acknowledged",
] as const satisfies readonly JobAttentionStatus[];

export const JOB_ATTENTION_MESSAGE_PREVIEW_MAX = 180;

export type JobAttentionDestination = {
  kind: JobAttentionDestinationKind;
  proposalId: string;
  proposalVersionId: string;
  requestId: string;
  tab: "proposals";
  anchor: "customer_request";
};

export type JobAttentionRequestContext = {
  requestId: string;
  intent: "request_package" | "ask_question" | "ask_about_package";
  requestStatus: "new" | "seen" | "dismissed";
  packageLabel: string | null;
  message: string | null;
  messagePreview: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

export type JobAttentionSafeItem = {
  id: string;
  jobId: string;
  proposalId: string | null;
  proposalVersionId: string | null;
  attentionType: JobAttentionType;
  sourceType: "proposal_customer_requests";
  sourceId: string;
  status: Extract<JobAttentionStatus, "open" | "acknowledged">;
  severity: JobAttentionSeverity;
  openedAt: string;
  acknowledgedAt: string | null;
  destination: JobAttentionDestination;
  request: JobAttentionRequestContext;
  personalReadAt: string | null;
  personalLastViewedAt: string | null;
};

export type JobAttentionPriorityItem = Pick<
  JobAttentionSafeItem,
  "id" | "jobId" | "attentionType" | "status" | "severity" | "openedAt"
>;

export type JobAttentionSummary = {
  jobId: string;
  activeCount: number;
  highestSeverity: JobAttentionSeverity;
  primaryAttentionId: string;
  primaryType: JobAttentionType;
  primaryStatus: Extract<JobAttentionStatus, "open" | "acknowledged">;
  label: string;
  accessibleLabel: string;
};

export type JobAttentionSummaryMap = Record<string, JobAttentionSummary>;

const SEVERITY_PRIORITY: Record<JobAttentionSeverity, number> = {
  critical: 0,
  high: 1,
  normal: 2,
};

const STATUS_PRIORITY: Record<Extract<JobAttentionStatus, "open" | "acknowledged">, number> = {
  open: 0,
  acknowledged: 1,
};

export function isActiveJobAttentionStatus(
  status: JobAttentionStatus
): status is Extract<JobAttentionStatus, "open" | "acknowledged"> {
  return status === "open" || status === "acknowledged";
}

export function normalizeAttentionMessage(
  value: string | null | undefined
): string | null {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function normalizeAttentionMessagePreview(
  value: string | null | undefined,
  maxLength = JOB_ATTENTION_MESSAGE_PREVIEW_MAX
): string | null {
  const normalized = normalizeAttentionMessage(value);
  if (!normalized) return null;
  const safeMax = Math.max(1, Math.floor(maxLength));
  if (normalized.length <= safeMax) return normalized;
  if (safeMax === 1) return "…";
  return `${normalized.slice(0, safeMax - 1).trimEnd()}…`;
}

export function compareJobAttentionPriority(
  a: Pick<JobAttentionSafeItem, "severity" | "status" | "openedAt" | "id">,
  b: Pick<JobAttentionSafeItem, "severity" | "status" | "openedAt" | "id">
): number {
  const severity = SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity];
  if (severity !== 0) return severity;
  const status = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
  if (status !== 0) return status;
  const opened = Date.parse(a.openedAt) - Date.parse(b.openedAt);
  if (opened !== 0) return opened;
  return a.id.localeCompare(b.id);
}

export function attentionTypeLabel(type: JobAttentionType): string {
  return type === "customer_question" ? "Customer question" : "Customer request";
}

export function attentionHeadline(item: JobAttentionSafeItem): string {
  if (item.attentionType === "customer_question") {
    return "Customer asked a question";
  }
  return `Customer requested ${item.request.packageLabel || "a package"}`;
}

export function summarizeActiveAttentionByJob(
  items: readonly JobAttentionPriorityItem[]
): JobAttentionSummaryMap {
  const grouped = new Map<string, JobAttentionPriorityItem[]>();
  for (const item of items) {
    if (!isActiveJobAttentionStatus(item.status)) continue;
    const group = grouped.get(item.jobId) ?? [];
    group.push(item);
    grouped.set(item.jobId, group);
  }

  const summaries: JobAttentionSummaryMap = {};
  for (const [jobId, group] of grouped) {
    const sorted = [...group].sort(compareJobAttentionPriority);
    const primary = sorted[0];
    if (!primary) continue;
    const baseLabel = attentionTypeLabel(primary.attentionType);
    const extra = sorted.length - 1;
    summaries[jobId] = {
      jobId,
      activeCount: sorted.length,
      highestSeverity: primary.severity,
      primaryAttentionId: primary.id,
      primaryType: primary.attentionType,
      primaryStatus: primary.status,
      label: extra > 0 ? `${baseLabel} +${extra}` : baseLabel,
      accessibleLabel: `${sorted.length} attention ${
        sorted.length === 1 ? "item" : "items"
      }. Highest priority: ${baseLabel.toLowerCase()}.`,
    };
  }
  return summaries;
}

export function selectActiveAttention(
  items: readonly JobAttentionSafeItem[],
  requestedAttentionId?: string | null
): JobAttentionSafeItem | null {
  const sorted = items
    .filter((item) => isActiveJobAttentionStatus(item.status))
    .sort(compareJobAttentionPriority);
  const requested = (requestedAttentionId ?? "").trim();
  if (requested && isUuidLike(requested)) {
    const match = sorted.find((item) => item.id === requested);
    if (match) return match;
  }
  return sorted[0] ?? null;
}

export function parseJobAttentionDestination(
  kind: unknown,
  value: unknown
): JobAttentionDestination | null {
  if (kind !== "job_card_proposals" || !value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const proposalId = String(record.proposal_id ?? "").trim();
  const proposalVersionId = String(record.proposal_version_id ?? "").trim();
  const requestId = String(record.request_id ?? "").trim();
  if (
    !isUuidLike(proposalId) ||
    !isUuidLike(proposalVersionId) ||
    !isUuidLike(requestId) ||
    record.tab !== "proposals" ||
    record.anchor !== "customer_request"
  ) {
    return null;
  }
  return {
    kind,
    proposalId,
    proposalVersionId,
    requestId,
    tab: "proposals",
    anchor: "customer_request",
  };
}

export function buildJobCardAttentionHref(
  jobId: string,
  attentionId: string
): string {
  const params = new URLSearchParams({
    entry: "job-card",
    job: jobId,
    attention: attentionId,
  });
  return `/tools/roofing?${params.toString()}`;
}

export function buildJobCardProposalAttentionHref(
  jobId: string,
  item: JobAttentionSafeItem
): string {
  const params = new URLSearchParams({
    entry: "job-card",
    job: jobId,
    tab: item.destination.tab,
    anchor: item.destination.anchor,
    request: item.destination.requestId,
    proposal: item.destination.proposalId,
  });
  return `/tools/roofing?${params.toString()}`;
}
