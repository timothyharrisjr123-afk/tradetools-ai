import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA,
  PROPOSAL_CUSTOMER_PACKET_QUESTIONS_HEADING,
  PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  buildAskQuestionHref,
  PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR,
} from "@/app/lib/proposalCustomerPacketInterestAction";
import type { ProposalPacketMode } from "./ProposalPacket";
import { IconGlobe, IconHome, IconMail, IconPhone } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_CONTACT_COMPANY,
  PROPOSAL_PACKET_CONTACT_ICON,
  PROPOSAL_PACKET_CONTACT_ROW,
  PROPOSAL_PACKET_CONTACT_ROW_LINK,
  PROPOSAL_PACKET_CONTACT_ROWS,
  PROPOSAL_PACKET_CONTACT_VALUE,
  PROPOSAL_PACKET_CONTACT_VALUE_LINK,
  PROPOSAL_PACKET_CTA_TEXT_LINK,
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
};

/**
 * Questions and contact. The primary action lives in the purchase composition,
 * so asking a question is a quiet text link that cannot compete with it.
 */
export function ProposalPacketCloseoutAside({
  contact,
  mode = "public",
}: ProposalPacketCloseoutAsideProps) {
  const companyName = (contact?.companyName ?? "").trim();
  const rows = contact ? buildContactRows(contact) : [];
  const hasContact = Boolean(companyName) || rows.length > 0;
  const askHref = contact ? buildAskQuestionHref(contact) : null;

  return (
    <aside id={PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR} aria-label="Questions">
      <div className="mb-4 border-l-2 border-[#2563eb]/40 pl-4">
        <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-[#0b1f33] sm:text-[1.45rem]">
          {PROPOSAL_CUSTOMER_PACKET_QUESTIONS_HEADING}
        </h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>
          {contact?.supportMessage || PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE}
        </p>
        {mode === "public" && askHref ? (
          <a
            href={askHref}
            className={`mt-1 ${PROPOSAL_PACKET_CTA_TEXT_LINK}`}
            data-proposal-cta="ask-question"
          >
            {PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA}
          </a>
        ) : null}
      </div>

      {hasContact ? (
        <div className="pl-4">
          {companyName ? <p className={PROPOSAL_PACKET_CONTACT_COMPANY}>{companyName}</p> : null}
          <div className={`${PROPOSAL_PACKET_CONTACT_ROWS} mt-1.5`}>
            {rows.map((row) => (
              <ContactRow key={row.label} {...row} />
            ))}
          </div>
        </div>
      ) : null}
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
