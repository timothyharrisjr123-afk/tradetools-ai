import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA,
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_DETAILS_NOTE,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA,
  proposalCustomerPacketContactCompanyCta,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  buildAskQuestionHref,
  buildPackageInterestHref,
  PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR,
} from "@/app/lib/proposalCustomerPacketInterestAction";
import {
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";

type ProposalPacketPackageInterestActionsProps = {
  packageLabel: string;
  contact: ProposalCustomerPacketContactViewModel | null;
  /** Compact stack for the recommend/invest card; row for closeout. */
  layout?: "stack" | "row";
  /** Hero uses ask; closeout prefers contact company. */
  secondary?: "ask" | "contact" | "none";
  /** Tighter CTA spacing inside the investment panel. */
  compact?: boolean;
};

/**
 * Soft package interest CTAs — contact only; no accept/approve/sign/pay truth.
 */
export default function ProposalPacketPackageInterestActions({
  packageLabel,
  contact,
  layout = "stack",
  secondary = "ask",
  compact = false,
}: ProposalPacketPackageInterestActionsProps) {
  const requestHref = buildPackageInterestHref(contact, packageLabel, "request");
  const askHref = buildAskQuestionHref(contact);
  const contactHref =
    contact?.phone?.trim() || contact?.email?.trim()
      ? askHref
      : `#${PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR}`;

  const secondaryHref = secondary === "contact" ? contactHref : askHref;
  const secondaryLabel =
    secondary === "contact"
      ? proposalCustomerPacketContactCompanyCta(contact?.companyName)
      : PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA;

  const actionsClass =
    layout === "row"
      ? `${compact ? "mt-2.5" : "mt-3.5"} flex flex-wrap items-center gap-2`
      : `${compact ? "mt-0" : "mt-3.5"} flex flex-col gap-2`;

  return (
    <div>
      <div className={actionsClass}>
        <a
          href={requestHref}
          className={PROPOSAL_PACKET_CTA_PRIMARY}
          data-proposal-cta="request-package"
        >
          {PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA}
        </a>
        {secondary !== "none" ? (
          <a
            href={secondaryHref}
            className={PROPOSAL_PACKET_CTA_SECONDARY}
            data-proposal-cta={secondary === "contact" ? "contact-contractor" : "ask-question"}
          >
            {secondaryLabel}
          </a>
        ) : null}
      </div>
      <p className={`${compact ? "mt-2" : "mt-2.5"} text-[11px] leading-snug text-[#64748b]`}>
        {PROPOSAL_CUSTOMER_PACKET_CONFIRM_DETAILS_NOTE}
      </p>
    </div>
  );
}
