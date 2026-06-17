"use client";

import { proposalTemplateSectionKindLabel } from "@/app/lib/proposalTemplateTypes";
import type { TemplateStructureSectionView } from "@/app/lib/proposalTemplateStructureEditorView";
import type { PlanRemoveSectionResult } from "@/app/lib/proposalTemplateStructureMutations";
import { TEMPLATES_CONTENT_SECTION_ROW } from "./templatesConstants";

type TemplatesStructureSectionRowProps = {
  section: TemplateStructureSectionView;
  sectionIndex: number;
  sectionCount: number;
  removeState: PlanRemoveSectionResult;
  isMoving: boolean;
  structureDisabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export default function TemplatesStructureSectionRow({
  section,
  sectionIndex,
  sectionCount,
  removeState,
  isMoving,
  structureDisabled,
  onMoveUp,
  onMoveDown,
}: TemplatesStructureSectionRowProps) {
  const canMoveUp = sectionIndex > 0 && section.isReorderable && !structureDisabled && !isMoving;
  const canMoveDown =
    sectionIndex < sectionCount - 1 &&
    section.isReorderable &&
    !structureDisabled &&
    !isMoving;

  const removeTitle =
    removeState.reason ||
    "Section removal is blocked until safe delete semantics are approved.";

  return (
    <li className={TEMPLATES_CONTENT_SECTION_ROW}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{section.displayTitle}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
              {proposalTemplateSectionKindLabel(section.kind)}
            </span>
            {!section.isRemovable && section.protectionReason ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                Protected
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {section.name}
            {section.itemCount > 0
              ? ` · ${section.itemCount} template item${section.itemCount === 1 ? "" : "s"}`
              : ""}
            {section.sortOrder != null ? ` · sort ${section.sortOrder}` : ""}
          </p>
          {!section.isRemovable && section.protectionReason ? (
            <p className="mt-1 text-[11px] text-amber-800">{section.protectionReason}</p>
          ) : null}
          {removeState.itemCount > 0 && section.isRemovable ? (
            <p className="mt-1 text-[11px] text-amber-800">
              {removeState.itemCount} linked template item
              {removeState.itemCount === 1 ? "" : "s"} would need cleanup before delete is enabled.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title={canMoveUp ? "Move section up within this package option" : "Already at top"}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              canMoveUp
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
            }`}
          >
            {isMoving ? "…" : "Up"}
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title={canMoveDown ? "Move section down within this package option" : "Already at bottom"}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              canMoveDown
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
            }`}
          >
            {isMoving ? "…" : "Down"}
          </button>
          <button
            type="button"
            disabled
            title={removeTitle}
            className="cursor-not-allowed rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-400"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
