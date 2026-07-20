"use client";

import type { ReactNode } from "react";
import { PACKET_PAPER } from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPacketProps = {
  accentColor: string;
  children: ReactNode;
};

/**
 * Block 5C — "Premium Roofing Proposal Packet" outer shell.
 *
 * A single continuous paper surface with one outer elevation and a thin
 * brand accent rule. No nested cards — every zone inside is composed with
 * typography, whitespace, and hairline dividers only. Width/centering is
 * owned by the caller (aligned with the contractor bar above it).
 */
export default function ProposalCustomerPreviewPacket({
  accentColor,
  children,
}: ProposalCustomerPreviewPacketProps) {
  return (
    <div className={PACKET_PAPER} data-preview-customer-document data-preview-packet>
      <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: accentColor }} aria-hidden />
      {children}
    </div>
  );
}
