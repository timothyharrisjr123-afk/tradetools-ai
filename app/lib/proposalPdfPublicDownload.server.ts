/**
 * Server entry for customer / public Proposal PDF download.
 */

import "server-only";

import {
  buildDefaultPublicProposalPdfDeps,
  generatePublicProposalPdf,
  type PublicProposalPdfResult,
} from "@/app/lib/proposalPdfPublicDownload";
import { resolveProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessRpcStore.server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getPublicProposalVersionGraph } from "@/app/lib/proposalVersionGraphStore.server";

export async function generatePublicProposalPdfForToken(
  rawToken: string
): Promise<PublicProposalPdfResult> {
  const supabase = createAdminClient();
  const deps = buildDefaultPublicProposalPdfDeps(
    supabase,
    resolveProposalPublicAccessToken,
    getPublicProposalVersionGraph
  );
  return generatePublicProposalPdf({ rawToken, deps });
}
