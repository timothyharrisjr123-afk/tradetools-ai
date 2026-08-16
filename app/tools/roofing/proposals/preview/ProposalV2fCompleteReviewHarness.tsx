"use client";

import { useSearchParams } from "next/navigation";
import { buildProposalPublicProposalErrorViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import { buildProposalPublicGraphDto } from "@/app/lib/proposalPublicGraphDto";
import { buildProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import PublicProposalErrorPage from "@/app/p/[token]/PublicProposalErrorPage";
import PublicProposalPage from "@/app/p/[token]/PublicProposalPage";
import JobCardV2f1ReviewHarness from "@/app/tools/roofing/jobCard/JobCardV2f1ReviewHarness";
import ProposalRevisionPreviewReviewHarness from "./ProposalRevisionPreviewReviewHarness";
import ProposalSentRecordReviewHarness, {
  sentRecordGraph,
} from "./ProposalSentRecordReviewHarness";

const SENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEMPLATE_OPT = "66666666-6666-4666-8666-666666666666";

export default function ProposalV2fCompleteReviewHarness() {
  const searchParams = useSearchParams();
  const surface = (searchParams.get("surface") ?? "job").trim();

  if (surface === "preview") {
    return <ProposalRevisionPreviewReviewHarness />;
  }
  if (surface === "sent") {
    return <ProposalSentRecordReviewHarness />;
  }
  if (surface === "public-superseded") {
    return (
      <div data-v2f-complete-public-superseded>
        <PublicProposalErrorPage
          error={buildProposalPublicProposalErrorViewModel("superseded_token")}
        />
      </div>
    );
  }
  if (surface === "public-current") {
    const graph = sentRecordGraph({
      versionId: SENT_B,
      frozenAt: "2026-07-22T21:31:00.000Z",
      packageLabel: "Enhanced",
    });
    const dto = buildProposalPublicGraphDto(graph, TEMPLATE_OPT);
    const document = buildProposalPublicProposalDocumentViewModel(dto, {
      versionKind: "sent",
    });
    return (
      <div data-v2f-complete-public-current>
        <PublicProposalPage document={document} publicAccessToken="harness-token" />
      </div>
    );
  }

  return <JobCardV2f1ReviewHarness />;
}
