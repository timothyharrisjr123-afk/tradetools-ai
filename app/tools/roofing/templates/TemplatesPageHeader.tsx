type TemplatesPageHeaderProps = {
  onAddTemplate?: () => void;
  addTemplateDisabled?: boolean;
  addTemplateDisabledTitle?: string;
};

export default function TemplatesPageHeader({
  onAddTemplate,
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
          Proposal templates
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Reusable proposal setups for your company. Create a template here, then start job
          proposals from a Job Card.
        </p>
      </div>
      {onAddTemplate ? (
        <button
          type="button"
          onClick={onAddTemplate}
          disabled={addTemplateDisabled}
          title={addTemplateDisabled ? addTemplateDisabledTitle : undefined}
          className={`inline-flex shrink-0 items-center justify-center rounded-md border px-3.5 py-2 text-sm font-semibold shadow-sm transition ${
            addTemplateDisabled
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-blue-300 bg-blue-600 text-white hover:bg-blue-700"
          }`}
          data-templates-add-template="true"
        >
          + Template
        </button>
      ) : null}
    </header>
  );
}
