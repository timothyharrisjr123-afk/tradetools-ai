"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuidedTemplateCreatePlan } from "./templatesGuidedCreatePlanner";
import {
  GUIDED_CREATE_BACK_ACTION,
  GUIDED_CREATE_CANCEL_ACTION,
  GUIDED_CREATE_CONTINUE_ACTION,
  GUIDED_CREATE_OVERLAY_SUBTITLE,
  GUIDED_CREATE_OVERLAY_TITLE,
  GUIDED_CREATE_PRIMARY_ACTION,
  GUIDED_CREATE_STARTING_POINT_HINT,
  GUIDED_CREATE_STARTING_POINT_LABEL,
  GUIDED_CREATE_STARTING_POINT_VALUE,
  GUIDED_CREATE_STEP_LABELS,
  GUIDED_CREATE_STEPS,
  GUIDED_PACKAGE_MODEL_CHOICES,
  buildDefaultGuidedPackageDrafts,
  buildGuidedTemplateCreatePlan,
  formatGuidedPackageSummary,
  nextGuidedCreateStep,
  prevGuidedCreateStep,
  validateGuidedCreateBasics,
  validateGuidedPackageDrafts,
  type GuidedCreateStepId,
  type GuidedPackageDraft,
  type GuidedPackageModelId,
} from "./templatesGuidedCreatePlanner";

type TemplatesGuidedCreateOverlayProps = {
  open: boolean;
  creating: boolean;
  createError: string | null;
  onClose: () => void;
  onCreate: (plan: GuidedTemplateCreatePlan) => void;
};

export default function TemplatesGuidedCreateOverlay({
  open,
  creating,
  createError,
  onClose,
  onCreate,
}: TemplatesGuidedCreateOverlayProps) {
  const [step, setStep] = useState<GuidedCreateStepId>("basics");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [packageModel, setPackageModel] = useState<GuidedPackageModelId>("triple");
  const [packageDrafts, setPackageDrafts] = useState<GuidedPackageDraft[]>(() =>
    buildDefaultGuidedPackageDrafts("triple")
  );
  const [basicsError, setBasicsError] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("basics");
    setName("");
    setDescription("");
    setPackageModel("triple");
    setPackageDrafts(buildDefaultGuidedPackageDrafts("triple"));
    setBasicsError(null);
    setPackageError(null);
  }, [open]);

  const plan = useMemo(() => {
    const basics = validateGuidedCreateBasics({ name, description });
    if (!basics.ok) return null;
    const drafts =
      packageModel === "simple" ? [] : packageDrafts.length > 0 ? packageDrafts : buildDefaultGuidedPackageDrafts(packageModel);
    try {
      return buildGuidedTemplateCreatePlan({
        name: basics.name,
        description: basics.description,
        packageModel,
        packageDrafts: drafts,
      });
    } catch {
      return null;
    }
  }, [name, description, packageModel, packageDrafts]);

  if (!open) return null;

  const stepIndex = GUIDED_CREATE_STEPS.indexOf(step);

  const selectPackageModel = (nextModel: GuidedPackageModelId) => {
    setPackageModel(nextModel);
    setPackageDrafts(buildDefaultGuidedPackageDrafts(nextModel));
    setPackageError(null);
  };

  const updateDraft = (key: string, patch: Partial<GuidedPackageDraft>) => {
    setPackageDrafts((current) =>
      current.map((draft) => {
        if (draft.key !== key) {
          if (patch.isDefault === true) {
            return { ...draft, isDefault: false };
          }
          return draft;
        }
        return { ...draft, ...patch };
      })
    );
  };

  const goNextFromBasics = () => {
    const basics = validateGuidedCreateBasics({ name, description });
    if (!basics.ok) {
      setBasicsError(basics.error);
      return;
    }
    setBasicsError(null);
    const next = nextGuidedCreateStep("basics");
    if (next) setStep(next);
  };

  const goNextFromPackageSetup = () => {
    const check = validateGuidedPackageDrafts(packageModel, packageDrafts);
    if (!check.ok) {
      setPackageError(check.error);
      return;
    }
    setPackageError(null);
    const next = nextGuidedCreateStep("package_setup");
    if (next) setStep(next);
  };

  const goNext = () => {
    if (step === "basics") {
      goNextFromBasics();
      return;
    }
    if (step === "package_setup") {
      goNextFromPackageSetup();
      return;
    }
    const next = nextGuidedCreateStep(step);
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = prevGuidedCreateStep(step);
    if (prev) setStep(prev);
  };

  const handleCreate = () => {
    if (!plan || creating) return;
    onCreate(plan);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-5"
      data-templates-guided-create-overlay="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-guided-create-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close new template"
        data-templates-guided-create-backdrop="true"
        onClick={onClose}
        disabled={creating}
      />
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        data-templates-guided-create-panel="true"
      >
        <header className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="templates-guided-create-title"
                className="text-xl font-semibold tracking-tight text-slate-900"
              >
                {GUIDED_CREATE_OVERLAY_TITLE}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {GUIDED_CREATE_OVERLAY_SUBTITLE}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
              onClick={onClose}
              disabled={creating}
              data-templates-guided-create-close="true"
            >
              Close
            </button>
          </div>
          <nav
            className="mt-5 flex flex-wrap gap-2"
            aria-label="New template steps"
            data-templates-guided-create-steps="true"
          >
            {GUIDED_CREATE_STEPS.map((s, i) => {
              const active = s === step;
              const done = i < stepIndex;
              return (
                <span
                  key={s}
                  data-templates-guided-create-step={s}
                  data-active={active ? "true" : "false"}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    active
                      ? "bg-blue-600 text-white"
                      : done
                        ? "bg-blue-50 text-blue-800"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}. {GUIDED_CREATE_STEP_LABELS[s]}
                </span>
              );
            })}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {step === "basics" ? (
            <section data-templates-guided-create-panel-basics="true" className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {GUIDED_CREATE_STEP_LABELS.basics}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Name this reusable proposal setup for your company.
                </p>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-800">Template name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={creating}
                  placeholder="e.g. Roof Replacement Packages"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-200 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2"
                  data-templates-guided-create-name="true"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-800">
                  Short purpose <span className="font-normal text-slate-500">(optional)</span>
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={creating}
                  rows={3}
                  placeholder="What this template is for"
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-200 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2"
                  data-templates-guided-create-description="true"
                />
              </label>

              <div
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5"
                data-templates-guided-create-starting-point="true"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {GUIDED_CREATE_STARTING_POINT_LABEL}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {GUIDED_CREATE_STARTING_POINT_VALUE}
                </p>
                <p className="mt-1 text-sm text-slate-600">{GUIDED_CREATE_STARTING_POINT_HINT}</p>
              </div>

              {basicsError ? (
                <p className="text-sm text-amber-800" role="status" data-templates-guided-create-basics-error>
                  {basicsError}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "package_setup" ? (
            <section data-templates-guided-create-panel-package-setup="true" className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {GUIDED_CREATE_STEP_LABELS.package_setup}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Choose a package model, then name packages the way you sell them.
                </p>
              </div>
              <ul className="space-y-2">
                {GUIDED_PACKAGE_MODEL_CHOICES.map((choice) => {
                  const selected = choice.id === packageModel;
                  return (
                    <li key={choice.id}>
                      <button
                        type="button"
                        disabled={creating}
                        data-templates-guided-create-package-model={choice.id}
                        data-selected={selected ? "true" : "false"}
                        onClick={() => selectPackageModel(choice.id)}
                        className={`w-full rounded-xl border px-4 py-3.5 text-left transition ${
                          selected
                            ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-200"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900">{choice.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{choice.description}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {packageModel !== "simple" ? (
                <div className="space-y-3" data-templates-guided-create-package-drafts>
                  <p className="text-sm font-medium text-slate-800">Package names & descriptions</p>
                  {packageDrafts.map((draft) => (
                    <div
                      key={draft.key}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 space-y-3"
                      data-templates-guided-create-package-draft={draft.key}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                          <input
                            type="radio"
                            name="guided-default-package"
                            checked={draft.isDefault}
                            disabled={creating}
                            onChange={() => updateDraft(draft.key, { isDefault: true })}
                            data-templates-guided-create-default-package={draft.key}
                          />
                          Default package
                        </label>
                        <span className="text-[11px] text-slate-400">
                          Starter: {draft.sourceName}
                        </span>
                      </div>
                      <label className="block">
                        <span className="text-xs font-medium text-slate-700">Display name</span>
                        <input
                          type="text"
                          value={draft.name}
                          disabled={creating}
                          onChange={(e) => updateDraft(draft.key, { name: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                          data-templates-guided-create-package-name={draft.key}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-slate-700">
                          Customer label{" "}
                          <span className="font-normal text-slate-500">(optional)</span>
                        </span>
                        <input
                          type="text"
                          value={draft.customerLabel}
                          disabled={creating}
                          onChange={(e) =>
                            updateDraft(draft.key, { customerLabel: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                          data-templates-guided-create-package-customer-label={draft.key}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-slate-700">Description</span>
                        <textarea
                          value={draft.description}
                          disabled={creating}
                          rows={2}
                          onChange={(e) =>
                            updateDraft(draft.key, { description: e.target.value })
                          }
                          className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                          data-templates-guided-create-package-description={draft.key}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Simple estimate uses one prepared estimate — no customer package choices.
                </p>
              )}

              {packageError ? (
                <p className="text-sm text-amber-800" role="status" data-templates-guided-create-package-error>
                  {packageError}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "structure" ? (
            <section data-templates-guided-create-panel-structure="true" className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {GUIDED_CREATE_STEP_LABELS.structure}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Included work and optional upgrades will be prepared from your Catalog links.
                  Adjust items after create.
                </p>
              </div>
              {plan ? (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 space-y-2">
                  <p className="text-sm font-semibold text-slate-900" data-templates-guided-create-package-summary>
                    {formatGuidedPackageSummary(plan)}
                  </p>
                  {plan.defaultPackageLabel ? (
                    <p className="text-xs text-slate-500">
                      Default: {plan.defaultPackageLabel}
                    </p>
                  ) : null}
                  <ul className="mt-2 space-y-1.5">
                    {plan.structureNotes.map((note) => (
                      <li key={note} className="text-sm text-slate-600">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {step === "packet" ? (
            <section data-templates-guided-create-panel-packet="true" className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {GUIDED_CREATE_STEP_LABELS.packet}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Customer-facing pages prepared with this setup. Edit wording after create in
                  Advanced editing.
                </p>
              </div>
              {plan ? (
                <ol className="overflow-hidden rounded-xl ring-1 ring-slate-200/70">
                  {plan.contentAreas.map((area, index) => (
                    <li
                      key={area.label}
                      className="flex gap-3 border-b border-slate-100 bg-slate-50/40 px-3.5 py-2.5 last:border-b-0"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{area.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{area.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ) : null}

          {step === "confirm" ? (
            <section data-templates-guided-create-panel-confirm="true" className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {GUIDED_CREATE_STEP_LABELS.confirm}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Confirm this reusable setup, then create it.
                </p>
              </div>

              {plan ? (
                <div className="space-y-4" data-templates-guided-create-structure-summary="true">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Template
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{plan.name}</p>
                    {plan.description ? (
                      <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Packages
                    </p>
                    <p
                      className="mt-1 text-sm font-semibold text-slate-900"
                      data-templates-guided-create-package-summary
                    >
                      {formatGuidedPackageSummary(plan)}
                    </p>
                    {plan.defaultPackageLabel ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Default package: {plan.defaultPackageLabel}
                      </p>
                    ) : null}
                    {plan.packageDrafts.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {plan.packageDrafts.map((draft) => (
                          <li key={draft.key} className="text-sm text-slate-600">
                            <span className="font-medium text-slate-800">{draft.name}</span>
                            {draft.description ? ` — ${draft.description}` : ""}
                            {draft.isDefault ? " · Default" : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Proposal packet
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {plan.contentAreas.map((area) => (
                        <li key={area.label} className="text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">{area.label}</span>
                          <span className="text-slate-500"> — {area.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-800">
                  Complete template name and package setup before creating.
                </p>
              )}

              {createError ? (
                <p
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                  data-templates-guided-create-error
                >
                  {createError}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={step === "basics" ? onClose : goBack}
            disabled={creating}
            data-templates-guided-create-secondary="true"
          >
            {step === "basics" ? GUIDED_CREATE_CANCEL_ACTION : GUIDED_CREATE_BACK_ACTION}
          </button>

          {step === "confirm" ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-blue-300 bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              disabled={!plan || creating}
              onClick={handleCreate}
              data-templates-guided-create-submit="true"
            >
              {creating ? "Creating…" : GUIDED_CREATE_PRIMARY_ACTION}
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-blue-300 bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              disabled={creating || ((step === "structure" || step === "packet") && !plan)}
              onClick={goNext}
              data-templates-guided-create-continue="true"
            >
              {GUIDED_CREATE_CONTINUE_ACTION}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
