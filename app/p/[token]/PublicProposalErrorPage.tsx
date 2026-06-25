import type { ProposalPublicProposalErrorViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import PublicProposalHeader from "./PublicProposalHeader";
import {
  PUBLIC_PROPOSAL_CARD,
  PUBLIC_PROPOSAL_CARD_INNER,
  PUBLIC_PROPOSAL_PAGE,
} from "./publicProposalStyles";

type PublicProposalErrorPageProps = {
  error: ProposalPublicProposalErrorViewModel;
};

export default function PublicProposalErrorPage({ error }: PublicProposalErrorPageProps) {
  return (
    <main className={PUBLIC_PROPOSAL_PAGE}>
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center py-10">
        {error.header ? (
          <div className="mb-6">
            <PublicProposalHeader header={error.header} />
          </div>
        ) : null}

        <article className={PUBLIC_PROPOSAL_CARD}>
          <div className={`${PUBLIC_PROPOSAL_CARD_INNER} space-y-4 text-center sm:text-left`}>
            <h1 className="text-xl font-semibold text-slate-950">{error.title}</h1>
            <p className="text-sm leading-relaxed text-slate-600">{error.message}</p>
            <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
              Contact your contractor if you need a new proposal link.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
