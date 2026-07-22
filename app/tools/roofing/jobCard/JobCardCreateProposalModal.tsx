"use client";

import {
  canContinueCreateProposal,
  CREATE_PROPOSAL_CONTINUE_TO_BUILDER,
  CREATE_PROPOSAL_HELPER,
  CREATE_PROPOSAL_INCLUDED_LABEL,
  CREATE_PROPOSAL_INCLUDED_PRIMARY,
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  CREATE_PROPOSAL_MEASUREMENT_GUIDE,
  CREATE_PROPOSAL_MODAL_SUBTITLE,
  CREATE_PROPOSAL_MODAL_TITLE,
  CREATE_PROPOSAL_PACKAGE_BLOCKED,
  CREATE_PROPOSAL_PACKAGE_BUILDER_NOTE,
  CREATE_PROPOSAL_REVIEW_INTRO,
  CREATE_PROPOSAL_REVIEW_NEXT,
  CREATE_PROPOSAL_REVIEW_NEXT_LABEL,
  CREATE_PROPOSAL_REVIEW_TITLE,
  CREATE_PROPOSAL_STEPS,
  CREATE_PROPOSAL_TEMPLATE_BLOCKED,
  CREATE_PROPOSAL_TEMPLATE_GUIDE,
  CREATE_PROPOSAL_TEMPLATE_READY,
  CREATE_PROPOSAL_TEMPLATE_STRUCTURE,
  CREATE_PROPOSAL_USE_MEASUREMENT,
  CREATE_PROPOSAL_USE_TEMPLATE,
  createProposalStepLabel,
  formatCreateProposalMeasurementSummary,
  formatCreateProposalMeasurementTitle,
  formatCreateProposalPackageCountLine,
  formatCreateProposalPackageReviewLine,
  formatCreateProposalReviewScopeLine,
  formatCreateProposalTemplateSecondaryDetail,
  nextCreateProposalStep,
  prevCreateProposalStep,
  resolveCreateProposalPackageStepEyebrow,
  resolveCreateProposalPackageStepGuide,
  resolveCreateProposalTemplateStepMessage,
  type CreateProposalMeasurementChoice,
  type CreateProposalModalStep,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import type { JobCardPackageChoice } from "@/app/tools/roofing/jobCard/jobCardProposalSetup";
import {
  JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS,
  JOB_CARD_PROPOSALS_SECONDARY_BUTTON_CLASS,
} from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import type { PackagePresentationMode } from "@/app/tools/roofing/templates/templatesWorkspaceFlow";
import {
  packageChoiceGridClass,
  TEMPLATES_SIMPLE_ESTIMATE_LABEL,
} from "@/app/tools/roofing/templates/templatesWorkspaceFlow";

export type JobCardCreateProposalModalTemplateChoice = {
  id: string;
  name: string;
  ready: boolean;
  linkedItemCount: number;
  packageCount: number;
  availableUpgradeCount: number;
  packageMode: PackagePresentationMode;
  archived?: boolean;
};

export type JobCardCreateProposalModalProps = {
  open: boolean;
  step: CreateProposalModalStep;
  onStepChange: (step: CreateProposalModalStep) => void;
  onClose: () => void;

  measurements: readonly CreateProposalMeasurementChoice[];
  selectedMeasurementId: string | null;
  onSelectMeasurement: (measurementId: string) => void;
  measurementReady: boolean;
  measurementLabel: string | null;
  measurementRoofAreaSqft: number | null;
  measurementWastePercent: number | null;

  templates: JobCardCreateProposalModalTemplateChoice[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  templateReady: boolean;
  /** Quiet reason when selected template graph is loaded but not usable. */
  selectedTemplateUnusableReason?: string | null;
  selectedTemplateName: string | null;

  packageChoices: readonly JobCardPackageChoice[];
  packagePresentationMode: PackagePresentationMode;
  selectedPackageOptionId: string | null;
  onSelectPackage: (optionId: string) => void;
  packageIssueCount: number;
  selectedPackageName: string | null;

  includedItemCount: number;
  availableUpgradeCount: number;

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
  measurements,
  selectedMeasurementId,
  onSelectMeasurement,
  measurementReady,
  measurementLabel,
  measurementRoofAreaSqft,
  measurementWastePercent,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  templateReady,
  selectedTemplateUnusableReason = null,
  selectedTemplateName,
  packageChoices,
  packagePresentationMode,
  selectedPackageOptionId,
  onSelectPackage,
  packageIssueCount,
  selectedPackageName,
  includedItemCount,
  availableUpgradeCount,
  createEnabled,
  creating,
  createError,
  onContinueToBuilder,
}: JobCardCreateProposalModalProps) {
  if (!open) return null;

  const packageSelected =
    packageChoices.length === 0 || Boolean(selectedPackageOptionId);
  const canContinue = canContinueCreateProposal({
    measurementReady,
    templateReady,
    packageSelected,
    packageIssueCount,
    createEnabled,
  });
  const templateStepMessage = resolveCreateProposalTemplateStepMessage({
    templatesLength: templates.length,
    selectedTemplateId,
    templateReady,
    selectedUnusableReason: selectedTemplateUnusableReason,
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
  const measurementCards: CreateProposalMeasurementChoice[] =
    measurements.length > 0
      ? [...measurements]
      : measurementReady
        ? [
            {
              id: selectedMeasurementId ?? "current",
              title: formatCreateProposalMeasurementTitle(measurementLabel),
              summaryLine: formatCreateProposalMeasurementSummary({
                roofAreaSqft: measurementRoofAreaSqft,
                wastePercent: measurementWastePercent,
                ready: true,
              }),
              ready: true,
            },
          ]
        : [];

  const packageEyebrow = resolveCreateProposalPackageStepEyebrow(
    packagePresentationMode,
    packageChoices.length
  );
  const modalMaxWidthClass =
    step === "package" && packageChoices.length >= 4
      ? "max-w-3xl"
      : step === "package" && packageChoices.length >= 2
        ? "max-w-2xl"
        : "max-w-xl";
  const packageGridClass =
    packageChoices.length >= 4
      ? "grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2"
      : packageChoiceGridClass(packageChoices.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-5"
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
        className={`relative z-10 flex max-h-[92vh] w-full ${modalMaxWidthClass} flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl`}
        data-jobcard-create-proposal-panel="true"
        data-jobcard-create-proposal-panel-width={
          step === "package" && packageChoices.length >= 4
            ? "wide"
            : step === "package" && packageChoices.length >= 2
              ? "medium"
              : "default"
        }
      >
        <header className="border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="jobcard-create-proposal-title"
                className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
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
            className="mt-4 flex flex-wrap gap-1.5"
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
                    if (
                      i <= stepIndex ||
                      (i === stepIndex + 1 &&
                        canAdvanceFrom(step, {
                          measurementReady,
                          templateReady,
                          packageSelected,
                          packageIssueCount,
                        }))
                    ) {
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {step === "measurement" ? (
            <section data-jobcard-create-proposal-panel-measurement="true">
              <h3 className="text-base font-semibold text-slate-900">
                {createProposalStepLabel("measurement")}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {CREATE_PROPOSAL_MEASUREMENT_GUIDE}
              </p>
              {measurementReady && measurementCards.length > 0 ? (
                measurementCards.length > 1 ? (
                  <ul
                    className="mt-4 space-y-2"
                    data-jobcard-create-proposal-measurement-list
                  >
                    {measurementCards.map((m) => {
                      const selected = m.id === selectedMeasurementId;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            data-jobcard-create-proposal-measurement={m.id}
                            data-selected={selected ? "true" : "false"}
                            className={`w-full rounded-xl border px-4 py-3.5 text-left transition ${
                              selected
                                ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                            onClick={() => onSelectMeasurement(m.id)}
                            disabled={creating || !m.ready}
                          >
                            <p className="text-sm font-semibold text-slate-900">
                              {m.title}
                            </p>
                            <p
                              className="mt-1 text-sm text-slate-600"
                              data-jobcard-create-proposal-measurement-detail="true"
                            >
                              {m.summaryLine}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div
                    className="mt-4 rounded-xl border border-blue-300 bg-gradient-to-b from-blue-50/80 to-white px-4 py-4 ring-1 ring-blue-100"
                    data-jobcard-create-proposal-measurement-ready="true"
                    data-selected="true"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {measurementCards[0]!.title}
                      </p>
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                        Ready
                      </span>
                    </div>
                    <p
                      className="mt-1.5 text-sm text-slate-600"
                      data-jobcard-create-proposal-measurement-detail="true"
                    >
                      {measurementCards[0]!.summaryLine}
                    </p>
                    <p className="mt-2.5 text-xs text-slate-500">
                      Next: choose a reusable proposal setup for this job.
                    </p>
                  </div>
                )
              ) : (
                <p
                  className="mt-4 text-sm text-amber-800"
                  data-jobcard-create-proposal-measurement-blocked="true"
                >
                  {CREATE_PROPOSAL_MEASUREMENT_BLOCKED}
                </p>
              )}
            </section>
          ) : null}

          {step === "template" ? (
            <section data-jobcard-create-proposal-panel-template="true">
              <h3 className="text-base font-semibold text-slate-900">
                {createProposalStepLabel("template")}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {CREATE_PROPOSAL_TEMPLATE_GUIDE}
              </p>
              {templates.length === 0 ? (
                <p
                  className="mt-4 text-sm text-amber-800"
                  data-jobcard-create-proposal-template-blocked="true"
                  data-jobcard-create-proposal-template-message="none"
                >
                  {CREATE_PROPOSAL_TEMPLATE_BLOCKED}
                </p>
              ) : (
                <>
                  <ul className="mt-4 space-y-2">
                    {templates.map((t) => {
                      const selected = t.id === selectedTemplateId;
                      const secondary = formatCreateProposalTemplateSecondaryDetail({
                        linkedItemCount: t.linkedItemCount,
                        packageCount: t.packageCount,
                        availableUpgradeCount: t.availableUpgradeCount,
                        packageMode: t.packageMode,
                      });
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            data-jobcard-create-proposal-template={t.id}
                            data-selected={selected ? "true" : "false"}
                            data-archived={t.archived ? "true" : "false"}
                            className={`w-full rounded-xl border px-4 py-3.5 text-left transition ${
                              t.archived ? "opacity-60" : ""
                            } ${
                              selected
                                ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                            onClick={() => onSelectTemplate(t.id)}
                            disabled={creating}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {t.name}
                              </p>
                              {t.archived ? (
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  Archived
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">
                              {CREATE_PROPOSAL_TEMPLATE_STRUCTURE}
                            </p>
                            <p
                              className={`mt-2 text-xs font-medium ${
                                t.ready ? "text-emerald-700" : "text-amber-700"
                              }`}
                            >
                              {t.ready
                                ? CREATE_PROPOSAL_TEMPLATE_READY
                                : "Needs attention"}
                            </p>
                            {secondary ? (
                              <p
                                className="mt-1 text-xs text-slate-500"
                                data-jobcard-create-proposal-template-counts
                              >
                                {secondary}
                              </p>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {templateStepMessage ? (
                    <p
                      className="mt-4 text-sm text-amber-800"
                      data-jobcard-create-proposal-template-blocked="true"
                      data-jobcard-create-proposal-template-message="selected-unusable"
                    >
                      {templateStepMessage}
                    </p>
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          {step === "package" ? (
            <section data-jobcard-create-proposal-panel-package="true">
              <h3 className="text-base font-semibold text-slate-900">
                {createProposalStepLabel("package")}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {resolveCreateProposalPackageStepGuide(
                  packagePresentationMode,
                  packageChoices.length
                )}
              </p>
              {packageChoices.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  This template does not use packages yet.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  <p
                    className="text-xs font-medium text-slate-500"
                    data-jobcard-create-proposal-package-eyebrow
                    data-package-mode={packagePresentationMode}
                  >
                    {packageEyebrow}
                  </p>
                  {packagePresentationMode === "simple" ? (
                    <div
                      className="rounded-xl border border-blue-300 bg-blue-50/60 px-4 py-3.5 ring-1 ring-blue-200"
                      data-jobcard-create-proposal-package-simple="true"
                      data-selected="true"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {TEMPLATES_SIMPLE_ESTIMATE_LABEL}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {formatCreateProposalPackageCountLine({
                          linkedItemCount:
                            packageChoices[0]?.linkedItemCount ??
                            includedItemCount,
                          availableUpgradeCount:
                            packageChoices[0]?.availableUpgradeCount ?? 0,
                        })}
                      </p>
                      {packageChoices[0]?.description ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                          {packageChoices[0].description}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className={packageGridClass}
                      data-jobcard-create-proposal-package-cards
                      data-jobcard-package-count={packageChoices.length}
                    >
                      {packageChoices.map((choice) => (
                        <PackageChoiceCard
                          key={choice.optionId}
                          choice={choice}
                          selected={choice.optionId === selectedPackageOptionId}
                          onSelect={onSelectPackage}
                          disabled={creating}
                          compact={packageChoices.length >= 4}
                        />
                      ))}
                    </div>
                  )}
                  <p
                    className="pt-1 text-xs text-slate-500"
                    data-jobcard-create-proposal-package-builder-note
                  >
                    {CREATE_PROPOSAL_PACKAGE_BUILDER_NOTE}
                  </p>
                </div>
              )}
              {packagePresentationMode !== "simple" &&
              packageChoices.length > 0 &&
              !selectedPackageOptionId ? (
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
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                {CREATE_PROPOSAL_REVIEW_TITLE}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {CREATE_PROPOSAL_REVIEW_INTRO}
              </p>
              <div className="mt-5 space-y-4">
                <div
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3"
                  data-jobcard-create-proposal-review-measurement="true"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Measurement
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCreateProposalMeasurementTitle(measurementLabel)}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {formatCreateProposalMeasurementSummary({
                      roofAreaSqft: measurementRoofAreaSqft,
                      wastePercent: measurementWastePercent,
                      ready: true,
                    })}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Reusable setup
                  </p>
                  <p
                    className="mt-1 text-sm font-semibold text-slate-900"
                    data-jobcard-create-proposal-review-template="true"
                  >
                    {selectedTemplateName?.trim() || "Proposal template"}
                  </p>
                  <p
                    className="mt-0.5 text-sm text-slate-600"
                    data-jobcard-create-proposal-review-package="true"
                  >
                    {formatCreateProposalPackageReviewLine({
                      packageMode: packagePresentationMode,
                      packageName: selectedPackageName,
                    })}
                  </p>
                  <p
                    className="mt-1 text-xs text-slate-500"
                    data-jobcard-create-proposal-review-scope="true"
                  >
                    {formatCreateProposalReviewScopeLine({
                      includedItemCount,
                      availableUpgradeCount,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {CREATE_PROPOSAL_INCLUDED_LABEL}
                  </p>
                  <p
                    className="mt-1 text-sm leading-relaxed text-slate-700"
                    data-jobcard-create-proposal-review-included="true"
                  >
                    {CREATE_PROPOSAL_INCLUDED_PRIMARY}
                  </p>
                </div>
                <div
                  className="rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3"
                  data-jobcard-create-proposal-review-next="true"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800/80">
                    {CREATE_PROPOSAL_REVIEW_NEXT_LABEL}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">
                    {CREATE_PROPOSAL_REVIEW_NEXT}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm text-slate-500">{CREATE_PROPOSAL_HELPER}</p>
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

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
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
                (packagePresentationMode !== "simple" &&
                  packageChoices.length > 0 &&
                  !selectedPackageOptionId)
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

function PackageChoiceCard({
  choice,
  selected,
  onSelect,
  disabled,
  compact = false,
}: {
  choice: JobCardPackageChoice;
  selected: boolean;
  onSelect: (optionId: string) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const countLine = formatCreateProposalPackageCountLine({
    linkedItemCount: choice.linkedItemCount,
    availableUpgradeCount: choice.availableUpgradeCount,
    issueCount: choice.issueCount,
  });
  const shortHighlights = choice.highlightLabels.slice(0, 2);
  return (
    <button
      type="button"
      data-jobcard-create-proposal-package={choice.optionId}
      data-package-name={choice.label}
      data-package-included={choice.linkedItemCount}
      data-package-upgrades={choice.availableUpgradeCount}
      data-selected={selected ? "true" : "false"}
      className={`h-full w-full rounded-xl border px-3.5 py-3 text-left transition ${
        selected
          ? "border-blue-400 bg-white shadow-sm ring-2 ring-blue-100 text-slate-900"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
      }`}
      onClick={() => onSelect(choice.optionId)}
      disabled={disabled}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-900">{choice.label}</p>
        {selected ? (
          <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            Selected
          </span>
        ) : null}
      </div>
      <p
        className="mt-1 text-xs font-medium text-slate-600"
        data-jobcard-create-proposal-package-counts
      >
        {countLine}
      </p>
      {choice.description ? (
        <p
          className={`mt-1.5 text-xs leading-snug text-slate-500 ${
            compact ? "line-clamp-2" : ""
          }`}
        >
          {choice.description}
        </p>
      ) : null}
      {!compact && shortHighlights.length > 0 ? (
        <p
          className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-400"
          data-jobcard-create-proposal-package-highlights
        >
          Includes {shortHighlights.join(", ")}
          {choice.linkedItemCount > shortHighlights.length ? "…" : ""}
        </p>
      ) : null}
    </button>
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
