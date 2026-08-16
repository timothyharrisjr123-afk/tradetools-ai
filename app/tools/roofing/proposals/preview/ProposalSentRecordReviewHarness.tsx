"use client";

import { useSearchParams } from "next/navigation";
import {
  buildProposalCustomerPreviewDocument,
  resolveProposalCustomerPreviewSelectedTotalLabel,
} from "@/app/lib/proposalCustomerPreviewViewModel";
import { buildProposalPreviewSentFrozenChrome } from "@/app/lib/proposalPreviewSentFrozenChrome";
import { buildProposalPreviewSentRecordChrome } from "@/app/lib/proposalPreviewSentRecord";
import { buildRevisionChangeSummary } from "@/app/lib/proposalRevisionChangeSummary";
import {
  V2F_REVIEW_SENT_A,
  V2F_REVIEW_SENT_B,
  v2fReviewSentVersionGraph,
} from "@/app/lib/proposalV2fCompleteReviewFixtures";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import ProposalCustomerPreviewDocumentView from "./ProposalCustomerPreviewDocument";
import ProposalPreviewChangeSummary from "./ProposalPreviewChangeSummary";
import ProposalPreviewHeader from "./ProposalPreviewHeader";
import ProposalPreviewReviewSurface from "./ProposalPreviewReviewSurface";
import {
  PREVIEW_COMMAND_SURFACE,
  PREVIEW_WORKSPACE_BG,
  PREVIEW_WORKSPACE_STAGE,
} from "./proposalPreviewWorkspaceStyles";

export {
  sentRecordGraph,
  V2F_REVIEW_SENT_A as SENT_A,
  V2F_REVIEW_SENT_B as SENT_B,
} from "@/app/lib/proposalV2fCompleteReviewFixtures";

function resolveRecord(versionParam: string | null) {
  if (versionParam === V2F_REVIEW_SENT_A) {
    return {
      versionId: V2F_REVIEW_SENT_A,
      deliveryLabel: "Delivered",
      graph: v2fReviewSentVersionGraph(V2F_REVIEW_SENT_A),
    };
  }
  return {
    versionId: V2F_REVIEW_SENT_B,
    deliveryLabel: "Emailed",
    graph: v2fReviewSentVersionGraph(V2F_REVIEW_SENT_B),
  };
}

export default function ProposalSentRecordReviewHarness() {
  const searchParams = useSearchParams();
  const record = resolveRecord(searchParams.get("version"));
  const graph = record.graph;
  const document = buildProposalCustomerPreviewDocument(graph, {
    pricingStale: { stale: false, reason: null },
  });
  const estimatePage = document.pages.find((page) => page.kind === "estimate");
  const selectedPackageLabel =
    estimatePage?.kind === "estimate" ? estimatePage.selectedOptionLabel : null;
  const totalLabel = resolveProposalCustomerPreviewSelectedTotalLabel(graph);
  const sentRecordChrome = buildProposalPreviewSentRecordChrome({
    frozenAt: graph.version.frozen_at,
    deliveryLabel: record.deliveryLabel,
  });
  const sentFrozenChrome = buildProposalPreviewSentFrozenChrome({
    latestSentVersionId: graph.proposal.latest_sent_version_id,
    lastSentFrozenAt: graph.version.frozen_at,
  });
  const previousGraph =
    record.versionId === V2F_REVIEW_SENT_B
      ? v2fReviewSentVersionGraph(V2F_REVIEW_SENT_A)
      : null;
  const changeSummary = previousGraph
    ? buildRevisionChangeSummary({
        mode: "sent_record",
        current: graph,
        previous: previousGraph,
      })
    : null;

  return (
    <FieldDiveAppShell activeNav="jobs">
      <div
        className={PREVIEW_WORKSPACE_BG}
        data-preview-contractor-workspace
        data-v2f2-sent-record-harness
        data-preview-sent-record="true"
        data-sent-record-version={record.versionId}
      >
        <div
          className={`${PREVIEW_WORKSPACE_STAGE} space-y-3 pt-3 sm:pt-4`}
          data-preview-workspace-layout
        >
          <div className={PREVIEW_COMMAND_SURFACE} data-preview-command-surface>
            <ProposalPreviewHeader
              builderHref="#job-card"
              backHref="/dev-harness/v2f1-job-card?case=sent"
              customerName="Jordan Hale"
              projectAddress="1842 E 31st St, Tulsa, OK"
              selectedPackageLabel={selectedPackageLabel}
              totalLabel={totalLabel}
              sentFrozenChrome={sentFrozenChrome}
              sentRecordChrome={sentRecordChrome}
              onSendSharing={() => undefined}
              showSendSharing={false}
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
        </div>
      </div>
    </FieldDiveAppShell>
  );
}
