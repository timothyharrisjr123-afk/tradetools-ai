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

/** Activity rail — at least one visible contractor proposal exists. */
export const JOB_CARD_PROPOSAL_ACTIVITY_CREATED_LABEL = "Proposal created" as const;

export const JOB_CARD_PROPOSAL_ACTIVITY_CREATED_NOTE =
  "Open Builder to review this proposal." as const;

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
  packageLabelsByProposalId?: Readonly<Record<string, string | null | undefined>>;
}): string {
  const visible = input.visibleSummaries;
  if (visible.length === 0) return JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE;

  const drafts = visible.filter(
    (row) => formatJobCardProposalStatusLabel(row.status) === "Draft"
  );
  if (drafts.length === 1 && visible.length === 1) {
    return "Draft proposal";
  }
  if (drafts.length > 1 || visible.length > 1) {
    const latest = pickLatestVisibleProposal(visible);
    const pkgRaw =
      (latest && input.packageLabelsByProposalId?.[latest.id])?.trim() || "";
    const pkg = pkgRaw.replace(/\s+package$/i, "").trim();
    if (pkg) return `Latest: ${pkg} draft`;
    const draftCount = drafts.length > 0 ? drafts.length : visible.length;
    return `${draftCount} Draft proposal${draftCount === 1 ? "" : "s"}`;
  }

  const status = formatJobCardProposalStatusLabel(visible[0]?.status);
  if (status === "Draft") return "Draft proposal";
  return `${status} proposal`;
}

function pickLatestVisibleProposal(
  rows: readonly ProposalRecordStatusSummary[]
): ProposalRecordStatusSummary | null {
  if (rows.length === 0) return null;
  let best = rows[0]!;
  let bestMs = Date.parse(best.updated_at ?? "") || 0;
  for (const row of rows.slice(1)) {
    const ms = Date.parse(row.updated_at ?? "") || 0;
    if (ms >= bestMs) {
      best = row;
      bestMs = ms;
    }
  }
  return best;
}

/** Activity note when a visible proposal exists — prefer package-named readiness. */
export function formatJobCardProposalCreatedActivityNote(
  packageLabel?: string | null
): string {
  const pkg = (packageLabel ?? "").trim().replace(/\s+package$/i, "").trim();
  if (pkg) return `${pkg} proposal ready to review`;
  return JOB_CARD_PROPOSAL_ACTIVITY_CREATED_NOTE;
}

/**
 * Contractor row title. Prefer persisted title; else template name.
 * Package is shown as a separate badge — never appended as link-like text.
 */
export function formatJobCardProposalRowTitle(input: {
  title?: string | null;
  templateName?: string | null;
  packageLabel?: string | null;
}): string {
  const pkg = (input.packageLabel ?? "").trim();
  const title = (input.title ?? "").trim();
  let base = title;
  if (!base) {
    const templateName = (input.templateName ?? "").trim();
    if (templateName) {
      base = templateName;
    } else {
      base = "Proposal";
    }
  }
  // Soften "… Proposal" when a package badge will distinguish the row.
  if (pkg && / proposal$/i.test(base)) {
    base = base.replace(/\s+proposal$/i, "").trim() || base;
  }
  // Strip legacy “ — Package” suffix if present in stored titles.
  if (pkg) {
    const pkgBare = pkg.replace(/\s+package$/i, "").trim();
    if (pkgBare) {
      base = base
        .replace(new RegExp(`\\s*—\\s*${escapeRegExp(pkgBare)}$`, "i"), "")
        .trim();
    }
  }
  return base || "Proposal";
}

export function formatJobCardProposalRowPackageBadge(
  packageLabel?: string | null
): string | null {
  const pkg = (packageLabel ?? "").trim().replace(/\s+package$/i, "").trim();
  return pkg || null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildJobCardProposalRowMetaLine(input: {
  packageLabel?: string | null;
  statusLabel: string;
  updatedLabel?: string | null;
  /** When true, package is shown as a badge — omit from meta. */
  packageAsBadge?: boolean;
}): string {
  const parts: string[] = [];
  const pkg = (input.packageLabel ?? "").trim();
  if (pkg && !input.packageAsBadge) {
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
  const title = formatJobCardProposalRowTitle({
    title: input.summary.title,
    templateName: input.templateName,
    packageLabel,
  });
  return {
    proposalId: input.summary.id,
    title,
    statusLabel,
    packageLabel: formatJobCardProposalRowPackageBadge(packageLabel),
    updatedLabel,
    metaLine: buildJobCardProposalRowMetaLine({
      packageLabel,
      statusLabel,
      updatedLabel,
      packageAsBadge: Boolean(packageLabel),
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
