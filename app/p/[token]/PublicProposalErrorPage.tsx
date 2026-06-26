import type { ProposalPublicProposalErrorViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import { PROPOSAL_PACKET_PAGE } from "@/app/components/proposal-packet/proposalPacketStyles";

type PublicProposalErrorPageProps = {
  error: ProposalPublicProposalErrorViewModel;
};

export default function PublicProposalErrorPage({ error }: PublicProposalErrorPageProps) {
  return (
    <main className={PROPOSAL_PACKET_PAGE}>
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center py-10">
        <article className="rounded-xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm">
          <div className="space-y-4 text-center sm:text-left">
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
