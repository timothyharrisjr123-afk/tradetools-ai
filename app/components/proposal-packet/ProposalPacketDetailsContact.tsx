"use client";

import type {
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketDetailsViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { ProposalPacketCloseoutAside } from "./ProposalPacketContact";
import ProposalPacketDetails from "./ProposalPacketDetails";
import type { ProposalPacketMode } from "./ProposalPacket";
import { PROPOSAL_PACKET_DETAILS_SECTION } from "./proposalPacketStyles";

type ProposalPacketDetailsContactProps = {
  details: ProposalCustomerPacketDetailsViewModel | null;
  contact: ProposalCustomerPacketContactViewModel | null;
  mode?: ProposalPacketMode;
  publicAccessToken?: string | null;
  termsRequireDeposit?: boolean;
  accepted?: boolean;
  acceptedOnLabel?: string | null;
  onConfirmed?: () => void;
};

export default function ProposalPacketDetailsContact({
  details,
  contact,
  mode = "public",
  publicAccessToken = null,
  termsRequireDeposit = false,
  accepted = false,
  acceptedOnLabel = null,
  onConfirmed,
}: ProposalPacketDetailsContactProps) {
  const hasDetails = details != null && details.tabs.length > 0;
  const hasContact = contact != null;

  if (!hasDetails && !hasContact) return null;

  return (
    <>
      {hasDetails ? (
        <section className={PROPOSAL_PACKET_DETAILS_SECTION} aria-label="Warranty, notes and terms">
          <ProposalPacketDetails details={details!} embedded />
        </section>
      ) : null}
      {hasContact ? (
        <section className={PROPOSAL_PACKET_DETAILS_SECTION} aria-label="Ready to move forward">
          <ProposalPacketCloseoutAside
            contact={contact}
            mode={mode}
            publicAccessToken={publicAccessToken}
            termsRequireDeposit={termsRequireDeposit}
            accepted={accepted}
            acceptedOnLabel={acceptedOnLabel}
            onConfirmed={onConfirmed}
          />
        </section>
      ) : null}
    </>
  );
}
