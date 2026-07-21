"use client";

import {
  PACKET_INFO_LABEL,
  PACKET_TRUST_COPY,
  PACKET_TRUST_PANEL,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewTrustBridgeProps = {
  packageLabel: string | null;
  companyName: string | null;
};

/**
 * Short customer-safe “why this package” copy.
 */
export default function ProposalCustomerPreviewTrustBridge({
  packageLabel,
}: ProposalCustomerPreviewTrustBridgeProps) {
  const packagePart = packageLabel
    ? /\bpackage\b/i.test(packageLabel)
      ? packageLabel
      : `${packageLabel} package`
    : "selected package";

  const copy = `This package includes the measured roof scope, selected materials, installation labor, tear-off, disposal, and cleanup shown below for the ${packagePart}.`;

  return (
    <div className={PACKET_TRUST_PANEL} data-preview-trust-bridge>
      <p className={PACKET_INFO_LABEL}>Why this package</p>
      <p className={PACKET_TRUST_COPY}>{copy}</p>
    </div>
  );
}
