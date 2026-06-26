"use client";

import { useState } from "react";
import type {
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketDetailsViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketContact from "./ProposalPacketContact";
import ProposalPacketDetails from "./ProposalPacketDetails";
import { PROPOSAL_PACKET_SECTION_COMPACT } from "./proposalPacketStyles";

type ProposalPacketDetailsContactProps = {
  details: ProposalCustomerPacketDetailsViewModel | null;
  contact: ProposalCustomerPacketContactViewModel | null;
};

export default function ProposalPacketDetailsContact({
  details,
  contact,
}: ProposalPacketDetailsContactProps) {
  const [activeId, setActiveId] = useState(details?.tabs[0]?.id ?? "");
  const hasDetails = details != null && details.tabs.length > 0;
  const hasContact = contact != null;

  if (!hasDetails && !hasContact) {
    return null;
  }

  if (hasDetails && hasContact) {
    return (
      <section className={PROPOSAL_PACKET_SECTION_COMPACT} aria-label="Details and contact">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-0">
          <div className="lg:pr-10">
            <ProposalPacketDetails
              details={details!}
              activeId={activeId}
              onTabChange={setActiveId}
              embedded
            />
          </div>
          <div className="border-t border-[#e2e8f0] pt-10 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <ProposalPacketContact contact={contact!} embedded />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={PROPOSAL_PACKET_SECTION_COMPACT}>
      {hasDetails ? (
        <ProposalPacketDetails details={details!} activeId={activeId} onTabChange={setActiveId} />
      ) : null}
      {hasContact ? <ProposalPacketContact contact={contact!} /> : null}
    </section>
  );
}
