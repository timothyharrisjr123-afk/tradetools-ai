import type { ProposalPublicProposalErrorViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import { PROPOSAL_PACKET_PAGE } from "@/app/components/proposal-packet/proposalPacketStyles";

type PublicProposalErrorPageProps = {
  error: ProposalPublicProposalErrorViewModel;
};

/**
 * Customer-facing Public access failure shell.
 * No contractor identity is invented — token may not resolve company context.
 */
export default function PublicProposalErrorPage({ error }: PublicProposalErrorPageProps) {
  return (
    <main className={PROPOSAL_PACKET_PAGE} data-public-access-state={error.code}>
      <div className="mx-auto flex min-h-[72vh] max-w-md flex-col justify-center px-1 py-10 sm:max-w-lg sm:py-12">
        <article
          className="rounded-[16px] border border-[#cfd9e6]/95 bg-white px-6 py-8 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_16px_40px_rgba(11,31,51,0.08)] sm:px-8 sm:py-9"
          aria-labelledby="public-proposal-access-title"
        >
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <span
              className="mb-4 flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#0b1f33]/12 bg-[linear-gradient(180deg,#f7fafc_0%,#eef3f8_100%)] text-[#0b1f33]"
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 3.75h7.5L19.5 9v11.25A1.5 1.5 0 0 1 18 21.75H7A1.5 1.5 0 0 1 5.5 20.25V5.25A1.5 1.5 0 0 1 7 3.75Z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 3.75V9h5" />
                <path strokeLinecap="round" d="M9 13h6M9 16.5h4.5" />
              </svg>
            </span>

            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
              Roofing proposal
            </p>
            <h1
              id="public-proposal-access-title"
              className="mt-2 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#0b1f33] sm:text-[1.45rem]"
            >
              {error.title}
            </h1>
            <p className="mt-3 max-w-[34rem] text-[14px] leading-relaxed text-[#475569]">
              {error.message}
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
