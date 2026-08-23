/**
 * Job Card Proposals tab — Block 2 document/action surface helpers.
 * Pure view-model + copy. No React, Supabase, or store writes.
 *
 * V2F1: contractor lifecycle labels derive from pointers/timestamps,
 * not proposals.status.
 */

import {
  deriveContractorProposalLifecycle,
  type ContractorProposalLifecycle,
  type ContractorProposalLifecycleKind,
} from "@/app/lib/proposalContractorLifecycle";
import type { JobCardSentHistoryRowView } from "@/app/lib/proposalJobCardSentHistory";
import { formatJobCardSentAtLabel } from "@/app/lib/proposalJobCardSentHistory";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";

export const JOB_CARD_PROPOSALS_TAB_TITLE = "Proposals" as const;

export const JOB_CARD_PROPOSALS_TAB_SUBTITLE =
  "Create, review, and open proposals for this job." as const;

export const JOB_CARD_PROPOSALS_ADD_LABEL = "+ Proposal" as const;

export const JOB_CARD_PROPOSALS_CREATE_LABEL = "Create proposal" as const;

/** @deprecated V2F1 — sent proposals must not use a generic Open. */
export const JOB_CARD_PROPOSALS_OPEN_LABEL = "Open" as const;

export const JOB_CARD_PROPOSALS_EDIT_LABEL = "Edit proposal" as const;
export const JOB_CARD_PROPOSALS_PREVIEW_LABEL = "Preview" as const;
export const JOB_CARD_PROPOSALS_PREVIEW_REVISION_LABEL = "Preview revision" as const;
export const JOB_CARD_PROPOSALS_REVISE_LABEL = "Revise proposal" as const;
export const JOB_CARD_PROPOSALS_CONTINUE_REVISION_LABEL = "Continue revision" as const;
export const JOB_CARD_PROPOSALS_VIEW_SENT_LABEL = "View sent proposal" as const;
export const JOB_CARD_PROPOSALS_VIEW_LAST_SENT_LABEL = "View last sent" as const;
export const JOB_CARD_PROPOSALS_SENT_HISTORY_LABEL = "Sent history" as const;
export const JOB_CARD_PROPOSALS_CURRENT_SENT_MARKER = "Current" as const;
export const JOB_CARD_PROPOSALS_LAST_SENT_PREFIX = "Last sent" as const;
export const JOB_CARD_PROPOSALS_VIEW_SENT_UNAVAILABLE_REASON =
  "Sent proposal is not available." as const;

export const JOB_CARD_PROPOSALS_EMPTY_TITLE = "No proposals yet" as const;

export const JOB_CARD_PROPOSALS_EMPTY_BODY =
  "Create a proposal from this job’s completed measurement report." as const;

/** Job Card metadata strip — truly no proposal (no visible rows, no pointers). */
export const JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE =
  "Ready to create proposal" as const;

/**
 * Proposal exists via canonical job pointer/history, but contractor-visible
 * summaries are empty (filtered smoke, load gap, etc.). Must not claim
 * "Ready to create proposal".
 */
export const JOB_CARD_PROPOSAL_STATUS_EXISTS = "Proposal" as const;

/** True when jobs.active_proposal_id or jobs.latest_proposal_id is set. */
export function hasCanonicalJobProposalPointer(input: {
  activeProposalId?: string | null;
  latestProposalId?: string | null;
}): boolean {
  return Boolean(
    String(input.activeProposalId ?? "").trim() ||
      String(input.latestProposalId ?? "").trim()
  );
}

/** Board presence label — coarse existence only (acceptance depth is Job Card). */
export function formatBoardProposalPresenceLabel(
  hasProposal: boolean
): "Proposal" | "No Proposal" {
  return hasProposal ? "Proposal" : "No Proposal";
}

function canonicalProposalPointerIds(input: {
  activeProposalId?: string | null;
  latestProposalId?: string | null;
}): string[] {
  const ids: string[] = [];
  for (const raw of [input.activeProposalId, input.latestProposalId]) {
    const id = String(raw ?? "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

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

export const JOB_CARD_PROPOSALS_ROW_PRIMARY_BUTTON_CLASS =
  "shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400" as const;

export const JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS =
  "shrink-0 text-[12px] font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400" as const;

export type JobCardProposalActionId =
  | "edit_proposal"
  | "preview"
  | "preview_revision"
  | "revise_proposal"
  | "continue_revision"
  | "view_sent"
  | "view_last_sent";

export type JobCardProposalActionView = {
  id: JobCardProposalActionId;
  label: string;
  enabled: boolean;
  href?: string | null;
  unavailableReason?: string | null;
};

export type JobCardProposalRowView = {
  proposalId: string;
  title: string;
  metaLine: string;
  statusLabel: string;
  lifecycleKind: ContractorProposalLifecycleKind;
  packageLabel: string | null;
  updatedLabel: string | null;
  lastSentAtLabel: string | null;
  primaryAction: JobCardProposalActionView;
  secondaryActions: readonly JobCardProposalActionView[];
  sentHistory: readonly JobCardSentHistoryRowView[];
};

export type JobCardProposalSentFactsInput = {
  latestSentFrozenAt?: string | null;
  history?: readonly JobCardSentHistoryRowView[];
};

export type JobCardProposalHrefBuilders = {
  builderHref: (proposalId: string) => string;
  previewHref: (proposalId: string) => string;
  sentRecordHref?: (proposalId: string, versionId: string) => string;
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

function action(
  partial: JobCardProposalActionView
): JobCardProposalActionView {
  return {
    href: null,
    unavailableReason: null,
    ...partial,
  };
}

export function buildJobCardProposalActions(input: {
  kind: ContractorProposalLifecycleKind;
  editingAllowed: boolean;
  builderHref: string;
  previewHref: string;
  sentRecordHref?: string | null;
}): {
  primaryAction: JobCardProposalActionView;
  secondaryActions: JobCardProposalActionView[];
} {
  const sentHref = (input.sentRecordHref ?? "").trim() || null;
  const viewSent = action({
    id: "view_sent",
    label: JOB_CARD_PROPOSALS_VIEW_SENT_LABEL,
    enabled: Boolean(sentHref),
    href: sentHref,
    unavailableReason: sentHref
      ? null
      : JOB_CARD_PROPOSALS_VIEW_SENT_UNAVAILABLE_REASON,
  });
  const viewLastSent = action({
    id: "view_last_sent",
    label: JOB_CARD_PROPOSALS_VIEW_LAST_SENT_LABEL,
    enabled: Boolean(sentHref),
    href: sentHref,
    unavailableReason: sentHref
      ? null
      : JOB_CARD_PROPOSALS_VIEW_SENT_UNAVAILABLE_REASON,
  });

  if (!input.editingAllowed || input.kind === "signed") {
    return {
      primaryAction: viewSent,
      secondaryActions: [],
    };
  }

  if (input.kind === "draft") {
    return {
      primaryAction: action({
        id: "edit_proposal",
        label: JOB_CARD_PROPOSALS_EDIT_LABEL,
        enabled: true,
        href: input.builderHref,
      }),
      secondaryActions: [
        action({
          id: "preview",
          label: JOB_CARD_PROPOSALS_PREVIEW_LABEL,
          enabled: true,
          href: input.previewHref,
        }),
      ],
    };
  }

  if (input.kind === "revision_in_progress") {
    return {
      primaryAction: action({
        id: "continue_revision",
        label: JOB_CARD_PROPOSALS_CONTINUE_REVISION_LABEL,
        enabled: true,
        href: input.builderHref,
      }),
      secondaryActions: [
        action({
          id: "preview_revision",
          label: JOB_CARD_PROPOSALS_PREVIEW_REVISION_LABEL,
          enabled: true,
          href: input.previewHref,
        }),
        viewLastSent,
      ],
    };
  }

  return {
    primaryAction: viewSent,
    secondaryActions: [
      action({
        id: "revise_proposal",
        label: JOB_CARD_PROPOSALS_REVISE_LABEL,
        enabled: true,
        href: input.builderHref,
      }),
    ],
  };
}

/**
 * Shared contractor proposal-state label.
 * Signed/Accepted come from proposal_signatures / proposal_acceptances,
 * not proposals.signed_version_id. Signed is not a Job stage.
 *
 * Empty visible summaries alone do not mean "no proposal" — canonical
 * jobs.active_proposal_id / latest_proposal_id may still exist.
 * Do not invent Accepted/Sent from job stage.
 */
export function formatJobCardProposalCustomerStateLabel(input: {
  lifecycle: ContractorProposalLifecycle;
  customerAccepted?: boolean;
  customerSigned?: boolean;
}): string {
  const revising = input.lifecycle.kind === "revision_in_progress";
  if (input.customerSigned === true) {
    return revising ? "Signed · Revision in progress" : "Signed";
  }
  if (input.customerAccepted === true) {
    return revising ? "Accepted · Revision in progress" : "Accepted";
  }
  return input.lifecycle.statusLabel;
}

export function formatJobCardContractorProposalStatusLabel(input: {
  visibleSummaries: readonly ProposalRecordStatusSummary[];
  packageLabelsByProposalId?: Readonly<Record<string, string | null | undefined>>;
  sentFactsByProposalId?: Readonly<Record<string, JobCardProposalSentFactsInput | undefined>>;
  customerAccepted?: boolean;
  customerSigned?: boolean;
  acceptedProposalIds?: Readonly<Record<string, boolean | undefined>>;
  signedProposalIds?: Readonly<Record<string, boolean | undefined>>;
  /** Canonical jobs.active_proposal_id — presence truth when summaries empty. */
  activeProposalId?: string | null;
  /** Canonical jobs.latest_proposal_id — presence truth when summaries empty. */
  latestProposalId?: string | null;
}): string {
  const visible = input.visibleSummaries;
  if (visible.length === 0) {
    const pointerIds = canonicalProposalPointerIds({
      activeProposalId: input.activeProposalId,
      latestProposalId: input.latestProposalId,
    });
    if (pointerIds.length === 0) {
      return JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE;
    }
    const signedFromPointer = pointerIds.some(
      (id) => input.signedProposalIds?.[id] === true
    );
    const acceptedFromPointer = pointerIds.some(
      (id) => input.acceptedProposalIds?.[id] === true
    );
    if (
      signedFromPointer ||
      (input.signedProposalIds == null && input.customerSigned === true)
    ) {
      return "Signed";
    }
    if (
      acceptedFromPointer ||
      (input.acceptedProposalIds == null && input.customerAccepted === true)
    ) {
      return "Accepted";
    }
    return JOB_CARD_PROPOSAL_STATUS_EXISTS;
  }

  const derivedRows = visible.map((summary) => {
    const facts = input.sentFactsByProposalId?.[summary.id];
    const lifecycle = deriveContractorProposalLifecycle({
      latestSentVersionId: summary.latest_sent_version_id,
      signedVersionId: summary.signed_version_id,
      draftContentChangedAt: summary.draft_content_changed_at,
      latestSentFrozenAt: facts?.latestSentFrozenAt ?? null,
      headerStatus: summary.status,
    });
    const accepted =
      input.acceptedProposalIds?.[summary.id] === true ||
      (input.acceptedProposalIds == null && input.customerAccepted === true);
    const signed =
      input.signedProposalIds?.[summary.id] === true ||
      (input.signedProposalIds == null && input.customerSigned === true);
    return {
      summary,
      lifecycle,
      statusLabel: formatJobCardProposalCustomerStateLabel({
        lifecycle,
        customerAccepted: accepted,
        customerSigned: signed,
      }),
    };
  });

  if (derivedRows.length === 1) {
    const label = derivedRows[0]!.statusLabel;
    if (label === "Sent") return "Sent proposal";
    if (label === "Draft") return "Draft proposal";
    return label;
  }

  const latest = pickLatestVisibleProposal(visible);
  const latestDerived =
    derivedRows.find((row) => row.summary.id === latest?.id) ?? derivedRows[0]!;
  const pkgRaw =
    (latest && input.packageLabelsByProposalId?.[latest.id])?.trim() || "";
  const pkg = pkgRaw.replace(/\s+package$/i, "").trim();
  if (pkg) return `Latest: ${pkg} · ${latestDerived.statusLabel}`;
  return `Latest: ${latestDerived.statusLabel}`;
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
  lastSentAtLabel?: string | null;
  /** When true, package is shown as a badge — omit from meta. */
  packageAsBadge?: boolean;
}): string {
  const parts: string[] = [];
  const pkg = (input.packageLabel ?? "").trim();
  if (pkg && !input.packageAsBadge) {
    parts.push(/package$/i.test(pkg) ? pkg : `${pkg} package`);
  }
  parts.push(input.statusLabel);
  const lastSent = (input.lastSentAtLabel ?? "").trim();
  if (lastSent) {
    parts.push(`${JOB_CARD_PROPOSALS_LAST_SENT_PREFIX} ${lastSent}`);
  } else {
    const updated = (input.updatedLabel ?? "").trim();
    if (updated) parts.push(`Updated ${updated}`);
  }
  return parts.join(" · ");
}

export function buildJobCardProposalRowView(input: {
  summary: ProposalRecordStatusSummary;
  packageLabel?: string | null;
  templateName?: string | null;
  sentFacts?: JobCardProposalSentFactsInput | null;
  hrefs?: JobCardProposalHrefBuilders;
  customerAccepted?: boolean;
  customerSigned?: boolean;
}): JobCardProposalRowView {
  const packageLabel = (input.packageLabel ?? "").trim() || null;
  const title = formatJobCardProposalRowTitle({
    title: input.summary.title,
    templateName: input.templateName,
    packageLabel,
  });
  const lifecycle = deriveContractorProposalLifecycle({
    latestSentVersionId: input.summary.latest_sent_version_id,
    signedVersionId: input.summary.signed_version_id,
    draftContentChangedAt: input.summary.draft_content_changed_at,
    latestSentFrozenAt: input.sentFacts?.latestSentFrozenAt ?? null,
    headerStatus: input.summary.status,
  });
  const statusLabel = formatJobCardProposalCustomerStateLabel({
    lifecycle,
    customerAccepted: input.customerAccepted === true,
    customerSigned: input.customerSigned === true,
  });
  const lastSentAtLabel = formatJobCardSentAtLabel(input.sentFacts?.latestSentFrozenAt ?? null);
  const updatedLabel = formatJobCardProposalUpdatedShort(input.summary.updated_at);
  const builderHref = input.hrefs?.builderHref(input.summary.id) ?? null;
  const previewHref = input.hrefs?.previewHref(input.summary.id) ?? null;
  const recordVersionId =
    (input.summary.signed_version_id ?? "").trim() ||
    (input.summary.latest_sent_version_id ?? "").trim();
  const sentRecordHref =
    recordVersionId && input.hrefs?.sentRecordHref
      ? input.hrefs.sentRecordHref(input.summary.id, recordVersionId)
      : null;
  const actions = buildJobCardProposalActions({
    kind: lifecycle.kind,
    editingAllowed: lifecycle.editingAllowed,
    builderHref: builderHref ?? "",
    previewHref: previewHref ?? "",
    sentRecordHref,
  });
  const sentHistory = (input.sentFacts?.history ?? []).map((row) => ({
    ...row,
    href:
      row.versionId && input.hrefs?.sentRecordHref
        ? input.hrefs.sentRecordHref(input.summary.id, row.versionId)
        : row.href ?? null,
  }));

  return {
    proposalId: input.summary.id,
    title,
    statusLabel,
    lifecycleKind: lifecycle.kind,
    packageLabel: formatJobCardProposalRowPackageBadge(packageLabel),
    updatedLabel,
    lastSentAtLabel,
    primaryAction: actions.primaryAction,
    secondaryActions: actions.secondaryActions,
    sentHistory,
    metaLine: buildJobCardProposalRowMetaLine({
      packageLabel,
      statusLabel,
      updatedLabel,
      lastSentAtLabel,
      packageAsBadge: Boolean(packageLabel),
    }),
  };
}

export function buildJobCardProposalRowViews(input: {
  summaries: readonly ProposalRecordStatusSummary[];
  packageLabelsByProposalId?: Readonly<Record<string, string | null | undefined>>;
  templateNameByTemplateId?: Readonly<Record<string, string | null | undefined>>;
  sentFactsByProposalId?: Readonly<Record<string, JobCardProposalSentFactsInput | undefined>>;
  hrefs?: JobCardProposalHrefBuilders;
  acceptedProposalIds?: Readonly<Record<string, boolean | undefined>>;
  signedProposalIds?: Readonly<Record<string, boolean | undefined>>;
}): JobCardProposalRowView[] {
  return input.summaries.map((summary) =>
    buildJobCardProposalRowView({
      summary,
      packageLabel: input.packageLabelsByProposalId?.[summary.id] ?? null,
      templateName: input.templateNameByTemplateId?.[summary.template_id] ?? null,
      sentFacts: input.sentFactsByProposalId?.[summary.id] ?? null,
      hrefs: input.hrefs,
      customerAccepted: input.acceptedProposalIds?.[summary.id] === true,
      customerSigned: input.signedProposalIds?.[summary.id] === true,
    })
  );
}
