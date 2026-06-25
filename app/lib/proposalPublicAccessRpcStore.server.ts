/**
 * R18C3A — Server-only entry points for public proposal access RPC store.
 *
 * Routes and server actions import from this module only — not from persistence directly.
 */

import "server-only";

import {
  recordProposalCustomerViewViaRpc,
  resolveProposalPublicAccessTokenViaRpc,
  type ProposalPublicAccessCustomerViewMetadata,
  type ProposalPublicAccessRecordViewResult,
  type ProposalPublicAccessResolveResult,
} from "@/app/lib/proposalPublicAccessRpcPersistence";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type {
  ProposalPublicAccessCustomerViewMetadata,
  ProposalPublicAccessFailure,
  ProposalPublicAccessFailureCode,
  ProposalPublicAccessRecordViewResult,
  ProposalPublicAccessRecordViewSuccess,
  ProposalPublicAccessResolveResult,
  ProposalPublicAccessResolveSuccess,
} from "@/app/lib/proposalPublicAccessRpcPersistence";

export {
  PROPOSAL_PUBLIC_ACCESS_FAILURE_CODES,
  ProposalPublicAccessRpcStoreError,
  RECORD_PROPOSAL_CUSTOMER_VIEW_RPC_V1,
  RESOLVE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
} from "@/app/lib/proposalPublicAccessRpcPersistence";

export async function resolveProposalPublicAccessToken(
  rawToken: string
): Promise<ProposalPublicAccessResolveResult> {
  return resolveProposalPublicAccessTokenViaRpc(createAdminClient(), rawToken);
}

export async function recordProposalCustomerView(
  rawToken: string,
  metadata: ProposalPublicAccessCustomerViewMetadata = {}
): Promise<ProposalPublicAccessRecordViewResult> {
  return recordProposalCustomerViewViaRpc(createAdminClient(), rawToken, metadata);
}
