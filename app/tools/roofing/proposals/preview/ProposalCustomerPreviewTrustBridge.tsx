"use client";

import { PACKET_TRUST_COPY, PACKET_TRUST_PANEL } from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewTrustBridgeProps = {
  packageLabel: string | null;
  companyName: string | null;
};

/**
 * Customer-safe trust / scope bridge between package and estimate.
 * Polished sales copy — no contractor-internal or debug language.
 */
export default function ProposalCustomerPreviewTrustBridge({
  packageLabel,
  companyName,
}: ProposalCustomerPreviewTrustBridgeProps) {
  const packagePart = packageLabel
    ? `the selected ${/\bpackage\b/i.test(packageLabel) ? packageLabel : `${packageLabel} package`}`
    : "the selected package";

  const companyPart = companyName ? ` from ${companyName}` : "";

  const copy = `This roof replacement proposal${companyPart} is based on your property’s measurement report and ${packagePart}. The itemized estimate below covers the materials, labor, tear-off, and disposal included in that scope.`;

  return (
    <div className={PACKET_TRUST_PANEL} data-preview-trust-bridge>
      <p className={PACKET_TRUST_COPY}>{copy}</p>
    </div>
  );
}
