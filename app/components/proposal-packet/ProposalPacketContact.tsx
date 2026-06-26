import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { IconGlobe, IconMail, IconPhone } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketContactProps = {
  contact: ProposalCustomerPacketContactViewModel;
  embedded?: boolean;
};

function ContactRow({
  icon: Icon,
  value,
}: {
  icon: typeof IconPhone;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[15px] text-[#475569]">
      <Icon className="h-4 w-4 shrink-0 text-[#64748b]" aria-hidden />
      <span>{value}</span>
    </div>
  );
}

export default function ProposalPacketContact({
  contact,
  embedded = false,
}: ProposalPacketContactProps) {
  const phone = (contact.phone ?? "").trim();
  const email = (contact.email ?? "").trim();
  const website = (contact.website ?? "").trim();
  const address = (contact.address ?? "").trim();

  return (
    <section
      className={embedded ? "min-w-0" : undefined}
      aria-label="Contact"
    >
      <h3 className={PROPOSAL_PACKET_SECTION_TITLE}>Questions or ready to move forward?</h3>
      <p className={`${PROPOSAL_PACKET_SECTION_INTRO} max-w-md`}>{contact.supportMessage}</p>

      <div className="mt-6 space-y-3 rounded-2xl border border-[#e2e8f0] bg-slate-50/50 px-5 py-5">
        {phone ? <ContactRow icon={IconPhone} value={phone} /> : null}
        {email ? <ContactRow icon={IconMail} value={email} /> : null}
        {website ? <ContactRow icon={IconGlobe} value={website} /> : null}
        {address ? (
          <p className="border-t border-[#e2e8f0] pt-3 text-sm leading-relaxed text-[#64748b]">
            {address}
          </p>
        ) : null}
        {contact.license ? (
          <p className="text-xs text-[#94a3b8]">License {contact.license}</p>
        ) : null}
      </div>
    </section>
  );
}
