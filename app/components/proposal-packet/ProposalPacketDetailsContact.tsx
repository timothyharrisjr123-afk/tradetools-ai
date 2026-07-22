"use client";

import type {
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketDetailsViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { ProposalPacketCloseoutAside } from "./ProposalPacketContact";
import ProposalPacketDetails from "./ProposalPacketDetails";
import { PROPOSAL_PACKET_DETAILS_SECTION } from "./proposalPacketStyles";

type ProposalPacketDetailsContactProps = {
  details: ProposalCustomerPacketDetailsViewModel | null;
  contact: ProposalCustomerPacketContactViewModel | null;
  recommendedPackageLabel?: string | null;
};

export default function ProposalPacketDetailsContact({
  details,
  contact,
  recommendedPackageLabel = null,
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
            recommendedPackageLabel={recommendedPackageLabel}
          />
        </section>
      ) : null}
    </>
  );
}
