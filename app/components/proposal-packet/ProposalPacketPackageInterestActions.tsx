"use client";

import { useState } from "react";
import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
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
import {
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_AND_SIGN_CTA,
  PROPOSAL_CUSTOMER_PACKET_SIGNED_TITLE,
  PROPOSAL_CUSTOMER_PACKET_SIGN_PROPOSAL_CTA,
  formatProposalCustomerSignedOnSentence,
} from "@/app/lib/proposalSignatureTypes";
import ProposalPacketRequestModal, {
  type ProposalPacketRequestModalContactPrefill,
} from "./ProposalPacketRequestModal";
import ProposalPacketSignModal, {
  type ProposalPacketSignedResult,
} from "./ProposalPacketSignModal";
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
  signed?: boolean;
  signedOnLabel?: string | null;
  signerDisplayName?: string | null;
  onSigned?: (result: ProposalPacketSignedResult) => void;
  showAccept?: boolean;
};

/**
 * Public CTAs:
 * unsigned → Accept & sign
 * accepted unsigned → Sign proposal
 * signed → Proposal signed
 * Request this package remains interest-only.
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
  signed = false,
  signedOnLabel = null,
  signerDisplayName = null,
  onSigned,
  showAccept = true,
}: ProposalPacketPackageInterestActionsProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const token = (publicAccessToken ?? "").trim();
  const canSubmitRequest = Boolean(token) && Boolean((optionKey ?? "").trim());
  const canAcceptAndSign = showAccept && Boolean(token) && !accepted && !signed;
  const canSignOnly = showAccept && Boolean(token) && accepted && !signed;
  const primarySignOpen = canAcceptAndSign || canSignOnly;

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
    primarySignOpen || requestProminence === "continuation"
      ? PROPOSAL_PACKET_CTA_CONTINUATION
      : PROPOSAL_PACKET_CTA_PRIMARY;

  const actionsClass =
    layout === "row"
      ? `${compact ? "mt-2.5" : "mt-3.5"} flex flex-wrap items-center gap-2`
      : `${compact ? "mt-0" : "mt-3.5"} flex flex-col gap-2`;

  const requestAndAsk = (
    <>
      {canSubmitRequest ? (
        <button
          type="button"
          className={requestClass}
          data-proposal-cta="request-package"
          data-proposal-cta-prominence={primarySignOpen ? "continuation" : requestProminence}
          onClick={() => setRequestOpen(true)}
        >
          {PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA}
        </button>
      ) : (
        <a
          href={requestHref}
          className={requestClass}
          data-proposal-cta="request-package"
          data-proposal-cta-prominence={primarySignOpen ? "continuation" : requestProminence}
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
    </>
  );

  const requestModal = canSubmitRequest ? (
    <ProposalPacketRequestModal
      open={requestOpen}
      onClose={() => setRequestOpen(false)}
      packageLabel={packageLabel}
      optionKey={(optionKey ?? "").trim()}
      publicAccessToken={token}
      companyName={contact?.companyName ?? null}
      contactPrefill={contactPrefill}
    />
  ) : null;

  const signModal = primarySignOpen ? (
    <ProposalPacketSignModal
      open={signOpen}
      mode={canSignOnly ? "sign_only" : "accept_and_sign"}
      onClose={() => setSignOpen(false)}
      onSigned={(result) => {
        setSignOpen(false);
        onSigned?.(result);
      }}
      publicAccessToken={token}
      companyName={contact?.companyName ?? null}
      packageLabel={packageLabel}
      totalLabel={totalLabel}
      customerName={contactPrefill?.name ?? null}
      customerEmail={contactPrefill?.email ?? null}
    />
  ) : null;

  if (signed) {
    const signer = (signerDisplayName ?? "").trim();
    return (
      <div className={actionsClass} data-proposal-signed-state>
        <p className="text-[15px] font-semibold text-[#0b1f33]">
          {PROPOSAL_CUSTOMER_PACKET_SIGNED_TITLE}
        </p>
        <p className="text-[13px] text-[#475569]">
          {formatProposalCustomerSignedOnSentence(signedOnLabel)}
          {signer ? ` · ${signer}` : ""}
        </p>
        {requestAndAsk}
        {requestModal}
      </div>
    );
  }

  if (accepted) {
    return (
      <div className={actionsClass} data-proposal-accepted-state>
        <p className="text-[15px] font-semibold text-[#0b1f33]">
          {PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_TITLE}
        </p>
        <p className="text-[13px] text-[#475569]">
          {formatProposalCustomerAcceptedOnSentence(acceptedOnLabel)}
        </p>
        {canSignOnly ? (
          <button
            type="button"
            className={PROPOSAL_PACKET_CTA_PRIMARY}
            data-proposal-cta="sign-proposal"
            onClick={() => setSignOpen(true)}
          >
            {PROPOSAL_CUSTOMER_PACKET_SIGN_PROPOSAL_CTA}
          </button>
        ) : null}
        {requestAndAsk}
        {requestModal}
        {signModal}
      </div>
    );
  }

  return (
    <div>
      <div className={actionsClass}>
        {canAcceptAndSign ? (
          <button
            type="button"
            className={PROPOSAL_PACKET_CTA_PRIMARY}
            data-proposal-cta="accept-and-sign"
            onClick={() => setSignOpen(true)}
          >
            {PROPOSAL_CUSTOMER_PACKET_ACCEPT_AND_SIGN_CTA}
          </button>
        ) : null}
        {requestAndAsk}
      </div>
      {requestModal}
      {signModal}
    </div>
  );
}
