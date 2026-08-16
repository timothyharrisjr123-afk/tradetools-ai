/**
 * R3D — Customer signature contracts.
 *
 * Request ≠ acceptance ≠ signature ≠ payment ≠ scheduling.
 * Signature binds to one proposal_acceptances row (frozen sent version + option).
 * Signature never moves Job stage and never writes proposals.signed_version_id.
 */

export const RECORD_PROPOSAL_SIGNATURE_RPC_V1 = "record_proposal_signature_v1";

export const PROPOSAL_SIGNATURE_SIGNER_SLOT = "customer_primary" as const;
export const PROPOSAL_SIGNATURE_SOURCE = "public_token" as const;
export const PROPOSAL_SIGNATURE_METHOD = "drawn_signature" as const;

export const PROPOSAL_SIGNATURE_ACKNOWLEDGEMENT_KEY =
  "fielddive_proposal_signature_v1" as const;

export const PROPOSAL_SIGNATURE_ACKNOWLEDGEMENT_TEXT =
  "I accept and sign this proposal as shown, including the selected package and total.";

export const PROPOSAL_SIGNATURE_NAME_MAX = 120;
export const PROPOSAL_SIGNATURE_EMAIL_MAX = 254;

export const PROPOSAL_CUSTOMER_PACKET_ACCEPT_AND_SIGN_CTA = "Accept & sign";
export const PROPOSAL_CUSTOMER_PACKET_SIGN_PROPOSAL_CTA = "Sign proposal";
export const PROPOSAL_CUSTOMER_PACKET_SIGNED_TITLE = "Proposal signed";
export const PROPOSAL_CUSTOMER_PACKET_SIGN_MODAL_TITLE = "Sign this proposal";
export const PROPOSAL_CUSTOMER_PACKET_SIGN_NAME_LABEL = "Your name";
export const PROPOSAL_CUSTOMER_PACKET_SIGN_DRAW_LABEL = "Signature";
export const PROPOSAL_CUSTOMER_PACKET_SIGN_CLEAR_LABEL = "Clear";
export const PROPOSAL_CUSTOMER_PACKET_SIGNED_SUCCESS_NEXT =
  "The contractor has your signed proposal.";

export function formatProposalCustomerSignedOnSentence(
  signedOnLabel: string | null | undefined
): string {
  const label = (signedOnLabel ?? "").trim();
  return label ? `Signed on ${label}` : PROPOSAL_CUSTOMER_PACKET_SIGNED_TITLE;
}

export const PROPOSAL_SIGNATURE_INVALID_CODES = [
  "invalid_hash",
  "not_found",
  "revoked",
  "superseded",
  "expired",
  "invalid_version",
  "invalid_binding",
  "proposal_unavailable",
  "version_not_frozen",
  "option_not_on_version",
  "option_not_selected_frozen",
  "job_mismatch",
  "draft_version",
  "malformed",
  "invalid_payload",
  "forbidden_payload_keys",
  "invalid_customer_name",
  "invalid_customer_email",
  "invalid_signer_name",
  "invalid_signer_email",
  "invalid_mark",
  "invalid_mark_version",
  "mark_too_large",
  "mark_too_small",
  "idempotency_conflict",
] as const;

export type ProposalSignatureInvalidCode =
  (typeof PROPOSAL_SIGNATURE_INVALID_CODES)[number];
