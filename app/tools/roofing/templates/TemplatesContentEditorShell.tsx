"use client";

import { useEffect, useMemo, useState } from "react";
import type { TemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  TEMPLATES_CARD,
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
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(
    () => viewModel.optionGroups[0]?.optionId ?? null
  );

  useEffect(() => {
    setDraftsBySectionId(initialDrafts);
  }, [initialDrafts]);

  useEffect(() => {
    setExpandedOptionId((current) => {
      if (current && viewModel.optionGroups.some((g) => g.optionId === current)) {
        return current;
      }
      return viewModel.optionGroups[0]?.optionId ?? null;
    });
  }, [viewModel.optionGroups]);

  const dirtySectionCount = useMemo(
    () => countDirtySectionDrafts(viewModel, graph, draftsBySectionId),
    [viewModel, graph, draftsBySectionId]
  );

  useEffect(() => {
    onDirtySectionCountChange(dirtySectionCount);
  }, [dirtySectionCount, onDirtySectionCountChange]);

  return (
    <section
      className={TEMPLATES_CARD}
      aria-labelledby="templates-content-editor-heading"
      data-templates-content-tab
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="templates-content-editor-heading" className="text-sm font-semibold text-slate-900">
            Content
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Master prose for future drafts (terms, warranty, and text pages). Open one package option
            at a time.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
          {viewModel.totalEditableSectionCount} editable
        </span>
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
        <div className="mt-5 space-y-3">
          {viewModel.optionGroups.map((group) => {
            const open = expandedOptionId === group.optionId;
            return (
              <div key={group.optionId} className={TEMPLATES_OPTION_GROUP}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 text-left"
                  onClick={() =>
                    setExpandedOptionId((current) =>
                      current === group.optionId ? null : group.optionId
                    )
                  }
                  aria-expanded={open}
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {group.optionLabel}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {group.sections.length} editable section
                      {group.sections.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {open ? "Hide" : "Open"}
                  </span>
                </button>

                {open ? (
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
                            draftBody:
                              draftsBySectionId[section.sectionId] ?? section.bodyMarkdown,
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
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
