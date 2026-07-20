"use client";

import { useState, type ReactNode } from "react";
import type {
  ProposalSetupAction,
  ProposalSetupChecklistResult,
} from "@/app/lib/proposalSetupChecklist";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import type {
  JobCardDraftOpenSummary,
  JobCardProposalSetupPackages,
} from "./jobCardProposalSetup";
import {
  JOB_CARD_CREATE_ANOTHER_EXPLAINER,
  JOB_CARD_CREATE_ANOTHER_HEADLINE,
  JOB_CARD_CREATE_PROPOSAL_EXPLAINER,
  JOB_CARD_CURRENT_PROPOSAL_LABEL,
  formatContractorProposalTitle,
  formatJobCardDraftUpdatedLabel,
} from "./jobCardProposalSetup";
import JobCardProposalIncludedReview from "./JobCardProposalIncludedReview";

type JobCardProposalSetupCardProps = {
  jobLabel: string;
  measurementReady: boolean;
  measurementLabel: string;
  templateReady: boolean;
  templateName: string | null;
  templates: readonly ProposalTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  packageSetup: JobCardProposalSetupPackages;
  onSelectPackage: (optionId: string) => void;
  checklist: ProposalSetupChecklistResult;
  /** Enable create / create-another CTA (payload + gates). */
  createEnabled: boolean;
  isLaunching?: boolean;
  /** True while force-create is in flight. */
  isCreatingNew?: boolean;
  launchError?: string | null;
  hasExistingDraft: boolean;
  /** When set with hasExistingDraft, shows the current-proposal summary. */
  draftOpenSummary?: JobCardDraftOpenSummary | null;
  fixTemplateHref: string | null;
  fixCatalogHref: string | null;
  onSelectTab: (tab: "overview" | "measurements" | "proposals") => void;
  onNavigate: (href: string) => void;
  onNormalizeJobCard: (href: string) => void;
  /**
   * Open existing draft (reuse path) when a draft exists.
   * When no draft exists, may still be used as legacy create — prefer onCreateNewDraft.
   */
  onCreateOrOpen: () => void;
  /** Always create a distinct new draft (bypass reuse). */
  onCreateNewDraft: () => void;
  onOpenBuilder: (href: string) => void;
};

function CompactRow({
  label,
  detail,
  action,
  children,
  ready,
}: {
  label: string;
  detail: string;
  action?: ReactNode;
  children?: ReactNode;
  ready?: boolean;
}) {
  return (
    <div className="space-y-1.5" data-jobcard-compact-row={label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500">{label}</p>
          <p className="truncate text-[13px] font-medium text-slate-900">{detail}</p>
        </div>
        {ready != null ? (
          <span
            className={`shrink-0 text-[10px] font-semibold ${
              ready ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {ready ? "Ready" : "Needs attention"}
          </span>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
      {children}
    </div>
  );
}

function runSetupAction(
  action: ProposalSetupAction,
  handlers: Pick<
    JobCardProposalSetupCardProps,
    | "onSelectTab"
    | "onNavigate"
    | "onNormalizeJobCard"
    | "onCreateOrOpen"
    | "onCreateNewDraft"
    | "onOpenBuilder"
  >
) {
  if (action.disabled || action.actionType === "none") return;
  if (action.actionType === "job_card_tab" && action.targetTab) {
    handlers.onSelectTab(action.targetTab);
    return;
  }
  if (action.actionType === "normalize_job_card" && action.href) {
    handlers.onNormalizeJobCard(action.href);
    return;
  }
  if (action.actionType === "route" && action.href) {
    handlers.onNavigate(action.href);
    return;
  }
  if (action.actionType === "create_proposal") {
    handlers.onCreateNewDraft();
    return;
  }
  if (action.actionType === "open_builder" && action.href) {
    handlers.onOpenBuilder(action.href);
  }
}

function CreateProposalFields({
  measurementReady,
  measurementLabel,
  templateReady,
  templateName,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  packageSetup,
  onSelectPackage,
  fixTemplateHref,
  onSelectTab,
  onNavigate,
  showTemplatePicker,
  compact,
}: {
  measurementReady: boolean;
  measurementLabel: string;
  templateReady: boolean;
  templateName: string | null;
  templates: readonly ProposalTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  packageSetup: JobCardProposalSetupPackages;
  onSelectPackage: (optionId: string) => void;
  fixTemplateHref: string | null;
  onSelectTab: (tab: "overview" | "measurements" | "proposals") => void;
  onNavigate: (href: string) => void;
  showTemplatePicker: boolean;
  compact: boolean;
}) {
  const [showIncluded, setShowIncluded] = useState(false);
  const packageNeedsAttention =
    packageSetup.selected != null && packageSetup.selected.issueCount > 0;
  const templateStepReady = templateReady && !packageNeedsAttention;
  const includedDetail = packageSetup.selected
    ? `${packageSetup.includedItemCount} item${
        packageSetup.includedItemCount === 1 ? "" : "s"
      }${
        packageSetup.customerFacingLine
          ? ` · ${packageSetup.customerFacingLine}`
          : ""
      }`
    : "Select a package";

  return (
    <div className="space-y-3" data-jobcard-create-fields>
      {!compact || !measurementReady ? (
        <CompactRow
          label="Measurement"
          detail={measurementLabel || "No measurement selected"}
          ready={measurementReady}
          action={
            !measurementReady ? (
              <button
                type="button"
                onClick={() => onSelectTab("measurements")}
                className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              >
                Go to Measurements
              </button>
            ) : null
          }
        />
      ) : (
        <p className="text-[11px] text-slate-500" data-jobcard-measurement-ready-line>
          Measurement ready · {measurementLabel}
        </p>
      )}

      <CompactRow
        label="Template"
        detail={templateName?.trim() || "No template selected"}
        ready={templateStepReady}
        action={
          !templateReady && fixTemplateHref ? (
            <button
              type="button"
              onClick={() => onNavigate(fixTemplateHref)}
              className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
            >
              Fix template
            </button>
          ) : null
        }
      >
        {showTemplatePicker ? (
          <select
            className="mt-1 w-full max-w-md rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-800"
            value={selectedTemplateId ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              if (next) onSelectTemplate(next);
            }}
            data-jobcard-template-select
          >
            {templates.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        ) : null}
      </CompactRow>

      <div data-jobcard-setup-step={3}>
        <p className="text-[11px] font-semibold text-slate-500">Package</p>
        {packageSetup.choices.length > 0 ? (
          <div
            className="mt-1.5 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Package options"
            data-jobcard-package-selector
          >
            {packageSetup.choices.map((choice) => {
              const selected = choice.optionId === packageSetup.selectedOptionId;
              return (
                <button
                  key={choice.optionId}
                  type="button"
                  onClick={() => onSelectPackage(choice.optionId)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">
            Packages appear after a template is ready.
          </p>
        )}
      </div>

      <div data-jobcard-setup-step={4}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Included</p>
            <p className="text-[13px] font-medium text-slate-900">{includedDetail}</p>
          </div>
          {packageSetup.selected ? (
            <button
              type="button"
              onClick={() => setShowIncluded((v) => !v)}
              className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
              data-jobcard-review-included
            >
              {showIncluded ? "Hide" : "Review"}
            </button>
          ) : null}
        </div>
        <div data-jobcard-included-summary>
          <JobCardProposalIncludedReview
            open={showIncluded}
            packageLabel={packageSetup.selected?.label ?? null}
            items={packageSetup.includedItems}
            fixTemplateHref={fixTemplateHref}
            onClose={() => setShowIncluded(false)}
            onFixTemplate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}

export default function JobCardProposalSetupCard({
  jobLabel,
  measurementReady,
  measurementLabel,
  templateReady,
  templateName,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  packageSetup,
  onSelectPackage,
  checklist,
  createEnabled,
  isLaunching,
  isCreatingNew,
  launchError,
  hasExistingDraft,
  draftOpenSummary = null,
  fixTemplateHref,
  fixCatalogHref,
  onSelectTab,
  onNavigate,
  onNormalizeJobCard,
  onCreateOrOpen,
  onCreateNewDraft,
  onOpenBuilder,
}: JobCardProposalSetupCardProps) {
  const primary = checklist.primaryAction;
  const hasDraftSummary = hasExistingDraft && draftOpenSummary != null;
  const setupMode = hasDraftSummary ? "open_and_create" : "create";
  const isLaunchAction =
    primary.actionType === "create_proposal" || primary.actionType === "open_builder";
  const showOpening = Boolean(isLaunching) && !isCreatingNew;
  const showCreating = Boolean(isCreatingNew) || (Boolean(isLaunching) && !hasDraftSummary);

  const packageNeedsAttention =
    packageSetup.selected != null && packageSetup.selected.issueCount > 0;
  const templateStepReady = templateReady && !packageNeedsAttention;
  const createSetupReady =
    measurementReady && templateStepReady && createEnabled && packageSetup.selected != null;

  const showTemplatePicker = templates.length > 1;
  const showBlockers = !hasDraftSummary && !isLaunchAction && !checklist.quiet;
  const updatedLabel = hasDraftSummary
    ? formatJobCardDraftUpdatedLabel(draftOpenSummary.updatedAt)
    : null;
  const displayTitle = hasDraftSummary
    ? formatContractorProposalTitle(draftOpenSummary.title)
    : null;

  const openEnabled = hasDraftSummary && !showOpening && !showCreating;
  const createCtaEnabled =
    !showOpening &&
    !showCreating &&
    (hasDraftSummary
      ? createEnabled
      : !primary.disabled &&
        primary.actionType !== "none" &&
        (primary.actionType !== "create_proposal" || createEnabled));

  const createCtaLabel = showCreating ? "Creating proposal…" : "Create proposal draft";

  return (
    <div
      className="space-y-3"
      data-jobcard-proposal-setup
      data-jobcard-setup-mode={setupMode}
    >
      {hasDraftSummary ? (
        <section
          className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm"
          data-jobcard-existing-draft-card
          aria-labelledby="jobcard-current-proposal-heading"
        >
          <div
            className="flex flex-wrap items-start justify-between gap-3"
            data-jobcard-draft-open-summary
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {JOB_CARD_CURRENT_PROPOSAL_LABEL}
              </p>
              <p
                id="jobcard-current-proposal-heading"
                className="mt-0.5 truncate text-[15px] font-semibold text-slate-950"
                data-jobcard-setup-headline
                title={draftOpenSummary.title ?? undefined}
              >
                {displayTitle}
              </p>
              <p className="mt-1 text-[12px] text-slate-600">
                <span className="font-medium text-slate-800">
                  {draftOpenSummary.packageLabel ?? "Package on file"}
                </span>
                <span className="text-slate-300"> · </span>
                <span data-jobcard-setup-status-pill>{draftOpenSummary.statusLabel}</span>
                {updatedLabel ? (
                  <>
                    <span className="text-slate-300"> · </span>
                    <span>{updatedLabel}</span>
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              disabled={!openEnabled}
              aria-busy={showOpening || undefined}
              onClick={onCreateOrOpen}
              className={
                openEnabled
                  ? "inline-flex shrink-0 items-center rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  : "inline-flex shrink-0 cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400"
              }
              data-jobcard-open-cta
            >
              {showOpening ? "Opening…" : "Open in Builder"}
            </button>
          </div>
        </section>
      ) : null}

      <section
        className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm"
        data-jobcard-create-new-card
        aria-labelledby="jobcard-start-proposal-heading"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              id="jobcard-start-proposal-heading"
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              data-jobcard-create-headline
            >
              {hasDraftSummary ? JOB_CARD_CREATE_ANOTHER_HEADLINE : "Start proposal"}
            </p>
            {!hasDraftSummary ? (
              <p className="mt-0.5 text-[13px] font-semibold text-slate-950">
                {createSetupReady ? "Ready to create draft" : "Needs attention"}
              </p>
            ) : null}
            <p className="mt-0.5 text-[12px] text-slate-600">
              {hasDraftSummary
                ? `For ${jobLabel || "this job"} — choose template and package.`
                : `For ${jobLabel || "this job"} — confirm template and package.`}
            </p>
          </div>
          {!hasDraftSummary ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                createSetupReady
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-amber-50 text-amber-800 ring-amber-200"
              }`}
              data-jobcard-setup-status-pill
            >
              {createSetupReady ? "Ready" : "Needs attention"}
            </span>
          ) : null}
        </div>

        <CreateProposalFields
          measurementReady={measurementReady}
          measurementLabel={measurementLabel}
          templateReady={templateReady}
          templateName={templateName}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={onSelectTemplate}
          packageSetup={packageSetup}
          onSelectPackage={onSelectPackage}
          fixTemplateHref={fixTemplateHref}
          onSelectTab={onSelectTab}
          onNavigate={onNavigate}
          showTemplatePicker={showTemplatePicker}
          compact={hasDraftSummary || measurementReady}
        />

        <div className="mt-3 border-t border-slate-100 pt-3" data-jobcard-setup-cta-zone>
          <p className="text-[11px] leading-snug text-slate-500" data-jobcard-create-explainer>
            {hasDraftSummary
              ? JOB_CARD_CREATE_ANOTHER_EXPLAINER
              : JOB_CARD_CREATE_PROPOSAL_EXPLAINER}
          </p>
          <div className="mt-2">
            <button
              type="button"
              disabled={!createCtaEnabled}
              aria-busy={showCreating || undefined}
              onClick={() => {
                if (hasDraftSummary) {
                  if (!createEnabled) return;
                  onCreateNewDraft();
                  return;
                }
                if (primary.actionType === "create_proposal") {
                  if (!createEnabled) return;
                  onCreateNewDraft();
                  return;
                }
                runSetupAction(primary, {
                  onSelectTab,
                  onNavigate,
                  onNormalizeJobCard,
                  onCreateOrOpen,
                  onCreateNewDraft,
                  onOpenBuilder,
                });
              }}
              className={
                createCtaEnabled
                  ? "inline-flex items-center rounded-md border border-slate-900 bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  : "inline-flex cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-400"
              }
              data-jobcard-create-cta
            >
              {!hasDraftSummary && !isLaunchAction && !showCreating
                ? primary.label
                : createCtaLabel}
            </button>
          </div>
          {!hasDraftSummary && !isLaunchAction ? (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {primary.helperText ?? checklist.statusText}
            </p>
          ) : null}
          {launchError ? <p className="mt-1.5 text-[11px] text-red-600">{launchError}</p> : null}

          {showBlockers ? (
            <div
              className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2"
              data-jobcard-setup-blockers
            >
              <p className="text-[11px] font-semibold text-amber-900">Fix before creating</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {primary.actionType !== "create_proposal" &&
                primary.actionType !== "open_builder" ? (
                  <button
                    type="button"
                    disabled={primary.disabled}
                    onClick={() =>
                      runSetupAction(primary, {
                        onSelectTab,
                        onNavigate,
                        onNormalizeJobCard,
                        onCreateOrOpen,
                        onCreateNewDraft,
                        onOpenBuilder,
                      })
                    }
                    className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    {primary.label}
                  </button>
                ) : null}
                {fixCatalogHref && checklist.activeBlockerId === "catalog" ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(fixCatalogHref)}
                    className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    Open Catalog
                  </button>
                ) : null}
                {fixTemplateHref && checklist.activeBlockerId === "template" ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(fixTemplateHref)}
                    className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    Fix template
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
