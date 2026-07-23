/**
 * R3B1 — Server-only entry for customer package request RPC.
 */

import "server-only";

import {
  recordProposalCustomerRequestViaRpc,
  type ProposalCustomerRequestRecordResult,
  type ProposalCustomerRequestSubmitInput,
} from "@/app/lib/proposalCustomerRequestPersistence";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type {
  ProposalCustomerRequestFailure,
  ProposalCustomerRequestFailureCode,
  ProposalCustomerRequestIntent,
  ProposalCustomerRequestRecordResult,
  ProposalCustomerRequestRecordSuccess,
  ProposalCustomerRequestSubmitInput,
} from "@/app/lib/proposalCustomerRequestPersistence";

export {
  PROPOSAL_CUSTOMER_REQUEST_FAILURE_CODES,
  PROPOSAL_CUSTOMER_REQUEST_INTENTS,
  PROPOSAL_CUSTOMER_REQUEST_REVIEW_STATUSES,
  PROPOSAL_CUSTOMER_REQUEST_STATUSES,
  ProposalCustomerRequestStoreError,
  RECORD_PROPOSAL_CUSTOMER_REQUEST_RPC_V1,
  UPDATE_PROPOSAL_CUSTOMER_REQUEST_STATUS_RPC_V1,
  normalizeCustomerRequestSubmitInput,
  parseProposalCustomerRequestRpcResult,
  parseProposalCustomerRequestStatusUpdateRpcResult,
} from "@/app/lib/proposalCustomerRequestPersistence";

export async function recordProposalCustomerRequest(
  rawToken: string,
  input: ProposalCustomerRequestSubmitInput
): Promise<ProposalCustomerRequestRecordResult> {
  return recordProposalCustomerRequestViaRpc(createAdminClient(), rawToken, input);
}
