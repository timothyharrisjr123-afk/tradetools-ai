import type { ProposalPublicProposalHeaderViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import PublicProposalCompanyMark from "./PublicProposalCompanyMark";
import {
  PUBLIC_PROPOSAL_CARD,
  PUBLIC_PROPOSAL_CARD_INNER,
  PUBLIC_PROPOSAL_STATUS_PILL,
} from "./publicProposalStyles";

type PublicProposalHeaderProps = {
  header: ProposalPublicProposalHeaderViewModel;
};

export default function PublicProposalHeader({ header }: PublicProposalHeaderProps) {
  const { company, statusLabel, identity } = header;

  return (
    <header className={`${PUBLIC_PROPOSAL_CARD} sticky top-0 z-10`}>
      <div className={`${PUBLIC_PROPOSAL_CARD_INNER} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex min-w-0 items-center gap-3">
          <PublicProposalCompanyMark company={company} size="sm" />
          <div className="min-w-0">
            {company.companyName ? (
              <p className="truncate text-sm font-semibold text-slate-950 sm:text-base">
                {company.companyName}
              </p>
            ) : null}
            {identity.hasAnyField ? (
              <p className="mt-0.5 truncate text-xs text-slate-600 sm:text-sm">
                {[identity.customerName, identity.propertyAddress].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {identity.proposalNumber ? (
            <span className="text-xs font-medium text-slate-500">#{identity.proposalNumber}</span>
          ) : null}
          <span className={PUBLIC_PROPOSAL_STATUS_PILL}>{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}
