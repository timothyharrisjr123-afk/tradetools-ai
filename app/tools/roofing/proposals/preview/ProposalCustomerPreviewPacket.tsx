"use client";

import type { ReactNode } from "react";
import { PACKET_PAPER } from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPacketProps = {
  children: ReactNode;
};

/**
 * Roofing Proposal Sales Packet — outer paper shell.
 *
 * Brand weight lives in the cover band (not a thin accent rule).
 * One continuous white surface; zones compose with typography + panels.
 */
export default function ProposalCustomerPreviewPacket({
  children,
}: ProposalCustomerPreviewPacketProps) {
  return (
    <div
      className={PACKET_PAPER}
      data-preview-customer-document
      data-preview-packet
      data-preview-sales-packet
    >
      {children}
    </div>
  );
}
