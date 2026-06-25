import type { ProposalPublicFutureActionViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import {
  PUBLIC_PROPOSAL_CARD,
  PUBLIC_PROPOSAL_CARD_INNER,
  PUBLIC_PROPOSAL_DEFERRED_ACTION,
  PUBLIC_PROPOSAL_PAGE_TITLE,
} from "./publicProposalStyles";

type PublicProposalFutureActionsProps = {
  actions: ProposalPublicFutureActionViewModel[];
};

export default function PublicProposalFutureActions({ actions }: PublicProposalFutureActionsProps) {
  const visibleActions = actions.filter((action) => action.showInUi);
  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <section className={PUBLIC_PROPOSAL_CARD} aria-label="Proposal actions">
      <div className={`${PUBLIC_PROPOSAL_CARD_INNER} space-y-4`}>
        <div className="space-y-1">
          <h2 className={PUBLIC_PROPOSAL_PAGE_TITLE}>Next steps</h2>
          <p className="text-sm text-slate-500">
            These options will be enabled by your contractor in a future update.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {visibleActions.map((action) => (
            <div
              key={action.id}
              className={PUBLIC_PROPOSAL_DEFERRED_ACTION}
              aria-disabled="true"
              role="group"
              aria-label={action.label}
            >
              <span className="text-sm font-semibold text-slate-700">{action.label}</span>
              {action.description ? (
                <span className="text-xs leading-relaxed text-slate-500">{action.description}</span>
              ) : null}
              <span className="text-xs leading-relaxed text-slate-500">{action.disabledReason}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
