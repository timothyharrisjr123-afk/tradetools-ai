import ProposalPacket from "@/app/components/proposal-packet/ProposalPacket";
import { applyCustomerPaymentReturnHint } from "@/app/lib/jobPaymentCustomerPresenter";
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
  const packet = {
    ...document.packet,
    payment: applyCustomerPaymentReturnHint(
      document.packet.payment ?? null,
      paymentReturnHint
    ),
  };
  return (
    <ProposalPacket
      packet={packet}
      mode="public"
      publicAccessToken={publicAccessToken}
    />
  );
}
