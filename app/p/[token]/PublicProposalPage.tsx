import type { ProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import PublicProposalCoverSection from "./PublicProposalCoverSection";
import PublicProposalDocumentPages from "./PublicProposalDocumentPages";
import PublicProposalEstimateSection from "./PublicProposalEstimateSection";
import PublicProposalFooter from "./PublicProposalFooter";
import PublicProposalFutureActions from "./PublicProposalFutureActions";
import PublicProposalHeader from "./PublicProposalHeader";
import { PUBLIC_PROPOSAL_PAGE, PUBLIC_PROPOSAL_STACK } from "./publicProposalStyles";

type PublicProposalPageProps = {
  document: ProposalPublicProposalDocumentViewModel;
};

export default function PublicProposalPage({ document }: PublicProposalPageProps) {
  return (
    <main className={PUBLIC_PROPOSAL_PAGE}>
      <div className={PUBLIC_PROPOSAL_STACK}>
        <PublicProposalHeader header={document.header} />

        <PublicProposalCoverSection
          cover={document.cover}
          brandPrimaryColor={document.header.company.brandPrimaryColor}
        />

        <PublicProposalDocumentPages pages={document.pages} />

        <PublicProposalEstimateSection estimate={document.estimate} />

        <PublicProposalFutureActions actions={document.futureActions} />

        <PublicProposalFooter footer={document.footer} />
      </div>
    </main>
  );
}
