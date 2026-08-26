import {
  SEND_GATE_PAYMENTS_SETUP_BODY,
  termsRequireOnlineDeposit,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";

export const SEND_GATE_PAYMENTS_SETUP_CODE = "payments_setup_required";

export type OnlineDepositSendReadiness = {
  onlineDepositRequired: boolean;
  chargesEnabled: boolean;
  blocked: boolean;
  message: string | null;
};

export function resolveOnlineDepositSendReadiness(input: {
  terms: ProposalPaymentTerms | null;
  chargesEnabled: boolean;
}): OnlineDepositSendReadiness {
  const onlineDepositRequired = input.terms
    ? termsRequireOnlineDeposit(input.terms)
    : false;
  const blocked = onlineDepositRequired && !input.chargesEnabled;
  return {
    onlineDepositRequired,
    chargesEnabled: input.chargesEnabled,
    blocked,
    message: blocked ? SEND_GATE_PAYMENTS_SETUP_BODY : null,
  };
}
