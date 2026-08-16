"use client";

import { useSearchParams } from "next/navigation";
import {
  buildProposalCustomerPreviewDocument,
  resolveProposalCustomerPreviewSelectedTotalLabel,
} from "@/app/lib/proposalCustomerPreviewViewModel";
import { isMutableDraftDirtyAfterSentFreeze } from "@/app/lib/proposalContractorLifecycle";
import { buildProposalPreviewSentFrozenChrome } from "@/app/lib/proposalPreviewSentFrozenChrome";
import { buildRevisionChangeSummary } from "@/app/lib/proposalRevisionChangeSummary";
import {
  V2F_REVIEW_DRAFT_UPDATED_AT,
  V2F_REVIEW_JOB_ID,
  V2F_REVIEW_SENT_A,
  V2F_REVIEW_SENT_A_FROZEN_AT,
  V2F_REVIEW_SENT_B,
  asRevisionPreviewDraftGraph,
  v2fReviewSentVersionGraph,
} from "@/app/lib/proposalV2fCompleteReviewFixtures";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import ProposalCustomerPreviewDocumentView from "./ProposalCustomerPreviewDocument";
import ProposalCustomerPreviewSendSharingDrawer from "./ProposalCustomerPreviewSendSharingDrawer";
import ProposalPreviewChangeSummary from "./ProposalPreviewChangeSummary";
import ProposalPreviewHeader from "./ProposalPreviewHeader";
import ProposalPreviewReadinessSummary from "./ProposalPreviewReadinessSummary";
import ProposalPreviewReviewSurface from "./ProposalPreviewReviewSurface";
import {
  PREVIEW_COMMAND_SURFACE,
  PREVIEW_WORKSPACE_BG,
  PREVIEW_WORKSPACE_STAGE,
} from "./proposalPreviewWorkspaceStyles";

const HARNESS_CASES = ["unchanged", "changes", "send"] as const;
type HarnessCase = (typeof HARNESS_CASES)[number];

function isHarnessCase(value: string | null): value is HarnessCase {
  return HARNESS_CASES.includes(value as HarnessCase);
}

export default function ProposalRevisionPreviewReviewHarness() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("case");
  const caseId: HarnessCase = isHarnessCase(raw) ? raw : "changes";
  const previous = v2fReviewSentVersionGraph(V2F_REVIEW_SENT_A);
  const current =
    caseId === "unchanged"
      ? previous
      : v2fReviewSentVersionGraph(V2F_REVIEW_SENT_B);
  const draftUpdatedAt =
    caseId === "unchanged" ? V2F_REVIEW_SENT_A_FROZEN_AT : V2F_REVIEW_DRAFT_UPDATED_AT;
  const graph = asRevisionPreviewDraftGraph(current, {
    latestSentVersionId: V2F_REVIEW_SENT_A,
    draftUpdatedAt,
  });
  const document = buildProposalCustomerPreviewDocument(graph, {
    pricingStale: { stale: false, reason: null },
  });
  const estimatePage = document.pages.find((page) => page.kind === "estimate");
  const selectedPackageLabel =
    estimatePage?.kind === "estimate" ? estimatePage.selectedOptionLabel : null;
  const totalLabel = resolveProposalCustomerPreviewSelectedTotalLabel(graph);
  const lastSentFrozenAt = V2F_REVIEW_SENT_A_FROZEN_AT;
  const sentFrozenChrome = buildProposalPreviewSentFrozenChrome({
    latestSentVersionId: V2F_REVIEW_SENT_A,
    lastSentFrozenAt,
  });
  const changeSummary = buildRevisionChangeSummary({
    mode: "revision_preview",
    current: graph,
    previous,
  });
  const isRevisionSend = isMutableDraftDirtyAfterSentFreeze({
    draftUpdatedAt,
    latestSentFrozenAt: lastSentFrozenAt,
  });

  return (
    <FieldDiveAppShell activeNav="jobs">
      <div
        className={PREVIEW_WORKSPACE_BG}
        data-preview-contractor-workspace
        data-v2f-revision-preview-harness
        data-v2f-case={caseId}
      >
        <div className={`${PREVIEW_WORKSPACE_STAGE} space-y-3 pt-3 sm:pt-4`}>
          <div className={PREVIEW_COMMAND_SURFACE} data-preview-command-surface>
            <ProposalPreviewHeader
              builderHref="#builder"
              customerName="Jordan Hale"
              projectAddress="1842 E 31st St, Tulsa, OK"
              selectedPackageLabel={selectedPackageLabel}
              totalLabel={totalLabel}
              sentFrozenChrome={sentFrozenChrome}
              onSendSharing={() => undefined}
              showSendSharing
            />
            <ProposalPreviewReadinessSummary
              blockingLineCount={0}
              pricingComplete
              hasRecipientEmail
              builderHref="#builder"
              companyLogoMissing={false}
            />
            {changeSummary ? <ProposalPreviewChangeSummary summary={changeSummary} /> : null}
          </div>
          <ProposalPreviewReviewSurface>
            <ProposalCustomerPreviewDocumentView
              document={document}
              draftGraph={graph}
              catalogItems={[]}
            />
          </ProposalPreviewReviewSurface>
          {caseId === "send" ? (
            <ProposalCustomerPreviewSendSharingDrawer
              open
              onClose={() => undefined}
              jobId={V2F_REVIEW_JOB_ID}
              proposalId={graph.proposal.id}
              graph={graph}
              job={null}
              previewReadiness={document.readiness}
              pricingStale={false}
              emailDeliveryConfigured
              builderHref="#builder"
              sentFrozenChrome={sentFrozenChrome}
              isRevisionSend={isRevisionSend}
            />
          ) : null}
        </div>
      </div>
    </FieldDiveAppShell>
  );
}
