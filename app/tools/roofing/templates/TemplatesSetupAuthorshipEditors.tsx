"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateOption } from "@/app/lib/proposalTemplateTypes";
import { sortTemplateOptionsByOrder } from "./templatesSetupUtils";
import {
  buildCopiedPackageSummary,
  countIncludedAndUpgradeItems,
  type PackageAddMode,
} from "./templatesPackageStructurePlanner";

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

export type PackageStructureCreateDraft = {
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

type PanelMode = "list" | "add" | "remove";

type TemplatesPackagesAdjustPanelProps = {
  graph: ProposalTemplateGraph;
  busy: boolean;
  onSaveAuthorship: (drafts: readonly PackageAuthorshipDraft[]) => Promise<void> | void;
  onCopyPackage: (input: {
    sourceOptionId: string;
    draft: PackageStructureCreateDraft;
  }) => Promise<boolean>;
  onCreateBlankPackage: (draft: PackageStructureCreateDraft) => Promise<boolean>;
  onReorderPackage: (optionId: string, direction: "up" | "down") => Promise<boolean>;
  onRemovePackage: (input: {
    removeOptionId: string;
    replacementDefaultOptionId?: string | null;
  }) => Promise<boolean>;
  /** Notify parent when the contextual adjust surface opens/closes. */
  onOpenChange?: (open: boolean) => void;
};

export function TemplatesPackagesAdjustPanel({
  graph,
  busy,
  onSaveAuthorship,
  onCopyPackage,
  onCreateBlankPackage,
  onReorderPackage,
  onRemovePackage,
  onOpenChange,
}: TemplatesPackagesAdjustPanelProps) {
  const ordered = sortTemplateOptionsByOrder(graph.options);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("list");
  const [drafts, setDrafts] = useState<PackageAuthorshipDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [addMode, setAddMode] = useState<PackageAddMode>("copy_existing");
  const [addStep, setAddStep] = useState<"path" | "details">("path");
  const [sourceOptionId, setSourceOptionId] = useState<string>("");
  const [createDraft, setCreateDraft] = useState<PackageStructureCreateDraft>({
    name: "",
    customerLabel: "",
    description: "",
    isDefault: false,
  });

  const [removeOptionId, setRemoveOptionId] = useState<string>("");
  const [replacementDefaultId, setReplacementDefaultId] = useState<string>("");

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const next = sortTemplateOptionsByOrder(graph.options).map((option) => ({
      optionId: option.id,
      name: option.name,
      customerLabel: option.customer_label ?? option.name,
      description: option.description ?? "",
      isDefault: option.is_default === true,
    }));
    setDrafts(next);
    setError(null);
    setMode("list");
    setAddMode("copy_existing");
    setAddStep("path");
    setSourceOptionId(next.find((row) => row.isDefault)?.optionId ?? next[0]?.optionId ?? "");
  }, [open, graph.options]);

  const sourceSummaries = useMemo(() => {
    return ordered.map((option) => {
      const counts = countIncludedAndUpgradeItems({
        optionId: option.id,
        sections: graph.sections,
        items: graph.items,
      });
      return {
        optionId: option.id,
        label: option.customer_label?.trim() || option.name,
        includedCount: counts.includedCount,
        availableUpgradeCount: counts.availableUpgradeCount,
      };
    });
  }, [graph.items, graph.sections, ordered]);

  const selectedSource = sourceSummaries.find((row) => row.optionId === sourceOptionId) ?? null;
  const copySummary =
    selectedSource != null
      ? buildCopiedPackageSummary({
          sourceLabel: selectedSource.label,
          includedCount: selectedSource.includedCount,
          availableUpgradeCount: selectedSource.availableUpgradeCount,
        })
      : null;

  if (ordered.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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

  const handleSaveAuthorship = async () => {
    for (const draft of drafts) {
      if (!draft.name.trim()) {
        setError("Every package needs a display name.");
        return;
      }
    }
    if (!drafts.some((draft) => draft.isDefault)) {
      setError("Choose a starting package.");
      return;
    }
    setError(null);
    await onSaveAuthorship(drafts);
    setOpen(false);
  };

  const startAdd = () => {
    setMode("add");
    setAddMode("copy_existing");
    setAddStep("path");
    setError(null);
    const defaultSource =
      drafts.find((row) => row.isDefault)?.optionId ?? drafts[0]?.optionId ?? "";
    setSourceOptionId(defaultSource);
    const source = ordered.find((row) => row.id === defaultSource);
    setCreateDraft({
      name: source ? `${source.customer_label ?? source.name} Plus` : "",
      customerLabel: "",
      description: "",
      isDefault: false,
    });
  };

  const handleCreatePackage = async () => {
    if (addMode === "copy_existing") {
      if (!sourceOptionId) {
        setError("Choose a package to copy.");
        return;
      }
      if (!createDraft.name.trim()) {
        setError("Enter a package name.");
        return;
      }
      const ok = await onCopyPackage({
        sourceOptionId,
        draft: createDraft,
      });
      if (!ok) return;
      setMode("list");
      return;
    }
    if (!createDraft.name.trim()) {
      setError("Enter a package name.");
      return;
    }
    const ok = await onCreateBlankPackage(createDraft);
    if (!ok) return;
    setMode("list");
  };

  const startRemove = (optionId: string) => {
    setRemoveOptionId(optionId);
    const remaining = drafts.filter((row) => row.optionId !== optionId);
    const nextDefault =
      remaining.find((row) => row.isDefault)?.optionId ?? remaining[0]?.optionId ?? "";
    setReplacementDefaultId(nextDefault);
    setMode("remove");
    setError(null);
  };

  const handleConfirmRemove = async () => {
    const ok = await onRemovePackage({
      removeOptionId,
      replacementDefaultOptionId: replacementDefaultId || null,
    });
    if (!ok) return;
    setMode("list");
  };

  const removing = drafts.find((row) => row.optionId === removeOptionId);
  const removeCandidates = drafts.filter((row) => row.optionId !== removeOptionId);

  return (
    <div
      className="w-full space-y-3 rounded-xl bg-slate-50/50 p-3.5 ring-1 ring-slate-200/60"
      data-templates-packages-adjust
      data-templates-packages-adjust-mode={mode}
    >
      {mode === "list" ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 max-w-2xl">
              <p className="text-sm font-semibold text-slate-900">Adjust packages</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">
                Rename, reorder, or add package options in this setup.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={startAdd}
                className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                data-templates-add-package
              >
                Add package
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
                data-templates-packages-adjust-done
              >
                Done
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {drafts.map((draft, index) => (
              <div
                key={draft.optionId}
                className="rounded-xl bg-white px-3.5 py-3 ring-1 ring-slate-200/70"
                data-templates-package-authorship={draft.optionId}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="radio"
                      name="templates-default-package"
                      checked={draft.isDefault}
                      disabled={busy}
                      onChange={() => updateDraft(draft.optionId, { isDefault: true })}
                      data-templates-package-default={draft.optionId}
                    />
                    Starting package
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() => void onReorderPackage(draft.optionId, "up")}
                      className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-40"
                      data-templates-package-move-up={draft.optionId}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === drafts.length - 1}
                      onClick={() => void onReorderPackage(draft.optionId, "down")}
                      className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-40"
                      data-templates-package-move-down={draft.optionId}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      disabled={busy || drafts.length <= 1}
                      onClick={() => startRemove(draft.optionId)}
                      className="text-[11px] font-medium text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-40"
                      data-templates-package-remove={draft.optionId}
                    >
                      Remove from setup
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Package name</span>
                    <input
                      type="text"
                      value={draft.name}
                      disabled={busy}
                      onChange={(e) => updateDraft(draft.optionId, { name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
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
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                      data-templates-package-customer-label={draft.optionId}
                    />
                  </label>
                </div>
                <label className="mt-2.5 block">
                  <span className="text-xs font-medium text-slate-700">Description</span>
                  <textarea
                    value={draft.description}
                    disabled={busy}
                    rows={1}
                    onChange={(e) =>
                      updateDraft(draft.optionId, { description: e.target.value })
                    }
                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                    data-templates-package-description={draft.optionId}
                  />
                </label>
              </div>
            ))}
          </div>

          {error ? <p className="text-xs text-amber-800">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveAuthorship()}
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
        </>
      ) : null}

      {mode === "add" ? (
        <div className="space-y-3" data-templates-add-package-flow data-add-mode={addMode}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Add package</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("list");
                setError(null);
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Back
            </button>
          </div>

          {addStep === "path" ? (
            <div className="space-y-2" data-templates-add-package-path>
              <button
                type="button"
                disabled={busy}
                data-selected={addMode === "copy_existing" ? "true" : "false"}
                onClick={() => setAddMode("copy_existing")}
                className={`w-full rounded-xl border px-3.5 py-3 text-left ${
                  addMode === "copy_existing"
                    ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-200"
                    : "border-slate-200 bg-white"
                }`}
                data-templates-add-path="copy_existing"
              >
                <p className="text-sm font-semibold text-slate-900">Copy existing package</p>
                <p className="mt-1 text-xs text-slate-600">
                  Start from a working package, then rename and adjust.
                </p>
              </button>
              <button
                type="button"
                disabled={busy}
                data-selected={addMode === "start_blank" ? "true" : "false"}
                onClick={() => setAddMode("start_blank")}
                className={`w-full rounded-xl border px-3.5 py-3 text-left ${
                  addMode === "start_blank"
                    ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-200"
                    : "border-slate-200 bg-white"
                }`}
                data-templates-add-path="start_blank"
              >
                <p className="text-sm font-semibold text-slate-900">Start blank</p>
                <p className="mt-1 text-xs text-slate-600">
                  Create a package shell, then add included work.
                </p>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAddStep("details");
                  setError(null);
                  if (addMode === "start_blank") {
                    setCreateDraft({
                      name: "",
                      customerLabel: "",
                      description: "",
                      isDefault: false,
                    });
                  }
                }}
                className="rounded-md border border-blue-300 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                data-templates-add-package-continue
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="space-y-3" data-templates-add-package-details>
              {addMode === "copy_existing" ? (
                <div className="space-y-2" data-templates-copy-source>
                  <p className="text-xs font-medium text-slate-700">Copy from</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sourceSummaries.map((row) => {
                      const selected = row.optionId === sourceOptionId;
                      return (
                        <button
                          key={row.optionId}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSourceOptionId(row.optionId);
                            setCreateDraft((current) => ({
                              ...current,
                              name: current.name.trim()
                                ? current.name
                                : `${row.label} Plus`,
                            }));
                          }}
                          className={`rounded-xl border px-3 py-2.5 text-left ${
                            selected
                              ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-200"
                              : "border-slate-200 bg-white"
                          }`}
                          data-templates-copy-source={row.optionId}
                        >
                          <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                          <p className="mt-1 text-[11px] text-slate-600">
                            {row.includedCount} included
                            {row.availableUpgradeCount > 0
                              ? ` · ${row.availableUpgradeCount} available upgrade${
                                  row.availableUpgradeCount === 1 ? "" : "s"
                                }`
                              : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {copySummary ? (
                    <div
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                      data-templates-copy-summary
                    >
                      <p className="text-xs font-semibold text-slate-800">{copySummary.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{copySummary.detail}</p>
                      {selectedSource ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {selectedSource.includedCount} included ·{" "}
                          {selectedSource.availableUpgradeCount} available upgrades
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-600" data-templates-blank-hint>
                  Creates a valid package shell with no included work yet. Next step: Add
                  included work.
                </p>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Package name</span>
                <input
                  type="text"
                  value={createDraft.name}
                  disabled={busy}
                  onChange={(e) =>
                    setCreateDraft((current) => ({ ...current, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                  data-templates-add-package-name
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Customer label</span>
                <input
                  type="text"
                  value={createDraft.customerLabel}
                  disabled={busy}
                  placeholder="Optional — defaults to package name"
                  onChange={(e) =>
                    setCreateDraft((current) => ({
                      ...current,
                      customerLabel: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                  data-templates-add-package-customer-label
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Description</span>
                <textarea
                  value={createDraft.description}
                  disabled={busy}
                  rows={2}
                  onChange={(e) =>
                    setCreateDraft((current) => ({
                      ...current,
                      description: e.target.value,
                    }))
                  }
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                  data-templates-add-package-description
                />
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={createDraft.isDefault}
                  disabled={busy}
                  onChange={(e) =>
                    setCreateDraft((current) => ({
                      ...current,
                      isDefault: e.target.checked,
                    }))
                  }
                  data-templates-add-package-default
                />
                Default package
              </label>

              {error ? <p className="text-xs text-amber-800">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCreatePackage()}
                  className="rounded-md border border-blue-300 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  data-templates-add-package-create
                >
                  {addMode === "copy_existing" ? "Create package" : "Create package shell"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAddStep("path")}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {mode === "remove" && removing ? (
        <div className="space-y-3" data-templates-remove-package-flow>
          <p className="text-sm font-semibold text-slate-900">Remove from setup</p>
          <p className="text-sm text-slate-800">{removing.customerLabel || removing.name}</p>
          <p className="text-xs text-slate-600">
            This removes the package from future proposals using this template. Existing
            proposals are not changed.
          </p>
          {removing.isDefault && removeCandidates.length > 0 ? (
            <label className="block">
              <span className="text-xs font-medium text-slate-700">New default package</span>
              <select
                value={replacementDefaultId}
                disabled={busy}
                onChange={(e) => setReplacementDefaultId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                data-templates-remove-replacement-default
              >
                {removeCandidates.map((row) => (
                  <option key={row.optionId} value={row.optionId}>
                    {row.customerLabel || row.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {error ? <p className="text-xs text-amber-800">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirmRemove()}
              className="rounded-md border border-red-300 bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              data-templates-remove-package-confirm
            >
              Remove from setup
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("list")}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Keep type export for callers that only need option shape. */
export type { ProposalTemplateOption };
