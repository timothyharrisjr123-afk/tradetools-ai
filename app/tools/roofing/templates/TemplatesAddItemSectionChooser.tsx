"use client";

import type { CatalogTargetSectionChoice } from "./templatesWorkspaceFlow";

type TemplatesAddItemSectionChooserProps = {
  open: boolean;
  choices: readonly CatalogTargetSectionChoice[];
  onCancel: () => void;
  onChoose: (sectionId: string) => void;
};

export default function TemplatesAddItemSectionChooser({
  open,
  choices,
  onCancel,
  onChoose,
}: TemplatesAddItemSectionChooserProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-add-section-chooser-title"
      data-templates-add-section-chooser
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2
          id="templates-add-section-chooser-title"
          className="text-lg font-semibold text-slate-900"
        >
          Where should this item go?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose which part of this package to add the Catalog item to.
        </p>
        <ul className="mt-4 space-y-2">
          {choices.map((choice) => (
            <li key={choice.sectionId}>
              <button
                type="button"
                onClick={() => onChoose(choice.sectionId)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                data-templates-add-section-choice={choice.sectionId}
              >
                {choice.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
