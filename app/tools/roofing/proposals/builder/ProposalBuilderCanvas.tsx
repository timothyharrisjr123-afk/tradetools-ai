import { BUILDER_CANVAS_PLACEHOLDER, BUILDER_HERO_CARD } from "./proposalBuilderConstants";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { STARTER_TEMPLATE_DISPLAY_NAME } from "@/app/tools/roofing/templates/templatesSetupUtils";

type ProposalBuilderCanvasProps = {
  starterGraph: ProposalTemplateGraph | null;
};

export default function ProposalBuilderCanvas({ starterGraph }: ProposalBuilderCanvasProps) {
  const templateName = starterGraph?.template.name ?? STARTER_TEMPLATE_DISPLAY_NAME;
  const optionCount = starterGraph?.options.length ?? 0;

  return (
    <div className={`${BUILDER_HERO_CARD} space-y-4`}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Proposal canvas</h2>
        <p className="mt-1 text-xs text-slate-500">
          Placeholder workspace — customer-facing layout and editable line items come in 3H-2+.
        </p>
      </div>
      <div className={BUILDER_CANVAS_PLACEHOLDER}>
        <p className="text-sm font-medium text-slate-700">{templateName}</p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">
          {optionCount > 0
            ? `${optionCount} option tabs will appear here (Standard, Enhanced, Premium).`
            : "Template options will appear here after template graph loads."}
        </p>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
          No pricing totals · no PDF · no send
        </p>
      </div>
    </div>
  );
}
