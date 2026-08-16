"use client";

import type {
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketDetailsViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { ProposalPacketCloseoutAside } from "./ProposalPacketContact";
import ProposalPacketDetails from "./ProposalPacketDetails";
import type { ProposalPacketRequestModalContactPrefill } from "./ProposalPacketRequestModal";
import { PROPOSAL_PACKET_DETAILS_SECTION } from "./proposalPacketStyles";

type ProposalPacketDetailsContactProps = {
  details: ProposalCustomerPacketDetailsViewModel | null;
  contact: ProposalCustomerPacketContactViewModel | null;
  recommendedPackageLabel?: string | null;
  recommendedOptionKey?: string | null;
  publicAccessToken?: string | null;
  contactPrefill?: ProposalPacketRequestModalContactPrefill | null;
  totalLabel?: string | null;
  accepted?: boolean;
  acceptedOnLabel?: string | null;
  onAccepted?: (acceptedOnLabel: string) => void;
};

export default function ProposalPacketDetailsContact({
  details,
  contact,
  recommendedPackageLabel = null,
  recommendedOptionKey = null,
  publicAccessToken = null,
  contactPrefill = null,
  totalLabel = null,
  accepted = false,
  acceptedOnLabel = null,
  onAccepted,
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
            recommendedOptionKey={recommendedOptionKey}
            publicAccessToken={publicAccessToken}
            contactPrefill={contactPrefill}
            totalLabel={totalLabel}
            accepted={accepted}
            acceptedOnLabel={acceptedOnLabel}
            onAccepted={onAccepted}
          />
        </section>
      ) : null}
    </>
  );
}
