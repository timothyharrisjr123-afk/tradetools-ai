"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  PREPARE_PROPOSAL_ADD_MEASUREMENT_LABEL,
  PREPARE_PROPOSAL_FINISH_QUANTITIES_LABEL,
  PREPARE_PROPOSAL_QUANTITY_INCOMPLETE,
  PREPARE_PROPOSAL_CANCEL_LABEL,
  PREPARE_PROPOSAL_CHANGE_LABEL,
  PREPARE_PROPOSAL_CREATE_LABEL,
  PREPARE_PROPOSAL_CREATING_LABEL,
  PREPARE_PROPOSAL_FOOTER,
  PREPARE_PROPOSAL_MEASUREMENT_LABEL,
  PREPARE_PROPOSAL_PACKAGE_LABEL,
  PREPARE_PROPOSAL_SETUP_LABEL,
  PREPARE_PROPOSAL_TITLE,
  buildCreateProposalMeasurementChoice,
  canCreatePrepareProposal,
  formatCreateProposalTemplateSecondaryDetail,
  resolvePrepareProposalExpandedField,
  resolvePrepareProposalMeasurement,
  resolvePrepareProposalPackage,
  resolvePrepareProposalSetup,
  type CreateProposalMeasurementChoice,
  type PrepareProposalFieldId,
  type PrepareProposalFieldView,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import type { JobCardPackageChoice } from "@/app/tools/roofing/jobCard/jobCardProposalSetup";
import JobCardFirstProposalPricing from "@/app/tools/roofing/jobCard/JobCardFirstProposalPricing";
import JobCardFirstProposalPricingRules from "@/app/tools/roofing/jobCard/JobCardFirstProposalPricingRules";
import { JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS } from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import type {
  FirstProposalPricingLine,
  FirstProposalPricingRulesDraft,
} from "@/app/lib/firstProposalPrepare";
import type { PackagePresentationMode } from "@/app/tools/roofing/templates/templatesWorkspaceFlow";

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
  selectedTemplateUnusableReason?: string | null;
  preferredTemplateId: string | null;
  starterTemplateId: string | null;

  packageChoices: readonly JobCardPackageChoice[];
  packagePresentationMode: PackagePresentationMode;
  selectedPackageOptionId: string | null;
  startingPackageOptionId: string | null;
  onSelectPackage: (optionId: string) => void;
  packageGraphReady: boolean;

  createEnabled: boolean;
  creating: boolean;
  createError: string | null;
  onCreateProposal: () => void;
  onAddMeasurement?: () => void;
  unresolvedRequiredQuantityCount?: number | null;

  preparingStructure?: boolean;
  preparingStructureLabel?: string | null;
  structureError?: string | null;

  showFirstProposalPricingRules?: boolean;
  firstProposalPricingRulesDraft?: FirstProposalPricingRulesDraft | null;
  onFirstProposalPricingRulesChange?: (
    patch: Partial<FirstProposalPricingRulesDraft>
  ) => void;
  onSaveFirstProposalPricingRules?: () => void;
  firstProposalPricingRulesSaving?: boolean;
  firstProposalPricingRulesSaveError?: string | null;
  firstProposalPricingRulesComplete?: boolean;

  showFirstProposalPricing?: boolean;
  firstProposalPricingLines?: readonly FirstProposalPricingLine[];
  firstProposalPricingDrafts?: Record<string, string>;
  onFirstProposalPricingDraftChange?: (catalogItemId: string, value: string) => void;
  onSaveFirstProposalPrices?: () => void;
  firstProposalPricingSaving?: boolean;
  firstProposalPricingSaveError?: string | null;
  firstProposalPricingComplete?: boolean;
};

const CANCEL_BUTTON_CLASS =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50";

const CHANGE_BUTTON_CLASS =
  "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50";

const SELECTOR_OFFSET_CLASS = "sm:ml-44 sm:pl-6";

export function JobCardCreateProposalModal({
  open,
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
  preferredTemplateId,
  starterTemplateId,
  packageChoices,
  packagePresentationMode,
  selectedPackageOptionId,
  startingPackageOptionId,
  onSelectPackage,
  packageGraphReady,
  createEnabled,
  creating,
  createError,
  onCreateProposal,
  onAddMeasurement,
  unresolvedRequiredQuantityCount = null,
  preparingStructure = false,
  preparingStructureLabel = null,
  structureError = null,
  showFirstProposalPricingRules = false,
  firstProposalPricingRulesDraft = null,
  onFirstProposalPricingRulesChange,
  onSaveFirstProposalPricingRules,
  firstProposalPricingRulesSaving = false,
  firstProposalPricingRulesSaveError = null,
  firstProposalPricingRulesComplete = true,
  showFirstProposalPricing = false,
  firstProposalPricingLines = [],
  firstProposalPricingDrafts = {},
  onFirstProposalPricingDraftChange,
  onSaveFirstProposalPrices,
  firstProposalPricingSaving = false,
  firstProposalPricingSaveError = null,
  firstProposalPricingComplete = true,
}: JobCardCreateProposalModalProps) {
  const titleId = useId();
  const changeRefs = useRef<Partial<Record<PrepareProposalFieldId, HTMLButtonElement | null>>>(
    {}
  );
  const createRef = useRef<HTMLButtonElement | null>(null);
  const [contractorExpanded, setContractorExpanded] =
    useState<PrepareProposalFieldId | null>(null);
  const [contractorChoseSetup, setContractorChoseSetup] = useState(false);
  const [contractorChosePackage, setContractorChosePackage] = useState(false);

  if (!open) return null;

  const measurementEligible: CreateProposalMeasurementChoice[] =
    measurements.length > 0
      ? measurements.filter((row) => row.ready)
      : measurementReady
        ? [
            buildCreateProposalMeasurementChoice({
              id: selectedMeasurementId ?? "current",
              selectedLabel: measurementLabel,
              roofAreaSqft: measurementRoofAreaSqft,
              wastePercent: measurementWastePercent,
              ready: true,
            }),
          ]
        : [];

  const measurementField = resolvePrepareProposalMeasurement({
    eligible: measurementEligible,
    selectedId: selectedMeasurementId,
  });
  const setupField = resolvePrepareProposalSetup({
    setups: templates,
    preferredId: preferredTemplateId,
    starterId: starterTemplateId,
    explicitId: contractorChoseSetup ? selectedTemplateId : null,
    selectedId: selectedTemplateId,
    selectedUnusableReason:
      templateReady || !selectedTemplateUnusableReason
        ? null
        : selectedTemplateUnusableReason,
  });
  const packageField = resolvePrepareProposalPackage({
    setupState: setupField.state,
    choices: packageChoices,
    startingOptionId: startingPackageOptionId,
    explicitId: contractorChosePackage ? selectedPackageOptionId : null,
    packagePresentationMode,
    graphReady: packageGraphReady,
  });
  const expandedField = resolvePrepareProposalExpandedField({
    measurement: measurementField,
    setup: setupField,
    package: packageField,
    contractorExpanded,
  });
  const canCreate =
    canCreatePrepareProposal({
      measurement: measurementField.state,
      setup: setupField.state,
      package: packageField.state,
      unresolvedRequiredQuantityCount,
    }) &&
    createEnabled &&
    !creating &&
    !preparingStructure &&
    (!showFirstProposalPricingRules || firstProposalPricingRulesComplete) &&
    (!showFirstProposalPricing || firstProposalPricingComplete);

  const measurementQuantityIncomplete =
    (measurementField.state === "prepared" ||
      measurementField.state === "alternative_available") &&
    unresolvedRequiredQuantityCount != null &&
    unresolvedRequiredQuantityCount > 0;

  const restoreFocus = (field: PrepareProposalFieldId) => {
    window.requestAnimationFrame(() => {
      const changeButton = changeRefs.current[field];
      if (changeButton) {
        changeButton.focus();
        return;
      }
      createRef.current?.focus();
    });
  };

  const collapseAfterSelect = (field: PrepareProposalFieldId) => {
    setContractorExpanded(null);
    restoreFocus(field);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-5"
      data-jobcard-create-proposal-modal="true"
      data-jobcard-prepare-proposal="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close prepare proposal"
        data-jobcard-create-proposal-backdrop="true"
        onClick={onClose}
        disabled={creating}
      />
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        data-jobcard-create-proposal-panel="true"
      >
        <header className="px-5 pt-4 sm:px-6 sm:pt-4">
          <div className="flex items-start justify-between gap-3">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              {PREPARE_PROPOSAL_TITLE}
            </h2>
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md px-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
              onClick={onClose}
              disabled={creating}
              data-jobcard-create-proposal-close="true"
            >
              Close
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-1 sm:px-6">
          <PrepareFieldRow
            label={PREPARE_PROPOSAL_MEASUREMENT_LABEL}
            field={measurementField}
            expanded={expandedField === "measurement"}
            creating={creating}
            changeRef={(node) => {
              changeRefs.current.measurement = node;
            }}
            onToggleChange={() =>
              setContractorExpanded((current) =>
                current === "measurement" ? null : "measurement"
              )
            }
            extraAction={
              measurementField.state === "blocked" && onAddMeasurement ? (
                <button
                  type="button"
                  className={CHANGE_BUTTON_CLASS}
                  onClick={onAddMeasurement}
                  disabled={creating}
                  data-jobcard-prepare-add-measurement="true"
                >
                  {PREPARE_PROPOSAL_ADD_MEASUREMENT_LABEL}
                </button>
              ) : measurementQuantityIncomplete && onAddMeasurement ? (
                <button
                  type="button"
                  className={CHANGE_BUTTON_CLASS}
                  onClick={onAddMeasurement}
                  disabled={creating}
                  data-jobcard-prepare-finish-quantities="true"
                >
                  {PREPARE_PROPOSAL_FINISH_QUANTITIES_LABEL}
                </button>
              ) : null
            }
          >
            {expandedField === "measurement" ? (
              <div
                role="radiogroup"
                aria-label={PREPARE_PROPOSAL_MEASUREMENT_LABEL}
                className="divide-y divide-slate-100"
                data-jobcard-prepare-selector="measurement"
                data-jobcard-create-proposal-measurement-list
                onKeyDown={onSelectorKeyDown}
              >
                {measurementEligible.map((row) => {
                  const selected =
                    row.id === (measurementField.preparedId ?? selectedMeasurementId);
                  return (
                    <SelectorOption
                      key={row.id}
                      selected={selected}
                      disabled={creating || !row.ready}
                      label={row.title}
                      detail={row.summaryLine}
                      dataIdAttr="data-jobcard-create-proposal-measurement"
                      optionId={row.id}
                      onSelect={() => {
                        onSelectMeasurement(row.id);
                        collapseAfterSelect("measurement");
                      }}
                    />
                  );
                })}
              </div>
            ) : null}
          </PrepareFieldRow>
          {measurementQuantityIncomplete ? (
            <p
              className="pb-2 text-xs leading-snug text-amber-800 sm:pl-44 sm:ml-6"
              data-jobcard-prepare-quantity-incomplete="true"
            >
              {PREPARE_PROPOSAL_QUANTITY_INCOMPLETE}
            </p>
          ) : null}

          <PrepareFieldRow
            label={PREPARE_PROPOSAL_SETUP_LABEL}
            field={setupField}
            expanded={expandedField === "setup"}
            creating={creating}
            changeRef={(node) => {
              changeRefs.current.setup = node;
            }}
            onToggleChange={() =>
              setContractorExpanded((current) =>
                current === "setup" ? null : "setup"
              )
            }
          >
            {expandedField === "setup" ? (
              <div
                role="radiogroup"
                aria-label={PREPARE_PROPOSAL_SETUP_LABEL}
                className="divide-y divide-slate-100"
                data-jobcard-prepare-selector="setup"
                onKeyDown={onSelectorKeyDown}
              >
                {templates
                  .filter((row) => !row.archived)
                  .map((row) => {
                    const selected =
                      row.id === (setupField.preparedId ?? selectedTemplateId);
                    const secondary = formatCreateProposalTemplateSecondaryDetail({
                      linkedItemCount: row.linkedItemCount,
                      packageCount: row.packageCount,
                      availableUpgradeCount: row.availableUpgradeCount,
                      packageMode: row.packageMode,
                    });
                    return (
                      <SelectorOption
                        key={row.id}
                        selected={selected}
                        disabled={creating}
                        label={row.name}
                        detail={secondary || null}
                        dataIdAttr="data-jobcard-create-proposal-template"
                        optionId={row.id}
                        onSelect={() => {
                          setContractorChoseSetup(true);
                          setContractorChosePackage(false);
                          onSelectTemplate(row.id);
                          collapseAfterSelect("setup");
                        }}
                      />
                    );
                  })}
              </div>
            ) : null}
          </PrepareFieldRow>

          <PrepareFieldRow
            label={PREPARE_PROPOSAL_PACKAGE_LABEL}
            field={packageField}
            expanded={expandedField === "package"}
            creating={creating}
            changeRef={(node) => {
              changeRefs.current.package = node;
            }}
            onToggleChange={() =>
              setContractorExpanded((current) =>
                current === "package" ? null : "package"
              )
            }
            last
          >
            {expandedField === "package" ? (
              <div
                role="radiogroup"
                aria-label={PREPARE_PROPOSAL_PACKAGE_LABEL}
                className="divide-y divide-slate-100"
                data-jobcard-prepare-selector="package"
                data-jobcard-create-proposal-package-cards
                data-jobcard-package-count={packageChoices.length}
                onKeyDown={onSelectorKeyDown}
              >
                {packageChoices.map((choice) => {
                  const selected =
                    choice.optionId ===
                    (packageField.preparedId ?? selectedPackageOptionId);
                  const detail = `${choice.linkedItemCount} included${
                    choice.availableUpgradeCount
                      ? ` · ${choice.availableUpgradeCount} optional upgrade${
                          choice.availableUpgradeCount === 1 ? "" : "s"
                        }`
                      : ""
                  }`;
                  return (
                    <SelectorOption
                      key={choice.optionId}
                      selected={selected}
                      disabled={creating}
                      label={choice.label}
                      detail={detail}
                      dataIdAttr="data-jobcard-create-proposal-package"
                      optionId={choice.optionId}
                      extraData={{
                        "data-package-name": choice.label,
                        "data-jobcard-create-proposal-package-counts": "true",
                      }}
                      onSelect={() => {
                        setContractorChosePackage(true);
                        onSelectPackage(choice.optionId);
                        collapseAfterSelect("package");
                      }}
                    />
                  );
                })}
              </div>
            ) : null}
          </PrepareFieldRow>

          {preparingStructure ? (
            <p
              className="py-3 text-sm text-slate-600"
              data-first-proposal-preparing="true"
            >
              {preparingStructureLabel ?? "Preparing proposal…"}
            </p>
          ) : null}

          {structureError ? (
            <p
              className="py-2 text-sm text-rose-600"
              role="alert"
              data-first-proposal-structure-error="true"
            >
              {structureError}
            </p>
          ) : null}

          {showFirstProposalPricingRules &&
          firstProposalPricingRulesDraft &&
          onFirstProposalPricingRulesChange &&
          onSaveFirstProposalPricingRules ? (
            <div className="py-3">
              <JobCardFirstProposalPricingRules
                draft={firstProposalPricingRulesDraft}
                onChange={onFirstProposalPricingRulesChange}
                onSave={onSaveFirstProposalPricingRules}
                saving={firstProposalPricingRulesSaving}
                saveError={firstProposalPricingRulesSaveError}
                configured={false}
              />
            </div>
          ) : null}

          {showFirstProposalPricing &&
          onFirstProposalPricingDraftChange &&
          onSaveFirstProposalPrices ? (
            <div className="py-3">
              <JobCardFirstProposalPricing
                lines={firstProposalPricingLines}
                draftPrices={firstProposalPricingDrafts}
                onDraftChange={onFirstProposalPricingDraftChange}
                onSaveAll={onSaveFirstProposalPrices}
                saving={firstProposalPricingSaving}
                saveError={firstProposalPricingSaveError}
                allPriced={firstProposalPricingComplete}
              />
            </div>
          ) : null}
        </div>

        <footer className="px-5 pb-4 pt-3 sm:px-6 sm:pb-4">
          <p className="text-xs leading-snug text-slate-500">
            {PREPARE_PROPOSAL_FOOTER}
          </p>
          {createError ? (
            <p
              className="mt-2 text-sm text-red-700"
              data-jobcard-create-proposal-error="true"
              data-jobcard-prepare-error="true"
            >
              {createError}
            </p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              className={CANCEL_BUTTON_CLASS}
              onClick={onClose}
              disabled={creating}
              data-jobcard-create-proposal-secondary="true"
              data-jobcard-prepare-cancel="true"
            >
              {PREPARE_PROPOSAL_CANCEL_LABEL}
            </button>
            <button
              ref={createRef}
              type="button"
              className={`${JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS} min-h-[44px]`}
              disabled={!canCreate}
              onClick={onCreateProposal}
              data-jobcard-create-proposal-continue="true"
              data-jobcard-prepare-create="true"
              data-unresolved-required-quantities={
                unresolvedRequiredQuantityCount == null
                  ? undefined
                  : String(unresolvedRequiredQuantityCount)
              }
            >
              {creating ? PREPARE_PROPOSAL_CREATING_LABEL : PREPARE_PROPOSAL_CREATE_LABEL}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PrepareFieldRow({
  label,
  field,
  expanded,
  creating,
  last = false,
  changeRef,
  onToggleChange,
  extraAction = null,
  children,
}: {
  label: string;
  field: PrepareProposalFieldView;
  expanded: boolean;
  creating: boolean;
  last?: boolean;
  changeRef: (node: HTMLButtonElement | null) => void;
  onToggleChange: () => void;
  extraAction?: ReactNode;
  children?: ReactNode;
}) {
  const blocked = field.state === "blocked";
  return (
    <section
      className={`py-2.5 ${last ? "" : "border-b border-slate-100"}`}
      data-jobcard-prepare-field={field.field}
      data-jobcard-prepare-state={field.state}
      data-jobcard-create-proposal-panel-measurement={
        field.field === "measurement" ? "true" : undefined
      }
      data-jobcard-create-proposal-panel-template={
        field.field === "setup" ? "true" : undefined
      }
      data-jobcard-create-proposal-panel-package={
        field.field === "package" ? "true" : undefined
      }
    >
      <div className="flex items-start gap-3 sm:items-center">
        <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-6">
          <p className="text-sm text-slate-500 sm:w-44 sm:shrink-0">{label}</p>
          <div className="mt-0.5 min-w-0 sm:mt-0">
            {field.valueLabel ? (
              <p className="text-sm font-medium text-slate-900">{field.valueLabel}</p>
            ) : blocked ? null : (
              <p className="text-sm text-slate-400">—</p>
            )}
            {field.valueDetail && !expanded ? (
              <p className="mt-0.5 text-xs leading-snug text-slate-500">
                {field.valueDetail}
              </p>
            ) : null}
            {blocked && field.fixPath ? (
              <p
                className="mt-0.5 text-xs leading-snug text-amber-800"
                data-jobcard-prepare-fix={field.field}
                data-jobcard-create-proposal-measurement-blocked={
                  field.field === "measurement" ? "true" : undefined
                }
                data-jobcard-create-proposal-template-blocked={
                  field.field === "setup" ? "true" : undefined
                }
                data-jobcard-create-proposal-package-blocked={
                  field.field === "package" ? "true" : undefined
                }
              >
                {field.fixPath}
              </p>
            ) : null}
          </div>
        </div>
        {extraAction}
        {field.showChange ? (
          <button
            ref={changeRef}
            type="button"
            className={CHANGE_BUTTON_CLASS}
            onClick={onToggleChange}
            disabled={creating}
            aria-expanded={expanded}
            data-jobcard-prepare-change={field.field}
          >
            {PREPARE_PROPOSAL_CHANGE_LABEL}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className={`mt-1 ${SELECTOR_OFFSET_CLASS}`}>{children}</div>
      ) : null}
    </section>
  );
}

function SelectorOption({
  selected,
  disabled,
  label,
  detail,
  optionId,
  dataIdAttr,
  extraData,
  onSelect,
}: {
  selected: boolean;
  disabled: boolean;
  label: string;
  detail?: string | null;
  optionId: string;
  dataIdAttr: string;
  extraData?: Record<string, string>;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      {...{ [dataIdAttr]: optionId }}
      {...extraData}
      data-selected={selected ? "true" : "false"}
      className={`flex min-h-[44px] w-full items-start gap-2.5 py-2 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "bg-slate-50/70" : ""
      }`}
    >
      <span
        aria-hidden="true"
        data-jobcard-prepare-radio={selected ? "selected" : "idle"}
        className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-slate-900" : "border-slate-300"
        }`}
      >
        {selected ? (
          <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 pt-px">
        <span
          className={`block text-sm leading-snug ${
            selected ? "font-semibold text-slate-900" : "font-medium text-slate-800"
          }`}
        >
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-xs leading-snug text-slate-500">
            {detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function onSelectorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (
    event.key !== "ArrowDown" &&
    event.key !== "ArrowRight" &&
    event.key !== "ArrowUp" &&
    event.key !== "ArrowLeft" &&
    event.key !== "Home" &&
    event.key !== "End"
  ) {
    return;
  }
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not([disabled])'
    )
  );
  if (radios.length === 0) return;
  const index = radios.findIndex((el) => el === document.activeElement);
  let nextIndex = 0;
  if (event.key === "End") {
    nextIndex = radios.length - 1;
  } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    nextIndex = index < 0 ? 0 : (index + 1) % radios.length;
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    nextIndex =
      index < 0
        ? radios.length - 1
        : (index - 1 + radios.length) % radios.length;
  }
  event.preventDefault();
  radios[nextIndex]?.focus();
}
