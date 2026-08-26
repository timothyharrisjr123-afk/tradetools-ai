import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_HEADING,
  PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_ITEMS,
  PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR } from "@/app/lib/proposalCustomerPacketInterestAction";
import ProposalPacketCustomerActions from "./ProposalPacketCustomerActions";
import type { ProposalPacketMode } from "./ProposalPacket";
import { IconGlobe, IconHome, IconMail, IconPhone, IconShield } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_CLOSEOUT_GRID,
  PROPOSAL_PACKET_CLOSEOUT_CARD,
  PROPOSAL_PACKET_CLOSEOUT_TRUST,
  PROPOSAL_PACKET_CONTACT_COMPANY,
  PROPOSAL_PACKET_CONTACT_ICON,
  PROPOSAL_PACKET_CONTACT_ROW,
  PROPOSAL_PACKET_CONTACT_ROW_LINK,
  PROPOSAL_PACKET_CONTACT_ROWS,
  PROPOSAL_PACKET_CONTACT_VALUE,
  PROPOSAL_PACKET_CONTACT_VALUE_LINK,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_SECTION_INTRO,
} from "./proposalPacketStyles";

type ContactRowData = {
  icon: typeof IconPhone;
  label: string;
  value: string;
  href?: string;
};

function ContactRow({ icon: Icon, label, value, href }: ContactRowData) {
  const rowClass = href ? PROPOSAL_PACKET_CONTACT_ROW_LINK : PROPOSAL_PACKET_CONTACT_ROW;
  const valueClass = href ? PROPOSAL_PACKET_CONTACT_VALUE_LINK : PROPOSAL_PACKET_CONTACT_VALUE;
  const inner = (
    <>
      <span className={PROPOSAL_PACKET_CONTACT_ICON}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={PROPOSAL_PACKET_FIELD_LABEL}>{label}</span>
        <span className={valueClass}>{value}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={rowClass} aria-label={`${label}: ${value}`}>
        {inner}
      </a>
    );
  }

  return (
    <div className={rowClass} aria-label={`${label}: ${value}`}>
      {inner}
    </div>
  );
}

function buildContactRows(contact: ProposalCustomerPacketContactViewModel): ContactRowData[] {
  const phone = (contact.phone ?? "").trim();
  const email = (contact.email ?? "").trim();
  const website = (contact.website ?? "").trim();
  const address = (contact.address ?? "").trim();

  return [
    phone ? { icon: IconPhone, label: "Phone", value: phone, href: `tel:${phone}` } : null,
    email ? { icon: IconMail, label: "Email", value: email, href: `mailto:${email}` } : null,
    website
      ? {
          icon: IconGlobe,
          label: "Website",
          value: website.replace(/^https?:\/\//i, ""),
          href: website.startsWith("http") ? website : `https://${website}`,
        }
      : null,
    address ? { icon: IconHome, label: "Address", value: address } : null,
  ].filter(Boolean) as ContactRowData[];
}

type ProposalPacketCloseoutAsideProps = {
  contact: ProposalCustomerPacketContactViewModel | null;
  mode?: ProposalPacketMode;
  publicAccessToken?: string | null;
  termsRequireDeposit?: boolean;
  accepted?: boolean;
  acceptedOnLabel?: string | null;
  onConfirmed?: () => void;
};

/** Closeout: CTA first, then contact + next steps, trust as supportive band. */
export function ProposalPacketCloseoutAside({
  contact,
  mode = "public",
  publicAccessToken = null,
  termsRequireDeposit = false,
  accepted = false,
  acceptedOnLabel = null,
  onConfirmed,
}: ProposalPacketCloseoutAsideProps) {
  const companyName = (contact?.companyName ?? "").trim();
  const rows = contact ? buildContactRows(contact) : [];
  const hasContact = Boolean(companyName) || rows.length > 0;
  const heading = "Ready to move forward?";

  return (
    <aside id={PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR} aria-label="Ready to move forward">
      <div className="mb-4 border-l-2 border-[#2563eb]/40 pl-4">
        <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-[#0b1f33] sm:text-[1.45rem]">
          {heading}
        </h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>
          {contact?.supportMessage || PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE}
        </p>
        <ProposalPacketCustomerActions
          mode={mode}
          contact={contact}
          layout="row"
          secondary="contact"
          compact
          publicAccessToken={publicAccessToken}
          termsRequireDeposit={termsRequireDeposit}
          accepted={accepted}
          acceptedOnLabel={acceptedOnLabel}
          onConfirmed={onConfirmed}
        />
      </div>

      <div className={PROPOSAL_PACKET_CLOSEOUT_GRID}>
        <div className={PROPOSAL_PACKET_CLOSEOUT_CARD}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            {companyName ? `Contact ${companyName}` : "Contact"}
          </p>
          {companyName ? <p className={`${PROPOSAL_PACKET_CONTACT_COMPANY} mt-1.5`}>{companyName}</p> : null}
          {hasContact ? (
            <div className={`${PROPOSAL_PACKET_CONTACT_ROWS} mt-1.5`}>
              {rows.map((row) => (
                <ContactRow key={row.label} {...row} />
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[13px] text-[#64748b]">Contact details will appear here.</p>
          )}
        </div>

        <div className={PROPOSAL_PACKET_CLOSEOUT_CARD}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            {PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_HEADING}
          </p>
          <ol className="mt-2.5 space-y-2">
            {PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_ITEMS.map((item, index) => (
              <li key={item} className="flex gap-2.5 text-[13px] leading-snug text-[#475569]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b1f33] text-[10px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]">
                  {index + 1}
                </span>
                <span className="pt-0.5">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={PROPOSAL_PACKET_CLOSEOUT_TRUST}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#2563eb]/15 bg-white text-[#2563eb]">
          <IconShield className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#0b1f33]">
            We stand behind our work.
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-[#64748b]">
            Quality materials. Professional installation. Peace of mind.
          </p>
        </div>
      </div>
    </aside>
  );
}

/** @deprecated Use ProposalPacketCloseoutAside */
export default function ProposalPacketContact({
  contact,
  embedded = false,
}: {
  contact: ProposalCustomerPacketContactViewModel;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "min-w-0" : undefined}>
      <ProposalPacketCloseoutAside contact={contact} />
    </div>
  );
}

/** @deprecated */
export function ProposalPacketNextSteps() {
  return null;
}
