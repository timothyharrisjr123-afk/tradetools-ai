/**
 * Pure Job Board command summary metrics (Slice 1).
 * Uses existing card model signals only — no invented lifecycle counts.
 */

import type { RoofingEstimate } from "@/app/lib/estimateStore";
import {
  buildJobsBoardCardModel,
  formatCentsToCurrency,
  getBoardColumnKeyForJob,
  getLastUpdatedIso,
  getStageAnchorIso,
  sumJobsValueCents,
  type JobsBoardCommandSummary,
  type JobsBoardOverviewMetric,
} from "./jobsBoardUtils";

const RECENTLY_UPDATED_DAYS = 7;
const STALLED_STAGE_DAYS = 30;

function daysSinceIso(iso: string | null): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

function appendCountMetric(
  metrics: JobsBoardOverviewMetric[],
  metric: JobsBoardOverviewMetric,
  activeJobs: number
) {
  if (metric.alwaysShow || metric.value <= 0) {
    if (metric.alwaysShow) metrics.push(metric);
    return;
  }
  if (metric.value >= activeJobs) return;
  metrics.push(metric);
}

export function deriveJobsBoardOverviewMetrics(
  jobs: RoofingEstimate[],
  batchStatuses?: Record<
    string,
    { status: string; viewedAt?: string | null; approvedAt?: string | null }
  >
): JobsBoardCommandSummary {
  const activeJobs = jobs.length;
  let reportsMissing = 0;
  let proposalDrafts = 0;
  let recentlyUpdated = 0;
  let stalled30 = 0;

  for (const job of jobs) {
    const columnKey = getBoardColumnKeyForJob(job) ?? "estimate";
    const model = buildJobsBoardCardModel(job, batchStatuses, { columnKey });

    if (model.reportStatus?.tone === "report_missing") reportsMissing += 1;
    if (model.proposalStatus.tone === "proposal_draft") proposalDrafts += 1;

    const updatedDays = daysSinceIso(getLastUpdatedIso(job));
    if (updatedDays !== null && updatedDays <= RECENTLY_UPDATED_DAYS) recentlyUpdated += 1;

    const stageDays = daysSinceIso(getStageAnchorIso(job, batchStatuses));
    if (stageDays !== null && stageDays >= STALLED_STAGE_DAYS) stalled30 += 1;
  }

  const pipelineCents = sumJobsValueCents(jobs);
  const metrics: JobsBoardOverviewMetric[] = [
    { id: "active_jobs", label: "Active jobs", value: activeJobs, alwaysShow: true },
  ];

  appendCountMetric(metrics, { id: "reports_missing", label: "Reports missing", value: reportsMissing }, activeJobs);
  appendCountMetric(metrics, { id: "proposal_drafts", label: "Proposal drafts", value: proposalDrafts }, activeJobs);
  appendCountMetric(metrics, { id: "recently_updated", label: "Updated this week", value: recentlyUpdated }, activeJobs);
  appendCountMetric(metrics, { id: "stalled_30d", label: "Stalled 30+ days", value: stalled30 }, activeJobs);

  if (pipelineCents > 0) {
    metrics.push({
      id: "pipeline_value",
      label: "Open pipeline",
      value: pipelineCents,
      kind: "currency",
      displayValue: formatCentsToCurrency(pipelineCents),
    });
  }

  let insight: string | null = null;
  if (activeJobs > 0 && reportsMissing === activeJobs) {
    insight = `All ${activeJobs} active jobs need a measurement report before proposals can go out.`;
  } else if (reportsMissing > 0) {
    insight = `${reportsMissing} job${reportsMissing !== 1 ? "s" : ""} need${reportsMissing === 1 ? "s" : ""} a measurement report.`;
  } else if (stalled30 > 0 && stalled30 >= Math.max(3, Math.ceil(activeJobs * 0.25))) {
    insight = `${stalled30} job${stalled30 !== 1 ? "s" : ""} have been in the same stage for 30+ days.`;
  } else if (proposalDrafts > 0 && proposalDrafts === activeJobs) {
    insight = `${proposalDrafts} job${proposalDrafts !== 1 ? "s" : ""} have proposal drafts ready to open.`;
  }

  return { activeJobs, metrics, insight };
}

export type { JobsBoardCommandSummary, JobsBoardOverviewMetric };
