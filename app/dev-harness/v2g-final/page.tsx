"use client";

import { useSearchParams } from "next/navigation";
import { buildProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import { buildProposalPublicProposalErrorViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import {
  buildV2gMultiPackageDraftGraph,
  buildV2gMultiPackagePublicDto,
  V2G_TEMPLATE_OPT_B,
} from "@/app/lib/proposalV2gReviewFixtures";
import { buildProposalPublicGraphDto } from "@/app/lib/proposalPublicGraphDto";
import { buildProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import PublicProposalErrorPage from "@/app/p/[token]/PublicProposalErrorPage";
import PublicProposalPage from "@/app/p/[token]/PublicProposalPage";
import ProposalCustomerPreviewDocumentView from "@/app/tools/roofing/proposals/preview/ProposalCustomerPreviewDocument";

export default function ProposalV2gFinalReviewHarness() {
  const searchParams = useSearchParams();
  const surface = (searchParams.get("surface") ?? "public-comparison-off").trim();

  if (surface === "public-comparison-off") {
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: false });
    const document = buildProposalPublicProposalDocumentViewModel(dto, { versionKind: "sent" });
    return (
      <div data-v2g-public-comparison-off>
        <PublicProposalPage document={document} publicAccessToken="harness-token" />
      </div>
    );
  }

  if (surface === "public-comparison-on") {
    const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: true });
    const document = buildProposalPublicProposalDocumentViewModel(dto, { versionKind: "sent" });
    return (
      <div data-v2g-public-comparison-on>
        <PublicProposalPage document={document} publicAccessToken="harness-token" />
      </div>
    );
  }

  if (surface === "public-arbitrary-names") {
    const dto = buildV2gMultiPackagePublicDto({
      comparisonEnabled: true,
      optionNames: [
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Essential Care" },
        { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", label: "Signature Series" },
        { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", label: "Legacy Shield" },
      ],
      selectedId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    const document = buildProposalPublicProposalDocumentViewModel(dto, { versionKind: "sent" });
    return (
      <div data-v2g-public-arbitrary-names>
        <PublicProposalPage document={document} publicAccessToken="harness-token" />
      </div>
    );
  }

  if (surface === "public-hidden-scope") {
    const graph = buildV2gMultiPackageDraftGraph({
      includeHiddenLine: true,
      estimateSettings: { show_customer_package_comparison: true },
    });
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    const document = buildProposalPublicProposalDocumentViewModel(dto, { versionKind: "sent" });
    return (
      <div data-v2g-public-hidden-scope>
        <PublicProposalPage document={document} publicAccessToken="harness-token" />
      </div>
    );
  }

  if (surface === "public-superseded") {
    return (
      <div data-v2g-public-superseded>
        <PublicProposalErrorPage
          error={buildProposalPublicProposalErrorViewModel("superseded_token")}
        />
      </div>
    );
  }

  if (surface === "preview-comparison-on") {
    const graph = buildV2gMultiPackageDraftGraph({
      estimateSettings: { show_customer_package_comparison: true },
    });
    const document = buildProposalCustomerPreviewDocument(graph);
    return (
      <div data-v2g-preview-comparison-on className="bg-slate-50 py-6">
        <ProposalCustomerPreviewDocumentView document={document} draftGraph={graph} />
      </div>
    );
  }

  if (surface === "preview-comparison-off") {
    const graph = buildV2gMultiPackageDraftGraph({
      estimateSettings: { show_customer_package_comparison: false },
    });
    const document = buildProposalCustomerPreviewDocument(graph);
    return (
      <div data-v2g-preview-comparison-off className="bg-slate-50 py-6">
        <ProposalCustomerPreviewDocumentView document={document} draftGraph={graph} />
      </div>
    );
  }

  if (surface === "public-legacy-absent") {
    const graph = buildV2gMultiPackageDraftGraph({ omitComparisonKey: true });
    const dto = buildProposalPublicGraphDto(graph, V2G_TEMPLATE_OPT_B);
    const document = buildProposalPublicProposalDocumentViewModel(dto, { versionKind: "sent" });
    return (
      <div data-v2g-public-legacy-absent>
        <PublicProposalPage document={document} publicAccessToken="harness-token" />
      </div>
    );
  }

  const dto = buildV2gMultiPackagePublicDto({ comparisonEnabled: false });
  const document = buildProposalPublicProposalDocumentViewModel(dto, { versionKind: "sent" });
  return (
    <div data-v2g-public-comparison-off>
      <PublicProposalPage document={document} publicAccessToken="harness-token" />
    </div>
  );
}
