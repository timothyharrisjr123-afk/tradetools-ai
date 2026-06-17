"use client";

import { proposalTemplateSectionKindLabel } from "@/app/lib/proposalTemplateTypes";
import type { TemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import {
  TEMPLATES_CARD,
  TEMPLATES_CONTENT_SECTION_ROW,
  TEMPLATES_LOCKED_BANNER,
  TEMPLATES_OPTION_GROUP,
} from "./templatesConstants";

type TemplatesContentEditorShellProps = {
  viewModel: TemplateContentEditorViewModel;
};

function SectionBodyPreview({ body }: { body: string }) {
  if (!body.trim()) {
    return <p className="text-sm italic text-slate-400">No body content yet.</p>;
  }

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{body}</p>
  );
}

export default function TemplatesContentEditorShell({
  viewModel,
}: TemplatesContentEditorShellProps) {
  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-content-editor-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="templates-content-editor-heading" className="text-base font-semibold text-slate-900">
            Template content
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Reusable prose by package option — text, terms, and warranty sections for{" "}
            <span className="font-medium text-slate-800">{viewModel.templateName}</span>.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          Read-only
        </span>
      </div>

      <div className={TEMPLATES_LOCKED_BANNER} role="status">
        <p className="text-sm font-medium text-slate-800">Editing locked until R6</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Editing and save wiring comes in R6. Each package option keeps its own Terms, Warranty,
          and overview sections — there is no shared bulk field across Standard, Enhanced, or Premium.
        </p>
      </div>

      {viewModel.optionGroups.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No editable text sections found for this template yet.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {viewModel.optionGroups.map((group) => (
            <div key={group.optionId} className={TEMPLATES_OPTION_GROUP}>
              <div className="border-b border-slate-200/80 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">{group.optionLabel}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {group.sections.length} editable section
                  {group.sections.length === 1 ? "" : "s"} · per-option content
                </p>
              </div>

              <ul className="divide-y divide-slate-100">
                {group.sections.map((section) => (
                  <li key={section.sectionId} className={TEMPLATES_CONTENT_SECTION_ROW}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{section.displayTitle}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{section.name}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                        {proposalTemplateSectionKindLabel(section.kind)}
                      </span>
                    </div>

                    <div
                      className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-3"
                      aria-readonly="true"
                    >
                      <SectionBodyPreview body={section.bodyMarkdown} />
                    </div>

                    <p className="mt-2 text-[11px] text-slate-400">
                      Locked preview — changes will not persist on this page.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
