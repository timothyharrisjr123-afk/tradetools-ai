import {
  BUILDER_STAGE,
} from "./proposalBuilderConstants";

type ProposalBuilderPageAlertsProps = {
  loadError: string | null;
  shellReady: boolean;
  /** R17B — saved draft path shows Customer Preview availability copy. */
  hasPersistedDraft?: boolean;
};

/**
 * Block 4B: no yellow first-viewport status banner for normal draft editing.
 * Load errors still surface. Quiet setup note only when there is no saved proposal.
 */
export default function ProposalBuilderPageAlerts({
  loadError,
  shellReady,
  hasPersistedDraft = false,
}: ProposalBuilderPageAlertsProps) {
  return (
    <>
      {loadError ? (
        <div
          className={`${BUILDER_STAGE} rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800`}
          role="alert"
        >
          {loadError}
        </div>
      ) : null}
      {shellReady && !hasPersistedDraft ? (
        <div className={BUILDER_STAGE}>
          <p
            className="text-[12px] leading-snug text-slate-500"
            role="status"
            data-builder-setup-quiet-note
          >
            Setup preview — save a proposal from the Job Card to edit a draft document.
          </p>
        </div>
      ) : null}
    </>
  );
}
