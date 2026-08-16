"use client";

import { useState } from "react";
import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_PROPOSAL_CTA,
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_TITLE,
  PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA,
  formatProposalCustomerAcceptedOnSentence,
  proposalCustomerPacketContactCompanyCta,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  buildAskQuestionHref,
  buildPackageInterestHref,
  PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR,
} from "@/app/lib/proposalCustomerPacketInterestAction";
import ProposalPacketAcceptModal from "./ProposalPacketAcceptModal";
import ProposalPacketRequestModal, {
  type ProposalPacketRequestModalContactPrefill,
} from "./ProposalPacketRequestModal";
import {
  PROPOSAL_PACKET_CTA_CONTINUATION,
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";

type ProposalPacketPackageInterestActionsProps = {
  packageLabel: string;
  contact: ProposalCustomerPacketContactViewModel | null;
  layout?: "stack" | "row";
  secondary?: "ask" | "contact" | "none";
  requestProminence?: "primary" | "continuation";
  compact?: boolean;
  publicAccessToken?: string | null;
  optionKey?: string | null;
  contactPrefill?: ProposalPacketRequestModalContactPrefill | null;
  totalLabel?: string | null;
  accepted?: boolean;
  acceptedOnLabel?: string | null;
  onAccepted?: (acceptedOnLabel: string) => void;
  showAccept?: boolean;
};

/**
 * Public CTAs: Accept proposal (commitment) is distinct from Request this package (interest).
 */
export default function ProposalPacketPackageInterestActions({
  packageLabel,
  contact,
  layout = "stack",
  secondary = "ask",
  requestProminence = "continuation",
  compact = false,
  publicAccessToken = null,
  optionKey = null,
  contactPrefill = null,
  totalLabel = null,
  accepted = false,
  acceptedOnLabel = null,
  onAccepted,
  showAccept = true,
}: ProposalPacketPackageInterestActionsProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const token = (publicAccessToken ?? "").trim();
  const canSubmitRequest = Boolean(token) && Boolean((optionKey ?? "").trim());
  const canAccept = showAccept && Boolean(token) && !accepted;

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

  const requestClass =
    canAccept || requestProminence === "continuation"
      ? PROPOSAL_PACKET_CTA_CONTINUATION
      : PROPOSAL_PACKET_CTA_PRIMARY;

  const actionsClass =
    layout === "row"
      ? `${compact ? "mt-2.5" : "mt-3.5"} flex flex-wrap items-center gap-2`
      : `${compact ? "mt-0" : "mt-3.5"} flex flex-col gap-2`;

  if (accepted) {
    return (
      <div className={actionsClass} data-proposal-accepted-state>
        <p className="text-[15px] font-semibold text-[#0b1f33]">
          {PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_TITLE}
        </p>
        <p className="text-[13px] text-[#475569]">
          {formatProposalCustomerAcceptedOnSentence(acceptedOnLabel)}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className={actionsClass}>
        {canAccept ? (
          <button
            type="button"
            className={PROPOSAL_PACKET_CTA_PRIMARY}
            data-proposal-cta="accept-proposal"
            onClick={() => setAcceptOpen(true)}
          >
            {PROPOSAL_CUSTOMER_PACKET_ACCEPT_PROPOSAL_CTA}
          </button>
        ) : null}
        {canSubmitRequest ? (
          <button
            type="button"
            className={requestClass}
            data-proposal-cta="request-package"
            data-proposal-cta-prominence={canAccept ? "continuation" : requestProminence}
            onClick={() => setRequestOpen(true)}
          >
            {PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA}
          </button>
        ) : (
          <a
            href={requestHref}
            className={requestClass}
            data-proposal-cta="request-package"
            data-proposal-cta-prominence={canAccept ? "continuation" : requestProminence}
          >
            {PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA}
          </a>
        )}
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

      {canSubmitRequest ? (
        <ProposalPacketRequestModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          packageLabel={packageLabel}
          optionKey={(optionKey ?? "").trim()}
          publicAccessToken={token}
          companyName={contact?.companyName ?? null}
          contactPrefill={contactPrefill}
        />
      ) : null}

      {canAccept ? (
        <ProposalPacketAcceptModal
          open={acceptOpen}
          onClose={() => setAcceptOpen(false)}
          onAccepted={(label) => {
            setAcceptOpen(false);
            onAccepted?.(label);
          }}
          publicAccessToken={token}
          companyName={contact?.companyName ?? null}
          packageLabel={packageLabel}
          totalLabel={totalLabel}
          customerName={contactPrefill?.name ?? null}
          customerEmail={contactPrefill?.email ?? null}
        />
      ) : null}
    </div>
  );
}
