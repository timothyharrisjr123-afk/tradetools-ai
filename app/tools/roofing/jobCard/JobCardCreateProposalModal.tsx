"use client";

import type { ProposalTemplateOption } from "@/app/lib/proposalTemplateTypes";
import {
  canContinueCreateProposal,
  CREATE_PROPOSAL_CONTINUE_TO_BUILDER,
  CREATE_PROPOSAL_HELPER,
  CREATE_PROPOSAL_INCLUDED_PRIMARY,
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  CREATE_PROPOSAL_MEASUREMENT_GUIDE,
  CREATE_PROPOSAL_MODAL_SUBTITLE,
  CREATE_PROPOSAL_MODAL_TITLE,
  CREATE_PROPOSAL_PACKAGE_BLOCKED,
  CREATE_PROPOSAL_PACKAGE_GUIDE,
  CREATE_PROPOSAL_PACKAGE_ONE_ONLY,
  CREATE_PROPOSAL_REVIEW_INTRO,
  CREATE_PROPOSAL_REVIEW_TITLE,
  CREATE_PROPOSAL_STEPS,
  CREATE_PROPOSAL_TEMPLATE_BLOCKED,
  CREATE_PROPOSAL_TEMPLATE_GUIDE,
  CREATE_PROPOSAL_TEMPLATE_READY,
  CREATE_PROPOSAL_TEMPLATE_STRUCTURE,
  CREATE_PROPOSAL_USE_MEASUREMENT,
  CREATE_PROPOSAL_USE_TEMPLATE,
  createProposalStepLabel,
  formatCreateProposalMeasurementReviewLine,
  formatCreateProposalMeasurementSummary,
  formatCreateProposalMeasurementTitle,
  formatCreateProposalPricingItemsReady,
  formatCreateProposalTemplateSecondaryDetail,
  nextCreateProposalStep,
  prevCreateProposalStep,
  type CreateProposalMeasurementChoice,
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
  selectedTemplateName: string | null;

  packageOptions: ProposalTemplateOption[];
  selectedPackageOptionId: string | null;
  onSelectPackage: (optionId: string) => void;
  packageIssueCount: number;
  selectedPackageName: string | null;

  includedItemCount: number;

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
  selectedTemplateName,
  packageOptions,
  selectedPackageOptionId,
  onSelectPackage,
  packageIssueCount,
  selectedPackageName,
  includedItemCount,
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

  const reviewMeasurementLine = formatCreateProposalMeasurementReviewLine({
    selectedLabel: measurementLabel,
    roofAreaSqft: measurementRoofAreaSqft,
    wastePercent: measurementWastePercent,
  });
  const pricingReadyLine = formatCreateProposalPricingItemsReady(includedItemCount);

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
        className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        data-jobcard-create-proposal-panel="true"
      >
        <header className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="jobcard-create-proposal-title"
                className="text-xl font-semibold tracking-tight text-slate-900"
              >
                {CREATE_PROPOSAL_MODAL_TITLE}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
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
            className="mt-5 flex flex-wrap gap-2"
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
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
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

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
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
                  <ul className="mt-4 space-y-2" data-jobcard-create-proposal-measurement-list>
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
                                ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-200"
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
                    className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3.5"
                    data-jobcard-create-proposal-measurement-ready="true"
                    data-selected="true"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {measurementCards[0]!.title}
                    </p>
                    <p
                      className="mt-1 text-sm text-slate-600"
                      data-jobcard-create-proposal-measurement-detail="true"
                    >
                      {measurementCards[0]!.summaryLine}
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
                >
                  {CREATE_PROPOSAL_TEMPLATE_BLOCKED}
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {templates.map((t) => {
                    const selected = t.id === selectedTemplateId;
                    const secondary = formatCreateProposalTemplateSecondaryDetail({
                      linkedItemCount: t.linkedItemCount,
                      packageCount: t.packageCount,
                    });
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          data-jobcard-create-proposal-template={t.id}
                          data-selected={selected ? "true" : "false"}
                          className={`w-full rounded-xl border px-4 py-3.5 text-left transition ${
                            selected
                              ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-200"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                          onClick={() => onSelectTemplate(t.id)}
                          disabled={creating}
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {t.name}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">
                            {CREATE_PROPOSAL_TEMPLATE_STRUCTURE}
                          </p>
                          <p
                            className={`mt-2 text-xs font-medium ${
                              t.ready ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            {t.ready ? CREATE_PROPOSAL_TEMPLATE_READY : "Needs attention"}
                          </p>
                          {secondary ? (
                            <p className="mt-1 text-xs text-slate-400">{secondary}</p>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!templateReady && templates.length > 0 ? (
                <p
                  className="mt-4 text-sm text-amber-800"
                  data-jobcard-create-proposal-template-blocked="true"
                >
                  {CREATE_PROPOSAL_TEMPLATE_BLOCKED}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "package" ? (
            <section data-jobcard-create-proposal-panel-package="true">
              <h3 className="text-base font-semibold text-slate-900">
                {createProposalStepLabel("package")}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {CREATE_PROPOSAL_PACKAGE_GUIDE}
              </p>
              {packageOptions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  This template does not use packages.
                </p>
              ) : packageOptions.length === 1 ? (
                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-500">
                    {CREATE_PROPOSAL_PACKAGE_ONE_ONLY}
                  </p>
                  <PackageChoiceCard
                    option={packageOptions[0]!}
                    selected
                    onSelect={onSelectPackage}
                    disabled={creating}
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {packageOptions.map((opt) => (
                    <PackageChoiceCard
                      key={opt.id}
                      option={opt}
                      selected={opt.id === selectedPackageOptionId}
                      onSelect={onSelectPackage}
                      disabled={creating}
                    />
                  ))}
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
              <h3 className="text-base font-semibold text-slate-900">
                {CREATE_PROPOSAL_REVIEW_TITLE}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{CREATE_PROPOSAL_REVIEW_INTRO}</p>
              <div className="mt-5 space-y-4">
                <ReviewBlock
                  label="Measurement"
                  value={reviewMeasurementLine}
                  dataAttr="data-jobcard-create-proposal-review-measurement"
                />
                <ReviewBlock
                  label="Proposal"
                  value={selectedTemplateName?.trim() || "—"}
                  dataAttr="data-jobcard-create-proposal-review-template"
                />
                {packageOptions.length > 0 ? (
                  <ReviewBlock
                    label="Starting package"
                    value={selectedPackageName?.trim() || "—"}
                    dataAttr="data-jobcard-create-proposal-review-package"
                  />
                ) : null}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Included in proposal
                  </p>
                  <p
                    className="mt-1 text-sm font-medium text-slate-900"
                    data-jobcard-create-proposal-review-included="true"
                  >
                    {CREATE_PROPOSAL_INCLUDED_PRIMARY}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{pricingReadyLine}</p>
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

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
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

function PackageChoiceCard({
  option,
  selected,
  onSelect,
  disabled,
}: {
  option: ProposalTemplateOption;
  selected: boolean;
  onSelect: (optionId: string) => void;
  disabled: boolean;
}) {
  const description = (option.description ?? option.customer_label ?? "").trim();
  return (
    <button
      type="button"
      data-jobcard-create-proposal-package={option.id}
      data-package-name={option.name}
      data-selected={selected ? "true" : "false"}
      className={`mt-2 w-full rounded-xl border px-4 py-3.5 text-left transition ${
        selected
          ? "border-blue-500 bg-blue-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
      }`}
      onClick={() => onSelect(option.id)}
      disabled={disabled}
    >
      <p className="text-sm font-semibold">{option.name}</p>
      {description ? (
        <p
          className={`mt-1 text-xs leading-relaxed ${
            selected ? "text-blue-50" : "text-slate-500"
          }`}
        >
          {description}
        </p>
      ) : null}
    </button>
  );
}

function ReviewBlock({
  label,
  value,
  dataAttr,
}: {
  label: string;
  value: string;
  dataAttr:
    | "data-jobcard-create-proposal-review-measurement"
    | "data-jobcard-create-proposal-review-template"
    | "data-jobcard-create-proposal-review-package";
}) {
  const dataProps =
    dataAttr === "data-jobcard-create-proposal-review-measurement"
      ? { "data-jobcard-create-proposal-review-measurement": "true" as const }
      : dataAttr === "data-jobcard-create-proposal-review-template"
        ? { "data-jobcard-create-proposal-review-template": "true" as const }
        : { "data-jobcard-create-proposal-review-package": "true" as const };
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900" {...dataProps}>
        {value}
      </p>
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
