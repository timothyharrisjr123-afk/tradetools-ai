"use client";

import { proposalTemplateSectionKindLabel } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateSectionContent } from "@/app/lib/proposalTemplateTypes";
import type { TemplateContentEditorSectionView } from "@/app/lib/proposalTemplateContentEditorView";
import { TEMPLATES_CONTENT_SECTION_ROW } from "./templatesConstants";
import { isSectionBodyDraftDirty } from "./templatesContentEditorUtils";

type TemplatesContentSectionRowProps = {
  section: TemplateContentEditorSectionView;
  existingContent: ProposalTemplateSectionContent | null | undefined;
  draftBody: string;
  onDraftChange: (nextBody: string) => void;
  onSave: () => void;
  isSaving: boolean;
  saveError?: string | null;
};

export default function TemplatesContentSectionRow({
  section,
  existingContent,
  draftBody,
  onDraftChange,
  onSave,
  isSaving,
  saveError,
}: TemplatesContentSectionRowProps) {
  const isDirty = isSectionBodyDraftDirty(
    existingContent,
    section.bodyMarkdown,
    draftBody
  );
  const saveDisabled = !isDirty || isSaving;

  return (
    <li className={TEMPLATES_CONTENT_SECTION_ROW}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{section.displayTitle}</p>
          <p className="mt-0.5 text-xs text-slate-500">{section.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
              Unsaved
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
            {proposalTemplateSectionKindLabel(section.kind)}
          </span>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Body for {section.displayTitle}</span>
        <textarea
          value={draftBody}
          onChange={(event) => onDraftChange(event.target.value)}
          rows={6}
          disabled={isSaving}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ${
            saveDisabled
              ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {isSaving ? "Saving…" : "Save section"}
        </button>
        <p className="text-[11px] text-slate-500">
          Saves this section only. Other package options are not changed.
        </p>
      </div>

      {saveError ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {saveError}
        </p>
      ) : null}
    </li>
  );
}
