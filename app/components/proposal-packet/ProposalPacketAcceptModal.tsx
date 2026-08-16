"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_MODAL_ACK,
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_MODAL_TITLE,
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_PROPOSAL_CTA,
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_NEXT,
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_TITLE,
  formatProposalCustomerAcceptedOnLabel,
  formatProposalCustomerAcceptedOnSentence,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";

type ProposalPacketAcceptModalProps = {
  open: boolean;
  onClose: () => void;
  onAccepted: (acceptedOnLabel: string) => void;
  publicAccessToken: string;
  companyName: string | null;
  packageLabel: string;
  totalLabel: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

/**
 * Public formal acceptance confirmation — not a signature or payment.
 */
export default function ProposalPacketAcceptModal({
  open,
  onClose,
  onAccepted,
  publicAccessToken,
  companyName,
  packageLabel,
  totalLabel,
  customerName = null,
  customerEmail = null,
}: ProposalPacketAcceptModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptedOnLabel, setAcceptedOnLabel] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      queueMicrotask(() => {
        if (!dialog.open) return;
        setSubmitState("idle");
        setErrorMessage(null);
        setAcceptedOnLabel(null);
      });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const company = (companyName ?? "").trim() || "the contractor";
  const pkg = packageLabel.trim() || "selected package";
  const total = (totalLabel ?? "").trim();

  const submit = async () => {
    if (submitState === "submitting") return;
    setSubmitState("submitting");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/proposals/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: publicAccessToken,
          acceptedByName: (customerName ?? "").trim() || null,
          acceptedByEmail: (customerEmail ?? "").trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        acceptedAt?: string;
      };
      if (!response.ok || payload.ok !== true) {
        setSubmitState("error");
        setErrorMessage(
          "We could not accept this proposal. Please try again or contact the contractor."
        );
        return;
      }
      const label =
        formatProposalCustomerAcceptedOnLabel(payload.acceptedAt ?? null) ??
        formatProposalCustomerAcceptedOnLabel(new Date().toISOString());
      setAcceptedOnLabel(label);
      setSubmitState("success");
      onAccepted(label ?? "today");
    } catch {
      setSubmitState("error");
      setErrorMessage(
        "We could not accept this proposal. Please try again or contact the contractor."
      );
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="w-[min(28rem,calc(100vw-1.5rem))] rounded-[16px] border border-[#e2e8f0] bg-white p-0 shadow-[0_24px_60px_rgba(11,31,51,0.18)] backdrop:bg-[#0b1f33]/40"
      onClose={onClose}
      data-proposal-accept-modal
    >
      <form
        className="px-5 py-5 sm:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (submitState === "success") {
            onClose();
            return;
          }
          void submit();
        }}
      >
        {submitState === "success" ? (
          <div data-proposal-accept-success>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
              {PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_TITLE}
            </p>
            <h2 id={titleId} className="mt-1 text-[1.25rem] font-semibold text-[#0b1f33]">
              {formatProposalCustomerAcceptedOnSentence(acceptedOnLabel)}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#475569]">
              {PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_NEXT}
            </p>
            <button type="submit" className={`${PROPOSAL_PACKET_CTA_PRIMARY} mt-5 w-full`}>
              Done
            </button>
          </div>
        ) : (
          <div>
            <h2 id={titleId} className="text-[1.25rem] font-semibold text-[#0b1f33]">
              {PROPOSAL_CUSTOMER_PACKET_ACCEPT_MODAL_TITLE}
            </h2>
            <dl className="mt-3 space-y-2 text-[14px] text-[#334155]">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                  Contractor
                </dt>
                <dd className="mt-0.5 font-medium text-[#0b1f33]">{company}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                  Selected package
                </dt>
                <dd className="mt-0.5 font-medium text-[#0b1f33]">{pkg}</dd>
              </div>
              {total ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                    Total
                  </dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-[#0b1f33]">{total}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-3 text-[13px] leading-relaxed text-[#475569]">
              {PROPOSAL_CUSTOMER_PACKET_ACCEPT_MODAL_ACK}
            </p>
            {errorMessage ? (
              <p className="mt-3 text-[13px] text-[#b91c1c]" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="submit"
                className={PROPOSAL_PACKET_CTA_PRIMARY}
                data-proposal-cta="accept-proposal-confirm"
                disabled={submitState === "submitting"}
              >
                {submitState === "submitting"
                  ? "Accepting…"
                  : PROPOSAL_CUSTOMER_PACKET_ACCEPT_PROPOSAL_CTA}
              </button>
              <button
                type="button"
                className={PROPOSAL_PACKET_CTA_SECONDARY}
                onClick={onClose}
                disabled={submitState === "submitting"}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </form>
    </dialog>
  );
}
