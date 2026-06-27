/**
 * Proposal identity echo — pure live composition and send-prep coordination (Stage B).
 *
 * No DB, React, pricing math, freeze/send, or token behavior.
 */

import type { ProposalContextEchoCustomerFields } from "@/app/lib/proposalCustomerContext";
import { buildProposalCompanyContextEchoFromProfile } from "@/app/lib/companyBrandingProfile";
import {
  buildFullProposalIdentityEchoSnapshot,
  diffProposalIdentityEcho,
  type ProposalIdentityEchoDiff,
  type ProposalIdentityEchoKey,
  type ProposalIdentityEchoSnapshot,
  type ProposalIdentityEchoValue,
} from "@/app/lib/proposalIdentityEcho";

export type LoadLiveProposalIdentityEchoInput = {
  companyId: string;
  proposalId: string;
  jobId?: string | null;
};

export function composeLiveProposalIdentityEchoFromSources(input: {
  companyEcho: ReturnType<typeof buildProposalCompanyContextEchoFromProfile>;
  customerEcho: ProposalContextEchoCustomerFields;
  jobName: string | null;
  addressFormatted: string | null;
  templateName: string | null;
  proposalNumber: string | null;
  proposalTitle: string | null;
}): Record<ProposalIdentityEchoKey, ProposalIdentityEchoValue> {
  return buildFullProposalIdentityEchoSnapshot({
    company_name: input.companyEcho.company_name,
    company_logo_url: input.companyEcho.company_logo_url,
    company_phone: input.companyEcho.company_phone,
    company_email: input.companyEcho.company_email,
    company_website: input.companyEcho.company_website,
    company_address: input.companyEcho.company_address,
    customer_name: input.customerEcho.customer_name,
    customer_email: input.customerEcho.customer_email,
    customer_phone: input.customerEcho.customer_phone,
    customer_address: input.customerEcho.customer_address,
    address_formatted: input.addressFormatted,
    job_name: input.jobName,
    template_name: input.templateName,
    proposal_number: input.proposalNumber,
    proposal_title: input.proposalTitle,
  });
}

export type EnsureProposalIdentityEchoFreshResult = {
  identityRestamped: boolean;
  changedFields: ProposalIdentityEchoDiff[];
};

export type EnsureProposalIdentityEchoFreshInput = {
  companyId: string;
  proposalId: string;
  jobId: string;
  hasSignedSnapshot: boolean;
};

export type EnsureProposalIdentityEchoFreshDeps = {
  restampDraftProposalIdentityEcho: (
    companyId: string,
    proposalId: string,
    input?: { liveIdentity?: ProposalIdentityEchoSnapshot; jobId?: string | null }
  ) => Promise<{
    restamped: boolean;
    changedFields: ProposalIdentityEchoDiff[];
  }>;
};

export async function ensureProposalIdentityEchoFreshBeforeSendPrep(
  input: EnsureProposalIdentityEchoFreshInput,
  deps: EnsureProposalIdentityEchoFreshDeps
): Promise<EnsureProposalIdentityEchoFreshResult> {
  if (input.hasSignedSnapshot) {
    return { identityRestamped: false, changedFields: [] };
  }

  const result = await deps.restampDraftProposalIdentityEcho(input.companyId, input.proposalId, {
    jobId: input.jobId,
  });

  return {
    identityRestamped: result.restamped,
    changedFields: result.changedFields,
  };
}

export { diffProposalIdentityEcho };
