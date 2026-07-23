"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_MAX,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_PLACEHOLDER,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_TITLE,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUBMIT_CTA,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_BODY,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_NEXT,
  PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_TITLE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";

export type ProposalPacketRequestModalContactPrefill = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type ProposalPacketRequestModalProps = {
  open: boolean;
  onClose: () => void;
  packageLabel: string;
  optionKey: string;
  publicAccessToken: string;
  contactPrefill?: ProposalPacketRequestModalContactPrefill | null;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

/**
 * R3B2 — Compact non-binding package request modal for the public proposal.
 * Does not change proposal status, package selection, or upgrades.
 */
export default function ProposalPacketRequestModal({
  open,
  onClose,
  packageLabel,
  optionKey,
  publicAccessToken,
  contactPrefill = null,
}: ProposalPacketRequestModalProps) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState(
    (contactPrefill?.name ?? "").trim()
  );
  const [customerEmail, setCustomerEmail] = useState(
    (contactPrefill?.email ?? "").trim()
  );
  const [customerPhone, setCustomerPhone] = useState(
    (contactPrefill?.phone ?? "").trim()
  );
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      setSubmitState("idle");
      setErrorMessage(null);
      setMessage("");
      setCustomerName((contactPrefill?.name ?? "").trim());
      setCustomerEmail((contactPrefill?.email ?? "").trim());
      setCustomerPhone((contactPrefill?.phone ?? "").trim());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, contactPrefill?.name, contactPrefill?.email, contactPrefill?.phone]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitState === "submitting" || submitState === "success") return;

    setSubmitState("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/proposals/customer-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: publicAccessToken,
          intent: "request_package",
          requestedOptionId: optionKey,
          message,
          customerName,
          customerEmail,
          customerPhone,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setSubmitState("error");
        setErrorMessage(
          payload?.message?.trim() ||
            "We could not send your request. Please try again or contact the contractor."
        );
        return;
      }

      setSubmitState("success");
    } catch {
      setSubmitState("error");
      setErrorMessage(
        "We could not send your request. Please try again or contact the contractor."
      );
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 m-auto w-[min(100%-1.5rem,26rem)] rounded-[14px] border border-[#d5dee8] bg-white p-0 text-[#0b1f33] shadow-[0_24px_60px_rgba(11,31,51,0.22)] backdrop:bg-[#0b1f33]/45"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="px-5 py-4 sm:px-5 sm:py-5">
        {submitState === "success" ? (
          <div data-proposal-request-state="success">
            <h2 id={titleId} className="text-[1.15rem] font-semibold tracking-[-0.02em]">
              {PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_TITLE}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#334155]">
              {PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_BODY}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#64748b]">
              {PROPOSAL_CUSTOMER_PACKET_REQUEST_SUCCESS_NEXT}
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" className={PROPOSAL_PACKET_CTA_PRIMARY} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} data-proposal-request-state="form">
            <h2 id={titleId} className="text-[1.15rem] font-semibold tracking-[-0.02em]">
              {PROPOSAL_CUSTOMER_PACKET_REQUEST_MODAL_TITLE}
            </h2>
            <p className="mt-1.5 text-[13px] text-[#64748b]">
              Tell the contractor you are interested. They will review and confirm details.
            </p>

            <div className="mt-3 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                Package
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-[#0b1f33]">
                {(packageLabel || "Recommended package").trim()}
              </p>
            </div>

            <label htmlFor={messageId} className="mt-3.5 block">
              <span className="text-[12px] font-semibold text-[#475569]">
                {PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_LABEL}
              </span>
              <textarea
                id={messageId}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_MAX}
                rows={3}
                placeholder={PROPOSAL_CUSTOMER_PACKET_REQUEST_MESSAGE_PLACEHOLDER}
                className="mt-1.5 w-full resize-y rounded-[10px] border border-[#d5dee8] bg-white px-3 py-2 text-[13px] text-[#0b1f33] outline-none ring-[#2563eb]/30 placeholder:text-[#94a3b8] focus:border-[#93c5fd] focus:ring-2"
              />
            </label>

            <div className="mt-3 grid gap-2.5">
              <label className="block">
                <span className="text-[12px] font-semibold text-[#475569]">Your name</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  maxLength={120}
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-[10px] border border-[#d5dee8] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#2563eb]/30"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-[#475569]">Email</span>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-[10px] border border-[#d5dee8] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#2563eb]/30"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-[#475569]">Phone</span>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  maxLength={40}
                  autoComplete="tel"
                  className="mt-1.5 w-full rounded-[10px] border border-[#d5dee8] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#93c5fd] focus:ring-2 focus:ring-[#2563eb]/30"
                />
              </label>
            </div>

            {errorMessage ? (
              <p className="mt-3 text-[13px] text-[#b91c1c]" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <p className="mt-3 text-[12px] leading-snug text-[#64748b]">
              This is a request for review only. The contractor will confirm details before
              work begins.
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className={PROPOSAL_PACKET_CTA_SECONDARY}
                onClick={onClose}
                disabled={submitState === "submitting"}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={PROPOSAL_PACKET_CTA_PRIMARY}
                disabled={submitState === "submitting"}
                data-proposal-cta="send-request"
              >
                {submitState === "submitting"
                  ? "Sending…"
                  : PROPOSAL_CUSTOMER_PACKET_REQUEST_SUBMIT_CTA}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
