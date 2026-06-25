import type { ProposalPublicProposalDocumentPageViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import {
  PUBLIC_PROPOSAL_BODY,
  PUBLIC_PROPOSAL_CARD,
  PUBLIC_PROPOSAL_CARD_INNER,
  PUBLIC_PROPOSAL_PAGE_TITLE,
} from "./publicProposalStyles";

type PublicProposalDocumentPagesProps = {
  pages: ProposalPublicProposalDocumentPageViewModel[];
};

function emptyStateForPageType(pageType: string): string {
  switch (pageType) {
    case "project_overview":
      return "Project overview content will appear here.";
    case "terms":
      return "Terms will appear here.";
    case "warranty":
      return "Warranty details will appear here.";
    case "custom_text":
      return "Additional information will appear here.";
    default:
      return "Content will appear here.";
  }
}

export default function PublicProposalDocumentPages({ pages }: PublicProposalDocumentPagesProps) {
  if (pages.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 sm:space-y-5" aria-label="Proposal document">
      {pages.map((page) => (
        <article key={page.id} className={PUBLIC_PROPOSAL_CARD}>
          <div className={`${PUBLIC_PROPOSAL_CARD_INNER} space-y-4`}>
            <h2 className={PUBLIC_PROPOSAL_PAGE_TITLE}>{page.title}</h2>

            {page.kind === "text" ? (
              page.isEmpty ? (
                <p className="text-sm text-slate-500">{emptyStateForPageType(page.pageType)}</p>
              ) : (
                <div className={PUBLIC_PROPOSAL_BODY}>{page.displayText}</div>
              )
            ) : null}

            {page.kind === "deferred" ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4">
                <p className="text-sm leading-relaxed text-slate-600">{page.message}</p>
              </div>
            ) : null}

            {page.kind === "placeholder" ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
                <p className="text-sm text-slate-500">{page.message}</p>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
