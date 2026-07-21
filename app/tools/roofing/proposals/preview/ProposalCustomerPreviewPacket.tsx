"use client";

import type { ReactNode } from "react";

type ProposalCustomerPreviewPacketProps = {
  children: ReactNode;
};

/**
 * Passthrough wrapper for customer-safe proposal content.
 * Visual shell lives on ProposalPreviewReviewSurface — no nested paper card.
 */
export default function ProposalCustomerPreviewPacket({
  children,
}: ProposalCustomerPreviewPacketProps) {
  return <>{children}</>;
}
