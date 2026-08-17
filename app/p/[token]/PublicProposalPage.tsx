import ProposalPacket from "@/app/components/proposal-packet/ProposalPacket";
import type { ProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";

type PublicProposalPageProps = {
  document: ProposalPublicProposalDocumentViewModel;
  publicAccessToken: string;
  paymentReturnHint?: "pending" | "cancelled" | null;
};

export default function PublicProposalPage({
  document,
  publicAccessToken,
  paymentReturnHint = null,
}: PublicProposalPageProps) {
  const packet = paymentReturnHint
    ? {
        ...document.packet,
        payment: document.packet.payment
          ? {
              ...document.packet.payment,
              state:
                paymentReturnHint === "pending" &&
                document.packet.payment.state !== "received"
                  ? "pending"
                  : document.packet.payment.state,
            }
          : document.packet.payment,
      }
    : document.packet;
  return (
    <ProposalPacket
      packet={packet}
      mode="public"
      publicAccessToken={publicAccessToken}
    />
  );
}
