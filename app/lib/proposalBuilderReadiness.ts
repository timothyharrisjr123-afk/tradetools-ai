/**
 * Pure composite Proposal Builder readiness (job + measurement + catalog + templates).
 *
 * Read-only gates for the Builder shell — no proposals, pricing, React, or Supabase.
 */

import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";
import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { JobRecord } from "@/app/lib/jobTypes";
import { isUuidLike } from "@/app/lib/jobStore";
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
  const loading =
    (Boolean(jobIdParam) && !input.jobLoadComplete) ||
    (Boolean(jobIdParam) && input.job != null && !input.measurementLoadComplete) ||
    !input.catalogLoadComplete ||
    !input.templateLoadComplete;

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

  if (input.catalogLoadComplete && input.catalogReadiness.state !== "ready_for_templates") {
    blockedGates.push("catalog_not_ready");
  }

  if (input.templateLoadComplete && input.templateReadiness.status !== "ready_for_builder") {
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
      return "Open Proposal Builder from a Job Card with a saved job, or add ?job=<uuid> to the URL.";
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

export function buildProposalBuilderHref(jobId: string): string {
  return `/tools/roofing/proposals/builder?job=${encodeURIComponent(jobId)}`;
}

export function buildJobCardHref(jobId: string): string {
  return `/tools/roofing?entry=job-card&job=${encodeURIComponent(jobId)}`;
}
