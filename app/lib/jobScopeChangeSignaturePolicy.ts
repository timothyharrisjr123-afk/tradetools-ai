/**
 * Astra G9 — signature gate for customer scope-change authorization.
 *
 * Reuses the existing proposal/agreement signature posture:
 * signature is optional evidence only — there is no company-level
 * "always require signature" policy in current product truth
 * (see proposalAgreementProjection).
 *
 * Do not invent a new always-required signature gate for scope changes.
 */

/**
 * Whether the public authorize UI must collect a signature before approve.
 * Today: never required (mirrors proposal accept path).
 * Kept as a named helper so future company policy can plug in without UX churn.
 */
export function scopeChangeRequiresCustomerSignature(_input?: {
  companyId?: string | null;
  /** Reserved for future company/proposal signature policy rows. */
  companySignaturePolicy?: "optional" | "required" | null;
}): boolean {
  const policy = _input?.companySignaturePolicy ?? "optional";
  return policy === "required";
}
