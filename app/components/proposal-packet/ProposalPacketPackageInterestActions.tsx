"use client";

import { useState } from "react";
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
  /** Compact stack for the recommend/invest card; row for closeout. */
  layout?: "stack" | "row";
  /** Hero uses ask; closeout prefers contact company. */
  secondary?: "ask" | "contact" | "none";
  /**
   * Hero owns the dominant Request CTA (`primary`).
   * Closeout uses `continuation` so it is not equally dominant.
   */
  requestProminence?: "primary" | "continuation";
  /** Tighter CTA spacing inside the investment panel. */
  compact?: boolean;
  /**
   * When set with optionKey (public /p/[token]), Request opens the durable
   * package-request modal instead of mailto.
   */
  publicAccessToken?: string | null;
  optionKey?: string | null;
  contactPrefill?: ProposalPacketRequestModalContactPrefill | null;
};

/**
 * Soft package interest CTAs — non-binding request / contact only.
 * No formal commitment, signature, or payment truth.
 */
export default function ProposalPacketPackageInterestActions({
  packageLabel,
  contact,
  layout = "stack",
  secondary = "ask",
  requestProminence = "primary",
  compact = false,
  publicAccessToken = null,
  optionKey = null,
  contactPrefill = null,
}: ProposalPacketPackageInterestActionsProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const canSubmitRequest =
    Boolean((publicAccessToken ?? "").trim()) && Boolean((optionKey ?? "").trim());

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
    requestProminence === "continuation"
      ? PROPOSAL_PACKET_CTA_CONTINUATION
      : PROPOSAL_PACKET_CTA_PRIMARY;

  const actionsClass =
    layout === "row"
      ? `${compact ? "mt-2.5" : "mt-3.5"} flex flex-wrap items-center gap-2`
      : `${compact ? "mt-0" : "mt-3.5"} flex flex-col gap-2`;

  return (
    <div>
      <div className={actionsClass}>
        {canSubmitRequest ? (
          <button
            type="button"
            className={requestClass}
            data-proposal-cta="request-package"
            data-proposal-cta-prominence={requestProminence}
            onClick={() => setRequestOpen(true)}
          >
            {PROPOSAL_CUSTOMER_PACKET_REQUEST_PACKAGE_CTA}
          </button>
        ) : (
          <a
            href={requestHref}
            className={requestClass}
            data-proposal-cta="request-package"
            data-proposal-cta-prominence={requestProminence}
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
      <p className={`${compact ? "mt-2" : "mt-2.5"} text-[11px] leading-snug text-[#64748b]`}>
        {PROPOSAL_CUSTOMER_PACKET_CONFIRM_DETAILS_NOTE}
      </p>

      {canSubmitRequest ? (
        <ProposalPacketRequestModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          packageLabel={packageLabel}
          optionKey={(optionKey ?? "").trim()}
          publicAccessToken={(publicAccessToken ?? "").trim()}
          contactPrefill={contactPrefill}
        />
      ) : null}
    </div>
  );
}
