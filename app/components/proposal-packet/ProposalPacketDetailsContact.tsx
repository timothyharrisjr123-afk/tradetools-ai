"use client";

import { useMemo, useState } from "react";
import type {
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketDetailsViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { ProposalPacketCloseoutAside } from "./ProposalPacketContact";
import ProposalPacketDetails, {
  type DetailSectionKey,
  buildDetailSectionMap,
  firstAvailableDetailSection,
} from "./ProposalPacketDetails";
import {
  PROPOSAL_PACKET_CLOSEOUT_GRID,
  PROPOSAL_PACKET_DETAILS_SECTION,
} from "./proposalPacketStyles";

type ProposalPacketDetailsContactProps = {
  details: ProposalCustomerPacketDetailsViewModel | null;
  contact: ProposalCustomerPacketContactViewModel | null;
};

export default function ProposalPacketDetailsContact({
  details,
  contact,
}: ProposalPacketDetailsContactProps) {
  const sectionMap = useMemo(
    () => (details ? buildDetailSectionMap(details.tabs) : new Map()),
    [details]
  );
  const defaultSection = useMemo(() => firstAvailableDetailSection(sectionMap), [sectionMap]);
  const [activeSection, setActiveSection] = useState<DetailSectionKey>(defaultSection);

  const hasDetails = details != null && details.tabs.length > 0;
  const hasContact = contact != null;

  if (!hasDetails && !hasContact) return null;

  const showTwoColumn = hasDetails;

  return (
    <section className={PROPOSAL_PACKET_DETAILS_SECTION} aria-label="Proposal details and contact">
      <div className={showTwoColumn ? PROPOSAL_PACKET_CLOSEOUT_GRID : "mx-auto max-w-xl"}>
        {hasDetails ? (
          <ProposalPacketDetails
            details={details!}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            embedded
          />
        ) : null}

        <ProposalPacketCloseoutAside contact={contact} />
      </div>
    </section>
  );
}
