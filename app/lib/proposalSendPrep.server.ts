/**
 * R18D2 — Server-only entry for contractor customer send link prep.
 */

import "server-only";

import { adaptProposalDraftGraphToBuilderPreview } from "@/app/lib/proposalDraftGraphAdapter";
import { getSelectedMeasurementForJob } from "@/app/lib/measurementStore";
import { buildProposalSendSnapshotServerDeps } from "@/app/lib/proposalIdentityEcho.server";
import {
  prepareProposalCustomerSendLink,
  type PrepareProposalCustomerSendLinkInput,
  type PrepareProposalCustomerSendLinkResult,
} from "@/app/lib/proposalSendPrep";
import { mintProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMintStore.server";
import { getDraftGraph } from "@/app/lib/proposalRecordStore";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";
import { readDraftOnlineDepositSendReadiness } from "@/app/lib/proposalPaymentTermsPersistence";
import {
  SEND_GATE_PAYMENTS_SETUP_BODY,
} from "@/app/lib/proposalPaymentTerms";
import { SEND_GATE_PAYMENTS_SETUP_CODE } from "@/app/lib/proposalPaymentSendReadiness";
import { createClient } from "@/app/lib/supabase/server";

export type {
  PrepareProposalCustomerSendLinkInput,
  PrepareProposalCustomerSendLinkResult,
} from "@/app/lib/proposalSendPrep";

export async function prepareProposalCustomerSendLinkForContractor(
  input: PrepareProposalCustomerSendLinkInput
): Promise<PrepareProposalCustomerSendLinkResult> {
  const supabase = await createClient();

  let pricingStale = input.pricingStale === true;
  if (input.pricingStale == null) {
    const graph = await getDraftGraph(input.companyId, input.proposalId, {
      getSupabase: () => supabase,
    });
    if (graph) {
      const measurement = await getSelectedMeasurementForJob(input.jobId, supabase);
      const adapter = adaptProposalDraftGraphToBuilderPreview(graph);
      pricingStale = deriveProposalPricingStale({
        snapshotMeasurementId: adapter.snapshotMeasurementRecordId,
        currentMeasurementId: measurement?.id ?? null,
        snapshotUpdatedAt: graph.proposal.updated_at,
        measurementUpdatedAt: measurement?.updated_at ?? null,
      }).stale;
    }
  }

  const payments = await readDraftOnlineDepositSendReadiness(supabase, {
    companyId: input.companyId,
    proposalId: input.proposalId,
  });
  if (payments.blocked) {
    return {
      ok: false,
      message: SEND_GATE_PAYMENTS_SETUP_BODY,
      code: SEND_GATE_PAYMENTS_SETUP_CODE,
    };
  }

  return prepareProposalCustomerSendLink(
    { ...input, pricingStale },
    {
      ...buildProposalSendSnapshotServerDeps(supabase),
      mintToken: mintProposalPublicAccessToken,
    }
  );
}
