/**
 * R18C3B — Server-only entry points for public proposal access token minting.
 *
 * Routes and future Send/delivery code import from this module only — not from persistence directly.
 */

import "server-only";

import { generateProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMint";
import {
  mintAndSupersedeProposalPublicAccessTokenViaRpc,
  mintProposalPublicAccessTokenViaRpc,
  type ProposalPublicAccessEmailSendMintRpcResult,
  type ProposalPublicAccessMintRequest,
  type ProposalPublicAccessMintRpcResult,
} from "@/app/lib/proposalPublicAccessTokenMintPersistence";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type ProposalPublicAccessMintSuccess = Extract<
  ProposalPublicAccessMintRpcResult,
  { ok: true }
> & {
  raw_token: string;
};

export type ProposalPublicAccessMintResult =
  | ProposalPublicAccessMintSuccess
  | Extract<ProposalPublicAccessMintRpcResult, { ok: false }>;

export type ProposalPublicAccessEmailSendMintSuccess = Extract<
  ProposalPublicAccessEmailSendMintRpcResult,
  { ok: true }
> & {
  raw_token: string;
};

export type ProposalPublicAccessEmailSendMintResult =
  | ProposalPublicAccessEmailSendMintSuccess
  | Extract<ProposalPublicAccessEmailSendMintRpcResult, { ok: false }>;

export type {
  ProposalPublicAccessEmailSendMintFailure,
  ProposalPublicAccessEmailSendMintFailureCode,
  ProposalPublicAccessEmailSendMintRpcSuccess,
  ProposalPublicAccessMintFailure,
  ProposalPublicAccessMintFailureCode,
  ProposalPublicAccessMintRequest,
  ProposalPublicAccessMintRpcSuccess,
} from "@/app/lib/proposalPublicAccessTokenMintPersistence";

export {
  MINT_AND_SUPERSEDE_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
  MINT_PROPOSAL_PUBLIC_ACCESS_TOKEN_RPC_V1,
  PROPOSAL_PUBLIC_ACCESS_EMAIL_SEND_MINT_FAILURE_CODES,
  PROPOSAL_PUBLIC_ACCESS_MINT_FAILURE_CODES,
  ProposalPublicAccessTokenMintPersistenceError,
} from "@/app/lib/proposalPublicAccessTokenMintPersistence";

export async function mintProposalPublicAccessToken(
  input: ProposalPublicAccessMintRequest
): Promise<ProposalPublicAccessMintResult> {
  const rawToken = generateProposalPublicAccessToken();
  const rpcResult = await mintProposalPublicAccessTokenViaRpc(
    createAdminClient(),
    rawToken,
    input
  );

  if (!rpcResult.ok) {
    return rpcResult;
  }

  return {
    ...rpcResult,
    raw_token: rawToken,
  };
}

export async function mintAndSupersedeProposalPublicAccessToken(
  input: ProposalPublicAccessMintRequest
): Promise<ProposalPublicAccessEmailSendMintResult> {
  const rawToken = generateProposalPublicAccessToken();
  const rpcResult = await mintAndSupersedeProposalPublicAccessTokenViaRpc(
    createAdminClient(),
    rawToken,
    input
  );

  if (!rpcResult.ok) {
    return rpcResult;
  }

  return {
    ...rpcResult,
    raw_token: rawToken,
  };
}
