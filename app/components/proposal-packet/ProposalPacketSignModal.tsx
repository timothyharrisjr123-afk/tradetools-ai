"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  formatProposalCustomerAcceptedOnLabel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import type { ProposalSignatureMarkV1 } from "@/app/lib/proposalSignatureMark";
import { proposalSignatureMarkError } from "@/app/lib/proposalSignatureMark";
import {
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_AND_SIGN_CTA,
  PROPOSAL_CUSTOMER_PACKET_SIGNED_SUCCESS_NEXT,
  PROPOSAL_CUSTOMER_PACKET_SIGNED_TITLE,
  PROPOSAL_CUSTOMER_PACKET_SIGN_CLEAR_LABEL,
  PROPOSAL_CUSTOMER_PACKET_SIGN_DRAW_LABEL,
  PROPOSAL_CUSTOMER_PACKET_SIGN_MODAL_TITLE,
  PROPOSAL_CUSTOMER_PACKET_SIGN_NAME_LABEL,
  PROPOSAL_CUSTOMER_PACKET_SIGN_PROPOSAL_CTA,
  PROPOSAL_SIGNATURE_ACKNOWLEDGEMENT_TEXT,
  formatProposalCustomerSignedOnSentence,
} from "@/app/lib/proposalSignatureTypes";
import {
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_CTA_SECONDARY,
} from "./proposalPacketStyles";
import ProposalPacketSignaturePad from "./ProposalPacketSignaturePad";

export type ProposalPacketSignedResult = {
  signedOnLabel: string;
  acceptedOnLabel: string;
  signerPrintedName: string;
};

type ProposalPacketSignModalProps = {
  open: boolean;
  mode: "accept_and_sign" | "sign_only";
  onClose: () => void;
  onSigned: (result: ProposalPacketSignedResult) => void;
  publicAccessToken: string;
  companyName: string | null;
  packageLabel: string;
  totalLabel: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const SAFE_ERROR =
  "We could not sign this proposal. Please try again or contact the contractor.";

/**
 * Public Accept & sign / Sign proposal modal.
 * Submits one POST /api/proposals/sign — never accept-then-sign.
 */
export default function ProposalPacketSignModal({
  open,
  mode,
  onClose,
  onSigned,
  publicAccessToken,
  companyName,
  packageLabel,
  totalLabel,
  customerName = null,
  customerEmail = null,
}: ProposalPacketSignModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signedOnLabel, setSignedOnLabel] = useState<string | null>(null);
  const [name, setName] = useState((customerName ?? "").trim());
  const [acknowledged, setAcknowledged] = useState(false);
  const [mark, setMark] = useState<ProposalSignatureMarkV1 | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      queueMicrotask(() => {
        if (!dialog.open) return;
        setSubmitState("idle");
        setErrorMessage(null);
        setSignedOnLabel(null);
        setName((customerName ?? "").trim());
        setAcknowledged(false);
        setMark(null);
      });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, customerName]);

  const company = (companyName ?? "").trim() || "the contractor";
  const pkg = packageLabel.trim() || "selected package";
  const total = (totalLabel ?? "").trim();
  const cta =
    mode === "sign_only"
      ? PROPOSAL_CUSTOMER_PACKET_SIGN_PROPOSAL_CTA
      : PROPOSAL_CUSTOMER_PACKET_ACCEPT_AND_SIGN_CTA;
  const canSubmit =
    name.trim().length > 0 &&
    acknowledged &&
    mark != null &&
    proposalSignatureMarkError(mark) == null &&
    submitState !== "submitting";

  const submit = async () => {
    if (!canSubmit || !mark) return;
    setSubmitState("submitting");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/proposals/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: publicAccessToken,
          signerPrintedName: name,
          signerEmail: (customerEmail ?? "").trim() || null,
          drawnMark: mark,
          acknowledged: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        signedAt?: string;
        acceptedAt?: string;
        signedOnLabel?: string | null;
        acceptedOnLabel?: string | null;
        signerPrintedName?: string;
      };
      if (!response.ok || payload.ok !== true) {
        setSubmitState("error");
        setErrorMessage(SAFE_ERROR);
        return;
      }
      const signedLabel =
        payload.signedOnLabel ??
        formatProposalCustomerAcceptedOnLabel(payload.signedAt ?? null) ??
        formatProposalCustomerAcceptedOnLabel(new Date().toISOString()) ??
        "today";
      const acceptedLabel =
        payload.acceptedOnLabel ??
        formatProposalCustomerAcceptedOnLabel(payload.acceptedAt ?? null) ??
        signedLabel;
      setSignedOnLabel(signedLabel);
      setSubmitState("success");
      onSigned({
        signedOnLabel: signedLabel,
        acceptedOnLabel: acceptedLabel,
        signerPrintedName: payload.signerPrintedName ?? name.trim(),
      });
    } catch {
      setSubmitState("error");
      setErrorMessage(SAFE_ERROR);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 m-auto w-[min(28rem,calc(100vw-1.5rem))] rounded-[16px] border border-[#e2e8f0] bg-white p-0 shadow-[0_24px_60px_rgba(11,31,51,0.18)] backdrop:bg-[#0b1f33]/40"
      onClose={onClose}
      data-proposal-sign-modal
      data-proposal-sign-mode={mode}
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
          <div data-proposal-sign-success>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
              {PROPOSAL_CUSTOMER_PACKET_SIGNED_TITLE}
            </p>
            <h2 id={titleId} className="mt-1 text-[1.25rem] font-semibold text-[#0b1f33]">
              {formatProposalCustomerSignedOnSentence(signedOnLabel)}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#475569]">
              {PROPOSAL_CUSTOMER_PACKET_SIGNED_SUCCESS_NEXT}
            </p>
            <button type="submit" className={`${PROPOSAL_PACKET_CTA_PRIMARY} mt-5 w-full`}>
              Done
            </button>
          </div>
        ) : (
          <div>
            <h2 id={titleId} className="text-[1.25rem] font-semibold text-[#0b1f33]">
              {PROPOSAL_CUSTOMER_PACKET_SIGN_MODAL_TITLE}
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

            <label className="mt-4 block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                {PROPOSAL_CUSTOMER_PACKET_SIGN_NAME_LABEL}
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-1 w-full rounded-[10px] border border-[#cbd5e1] px-3 py-2 text-[15px] text-[#0b1f33] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                data-proposal-sign-name
                disabled={submitState === "submitting"}
              />
            </label>

            <label className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-[#475569]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#2563eb]"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                data-proposal-sign-ack
                disabled={submitState === "submitting"}
              />
              <span>{PROPOSAL_SIGNATURE_ACKNOWLEDGEMENT_TEXT}</span>
            </label>

            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                {PROPOSAL_CUSTOMER_PACKET_SIGN_DRAW_LABEL}
              </p>
              <div className="mt-1">
                <ProposalPacketSignaturePad
                  disabled={submitState === "submitting"}
                  onChange={setMark}
                />
              </div>
            </div>
            <p className="sr-only">{PROPOSAL_CUSTOMER_PACKET_SIGN_CLEAR_LABEL}</p>

            {errorMessage ? (
              <p className="mt-3 text-[13px] text-[#b91c1c]" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="submit"
                className={PROPOSAL_PACKET_CTA_PRIMARY}
                data-proposal-cta={
                  mode === "sign_only" ? "sign-proposal-confirm" : "accept-and-sign-confirm"
                }
                disabled={!canSubmit}
              >
                {submitState === "submitting" ? "Signing…" : cta}
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
