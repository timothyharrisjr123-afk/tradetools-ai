import type { ReactNode } from "react";
import type {
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketFooterMetadataViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE } from "@/app/lib/proposalCustomerPacketViewModel";
import { IconShield } from "./ProposalPacketIcons";
import { PROPOSAL_PACKET_FOOTER, PROPOSAL_PACKET_FOOTER_METADATA } from "./proposalPacketStyles";

type ProposalPacketFooterProps = {
  contact: ProposalCustomerPacketContactViewModel | null;
  footerMetadata: ProposalCustomerPacketFooterMetadataViewModel | null;
};

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="font-medium text-[#475569]">{label}</span>
      <span className="mx-1.5 text-[#cbd5e1]">·</span>
      <span>{value}</span>
    </span>
  );
}

export default function ProposalPacketFooter({ contact, footerMetadata }: ProposalPacketFooterProps) {
  const companyName = (contact?.companyName ?? "your contractor").trim();
  const showMetadata = footerMetadata?.hasAnyField ?? false;

  const metadataItems: { key: string; node: ReactNode }[] = [];
  if (footerMetadata?.proposalDateLabel) {
    metadataItems.push({
      key: "date",
      node: <MetadataItem label="Proposal date" value={footerMetadata.proposalDateLabel} />,
    });
  }
  if (footerMetadata?.proposalReferenceLabel) {
    metadataItems.push({
      key: "ref",
      node: <MetadataItem label="Proposal ID" value={footerMetadata.proposalReferenceLabel} />,
    });
  }
  if (footerMetadata?.licenseLabel) {
    metadataItems.push({
      key: "license",
      node: <MetadataItem label="License" value={footerMetadata.licenseLabel} />,
    });
  }
  if (footerMetadata?.insuredLabel) {
    metadataItems.push({
      key: "insured",
      node: <span>{footerMetadata.insuredLabel}</span>,
    });
  }

  return (
    <footer>
      <div className={PROPOSAL_PACKET_FOOTER}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-lg items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.08] text-[#f2c879]">
              <IconShield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[16px] font-bold leading-snug text-white">
                Thank you for considering {companyName}.
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                We appreciate the opportunity to help protect your home.
              </p>
            </div>
          </div>

          <p className="border-l-0 border-[#f2c879]/30 pl-0 text-[14px] font-semibold leading-snug text-[#f2c879] sm:border-l sm:pl-6 sm:text-right">
            {PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE}
          </p>
        </div>
      </div>

      {showMetadata && metadataItems.length > 0 ? (
        <div className={PROPOSAL_PACKET_FOOTER_METADATA}>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {metadataItems.map((item) => (
              <span key={item.key}>{item.node}</span>
            ))}
          </div>
        </div>
      ) : null}
    </footer>
  );
}
