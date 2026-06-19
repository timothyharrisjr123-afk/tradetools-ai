"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Lock, SlidersHorizontal, X } from "lucide-react";
import {
  WORKBENCH_EDIT_OPTION_COMING_SOON_BADGE,
  WORKBENCH_EDIT_OPTION_CONTROL,
  WORKBENCH_EDIT_OPTION_CONTROL_BTN,
  WORKBENCH_EDIT_OPTION_DRAWER_BACKDROP,
  WORKBENCH_EDIT_OPTION_DRAWER_BODY,
  WORKBENCH_EDIT_OPTION_DRAWER_FOOTER,
  WORKBENCH_EDIT_OPTION_DRAWER_HEADER,
  WORKBENCH_EDIT_OPTION_DRAWER_PANEL,
  WORKBENCH_EDIT_OPTION_FOOTER_COPY,
  WORKBENCH_EDIT_OPTION_INTRO_COPY,
  WORKBENCH_EDIT_OPTION_SECTION,
  WORKBENCH_EDIT_OPTION_SECTION_DESC,
  WORKBENCH_EDIT_OPTION_SECTION_TITLE,
  WORKBENCH_EDIT_OPTION_TITLE,
  WORKBENCH_EDIT_OPTION_TRUST_COPY,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
} from "./proposalBuilderConstants";

type EditOptionShellSection = {
  id: string;
  title: string;
  description: string;
  controlLabel: string;
  controlKind: "input" | "button" | "select";
};

const EDIT_OPTION_SHELL_SECTIONS: readonly EditOptionShellSection[] = [
  {
    id: "quantity",
    title: "Quantity decisions",
    description: "Set a manual quantity for this proposal option when measurement mapping is unresolved.",
    controlLabel: "Manual quantity",
    controlKind: "input",
  },
  {
    id: "exclude",
    title: "Mark not applicable / remove",
    description: "Exclude template lines from this package without changing the master template.",
    controlLabel: "Mark not applicable · Remove from proposal",
    controlKind: "button",
  },
  {
    id: "catalog",
    title: "Add from catalog",
    description: "Pull additional catalog items into this option’s scope.",
    controlLabel: "Browse catalog",
    controlKind: "button",
  },
  {
    id: "custom",
    title: "Add custom line",
    description: "Add a one-off line item for this job only.",
    controlLabel: "Add custom line",
    controlKind: "button",
  },
  {
    id: "upgrade",
    title: "Move to optional upgrade",
    description: "Reclassify a line as an optional upgrade for customer selection at signing.",
    controlLabel: "Move to upgrade",
    controlKind: "select",
  },
  {
    id: "visibility",
    title: "Hide from customer / contractor-only",
    description: "Control whether a line appears on the customer proposal or stays internal.",
    controlLabel: "Customer visibility",
    controlKind: "select",
  },
  {
    id: "quantity_source",
    title: "Quantity source / measurement mapping",
    description: "Choose which measurement field drives quantity, or override with manual entry.",
    controlLabel: "Quantity source",
    controlKind: "select",
  },
] as const;

export type ProposalBuilderWorkbenchEditOptionShellProps = {
  open: boolean;
  onClose: () => void;
  optionLabel: string | null;
  scopeReviewCount: number;
};

function ShellSectionControl({ section }: { section: EditOptionShellSection }) {
  if (section.controlKind === "button") {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={WORKBENCH_EDIT_OPTION_CONTROL_BTN}
        title="Coming soon — scope editing is not enabled yet"
      >
        {section.controlLabel}
      </button>
    );
  }

  return (
    <input
      type="text"
      disabled
      aria-disabled="true"
      readOnly
      placeholder={section.controlLabel}
      className={WORKBENCH_EDIT_OPTION_CONTROL}
      title="Coming soon — scope editing is not enabled yet"
    />
  );
}

export default function ProposalBuilderWorkbenchEditOptionShell({
  open,
  onClose,
  optionLabel,
  scopeReviewCount,
}: ProposalBuilderWorkbenchEditOptionShellProps) {
  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const scopeHint =
    scopeReviewCount > 0
      ? `${scopeReviewCount} item${scopeReviewCount === 1 ? "" : "s"} in scope review will be editable here.`
      : "Tailor line items for this package before sending the proposal.";

  return createPortal(
    <>
      <div
        className={WORKBENCH_EDIT_OPTION_DRAWER_BACKDROP}
        aria-hidden="true"
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
          }
        }}
      />

      <aside
        className={WORKBENCH_EDIT_OPTION_DRAWER_PANEL}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-edit-option-title"
        aria-describedby="workbench-edit-option-desc"
      >
        <header className={WORKBENCH_EDIT_OPTION_DRAWER_HEADER}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
                <p className={WORKBENCH_MODULE_KICKER} id="workbench-edit-option-kicker">
                  Package scope
                </p>
                <span className={WORKBENCH_EDIT_OPTION_COMING_SOON_BADGE}>Coming soon</span>
              </div>
              <h3 className={WORKBENCH_MODULE_TITLE} id="workbench-edit-option-title">
                {WORKBENCH_EDIT_OPTION_TITLE}
              </h3>
              {optionLabel ? (
                <p className="mt-0.5 truncate text-[13px] font-medium text-slate-700">{optionLabel}</p>
              ) : null}
              <p className={`${WORKBENCH_MODULE_DESC} mt-2`} id="workbench-edit-option-desc">
                {scopeHint}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              aria-label="Close Edit option"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className={WORKBENCH_EDIT_OPTION_DRAWER_BODY}>
          <div className="space-y-3 rounded-lg border border-blue-100/80 bg-blue-50/40 px-3.5 py-3">
            <p className="text-[13px] leading-relaxed text-slate-700">{WORKBENCH_EDIT_OPTION_INTRO_COPY}</p>
            <p className="text-[12px] leading-snug text-slate-500">{WORKBENCH_EDIT_OPTION_TRUST_COPY}</p>
          </div>

          <div className="mt-4 space-y-3">
            {EDIT_OPTION_SHELL_SECTIONS.map((section) => (
              <section
                key={section.id}
                className={WORKBENCH_EDIT_OPTION_SECTION}
                aria-labelledby={`edit-option-section-${section.id}`}
              >
                <h4 className={WORKBENCH_EDIT_OPTION_SECTION_TITLE} id={`edit-option-section-${section.id}`}>
                  {section.title}
                </h4>
                <p className={WORKBENCH_EDIT_OPTION_SECTION_DESC}>{section.description}</p>
                <ShellSectionControl section={section} />
              </section>
            ))}
          </div>
        </div>

        <footer className={WORKBENCH_EDIT_OPTION_DRAWER_FOOTER}>
          <p className="flex items-start gap-2 text-[11px] leading-snug text-slate-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{WORKBENCH_EDIT_OPTION_FOOTER_COPY}</span>
          </p>
        </footer>
      </aside>
    </>,
    document.body
  );
}
