"use client";

import type { ProposalTemplateOption } from "@/app/lib/proposalTemplateTypes";
import {
  canContinueCreateProposal,
  CREATE_PROPOSAL_CONTINUE_TO_BUILDER,
  CREATE_PROPOSAL_HELPER,
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  CREATE_PROPOSAL_MEASUREMENT_READY,
  CREATE_PROPOSAL_MODAL_SUBTITLE,
  CREATE_PROPOSAL_MODAL_TITLE,
  CREATE_PROPOSAL_PACKAGE_BLOCKED,
  CREATE_PROPOSAL_STEPS,
  CREATE_PROPOSAL_TEMPLATE_BLOCKED,
  CREATE_PROPOSAL_USE_MEASUREMENT,
  CREATE_PROPOSAL_USE_TEMPLATE,
  createProposalStepLabel,
  formatCreateProposalIncludedLine,
  formatCreateProposalMeasurementDetail,
  formatCreateProposalTemplateMetaLine,
  nextCreateProposalStep,
  prevCreateProposalStep,
  type CreateProposalModalStep,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import {
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS,
} from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";

export type JobCardCreateProposalModalTemplateChoice = {
  id: string;
  name: string;
  ready: boolean;
  linkedItemCount: number;
  packageCount: number;
};

export type JobCardCreateProposalModalProps = {
  open: boolean;
  step: CreateProposalModalStep;
  onStepChange: (step: CreateProposalModalStep) => void;
  onClose: () => void;

  measurementReady: boolean;
  measurementLabel: string | null;
  measurementQuantitiesLine: string | null;

  templates: JobCardCreateProposalModalTemplateChoice[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  templateReady: boolean;
  selectedTemplateName: string | null;

  packageOptions: ProposalTemplateOption[];
  selectedPackageOptionId: string | null;
  onSelectPackage: (optionId: string) => void;
  packageIssueCount: number;
  selectedPackageName: string | null;

  includedItemCount: number;
  customerFacingLine: string | null;

  createEnabled: boolean;
  creating: boolean;
  createError: string | null;
  onContinueToBuilder: () => void;
};

export function JobCardCreateProposalModal({
  open,
  step,
  onStepChange,
  onClose,
  measurementReady,
  measurementLabel,
  measurementQuantitiesLine,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  templateReady,
  selectedTemplateName,
  packageOptions,
  selectedPackageOptionId,
  onSelectPackage,
  packageIssueCount,
  selectedPackageName,
  includedItemCount,
  customerFacingLine,
  createEnabled,
  creating,
  createError,
  onContinueToBuilder,
}: JobCardCreateProposalModalProps) {
  if (!open) return null;

  const packageSelected =
    packageOptions.length === 0 || Boolean(selectedPackageOptionId);
  const canContinue = canContinueCreateProposal({
    measurementReady,
    templateReady,
    packageSelected,
    packageIssueCount,
    createEnabled,
  });

  const measurementDetail = formatCreateProposalMeasurementDetail({
    selectedLabel: measurementLabel,
    quantitiesLine: measurementQuantitiesLine,
  });
  const selectedTemplateMeta = formatCreateProposalTemplateMetaLine({
    linkedItemCount:
      templates.find((t) => t.id === selectedTemplateId)?.linkedItemCount ??
      includedItemCount,
    packageCount:
      templates.find((t) => t.id === selectedTemplateId)?.packageCount ??
      packageOptions.length,
    ready: templateReady,
  });
  const includedLine = formatCreateProposalIncludedLine({
    includedItemCount,
    customerFacingLine,
  });

  const goNext = () => {
    const next = nextCreateProposalStep(step);
    if (next) onStepChange(next);
  };
  const goBack = () => {
    const prev = prevCreateProposalStep(step);
    if (prev) onStepChange(prev);
  };

  const stepIndex = CREATE_PROPOSAL_STEPS.indexOf(step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      data-jobcard-create-proposal-modal="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jobcard-create-proposal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close create proposal"
        data-jobcard-create-proposal-backdrop="true"
        onClick={onClose}
        disabled={creating}
      />
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        data-jobcard-create-proposal-panel="true"
      >
        <header className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="jobcard-create-proposal-title"
                className="text-lg font-semibold tracking-tight text-slate-900"
              >
                {CREATE_PROPOSAL_MODAL_TITLE}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {CREATE_PROPOSAL_MODAL_SUBTITLE}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
              onClick={onClose}
              disabled={creating}
              data-jobcard-create-proposal-close="true"
            >
              Close
            </button>
          </div>
          <nav
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Create proposal steps"
            data-jobcard-create-proposal-steps="true"
          >
            {CREATE_PROPOSAL_STEPS.map((s, i) => {
              const active = s === step;
              const done = i < stepIndex;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={creating}
                  data-jobcard-create-proposal-step={s}
                  data-active={active ? "true" : "false"}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-blue-600 text-white"
                      : done
                        ? "bg-blue-50 text-blue-800"
                        : "bg-slate-100 text-slate-500"
                  }`}
                  onClick={() => {
                    if (i <= stepIndex || (i === stepIndex + 1 && canAdvanceFrom(step, {
                      measurementReady,
                      templateReady,
                      packageSelected,
                      packageIssueCount,
                    }))) {
                      onStepChange(s);
                    }
                  }}
                >
                  {i + 1}. {createProposalStepLabel(s)}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {step === "measurement" ? (
            <section data-jobcard-create-proposal-panel-measurement="true">
              <h3 className="text-sm font-semibold text-slate-900">
                {createProposalStepLabel("measurement")}
              </h3>
              {measurementReady ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide text-emerald-700"
                    data-jobcard-create-proposal-measurement-ready="true"
                  >
                    {CREATE_PROPOSAL_MEASUREMENT_READY}
                  </p>
                  <p
                    className="mt-1 text-sm font-medium text-slate-900"
                    data-jobcard-create-proposal-measurement-detail="true"
                  >
                    {measurementDetail}
                  </p>
                </div>
              ) : (
                <p
                  className="mt-3 text-sm text-amber-800"
                  data-jobcard-create-proposal-measurement-blocked="true"
                >
                  {CREATE_PROPOSAL_MEASUREMENT_BLOCKED}
                </p>
              )}
            </section>
          ) : null}

          {step === "template" ? (
            <section data-jobcard-create-proposal-panel-template="true">
              <h3 className="text-sm font-semibold text-slate-900">
                {createProposalStepLabel("template")}
              </h3>
              {templates.length === 0 ? (
                <p
                  className="mt-3 text-sm text-amber-800"
                  data-jobcard-create-proposal-template-blocked="true"
                >
                  {CREATE_PROPOSAL_TEMPLATE_BLOCKED}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {templates.map((t) => {
                    const selected = t.id === selectedTemplateId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          data-jobcard-create-proposal-template={t.id}
                          data-selected={selected ? "true" : "false"}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                            selected
                              ? "border-blue-400 bg-blue-50/80 ring-1 ring-blue-200"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                          onClick={() => onSelectTemplate(t.id)}
                          disabled={creating}
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {t.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {formatCreateProposalTemplateMetaLine({
                              linkedItemCount: t.linkedItemCount,
                              packageCount: t.packageCount,
                              ready: t.ready,
                            })}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!templateReady && templates.length > 0 ? (
                <p
                  className="mt-3 text-sm text-amber-800"
                  data-jobcard-create-proposal-template-blocked="true"
                >
                  {CREATE_PROPOSAL_TEMPLATE_BLOCKED}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "package" ? (
            <section data-jobcard-create-proposal-panel-package="true">
              <h3 className="text-sm font-semibold text-slate-900">
                {createProposalStepLabel("package")}
              </h3>
              {packageOptions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  This template does not use packages.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {packageOptions.map((opt) => {
                    const selected = opt.id === selectedPackageOptionId;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-jobcard-create-proposal-package={opt.id}
                        data-package-name={opt.name}
                        data-selected={selected ? "true" : "false"}
                        className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
                          selected
                            ? "border-blue-400 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                        }`}
                        onClick={() => onSelectPackage(opt.id)}
                        disabled={creating}
                      >
                        {opt.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {packageOptions.length > 0 && !selectedPackageOptionId ? (
                <p
                  className="mt-3 text-sm text-amber-800"
                  data-jobcard-create-proposal-package-blocked="true"
                >
                  {CREATE_PROPOSAL_PACKAGE_BLOCKED}
                </p>
              ) : null}
              {packageIssueCount > 0 ? (
                <p
                  className="mt-3 text-sm text-amber-800"
                  data-jobcard-create-proposal-package-issues="true"
                >
                  Finish package setup before continuing.
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "review" ? (
            <section data-jobcard-create-proposal-panel-review="true">
              <h3 className="text-sm font-semibold text-slate-900">
                {createProposalStepLabel("review")}
              </h3>
              <dl className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Measurement</dt>
                  <dd
                    className="text-right font-medium text-slate-900"
                    data-jobcard-create-proposal-review-measurement="true"
                  >
                    {measurementLabel?.trim() || "Measurement report"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Template</dt>
                  <dd
                    className="text-right font-medium text-slate-900"
                    data-jobcard-create-proposal-review-template="true"
                  >
                    {selectedTemplateName?.trim() || "—"}
                  </dd>
                </div>
                {packageOptions.length > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Package</dt>
                    <dd
                      className="text-right font-medium text-slate-900"
                      data-jobcard-create-proposal-review-package="true"
                    >
                      {selectedPackageName?.trim() || "—"}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Included</dt>
                  <dd
                    className="text-right font-medium text-slate-900"
                    data-jobcard-create-proposal-review-included="true"
                  >
                    {includedLine}
                  </dd>
                </div>
              </dl>
              {selectedTemplateMeta ? (
                <p className="mt-2 text-xs text-slate-500">{selectedTemplateMeta}</p>
              ) : null}
              <p className="mt-4 text-sm text-slate-600">{CREATE_PROPOSAL_HELPER}</p>
              {createError ? (
                <p
                  className="mt-3 text-sm text-red-700"
                  data-jobcard-create-proposal-error="true"
                >
                  {createError}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            className={JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS}
            onClick={step === "measurement" ? onClose : goBack}
            disabled={creating}
            data-jobcard-create-proposal-secondary="true"
          >
            {step === "measurement" ? "Cancel" : "Back"}
          </button>
          {step === "measurement" ? (
            <button
              type="button"
              className={JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS}
              disabled={!measurementReady || creating}
              onClick={goNext}
              data-jobcard-create-proposal-use-measurement="true"
            >
              {CREATE_PROPOSAL_USE_MEASUREMENT}
            </button>
          ) : null}
          {step === "template" ? (
            <button
              type="button"
              className={JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS}
              disabled={!templateReady || !selectedTemplateId || creating}
              onClick={goNext}
              data-jobcard-create-proposal-use-template="true"
            >
              {CREATE_PROPOSAL_USE_TEMPLATE}
            </button>
          ) : null}
          {step === "package" ? (
            <button
              type="button"
              className={JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS}
              disabled={
                creating ||
                packageIssueCount > 0 ||
                (packageOptions.length > 0 && !selectedPackageOptionId)
              }
              onClick={goNext}
              data-jobcard-create-proposal-use-package="true"
            >
              Continue
            </button>
          ) : null}
          {step === "review" ? (
            <button
              type="button"
              className={JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS}
              disabled={!canContinue || creating}
              onClick={onContinueToBuilder}
              data-jobcard-create-proposal-continue="true"
            >
              {creating ? "Creating…" : CREATE_PROPOSAL_CONTINUE_TO_BUILDER}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

function canAdvanceFrom(
  step: CreateProposalModalStep,
  gates: {
    measurementReady: boolean;
    templateReady: boolean;
    packageSelected: boolean;
    packageIssueCount: number;
  }
): boolean {
  if (step === "measurement") return gates.measurementReady;
  if (step === "template") return gates.templateReady;
  if (step === "package") {
    return gates.packageSelected && gates.packageIssueCount === 0;
  }
  return false;
}
