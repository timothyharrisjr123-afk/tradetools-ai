/**
 * Pure composite Proposal Builder readiness (job + measurement + catalog + templates).
 *
 * Read-only gates for the Builder shell — no proposals, pricing, React, or Supabase.
 */

import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";
import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { JobRecord } from "@/app/lib/jobTypes";
import { isUuidLike } from "@/app/lib/uuid";
import { normalizeDbProposalHref } from "@/app/lib/productSpine";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import { formatProposalTemplateNextStepCopy } from "@/app/lib/proposalTemplateReadiness";
import { formatCatalogNextStepCopy } from "@/app/lib/catalogReadiness";
import { formatProposalReadinessLabel } from "@/app/lib/measurementProposalHandoff";

export type ProposalBuilderGate =
  | "missing_job"
  | "invalid_job"
  | "measurement_not_ready"
  | "catalog_not_ready"
  | "template_not_ready";

export type DeriveProposalBuilderReadinessInput = {
  jobIdParam: string | null | undefined;
  job: JobRecord | null;
  jobLoadComplete: boolean;
  measurementHandoff: MeasurementProposalHandoff | null;
  measurementLoadComplete: boolean;
  catalogReadiness: CatalogReadinessSummary;
  catalogLoadComplete: boolean;
  templateReadiness: ProposalTemplateReadiness;
  templateLoadComplete: boolean;
  /**
   * When a valid job-scoped draft graph is already loaded, company Catalog/Template
   * setup gates must not false-block the Builder shell. The draft is the source of
   * truth for that open session; setup-preview (no draft) still uses live gates.
   */
  hasValidPersistedDraft?: boolean;
};

export type ProposalBuilderReadiness = {
  ready: boolean;
  loading: boolean;
  blockedGates: ProposalBuilderGate[];
  primaryGate: ProposalBuilderGate | null;
};

const GATE_ORDER: ProposalBuilderGate[] = [
  "missing_job",
  "invalid_job",
  "measurement_not_ready",
  "catalog_not_ready",
  "template_not_ready",
];

function normalizeJobIdParam(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickPrimaryGate(gates: ProposalBuilderGate[]): ProposalBuilderGate | null {
  for (const gate of GATE_ORDER) {
    if (gates.includes(gate)) return gate;
  }
  return null;
}

export function deriveProposalBuilderReadiness(
  input: DeriveProposalBuilderReadinessInput
): ProposalBuilderReadiness {
  const jobIdParam = normalizeJobIdParam(input.jobIdParam);
  const hasValidPersistedDraft = input.hasValidPersistedDraft === true;

  // Missing job is known immediately — do not wait on catalog/template.
  // Draft sessions still need job + measurement context, but must not wait on
  // company template install readiness after a draft graph has already loaded.
  const loading = jobIdParam
    ? (!input.jobLoadComplete) ||
      (input.job != null && !input.measurementLoadComplete) ||
      !input.catalogLoadComplete ||
      (!hasValidPersistedDraft && !input.templateLoadComplete)
    : false;

  const blockedGates: ProposalBuilderGate[] = [];

  if (!jobIdParam) {
    blockedGates.push("missing_job");
  } else if (!isUuidLike(jobIdParam)) {
    blockedGates.push("invalid_job");
  } else if (input.jobLoadComplete && !input.job) {
    blockedGates.push("invalid_job");
  }

  if (
    jobIdParam &&
    isUuidLike(jobIdParam) &&
    input.jobLoadComplete &&
    input.job &&
    input.measurementLoadComplete
  ) {
    if (!input.measurementHandoff?.proposalReady) {
      blockedGates.push("measurement_not_ready");
    }
  }

  if (
    Boolean(jobIdParam) &&
    !hasValidPersistedDraft &&
    input.catalogLoadComplete &&
    input.catalogReadiness.state !== "ready_for_templates"
  ) {
    blockedGates.push("catalog_not_ready");
  }

  if (
    Boolean(jobIdParam) &&
    !hasValidPersistedDraft &&
    input.templateLoadComplete &&
    input.templateReadiness.status !== "ready_for_builder"
  ) {
    blockedGates.push("template_not_ready");
  }

  const primaryGate = pickPrimaryGate(blockedGates);
  const ready = !loading && blockedGates.length === 0;

  return {
    ready,
    loading,
    blockedGates,
    primaryGate,
  };
}

export function formatProposalBuilderGateTitle(gate: ProposalBuilderGate): string {
  switch (gate) {
    case "missing_job":
      return "Job required";
    case "invalid_job":
      return "Job not found";
    case "measurement_not_ready":
      return "Measurement not ready";
    case "catalog_not_ready":
      return "Catalog setup incomplete";
    case "template_not_ready":
      return "Proposal templates not ready";
    default:
      return "Proposal Builder unavailable";
  }
}

export function formatProposalBuilderGateMessage(
  gate: ProposalBuilderGate,
  context?: {
    measurementHandoff?: MeasurementProposalHandoff | null;
    catalogReadiness?: CatalogReadinessSummary;
    templateReadiness?: ProposalTemplateReadiness;
  }
): string {
  switch (gate) {
    case "missing_job":
      return "Open this Builder from a saved Job Card.";
    case "invalid_job":
      return "This job id is invalid or you do not have access to it. Return to the Job Board and open the job again.";
    case "measurement_not_ready": {
      const handoff = context?.measurementHandoff;
      if (!handoff) {
        return "Save a measurement on the Job Card before opening Proposal Builder.";
      }
      const label = formatProposalReadinessLabel(handoff.proposalReady, handoff.blockers);
      return `Measurement must be proposal-ready first (${label}). Complete and save measurements on the Job Card.`;
    }
    case "catalog_not_ready":
      return context?.catalogReadiness
        ? formatCatalogNextStepCopy(context.catalogReadiness)
        : "Finish company catalog setup before Proposal Builder can open.";
    case "template_not_ready":
      return context?.templateReadiness
        ? formatProposalTemplateNextStepCopy(context.templateReadiness)
        : "Install and price the starter proposal template before Proposal Builder can open.";
    default:
      return "Complete setup prerequisites before using Proposal Builder.";
  }
}

export function formatProposalBuilderDisabledButtonTitle(
  readiness: ProposalBuilderReadiness,
  context?: {
    measurementHandoff?: MeasurementProposalHandoff | null;
    catalogReadiness?: CatalogReadinessSummary;
    templateReadiness?: ProposalTemplateReadiness;
  }
): string {
  if (readiness.loading) {
    return "Checking Proposal Builder readiness…";
  }
  if (readiness.ready) {
    return "Open Proposal Builder (setup preview shell)";
  }
  if (readiness.primaryGate) {
    return formatProposalBuilderGateTitle(readiness.primaryGate);
  }
  if (readiness.blockedGates.length > 0) {
    return formatProposalBuilderGateTitle(readiness.blockedGates[0]!);
  }
  void context;
  return "Proposal Builder is not available yet.";
}

export function buildProposalBuilderHref(
  jobId: string,
  proposalId?: string | null
): string {
  const pid = proposalId == null ? "" : String(proposalId).trim();
  if (!pid || !isUuidLike(pid)) {
    return buildJobCardHref(jobId, { tab: "proposals" });
  }
  return `/tools/roofing/proposals/builder?job=${encodeURIComponent(jobId)}&proposal=${encodeURIComponent(pid)}`;
}

export function buildProposalPreviewHref(
  jobId: string,
  proposalId?: string | null
): string {
  const pid = proposalId == null ? "" : String(proposalId).trim();
  if (!pid || !isUuidLike(pid)) {
    return buildJobCardHref(jobId, { tab: "proposals" });
  }
  return `/tools/roofing/proposals/preview?job=${encodeURIComponent(jobId)}&proposal=${encodeURIComponent(pid)}`;
}

export { buildProposalPreviewSentHref } from "@/app/lib/proposalPreviewSentRecord";

export function buildJobCardHref(
  jobId: string,
  options?: { tab?: "overview" | "measurements" | "proposals" }
): string {
  const base = `/tools/roofing?entry=job-card&job=${encodeURIComponent(jobId)}`;
  if (options?.tab) {
    return `${base}&tab=${encodeURIComponent(options.tab)}`;
  }
  return base;
}

/**
 * Encoded Job Card URL used as setup-route return target.
 * DB-first: uses job= (never loadSaved=, never from=board).
 */
export function buildJobCardReturnTo(
  jobId: string,
  tab: "overview" | "measurements" | "proposals" = "proposals"
): string {
  return `/tools/roofing?entry=job-card&job=${encodeURIComponent(jobId)}&tab=${encodeURIComponent(tab)}`;
}

/**
 * Validate a returnTo param and return a safe internal href, or null.
 * Only allows internal absolute /tools/ paths — blocks external/protocol URLs.
 */
export function parseInternalReturnTo(
  returnTo: string | null | undefined
): string | null {
  if (returnTo == null) return null;
  let value = String(returnTo).trim();
  if (!value) return null;
  if (/%2f|%3a/i.test(value)) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  if (value.startsWith("//")) return null;
  if (!value.startsWith("/tools/")) return null;
  return normalizeDbProposalHref(value);
}

/**
 * Append return context (returnTo + job + tab) to a setup-route href
 * (Catalog / Templates / Pricing) so the user can return to the same Job Card.
 * Optional returnLabel is a short display name for “Return to {label} · Proposals”.
 */
export function buildSetupRouteHref(
  baseHref: string,
  jobId: string,
  options?: {
    tab?: "overview" | "measurements" | "proposals";
    returnLabel?: string | null;
  }
): string {
  const tab = options?.tab ?? "proposals";
  if (!jobId || !isUuidLike(jobId)) {
    return baseHref;
  }
  const returnTo = buildJobCardReturnTo(jobId, tab);
  const sep = baseHref.includes("?") ? "&" : "?";
  let href =
    `${baseHref}${sep}returnTo=${encodeURIComponent(returnTo)}` +
    `&job=${encodeURIComponent(jobId)}&tab=${encodeURIComponent(tab)}`;
  const label = (options?.returnLabel ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (label) {
    href += `&returnLabel=${encodeURIComponent(label)}`;
  }
  return href;
}

export function resolveJobCardProposalActivityLine(
  readiness: ProposalBuilderReadiness,
  context?: {
    measurementHandoff?: MeasurementProposalHandoff | null;
    catalogReadiness?: CatalogReadinessSummary;
    templateReadiness?: ProposalTemplateReadiness;
    proposalNotStartedSubtitle?: string;
    /**
     * True when the Job Card lists at least one contractor-visible proposal
     * (Block 1 isolation). Hidden smoke/internal drafts must not count.
     */
    hasVisibleContractorProposal?: boolean;
    /** Create-ready activity copy when setup is ready but no visible proposal. */
    readyForProposalLabel?: string;
    readyForProposalNote?: string;
    /** When a visible proposal exists — contractor event language (not module names). */
    createdProposalLabel?: string;
    createdProposalNote?: string;
  }
): { label: string; note: string } {
  if (readiness.loading) {
    return {
      label: "Checking proposal setup",
      note: "Verifying catalog, templates, and measurement readiness…",
    };
  }
  if (readiness.ready) {
    if (context?.hasVisibleContractorProposal === true) {
      return {
        label: context?.createdProposalLabel?.trim() || "Proposal created",
        note:
          context?.createdProposalNote?.trim() ||
          "Open Builder to review this proposal.",
      };
    }
    return {
      label: context?.readyForProposalLabel?.trim() || "Ready for proposal",
      note:
        context?.readyForProposalNote?.trim() ||
        "Create a proposal from this job’s completed measurement report.",
    };
  }
  if (
    readiness.primaryGate === "measurement_not_ready" &&
    context?.proposalNotStartedSubtitle
  ) {
    return {
      label: "Proposal not started",
      note: context.proposalNotStartedSubtitle,
    };
  }
  if (readiness.primaryGate) {
    return {
      label: "Proposal setup blocked",
      note: formatProposalBuilderGateMessage(readiness.primaryGate, {
        measurementHandoff: context?.measurementHandoff,
        catalogReadiness: context?.catalogReadiness,
        templateReadiness: context?.templateReadiness,
      }),
    };
  }
  return {
    label: "Proposal setup blocked",
    note: "Complete setup prerequisites before using Proposal Builder.",
  };
}
