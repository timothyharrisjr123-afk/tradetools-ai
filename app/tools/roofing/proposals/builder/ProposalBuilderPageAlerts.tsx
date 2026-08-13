import { BUILDER_STAGE } from "./proposalBuilderConstants";

type ProposalBuilderPageAlertsProps = {
  loadError: string | null;
};

/**
 * Load errors only. No setup-preview note, no readiness dashboard.
 */
export default function ProposalBuilderPageAlerts({
  loadError,
}: ProposalBuilderPageAlertsProps) {
  if (!loadError) return null;

  return (
    <div
      className={`${BUILDER_STAGE} rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800`}
      role="alert"
    >
      {loadError}
    </div>
  );
}
