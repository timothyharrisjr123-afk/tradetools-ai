import { TEMPLATES_CREATE_ANOTHER_ACTION } from "./templatesWorkspaceFlow";

type TemplatesPageHeaderProps = {
  onAddTemplate?: () => void;
  /** Once a usable template exists, creating another is a secondary task. */
  hasUsableTemplate?: boolean;
  addTemplateDisabled?: boolean;
  addTemplateDisabledTitle?: string;
};

export default function TemplatesPageHeader({
  onAddTemplate,
  hasUsableTemplate = false,
  addTemplateDisabled = false,
  addTemplateDisabledTitle,
}: TemplatesPageHeaderProps) {
  return (
    <header
      className="flex flex-wrap items-start justify-between gap-3"
      data-templates-page-header
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Templates
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-600">
          Reusable setups for proposals you start from a Job Card.
        </p>
      </div>
      {onAddTemplate ? (
        <button
          type="button"
          onClick={onAddTemplate}
          disabled={addTemplateDisabled}
          title={addTemplateDisabled ? addTemplateDisabledTitle : undefined}
          className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border px-3.5 py-2 text-sm font-semibold transition ${
            addTemplateDisabled
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : hasUsableTemplate
                ? "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                : "border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800"
          }`}
          data-templates-add-template="true"
          data-templates-add-template-emphasis={hasUsableTemplate ? "secondary" : "primary"}
        >
          {hasUsableTemplate ? TEMPLATES_CREATE_ANOTHER_ACTION : "+ Template"}
        </button>
      ) : null}
    </header>
  );
}
