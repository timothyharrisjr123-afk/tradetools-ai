"use client";

import { useState } from "react";
import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_ASK_QUESTION_CTA,
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA,
  PROPOSAL_CUSTOMER_PACKET_CONFIRMED_TITLE,
  formatProposalCustomerAcceptedOnSentence,
  proposalCustomerPacketContactCompanyCta,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { buildAskQuestionHref } from "@/app/lib/proposalCustomerPacketInterestAction";
import { PROPOSAL_CUSTOMER_PACKET_READY_ANCHOR } from "@/app/lib/proposalCustomerPacketInterestAction";
import type { ProposalPacketMode } from "./ProposalPacket";
import {
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";

type ProposalPacketCustomerActionsProps = {
  mode: ProposalPacketMode;
  contact: ProposalCustomerPacketContactViewModel | null;
  layout?: "stack" | "row";
  secondary?: "ask" | "contact" | "none";
  compact?: boolean;
  publicAccessToken?: string | null;
  termsRequireDeposit: boolean;
  accepted?: boolean;
  acceptedOnLabel?: string | null;
  onConfirmed?: () => void;
};

/**
 * Public customer actions — select/confirm/pay flow.
 * No Request package, Accept & sign, or Sign proposal in the default path.
 */
export default function ProposalPacketCustomerActions({
  mode,
  contact,
  layout = "stack",
  secondary = "ask",
  compact = false,
  publicAccessToken = null,
  termsRequireDeposit,
  accepted = false,
  acceptedOnLabel = null,
  onConfirmed,
}: ProposalPacketCustomerActionsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = (publicAccessToken ?? "").trim();

  if (mode !== "public") return null;

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

  const confirmProposal = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/proposals/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setError("We could not confirm this proposal. Please try again.");
        return;
      }
      onConfirmed?.();
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch {
      setError("We could not confirm this proposal. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (accepted) {
    return (
      <div className={actionsClass} data-proposal-confirmed-state>
        <p className="text-[15px] font-semibold text-[#0b1f33]">
          {PROPOSAL_CUSTOMER_PACKET_CONFIRMED_TITLE}
        </p>
        <p className="text-[13px] text-[#475569]">
          {formatProposalCustomerAcceptedOnSentence(acceptedOnLabel)}
        </p>
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
    );
  }

  return (
    <div className={actionsClass}>
      {!termsRequireDeposit && token ? (
        <button
          type="button"
          className={PROPOSAL_PACKET_CTA_PRIMARY}
          data-proposal-cta="confirm-proposal"
          disabled={busy}
          onClick={() => void confirmProposal()}
        >
          {busy ? "Confirming…" : PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA}
        </button>
      ) : null}
      {secondary !== "none" ? (
        <a
          href={secondaryHref}
          className={PROPOSAL_PACKET_CTA_SECONDARY}
          data-proposal-cta={secondary === "contact" ? "contact-contractor" : "ask-question"}
        >
          {secondaryLabel}
        </a>
      ) : null}
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
    </div>
  );
}
