type TemplatesLibraryEmptyStateProps = {
  catalogReady: boolean;
};

export default function TemplatesLibraryEmptyState({ catalogReady }: TemplatesLibraryEmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center">
      <p className="text-sm font-medium text-slate-800">No templates in your library yet</p>
      <p className="mt-2 text-sm text-slate-600">
        {catalogReady
          ? "Install the starter roof replacement template from setup above to add Standard, Enhanced, and Premium packages to your library."
          : "Finish catalog setup first, then install the starter template from the onboarding section above."}
      </p>
    </div>
  );
}
