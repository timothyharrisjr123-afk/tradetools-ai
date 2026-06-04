import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSection } from "@/app/lib/proposalTemplateTypes";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import {
  buildCatalogItemById,
  buildLinePreviewRowsForSection,
  isLineItemsSectionKind,
  truncatePreviewText,
  type ProposalQuantityPreviewContext,
} from "@/app/lib/proposalBuilderPreview";
import ProposalBuilderLinePreviewTable from "./ProposalBuilderLinePreviewTable";
import { BUILDER_DOCUMENT_SECTION, BUILDER_DOCUMENT_TEXT_BLOCK } from "./proposalBuilderConstants";

type ProposalBuilderSectionPreviewProps = {
  graph: ProposalTemplateGraph;
  section: ProposalTemplateSection;
  catalogItems: CatalogItem[];
  measurementHandoff: MeasurementProposalHandoff | null;
  measurementQuantityMap: MeasurementQuantityMap | null;
};

export default function ProposalBuilderSectionPreview({
  graph,
  section,
  catalogItems,
  measurementHandoff,
  measurementQuantityMap,
}: ProposalBuilderSectionPreviewProps) {
  const title = (section.customer_title ?? section.name).trim() || section.name;
  const catalogById = buildCatalogItemById(catalogItems);

  const quantityContext: ProposalQuantityPreviewContext = {
    measurementHandoff,
    quantityMap: measurementQuantityMap,
  };

  const bodyMarkdown = (section.content?.body_markdown ?? "").trim();
  const showTextBlock = !isLineItemsSectionKind(section.kind) && bodyMarkdown.length > 0;

  const lineRows = isLineItemsSectionKind(section.kind)
    ? buildLinePreviewRowsForSection(graph, section.id, catalogById, quantityContext)
    : [];

  return (
    <section className={BUILDER_DOCUMENT_SECTION}>
      <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>

      {showTextBlock ? (
        <div className={BUILDER_DOCUMENT_TEXT_BLOCK}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {truncatePreviewText(bodyMarkdown, 1200)}
          </p>
        </div>
      ) : null}

      {isLineItemsSectionKind(section.kind) ? (
        <div className="mt-1">
          <ProposalBuilderLinePreviewTable rows={lineRows} sectionTitle={title} />
        </div>
      ) : null}

      {!showTextBlock && !isLineItemsSectionKind(section.kind) ? (
        <p className="text-sm italic text-slate-500">No content for this section.</p>
      ) : null}
    </section>
  );
}
