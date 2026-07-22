"use client";

import {
  TEMPLATES_ARCHIVE_ACTION_LABEL,
  TEMPLATES_ARCHIVE_CONFIRM_COPY,
  TEMPLATES_ARCHIVE_CONFIRM_TITLE,
} from "./templatesWorkspaceFlow";

type TemplatesArchiveTemplateConfirmModalProps = {
  open: boolean;
  templateName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** R2A — calm archive confirmation. No DB terms, no destructive language. */
export default function TemplatesArchiveTemplateConfirmModal({
  open,
  templateName,
  busy,
  onCancel,
  onConfirm,
}: TemplatesArchiveTemplateConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-archive-confirm-title"
      data-templates-archive-confirm
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2
          id="templates-archive-confirm-title"
          className="text-lg font-semibold text-slate-900"
        >
          {TEMPLATES_ARCHIVE_CONFIRM_TITLE}
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-medium">{templateName}</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {TEMPLATES_ARCHIVE_CONFIRM_COPY}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            data-templates-archive-confirm-submit
          >
            {busy ? "Archiving…" : TEMPLATES_ARCHIVE_ACTION_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
