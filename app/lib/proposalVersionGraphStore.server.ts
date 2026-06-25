/**
 * R18C4B — Server-only sent/signed proposal version graph loader for public routes.
 *
 * Uses service_role Supabase via createAdminClient() — not the browser-only client.
 * Token-bound reads only; no draft graph, no mutations.
 */

import "server-only";

import {
  getProposalVersionGraph,
  type GetProposalVersionGraphOptions,
  type ProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type PublicProposalVersionGraphOptions = GetProposalVersionGraphOptions & {
  requireSentVersion: true;
};

/**
 * Load a sent/signed proposal version graph for public token orchestration.
 * Caller must pass company/proposal/version IDs from resolveProposalPublicAccessToken only.
 */
export async function getPublicProposalVersionGraph(
  companyId: string,
  proposalId: string,
  versionId: string,
  options: PublicProposalVersionGraphOptions
): Promise<ProposalVersionGraph | null> {
  return getProposalVersionGraph(companyId, proposalId, versionId, options, {
    getSupabase: () => createAdminClient(),
  });
}
