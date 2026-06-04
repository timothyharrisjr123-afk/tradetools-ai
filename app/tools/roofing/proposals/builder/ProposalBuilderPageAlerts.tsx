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
          <p className="font-medium">Read-only proposal preview</p>
          <p className="mt-1 text-xs leading-relaxed text-cyan-900/90">
            Read-only proposal preview. Pricing, PDF, send, signature, and payment come later.
            Resolved quantities and proposal totals are not shown in this stage.
          </p>
        </div>
      ) : null}
    </>
  );
}
