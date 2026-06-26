import ProposalPacket from "@/app/components/proposal-packet/ProposalPacket";
import type { ProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";

type PublicProposalPageProps = {
  document: ProposalPublicProposalDocumentViewModel;
};

export default function PublicProposalPage({ document }: PublicProposalPageProps) {
  return <ProposalPacket packet={document.packet} mode="public" />;
}
