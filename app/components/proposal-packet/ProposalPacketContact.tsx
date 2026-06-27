import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";

import {
  PROPOSAL_CUSTOMER_PACKET_CONTACT_HEADING,
  PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_FOOTNOTE,
  PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_HEADING,
  PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_ITEMS,
  PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE,
} from "@/app/lib/proposalCustomerPacketViewModel";

import { IconGlobe, IconHome, IconMail, IconPhone } from "./ProposalPacketIcons";

import {
  PROPOSAL_PACKET_CLOSEOUT_COMBO,
  PROPOSAL_PACKET_CLOSEOUT_COMBO_GRID,
  PROPOSAL_PACKET_CLOSEOUT_COMBO_PANEL,
  PROPOSAL_PACKET_CLOSEOUT_CONTACT_BODY,
  PROPOSAL_PACKET_CLOSEOUT_CONTACT_BODY_COMPACT,
  PROPOSAL_PACKET_CLOSEOUT_NEXT_BODY,
  PROPOSAL_PACKET_CLOSEOUT_PANEL_HEADER,
  PROPOSAL_PACKET_CLOSEOUT_PANEL_TITLE,
  PROPOSAL_PACKET_CONTACT_COMPANY,
  PROPOSAL_PACKET_CONTACT_ICON,
  PROPOSAL_PACKET_CONTACT_ROW,
  PROPOSAL_PACKET_CONTACT_ROW_LINK,
  PROPOSAL_PACKET_CONTACT_ROWS,
  PROPOSAL_PACKET_CONTACT_VALUE,
  PROPOSAL_PACKET_CONTACT_VALUE_LINK,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_NEXT_STEP_BADGE,
  PROPOSAL_PACKET_NEXT_STEP_FOOTNOTE,
  PROPOSAL_PACKET_NEXT_STEP_LINE,
  PROPOSAL_PACKET_NEXT_STEP_TEXT,
  PROPOSAL_PACKET_NEXT_STEPS_TIMELINE,
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

function ContactPanel({ contact }: { contact: ProposalCustomerPacketContactViewModel }) {
  const rows = buildContactRows(contact);
  const companyName = (contact.companyName ?? "").trim();
  const bodyClass =
    rows.length <= 1 ? PROPOSAL_PACKET_CLOSEOUT_CONTACT_BODY_COMPACT : PROPOSAL_PACKET_CLOSEOUT_CONTACT_BODY;

  if (rows.length === 0 && !companyName) {
    return null;
  }

  return (
    <div className={PROPOSAL_PACKET_CLOSEOUT_COMBO_PANEL} aria-label="Contact information">
      <div className={PROPOSAL_PACKET_CLOSEOUT_PANEL_HEADER}>
        <p className={PROPOSAL_PACKET_CLOSEOUT_PANEL_TITLE}>Contact information</p>
      </div>
      <div className={bodyClass}>
        {companyName ? (
          <p className={`${PROPOSAL_PACKET_CONTACT_COMPANY} ${rows.length ? "mb-2" : ""}`}>{companyName}</p>
        ) : null}
        {rows.length ? (
          <div className={PROPOSAL_PACKET_CONTACT_ROWS}>
            {rows.map((row) => (
              <ContactRow key={row.label} {...row} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] font-medium text-[#334155]">{companyName}</p>
        )}
      </div>
    </div>
  );
}

function NextStepsPanel() {
  return (
    <div className={PROPOSAL_PACKET_CLOSEOUT_COMBO_PANEL} aria-label="What happens next">
      <div className={PROPOSAL_PACKET_CLOSEOUT_PANEL_HEADER}>
        <p className={PROPOSAL_PACKET_CLOSEOUT_PANEL_TITLE}>{PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_HEADING}</p>
      </div>
      <div className={PROPOSAL_PACKET_CLOSEOUT_NEXT_BODY}>
        <ol className={PROPOSAL_PACKET_NEXT_STEPS_TIMELINE}>
          {PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_ITEMS.map((item, index) => {
            const isLast = index === PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_ITEMS.length - 1;
            return (
              <li key={item} className="relative flex gap-2.5 pb-3 last:pb-0">
                {!isLast ? <span className={PROPOSAL_PACKET_NEXT_STEP_LINE} aria-hidden /> : null}
                <span className={PROPOSAL_PACKET_NEXT_STEP_BADGE}>{index + 1}</span>
                <span className={PROPOSAL_PACKET_NEXT_STEP_TEXT}>{item}</span>
              </li>
            );
          })}
        </ol>
        <p className={PROPOSAL_PACKET_NEXT_STEP_FOOTNOTE}>{PROPOSAL_CUSTOMER_PACKET_NEXT_STEPS_FOOTNOTE}</p>
      </div>
    </div>
  );
}

function SplitCloseoutCard({ contact }: { contact: ProposalCustomerPacketContactViewModel | null }) {
  const hasContactPanel =
    contact != null &&
    (buildContactRows(contact).length > 0 || (contact.companyName ?? "").trim().length > 0);

  const gridClass = hasContactPanel
    ? PROPOSAL_PACKET_CLOSEOUT_COMBO_GRID
    : "grid grid-cols-1";

  return (
    <div className={PROPOSAL_PACKET_CLOSEOUT_COMBO}>
      <div className={gridClass}>
        {hasContactPanel && contact ? <ContactPanel contact={contact} /> : null}
        <NextStepsPanel />
      </div>
    </div>
  );
}

type ProposalPacketCloseoutAsideProps = {
  contact: ProposalCustomerPacketContactViewModel | null;
};

export function ProposalPacketCloseoutAside({ contact }: ProposalPacketCloseoutAsideProps) {
  return (
    <aside className="flex min-w-0 flex-col lg:self-start" aria-label="Contact and next steps">
      <div className="mb-4">
        <h2 className="text-[1.25rem] font-bold leading-tight tracking-[-0.02em] text-[#0f172a] sm:text-[1.4rem]">
          {PROPOSAL_CUSTOMER_PACKET_CONTACT_HEADING}
        </h2>
        <p className={`${PROPOSAL_PACKET_SECTION_INTRO} max-w-none`}>
          {contact?.supportMessage || PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE}
        </p>
      </div>

      <SplitCloseoutCard contact={contact} />
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

/** @deprecated Use ProposalPacketCloseoutAside */
export function ProposalPacketNextSteps() {
  return <NextStepsPanel />;
}
