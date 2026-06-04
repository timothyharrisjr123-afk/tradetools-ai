import { BUILDER_SHELL_BANNER } from "./proposalBuilderConstants";

type ProposalBuilderPageAlertsProps = {
  loadError: string | null;
  shellReady: boolean;
};

export default function ProposalBuilderPageAlerts({
  loadError,
  shellReady,
}: ProposalBuilderPageAlertsProps) {
  return (
    <>
      {loadError ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}
      {shellReady ? (
        <div className={BUILDER_SHELL_BANNER} role="status">
          <p className="font-medium">Proposal Builder shell (3H-1)</p>
          <p className="mt-1 text-xs leading-relaxed text-cyan-900/90">
            This is a read-only setup preview — not a sendable customer proposal. Line items,
            quantities, pricing totals, PDF, send, sign, and payment controls arrive in later
            stages.
          </p>
        </div>
      ) : null}
    </>
  );
}
