import ProposalPacket from "@/app/components/proposal-packet/ProposalPacket";
import type { ProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";

type PublicProposalPageProps = {
  document: ProposalPublicProposalDocumentViewModel;
  publicAccessToken: string;
};

export default function PublicProposalPage({
  document,
  publicAccessToken,
}: PublicProposalPageProps) {
  return (
    <ProposalPacket
      packet={document.packet}
      mode="public"
      publicAccessToken={publicAccessToken}
    />
  );
}
