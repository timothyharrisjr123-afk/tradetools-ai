/**
 * Thin acceptance-obligation helper.
 *
 * Canonical acceptance exists → invoke open_job_deposit_from_acceptance_v1.
 * Amount, uncovered obligation, collectible, and contractual total stay DB/RPC
 * authority. This module must not calculate money.
 */

import "server-only";

import {
  openJobDepositFromAcceptanceViaAdmin,
  type OpenJobDepositFromAcceptanceResult,
} from "@/app/lib/proposalPaymentTermsPersistence";

export async function openCanonicalDepositFromAcceptedProposal(input: {
  companyId: string;
  acceptanceId: string;
}): Promise<OpenJobDepositFromAcceptanceResult> {
  return openJobDepositFromAcceptanceViaAdmin({
    companyId: input.companyId,
    acceptanceId: input.acceptanceId,
  });
}
