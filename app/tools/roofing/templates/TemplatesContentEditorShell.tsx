"use client";

import { useEffect, useMemo, useState } from "react";
import type { TemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  TEMPLATES_CARD,
  TEMPLATES_LOCKED_BANNER,
  TEMPLATES_OPTION_GROUP,
} from "./templatesConstants";
import TemplatesContentSectionRow from "./TemplatesContentSectionRow";
import {
  buildInitialSectionDrafts,
  countDirtySectionDrafts,
  findSectionContent,
} from "./templatesContentEditorUtils";

type SectionSaveError = {
  sectionId: string;
  message: string;
};

type TemplatesContentEditorShellProps = {
  viewModel: TemplateContentEditorViewModel;
  graph: ProposalTemplateGraph;
  savingSectionId: string | null;
  sectionSaveError: SectionSaveError | null;
  contentSaveBlocked?: boolean;
  onSaveSection: (args: {
    sectionId: string;
    optionId: string;
    draftBody: string;
  }) => void;
  onDirtySectionCountChange: (count: number) => void;
};

export default function TemplatesContentEditorShell({
  viewModel,
  graph,
  savingSectionId,
  sectionSaveError,
  contentSaveBlocked = false,
  onSaveSection,
  onDirtySectionCountChange,
}: TemplatesContentEditorShellProps) {
  const initialDrafts = useMemo(() => buildInitialSectionDrafts(viewModel), [viewModel]);
  const [draftsBySectionId, setDraftsBySectionId] =
    useState<Record<string, string>>(initialDrafts);

  useEffect(() => {
    setDraftsBySectionId(initialDrafts);
  }, [initialDrafts]);

  const dirtySectionCount = useMemo(
    () => countDirtySectionDrafts(viewModel, graph, draftsBySectionId),
    [viewModel, graph, draftsBySectionId]
  );

  useEffect(() => {
    onDirtySectionCountChange(dirtySectionCount);
  }, [dirtySectionCount, onDirtySectionCountChange]);

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-content-editor-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="templates-content-editor-heading" className="text-base font-semibold text-slate-900">
            Template content
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Reusable master prose by package option — text, terms, and warranty for{" "}
            <span className="font-medium text-slate-800">{viewModel.templateName}</span>.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
          Editable
        </span>
      </div>

      <div className={TEMPLATES_LOCKED_BANNER} role="status">
        <p className="text-sm font-medium text-slate-800">Master template content</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Changes save to this company template and apply to future proposal drafts created from it.
          Existing job proposal pages are not changed. Each package option has its own sections —
          save one section at a time. Structure and estimate settings are configured above.
        </p>
      </div>

      {contentSaveBlocked ? (
        <p className="mt-3 text-xs text-amber-800" role="status">
          Content save is paused while structure or settings are saving.
        </p>
      ) : null}

      {dirtySectionCount > 0 ? (
        <p className="mt-3 text-xs text-amber-800" role="status">
          {dirtySectionCount} section{dirtySectionCount === 1 ? "" : "s"} with unsaved changes.
          Save or revert before switching templates.
        </p>
      ) : null}

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
                  <TemplatesContentSectionRow
                    key={section.sectionId}
                    section={section}
                    existingContent={findSectionContent(graph, section.sectionId)}
                    draftBody={draftsBySectionId[section.sectionId] ?? section.bodyMarkdown}
                    onDraftChange={(nextBody) =>
                      setDraftsBySectionId((current) => ({
                        ...current,
                        [section.sectionId]: nextBody,
                      }))
                    }
                    onSave={() =>
                      onSaveSection({
                        sectionId: section.sectionId,
                        optionId: section.optionId,
                        draftBody: draftsBySectionId[section.sectionId] ?? section.bodyMarkdown,
                      })
                    }
                    isSaving={savingSectionId === section.sectionId}
                    saveDisabled={contentSaveBlocked}
                    saveError={
                      sectionSaveError?.sectionId === section.sectionId
                        ? sectionSaveError.message
                        : null
                    }
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
