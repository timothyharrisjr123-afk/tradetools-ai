/**
 * Job Card Proposals tab — Block 2 document/action surface helpers.
 * Pure view-model + copy. No React, Supabase, or store writes.
 */

import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";

export const JOB_CARD_PROPOSALS_TAB_TITLE = "Proposals" as const;

export const JOB_CARD_PROPOSALS_TAB_SUBTITLE =
  "Create, review, and open proposals for this job." as const;

export const JOB_CARD_PROPOSALS_ADD_LABEL = "+ Proposal" as const;

export const JOB_CARD_PROPOSALS_CREATE_LABEL = "Create proposal" as const;

export const JOB_CARD_PROPOSALS_OPEN_LABEL = "Open" as const;

export const JOB_CARD_PROPOSALS_EMPTY_TITLE = "No proposals yet" as const;

export const JOB_CARD_PROPOSALS_EMPTY_BODY =
  "Create a proposal from this job’s completed measurement report." as const;

/** Job Card metadata strip — no visible contractor proposals. */
export const JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE =
  "Ready to create proposal" as const;

/** Activity rail — setup ready, no visible contractor proposal. */
export const JOB_CARD_PROPOSAL_ACTIVITY_READY_LABEL = "Ready for proposal" as const;

export const JOB_CARD_PROPOSAL_ACTIVITY_READY_NOTE =
  "Create a proposal from this job’s completed measurement report." as const;

/** Block 2 placeholder — Block 3 owns measurement → template → package modal. */
export const JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER =
  "Next: choose measurement, template, and package to continue to Builder." as const;

export const JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER_HINT =
  "Proposal setup opens here next: measurement → template → package." as const;

/** FieldDive blue primary — matches Builder/Preview action styling. */
export const JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-md border border-blue-300 bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400" as const;

export const JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS =
  "shrink-0 text-[12px] font-semibold text-slate-600 hover:text-slate-900" as const;

export type JobCardProposalRowView = {
  proposalId: string;
  title: string;
  metaLine: string;
  statusLabel: string;
  packageLabel: string | null;
  updatedLabel: string | null;
};

/** Compact list stamp — e.g. "Jul 20" (no time / internal ids). */
export function formatJobCardProposalUpdatedShort(
  updatedAt: string | null | undefined
): string | null {
  const raw = (updatedAt ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

export function formatJobCardProposalStatusLabel(
  status: string | null | undefined
): string {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "draft") return "Draft";
  if (s === "sent") return "Sent";
  if (s === "viewed") return "Viewed";
  if (s === "signed" || s === "accepted") return "Signed";
  if (s === "won") return "Won";
  if (s === "lost") return "Lost";
  if (!s) return "Draft";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Contractor-facing Job Card proposal status strip label.
 * Uses visible (non-fixture) proposals only — never hidden smoke drafts.
 */
export function formatJobCardContractorProposalStatusLabel(input: {
  visibleSummaries: readonly ProposalRecordStatusSummary[];
}): string {
  const visible = input.visibleSummaries;
  if (visible.length === 0) return JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE;
  const status = formatJobCardProposalStatusLabel(visible[0]?.status);
  if (status === "Draft") return "Proposal Draft";
  return `Proposal ${status}`;
}

/**
 * Contractor row title. Prefer persisted title; else template name + " Proposal".
 * Does not soften to "Saved proposal" (Block 2 — hide fixtures instead).
 */
export function formatJobCardProposalRowTitle(input: {
  title?: string | null;
  templateName?: string | null;
}): string {
  const title = (input.title ?? "").trim();
  if (title) return title;
  const templateName = (input.templateName ?? "").trim();
  if (templateName) {
    return /proposal$/i.test(templateName)
      ? templateName
      : `${templateName} Proposal`;
  }
  return "Proposal";
}

export function buildJobCardProposalRowMetaLine(input: {
  packageLabel?: string | null;
  statusLabel: string;
  updatedLabel?: string | null;
}): string {
  const parts: string[] = [];
  const pkg = (input.packageLabel ?? "").trim();
  if (pkg) {
    parts.push(/package$/i.test(pkg) ? pkg : `${pkg} package`);
  }
  parts.push(input.statusLabel);
  const updated = (input.updatedLabel ?? "").trim();
  if (updated) parts.push(`Updated ${updated}`);
  return parts.join(" · ");
}

export function buildJobCardProposalRowView(input: {
  summary: ProposalRecordStatusSummary;
  packageLabel?: string | null;
  templateName?: string | null;
}): JobCardProposalRowView {
  const statusLabel = formatJobCardProposalStatusLabel(input.summary.status);
  const updatedLabel = formatJobCardProposalUpdatedShort(input.summary.updated_at);
  const packageLabel = (input.packageLabel ?? "").trim() || null;
  return {
    proposalId: input.summary.id,
    title: formatJobCardProposalRowTitle({
      title: input.summary.title,
      templateName: input.templateName,
    }),
    statusLabel,
    packageLabel,
    updatedLabel,
    metaLine: buildJobCardProposalRowMetaLine({
      packageLabel,
      statusLabel,
      updatedLabel,
    }),
  };
}

export function buildJobCardProposalRowViews(input: {
  summaries: readonly ProposalRecordStatusSummary[];
  packageLabelsByProposalId?: Readonly<Record<string, string | null | undefined>>;
  templateNameByTemplateId?: Readonly<Record<string, string | null | undefined>>;
}): JobCardProposalRowView[] {
  return input.summaries.map((summary) =>
    buildJobCardProposalRowView({
      summary,
      packageLabel: input.packageLabelsByProposalId?.[summary.id] ?? null,
      templateName: input.templateNameByTemplateId?.[summary.template_id] ?? null,
    })
  );
}
