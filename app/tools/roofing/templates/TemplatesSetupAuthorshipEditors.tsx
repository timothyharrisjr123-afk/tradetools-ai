"use client";

import { useEffect, useState } from "react";
import type { ProposalTemplateOption } from "@/app/lib/proposalTemplateTypes";
import { sortTemplateOptionsByOrder } from "./templatesSetupUtils";

export type TemplateIdentityDraft = {
  name: string;
  description: string;
};

export type PackageAuthorshipDraft = {
  optionId: string;
  name: string;
  customerLabel: string;
  description: string;
  isDefault: boolean;
};

type TemplatesIdentityEditorProps = {
  name: string;
  description: string | null;
  busy: boolean;
  onSave: (draft: TemplateIdentityDraft) => Promise<void> | void;
};

export function TemplatesIdentityEditor({
  name,
  description,
  busy,
  onSave,
}: TemplatesIdentityEditorProps) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDraftName(name);
      setDraftDescription(description ?? "");
      setError(null);
    }
  }, [open, name, description]);

  const handleSave = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("Enter a template name.");
      return;
    }
    setError(null);
    await onSave({
      name: trimmed,
      description: draftDescription.trim(),
    });
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
        data-templates-edit-identity
      >
        Edit name & purpose
      </button>
    );
  }

  return (
    <div
      className="mt-3 space-y-2.5 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70"
      data-templates-identity-editor
    >
      <label className="block">
        <span className="text-xs font-medium text-slate-700">Template name</span>
        <input
          type="text"
          value={draftName}
          disabled={busy}
          onChange={(e) => setDraftName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
          data-templates-identity-name
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-700">Purpose</span>
        <textarea
          value={draftDescription}
          disabled={busy}
          rows={2}
          onChange={(e) => setDraftDescription(e.target.value)}
          className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
          data-templates-identity-description
        />
      </label>
      {error ? <p className="text-xs text-amber-800">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-md border border-blue-300 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          data-templates-identity-save
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

type TemplatesPackagesAdjustPanelProps = {
  options: readonly ProposalTemplateOption[];
  busy: boolean;
  onSave: (drafts: readonly PackageAuthorshipDraft[]) => Promise<void> | void;
};

export function TemplatesPackagesAdjustPanel({
  options,
  busy,
  onSave,
}: TemplatesPackagesAdjustPanelProps) {
  const ordered = sortTemplateOptionsByOrder(options);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<PackageAuthorshipDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = sortTemplateOptionsByOrder(options).map((option) => ({
      optionId: option.id,
      name: option.name,
      customerLabel: option.customer_label ?? option.name,
      description: option.description ?? "",
      isDefault: option.is_default === true,
    }));
    setDrafts(next);
    setError(null);
  }, [open, options]);

  if (ordered.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        data-templates-adjust-packages
      >
        Adjust packages
      </button>
    );
  }

  const updateDraft = (optionId: string, patch: Partial<PackageAuthorshipDraft>) => {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.optionId !== optionId) {
          if (patch.isDefault === true) return { ...draft, isDefault: false };
          return draft;
        }
        return { ...draft, ...patch };
      })
    );
  };

  const handleSave = async () => {
    for (const draft of drafts) {
      if (!draft.name.trim()) {
        setError("Every package needs a display name.");
        return;
      }
    }
    if (!drafts.some((draft) => draft.isDefault)) {
      setError("Choose a default package.");
      return;
    }
    setError(null);
    await onSave(drafts);
    setOpen(false);
  };

  return (
    <div
      className="mt-3 space-y-3 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70"
      data-templates-packages-adjust
    >
      <p className="text-xs text-slate-500">
        Rename packages and set the default used when creating a proposal from a Job Card.
      </p>
      {drafts.map((draft) => (
        <div
          key={draft.optionId}
          className="space-y-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3"
          data-templates-package-authorship={draft.optionId}
        >
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="radio"
              name="templates-default-package"
              checked={draft.isDefault}
              disabled={busy}
              onChange={() => updateDraft(draft.optionId, { isDefault: true })}
              data-templates-package-default={draft.optionId}
            />
            Default package
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Display name</span>
            <input
              type="text"
              value={draft.name}
              disabled={busy}
              onChange={(e) => updateDraft(draft.optionId, { name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
              data-templates-package-name={draft.optionId}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Customer label</span>
            <input
              type="text"
              value={draft.customerLabel}
              disabled={busy}
              onChange={(e) =>
                updateDraft(draft.optionId, { customerLabel: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
              data-templates-package-customer-label={draft.optionId}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Description</span>
            <textarea
              value={draft.description}
              disabled={busy}
              rows={2}
              onChange={(e) =>
                updateDraft(draft.optionId, { description: e.target.value })
              }
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
              data-templates-package-description={draft.optionId}
            />
          </label>
        </div>
      ))}
      {error ? <p className="text-xs text-amber-800">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-md border border-blue-300 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          data-templates-packages-adjust-save
        >
          Save packages
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
