import Link from "next/link";
import {
  formatProposalBuilderGateMessage,
  formatProposalBuilderGateTitle,
  type ProposalBuilderGate,
} from "@/app/lib/proposalBuilderReadiness";
import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";
import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import {
  BUILDER_BLOCKED_BANNER,
  builderGateLinkHref,
  builderGateLinkLabel,
} from "./proposalBuilderConstants";

type ProposalBuilderBlockedStateProps = {
  loading: boolean;
  primaryGate: ProposalBuilderGate | null;
  blockedGates: ProposalBuilderGate[];
  jobId: string | null;
  measurementHandoff: MeasurementProposalHandoff | null;
  catalogReadiness: CatalogReadinessSummary;
  templateReadiness: ProposalTemplateReadiness;
};

export default function ProposalBuilderBlockedState({
  loading,
  primaryGate,
  blockedGates,
  jobId,
  measurementHandoff,
  catalogReadiness,
  templateReadiness,
}: ProposalBuilderBlockedStateProps) {
  if (loading) {
    return (
      <div className={BUILDER_BLOCKED_BANNER} role="status" data-builder-blocked-state>
        <p className="text-[14px] text-slate-600">Checking Proposal Builder…</p>
      </div>
    );
  }

  const gate = primaryGate ?? blockedGates[0] ?? "missing_job";
  const isMissingJob = gate === "missing_job";
  const title = isMissingJob ? "Choose a job first" : formatProposalBuilderGateTitle(gate);
  const message = isMissingJob
    ? "Open a job before creating a proposal."
    : formatProposalBuilderGateMessage(gate, {
        measurementHandoff,
        catalogReadiness,
        templateReadiness,
      });
  const linkHref = builderGateLinkHref(gate, jobId);
  const linkLabel = isMissingJob ? "Open Jobs" : builderGateLinkLabel(gate);

  return (
    <div
      className={BUILDER_BLOCKED_BANNER}
      role="status"
      aria-labelledby="builder-blocked-heading"
      data-builder-blocked-state
      data-builder-blocked-gate={gate}
    >
      <h2
        id="builder-blocked-heading"
        className="text-[1.35rem] font-semibold tracking-tight text-slate-950"
      >
        {title}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{message}</p>
      {linkHref ? (
        <Link
          href={linkHref}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-md bg-slate-900 px-4 text-[13px] font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
