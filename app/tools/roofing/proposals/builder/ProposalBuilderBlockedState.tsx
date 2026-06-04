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
      <div className={BUILDER_BLOCKED_BANNER} role="status">
        <h2 className="text-sm font-semibold text-amber-950">Checking Proposal Builder readiness…</h2>
        <p className="mt-2 text-sm text-amber-900">
          Loading job context, measurement summary, catalog, and template setup.
        </p>
      </div>
    );
  }

  const gate = primaryGate ?? blockedGates[0] ?? "missing_job";
  const title = formatProposalBuilderGateTitle(gate);
  const message = formatProposalBuilderGateMessage(gate, {
    measurementHandoff,
    catalogReadiness,
    templateReadiness,
  });
  const linkHref = builderGateLinkHref(gate, jobId);
  const linkLabel = builderGateLinkLabel(gate);

  return (
    <div className={BUILDER_BLOCKED_BANNER} role="status" aria-labelledby="builder-blocked-heading">
      <h2 id="builder-blocked-heading" className="text-sm font-semibold text-amber-950">
        {title}
      </h2>
      <p className="mt-2 text-sm text-amber-900">{message}</p>
      {blockedGates.length > 1 ? (
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-amber-800">
          {blockedGates.map((blockedGate) => (
            <li key={blockedGate}>{formatProposalBuilderGateTitle(blockedGate)}</li>
          ))}
        </ul>
      ) : null}
      {linkHref ? (
        <Link
          href={linkHref}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          {linkLabel}
        </Link>
      ) : null}
      <p className="mt-4 text-xs text-amber-800">
        Proposal Builder opens only when measurement, catalog, and template setup are all ready. No
        proposal record is created from this blocked state.
      </p>
    </div>
  );
}
