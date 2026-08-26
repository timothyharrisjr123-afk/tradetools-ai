import {
  SEND_GATE_PAYMENTS_SETUP_BODY,
  termsRequireOnlineDeposit,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";

export const SEND_GATE_PAYMENTS_SETUP_CODE = "payments_setup_required";

export const SEND_GATE_PAYMENTS_TERMS_UNKNOWN_BODY =
  "Payment terms could not be verified. Refresh and try again.";

export type OnlineDepositSendReadiness = {
  onlineDepositRequired: boolean;
  chargesEnabled: boolean;
  blocked: boolean;
  message: string | null;
  termsKnown: boolean;
};

export function resolveOnlineDepositSendReadiness(input: {
  terms: ProposalPaymentTerms | null;
  chargesEnabled: boolean;
  termsKnown?: boolean;
}): OnlineDepositSendReadiness {
  const termsKnown = input.termsKnown !== false;
  if (!termsKnown) {
    return {
      onlineDepositRequired: false,
      chargesEnabled: input.chargesEnabled,
      blocked: true,
      message: SEND_GATE_PAYMENTS_TERMS_UNKNOWN_BODY,
      termsKnown: false,
    };
  }

  const onlineDepositRequired = input.terms
    ? termsRequireOnlineDeposit(input.terms)
    : false;
  const blocked = onlineDepositRequired && !input.chargesEnabled;
  return {
    onlineDepositRequired,
    chargesEnabled: input.chargesEnabled,
    blocked,
    message: blocked ? SEND_GATE_PAYMENTS_SETUP_BODY : null,
    termsKnown: true,
  };
}
